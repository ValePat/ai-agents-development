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

from .models import MacroState, MacroTarget, OrchestratorStatus, CalibrationRequest
from .osc_dispatcher import OscDispatcher

logger = logging.getLogger(__name__)

# Macro field names (must match MacroState attributes)
MACRO_FIELDS: list[str] = ["energy", "tension", "rhythm_density", "atmosphere"]

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

    def apply(self, v: float) -> float:
        """Map normalised [0,1] → [min_val, max_val]."""
        return self.min_val + v * (self.max_val - self.min_val)


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
        self.current = MacroState()
        self.target = MacroTarget()
        self._task: asyncio.Task | None = None
        self._override: dict[str, float] = {}   # field → pinned value
        self._transition_start: float = 0.0
        self._start_state = MacroState()
        self._calibration: dict[str, _CalibrationRange] = {
            f: _CalibrationRange() for f in MACRO_FIELDS
        }
        self._dispatcher = OscDispatcher()

    # ------------------------------------------------------------------
    # Public API (called from router handlers — all on the event loop)
    # ------------------------------------------------------------------

    async def set_target(self, target: MacroTarget) -> None:
        """Accept a new target from the LLM or a direct caller."""
        self._start_state = MacroState(**self.current.model_dump())
        self.target = target
        self._transition_start = time.monotonic()
        logger.info(
            f"New target set: {target.model_dump()} "
            f"(duration={target.duration}s)"
        )

    def hard_override(self, field: str, value: float) -> None:
        """Pin a field to a manual slider value (excludes it from interpolation)."""
        if field not in MACRO_FIELDS:
            raise ValueError(f"Unknown macro field: {field!r}")
        self._override[field] = max(0.0, min(1.0, value))
        setattr(self.current, field, self._override[field])

    def release_override(self, field: str) -> None:
        """Release a pinned field back to interpolation."""
        if field not in MACRO_FIELDS:
            raise ValueError(f"Unknown macro field: {field!r}")
        self._override.pop(field, None)

    def apply_calibration(self, cal: CalibrationRequest) -> None:
        """Update per-macro output clamping ranges."""
        self._calibration["energy"] = _CalibrationRange(cal.energy_min, cal.energy_max)
        self._calibration["tension"] = _CalibrationRange(cal.tension_min, cal.tension_max)
        self._calibration["rhythm_density"] = _CalibrationRange(cal.rhythm_density_min, cal.rhythm_density_max)
        self._calibration["atmosphere"] = _CalibrationRange(cal.atmosphere_min, cal.atmosphere_max)

    def get_status(self) -> OrchestratorStatus:
        elapsed = time.monotonic() - self._transition_start
        is_interp = elapsed < self.target.duration
        return OrchestratorStatus(
            current=MacroState(**self.current.model_dump()),
            target=MacroTarget(**self.target.model_dump()),
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
                duration = max(self.target.duration, 1e-6)

                if elapsed < duration:
                    raw_t = elapsed / duration
                    # Use linear for very short "snap" transitions
                    eased_t = raw_t if duration < 0.5 else _smoothstep(raw_t)

                    for f in MACRO_FIELDS:
                        if f in self._override:
                            continue  # pinned
                        start_val = getattr(self._start_state, f)
                        end_val = getattr(self.target, f)
                        interp_val = _lerp(start_val, end_val, eased_t)
                        # Apply calibration mapping
                        calibrated = self._calibration[f].apply(interp_val)
                        setattr(self.current, f, max(0.0, min(1.0, calibrated)))
                else:
                    # Transition complete — park at target
                    for f in MACRO_FIELDS:
                        if f in self._override:
                            continue
                        end_val = getattr(self.target, f)
                        calibrated = self._calibration[f].apply(end_val)
                        setattr(self.current, f, max(0.0, min(1.0, calibrated)))

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
