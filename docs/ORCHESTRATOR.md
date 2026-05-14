# Orchestrator Architecture

This document describes the **Real-Time Show Orchestrator** — a live performance control system built on top of the AI Agent boilerplate.

---

## Overview

The orchestrator allows a director to steer the energy, tension, rhythm density, and atmosphere of a live show in real time. A semantic text prompt is translated by an LLM into four numeric macro values, which are then smoothly interpolated toward their targets and broadcast via OSC to Ableton Live and TouchDesigner.

---

## Architecture

```mermaid
graph TD
    Director([Director Browser /orchestrator]) -->|WebSocket 10 Hz| WS[FastAPI WebSocket /orchestrator/ws]
    Director -->|POST /orchestrator/prompt| PROMPT[REST Endpoint]
    Director -->|POST/DELETE /orchestrator/override| OVERRIDE[Override Endpoint]

    PROMPT --> LLM[LLM Agent - Gemini Flash via OpenRouter]
    LLM -->|MacroTarget JSON| ENGINE[InterpolationEngine]
    OVERRIDE --> ENGINE

    subgraph "FastAPI Backend"
        WS --> ENGINE
        ENGINE -->|60 Hz asyncio loop| OSC[OscDispatcher]
        ENGINE -->|smoothstep easing| ENGINE
    end

    OSC -->|UDP port 9000| Ableton[Ableton Live / Max for Live]
    OSC -->|UDP port 9001| TD[TouchDesigner OSC In CHOP]

    LLM --> OpenRouter[OpenRouter API - Gemini Flash 1.5]
```

---

## Components

### Backend (`backend/orchestrator/`)

| Module | Responsibility |
|---|---|
| `models.py` | Pydantic schemas: `MacroState`, `MacroTarget`, `PromptRequest`, `OverrideRequest`, `CalibrationRequest`, `OrchestratorStatus` |
| `llm_agent.py` | Calls `litellm.completion()` with `response_format=json_object` to translate a semantic prompt into a `MacroTarget`. Uses `asyncio.to_thread` since LiteLLM is synchronous. |
| `interpolation_engine.py` | 60 Hz asyncio loop. Smoothstep easing from current → target values. Supports override pin/release per-field and calibration clamping. |
| `osc_dispatcher.py` | `python-osc` UDP client pair (Ableton + TouchDesigner). Fire-and-forget; logs target addresses at startup. |
| `router.py` | FastAPI `APIRouter` mounted at `/orchestrator`. REST + WebSocket endpoints. References the engine singleton set during lifespan. |

### Frontend (`frontend/app/orchestrator/`, `frontend/components/orchestrator/`)

| File | Responsibility |
|---|---|
| `page.tsx` | Director console. 3 zones (Prompt, Live Gauges, Overrides) + collapsible Rehearsal Panel. |
| `MacroGauge.tsx` | Animated horizontal gauge for one macro. Props: `value`, `isOverridden`, `isInterpolating`. |
| `OverrideSlider.tsx` | Range slider with 50 ms debounce for live override. PIN/Release toggle calls DELETE endpoint. |
| `PresetBank.tsx` | Save/load named macro snapshots from `localStorage`. |

---

## Data Flow

1. Director types a semantic prompt (e.g. "slow breakdown into ambient space").
2. `POST /orchestrator/prompt` → `llm_agent.translate_prompt()` → Gemini Flash returns `MacroTarget` JSON.
3. `InterpolationEngine.set_target()` stores the new target and records `time.monotonic()` as transition start.
4. The 60 Hz loop runs `smoothstep(elapsed / duration)` per tick, updating `current` values.
5. `OscDispatcher.dispatch(current)` fires 4 OSC messages to both UDP targets.
6. The 10 Hz WebSocket pushes `OrchestratorStatus` to the browser.
7. The browser animates `MacroGauge` bars using CSS `transition-[width]`.

---

## OSC Messages

Sent to both Ableton (`ABLETON_OSC_PORT=9000`) and TouchDesigner (`TD_OSC_PORT=9001`) on every 60 Hz tick:

```
/orchestrator/energy          <float 0.0–1.0>
/orchestrator/tension         <float 0.0–1.0>
/orchestrator/rhythm_density  <float 0.0–1.0>
/orchestrator/atmosphere      <float 0.0–1.0>
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/orchestrator/status` | Current `OrchestratorStatus` snapshot |
| `POST` | `/orchestrator/prompt` | Translate prompt via LLM → set target, returns `MacroTarget` |
| `POST` | `/orchestrator/override` | Pin a field `{ field, value }` to a manual value |
| `DELETE` | `/orchestrator/override/{field}` | Release a pinned field |
| `POST` | `/orchestrator/calibrate` | Adjust per-macro output clamping ranges |
| `WebSocket` | `/orchestrator/ws` | Stream `OrchestratorStatus` at 10 Hz |

---

## Environment Variables

Add to `backend/.env`:

```dotenv
# Orchestrator LLM (defaults to Gemini Flash via OpenRouter)
ORCHESTRATOR_MODEL_ID=openrouter/google/gemini-3.1-flash-lite

# OSC Targets (defaults shown)
ABLETON_OSC_HOST=127.0.0.1
ABLETON_OSC_PORT=9000
TD_OSC_HOST=127.0.0.1
TD_OSC_PORT=9001
```

---

## Design Decisions

| Decision | Rationale |
|---|---|
| Single backend router, no new service | Reuses existing FastAPI lifespan, LiteLLM, and CORS config. No new Docker service needed. |
| `litellm.completion()` directly (not `LiteLLMModel`) | `LiteLLMModel` is a `smolagents` wrapper requiring a tool-calling loop. For a single structured JSON completion, `litellm.completion()` with `response_format=json_object` is simpler and more reliable. |
| 60 Hz asyncio loop | Fully async FastAPI; avoids GIL contention. `asyncio.sleep(1/60)` prevents drift; actual elapsed time tracked with `time.monotonic()`. |
| WebSocket at 10 Hz (not 60 Hz) | Browser animations don't need 60 Hz; 10 Hz saves bandwidth. OSC dispatch stays at 60 Hz. |
| Smoothstep easing `t²(3-2t)` | Simple, no external deps, visually pleasing. Linear fallback for snap transitions (`duration < 0.5s`). |
| Override pin/release as `dict[str, float]` | All access is from the asyncio event loop (async router handlers). No lock needed. |
| `localStorage` for presets | Keeps the system stateless between sessions; no backend DB needed. |
| Separate OSC ports for Ableton / TD | Allows independent routing; hardware can run on different LAN machines. |

---

## Deployment Notes

- `python-osc` is a new dependency — requires a Docker container rebuild: `docker-compose up --build backend`.
- New files under `backend/orchestrator/` are picked up immediately by the existing `./backend:/app` volume mount without rebuilding.
- OSC packets are fire-and-forget (UDP). If Ableton/TD aren't running, no exception is raised. The startup log line confirms configured addresses.
- WebSocket does not go through FastAPI's CORS middleware — this is correct behavior and requires no configuration.

---

## Testing

- **Unit**: `pytest` tests for `InterpolationEngine` step math (`smoothstep`, `lerp`) and easing curve correctness.
- **Integration**: Mock LLM returning a known `MacroTarget`; assert OSC packet content via a UDP listener on loopback.
- **Hardware**: Use `oscdump 9000` and `oscdump 9001` to verify 60 Hz output independently of Ableton/TD.
- **Frontend**: Rehearsal panel OSC monitor displays last 30 frames at 10 Hz for visual verification.

---

*Implemented May 2026*
