"""
Interpolation Engine — 60 Hz asyncio loop that smoothly transitions macro values
toward a target and dispatches them via OSC every tick.

Design notes
------------
- Progress is tracked with time.monotonic() (not tick count) to avoid drift.
- Easing: smoothstep  f(t) = t² * (3 - 2t)
  When duration < 0.5 s the engine uses linear interpolation for "snap" transitions.
- Overridden fields are pinned at their slider value and excluded from interpolation.
- All state access stays on the asyncio event loop; no locking required.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from .models import OrchestratorStatus, CalibrationRequest
from .osc_dispatcher import OscDispatcher

logger = logging.getLogger(__name__)

TICK_RATE = 60  # Hz


def _smoothstep(t: float) -> float:
    """Smoothstep easing: t² * (3 - 2t).  Input clamped to [0, 1]."""
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


@dataclass
class _CalibrationRange:
    min_val: float = 0.0
    max_val: float = 1.0
    native_min: float = 0.0
    native_max: float = 1.0

    def apply(self, v: float) -> float:
        """
        Map value from native range [native_min, native_max] 
        to calibrated output range [min_val, max_val].
        """
        # 1. Normalize native value to [0, 1]
        denom = (self.native_max - self.native_min)
        norm_v = (v - self.native_min) / denom if denom != 0 else 0.0
        # 2. Map to calibrated range
        return self.min_val + norm_v * (self.max_val - self.min_val)


class InterpolationEngine:
    """
    Singleton-style engine started once in the FastAPI lifespan.

    Usage
    -----
        engine = InterpolationEngine()
        engine.start()   # inside lifespan, after yield is set up
        ...
        engine.stop()    # in lifespan finally block
    """

    def __init__(self) -> None:
        self.reinitialize()
        self._dispatcher = OscDispatcher()

    def reinitialize(self) -> None:
        """Reload configuration and models when variables change."""
        from .models import MacroState, MacroTarget
        from .config import load_variables
        self.current = MacroState()
        self.target = MacroTarget()
        self._task: asyncio.Task | None = getattr(self, "_task", None)
        self._override: dict[str, float] = {}   # field → pinned value
        self._transition_start: float = 0.0
        self._start_state = MacroState()
        
        # Load ranges for clamping
        variables = load_variables()
        self._ranges = {
            v["name"]: (v.get("min", 0.0), v.get("max", 1.0))
            for v in variables if v["type"] == "numeric"
        }
        
        self._calibration: dict[str, _CalibrationRange] = {
            f: _CalibrationRange(
                min_val=v_min, 
                max_val=v_max, 
                native_min=v_min, 
                native_max=v_max
            ) for f, (v_min, v_max) in self._ranges.items()
        }
        logger.info("Interpolation engine (re)initialized with current macro fields.")

    # ------------------------------------------------------------------
    # Public API (called from router handlers — all on the event loop)
    # ------------------------------------------------------------------

    async def set_target(self, target: Any) -> None:
        """Accept a new target from the LLM or a direct caller."""
        from .models import MacroState
        from .config import get_macro_config
        _, string_fields, _ = get_macro_config()
        self._start_state = MacroState(**self.current.model_dump())
        self.target = target
        self._transition_start = time.monotonic()
        
        # Immediately update string fields (they don't interpolate)
        for f in string_fields:
            if hasattr(target, f):
                setattr(self.current, f, getattr(target, f))
            
        logger.info(
            f"New target set: {target.model_dump()} "
            f"(duration={getattr(target, 'duration', 4.0)}s)"
        )

    def hard_override(self, field: str, value: float) -> None:
        """Pin a field to a manual slider value (excludes it from interpolation)."""
        if field not in self._ranges:
            raise ValueError(f"Unknown numeric macro field: {field!r}")
        
        v_min, v_max = self._ranges[field]
        self._override[field] = max(v_min, min(v_max, value))
        setattr(self.current, field, self._override[field])

    def release_override(self, field: str) -> None:
        """Release a pinned field back to interpolation."""
        if field not in self._ranges:
            raise ValueError(f"Unknown macro field: {field!r}")
        self._override.pop(field, None)

    def apply_calibration(self, cal: CalibrationRequest) -> None:
        """Update per-macro output clamping ranges."""
        for f, (v_min, v_max) in self._ranges.items():
            min_attr = f"{f}_min"
            max_attr = f"{f}_max"
            if hasattr(cal, min_attr) and hasattr(cal, max_attr):
                self._calibration[f] = _CalibrationRange(
                    min_val=getattr(cal, min_attr), 
                    max_val=getattr(cal, max_attr),
                    native_min=v_min,
                    native_max=v_max
                )

    def get_status(self) -> OrchestratorStatus:
        elapsed = time.monotonic() - self._transition_start
        # Handle case where duration might be 0 or very small
        duration = getattr(self.target, "duration", 4.0)
        is_interp = elapsed < duration
        
        return OrchestratorStatus(
            current=self.current.model_dump(),
            target=self.target.model_dump(),
            is_interpolating=is_interp,
            elapsed_seconds=elapsed,
            pinned_fields=list(self._override.keys()),
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Schedule the 60 Hz loop as an asyncio Task."""
        self._task = asyncio.create_task(self._loop(), name="orchestrator-60hz")
        logger.info("Interpolation engine started (60 Hz loop)")

    def stop(self) -> None:
        """Cancel the loop task; called in lifespan finally block."""
        if self._task and not self._task.done():
            self._task.cancel()
            logger.info("Interpolation engine stopped")

    # ------------------------------------------------------------------
    # Internal 60 Hz loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        try:
            while True:
                tick_start = time.monotonic()

                elapsed = tick_start - self._transition_start
                duration = max(getattr(self.target, "duration", 4.0), 1e-6)

                if elapsed < duration:
                    raw_t = elapsed / duration
                    # Use linear for very short "snap" transitions
                    eased_t = raw_t if duration < 0.5 else _smoothstep(raw_t)

                    for f, (v_min, v_max) in self._ranges.items():
                        if f in self._override:
                            continue  # pinned
                        field_default = self.current.model_fields[f].default if f in self.current.model_fields else (v_min + v_max) / 2
                        start_val = getattr(self._start_state, f, field_default)
                        end_val = getattr(self.target, f, field_default)
                        interp_val = _lerp(start_val, end_val, eased_t)
                        # Apply calibration mapping
                        calibrated = self._calibration.get(f, _CalibrationRange(v_min, v_max)).apply(interp_val)
                        setattr(self.current, f, max(v_min, min(v_max, calibrated)))
                else:
                    # Transition complete — park at target
                    for f, (v_min, v_max) in self._ranges.items():
                        if f in self._override:
                            continue
                        field_default = self.current.model_fields[f].default if f in self.current.model_fields else (v_min + v_max) / 2
                        end_val = getattr(self.target, f, field_default)
                        calibrated = self._calibration.get(f, _CalibrationRange(v_min, v_max)).apply(end_val)
                        setattr(self.current, f, max(v_min, min(v_max, calibrated)))

                self._dispatcher.dispatch(self.current)


                # Sleep for the remainder of the tick period
                tick_elapsed = time.monotonic() - tick_start
                sleep_time = max(0.0, (1.0 / TICK_RATE) - tick_elapsed)
                await asyncio.sleep(sleep_time)

        except asyncio.CancelledError:
            logger.info("60 Hz loop cancelled cleanly")
            raise
        except Exception:
            logger.exception("Unhandled exception in interpolation loop")
            raise
