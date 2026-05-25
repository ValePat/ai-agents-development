# Real-Time Show Orchestrator

A production-ready system for live show control, translating natural language director prompts into real-time OSC signals for Ableton Live and TouchDesigner. Built with **FastAPI**, **Next.js**, and **smolagents**.

---

## 🏗 Architecture & Design Intent

The Orchestrator is designed for live performance environments where a director needs to steer technical and emotional states dynamically. It operates through a **Think-Interpolate-Dispatch** pipeline.

### High-Level Flow
1. **Director Console (Frontend)**: A Next.js dashboard where the director inputs semantic prompts.
2. **LLM Translation (Backend)**: A FastAPI service uses an OpenRouter-hosted LLM (default: `gemini-2.0-flash`) to map prompts to a structured JSON object containing numeric and string macros.
3. **Interpolation Engine**: A 60 Hz asyncio loop smoothly transitions numeric macros toward targets using **smoothstep easing** (or linear for "snap" transitions < 0.5 s), ensuring jitter-free control.
4. **OSC Dispatch**: Industry-standard OSC messages are broadcast via UDP to per-category targets — Music (port 9000), Visual (port 9001), Lights (port 9002) — configurable from the Settings UI.

### Technology Stack
- **Frontend**: Next.js 15+, Tailwind CSS, WebSockets (10 Hz status stream).
- **Backend**: FastAPI, smolagents, LiteLLM, python-osc, MCP (Model Context Protocol).
- **Protocol**: OSC (Open Sound Control) for low-latency UDP control of Ableton and TouchDesigner.

---

## 🧠 System Prompt & Agent Logic

The Orchestrator's behavior is governed by a dynamic system prompt that transforms director intent into technical state.

### Dynamic Placeholders
The system prompt (configured in `/settings`) supports placeholders injected with real-time context before being sent to the LLM:

| Placeholder | What it injects |
|---|---|
| `{{{VARIABLE_DEFINITIONS}}}` | All macro names, descriptions, and [min, max] ranges |
| `{{{CURRENT_STATE}}}` | Current values of all macros (for relative adjustments like *"brighter than now"*) |
| `{{{SHOW_CONTEXT}}}` | Active show's Name, Description, Genres, and Core Vibes |
| `{{{SHOW_ID}}}` | Identifier for the currently active performance |

### Fallback Model Chain
The agent supports a **primary + fallback** model chain. If the primary model is rate-limited (HTTP 429), it instantly switches to the next model in the list — no waiting. If a model returns malformed JSON, it retries the same model up to `max_steps` times before giving up.

### Configuration & Persistence
- **UI Editing**: The system prompt and all agent settings can be edited in real-time from the **Settings** page.
- **Persistence**: Changes are saved to `backend/settings.json`.
- **Fallback**: If the dashboard prompt is empty, the system falls back to `backend/agent_instructions.txt`.

---

## 🛠 MCP (Model Context Protocol) Integration

The backend loads MCP servers at startup from `backend/mcp_servers.json`. These expose tools to the smolagents agent for optional use during prompt translation.

**Default servers bundled:**

| Server | Purpose |
|---|---|
| `filesystem` | Read/write access inside the sandboxed `backend/sandbox/` directory |
| `memory` | Persistent key-value memory stored at `backend/sandbox/memory.json` |

**Adding a new MCP server**: Add an entry to `mcp_servers.json` following the existing format. Use the `{{SAFE_DIR}}` placeholder for any path that should resolve to the sandbox directory. The server is loaded automatically on next startup.

---

## 🚀 Key Features
- **Semantic Control**: Control complex setups with natural language (e.g., *"Make it feel more industrial and dark"*).
- **Smooth Transitions**: 60 Hz interpolation with smoothstep easing for professional-grade parameter smoothing.
- **Manual Overrides**: Pin specific macros to manual values via the UI while others remain automated.
- **Dynamic Configuration**: Create, delete, and tune macro variables directly from the dashboard — changes take effect instantly without a restart.
- **Show Profiles**: Save different sets of variables, presets, genres, and vibes for different performances.
- **Preset Bank**: Save and recall named state snapshots with a configurable transition duration.
- **Calibration**: Per-macro output range clamping for fine-tuned hardware integration.
- **Multi-Target OSC**: Route Music, Lights, and Visual macros to independent UDP hosts/ports.
- **Rate-Limit Resilience**: Automatic fallback across a configurable chain of LLM models.

---

## 📂 Project Structure

```text
.
├── backend/                        # FastAPI Application
│   ├── orchestrator/               # Core Orchestrator Logic
│   │   ├── config.py               # Variable loader/saver; global field lists
│   │   ├── interpolation_engine.py # 60 Hz asyncio loop; smoothstep easing; calibration
│   │   ├── llm_agent.py            # LLM translation; fallback chain; prompt construction
│   │   ├── models.py               # Pydantic schemas (dynamic MacroState/MacroTarget)
│   │   ├── osc_dispatcher.py       # Per-category UDP OSC dispatch
│   │   └── router.py               # APIRouter: /status, /prompt, /shows, /variables, /ws
│   ├── main.py                     # Entry point, lifespan, MCP server loading
│   ├── config_router.py            # /api/settings endpoints
│   ├── mcp_servers.json            # MCP server definitions (filesystem, memory)
│   ├── settings.json               # Persisted LLM & engine configuration
│   └── shows.json                  # Show profiles, active show state, variables, presets
├── frontend/                       # Next.js Application
│   ├── app/
│   │   ├── page.tsx                # Director Dashboard (main orchestrator view)
│   │   ├── settings/page.tsx       # Settings page (LLM model, system prompt, OSC targets)
│   │   ├── config/page.tsx         # Macro configuration page
│   │   └── shows/page.tsx          # Show profile management page
│   └── components/orchestrator/
│       ├── ConfigurationDashboard.tsx  # Variable list & editor
│       ├── MacroGauge.tsx              # Real-time animated gauge per macro
│       ├── OverrideSlider.tsx          # Manual pin slider per macro
│       └── PresetBank.tsx              # Preset save/recall UI
├── docker-compose.yml              # Compose file (backend + frontend services)
└── sandbox/                        # Agent-accessible sandbox directory (MCP)
```

---

## ⚙️ Configuration & Setup

### 1. Docker (Recommended)
```bash
# Build and start both services
docker-compose up -d

# View backend logs
docker-compose logs -f backend

# Check service status
docker-compose ps
```

> **macOS without Docker Desktop**: Use **Colima** — `colima start --cpu 2 --memory 4` before running `docker-compose up`.

### 2. Backend Setup (Local venv)
```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
# or: venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
# Create backend/.env:
OPENROUTER_API_KEY=your_api_key_here
ORCHESTRATOR_MODEL_ID=openrouter/google/gemini-2.0-flash-001

# Start the server (port 8000)
python main.py
```

> **Windows**: The backend automatically switches to `WindowsProactorEventLoopPolicy` for reliable MCP subprocess (npx) support.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### 4. OSC Targets
By default OSC is routed to `127.0.0.1` with separate ports per category:
- **Music** → port `9000`
- **Visual** → port `9001`
- **Lights** → port `9002`

All targets are configurable per-category from the **Settings** page in the dashboard, with changes taking effect on the next engine tick.

---

## 🌐 API Reference

The backend exposes two routers mounted on the FastAPI app:

### Orchestrator API (`/orchestrator`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/orchestrator/status` | Current engine state (values, target, interpolation progress) |
| `POST` | `/orchestrator/prompt` | Translate a semantic prompt → set new target |
| `POST` | `/orchestrator/target` | Set a target state directly (e.g., from a preset) |
| `POST` | `/orchestrator/override` | Pin a macro field to a manual slider value |
| `DELETE` | `/orchestrator/override/{field}` | Release a pinned field back to interpolation |
| `POST` | `/orchestrator/calibrate` | Adjust per-macro output clamping ranges |
| `GET` | `/orchestrator/variables` | List all macro variable definitions |
| `POST` | `/orchestrator/variables` | Add or update a macro variable |
| `DELETE` | `/orchestrator/variables/{name}` | Remove a macro variable |
| `GET` | `/orchestrator/shows` | List all show profiles |
| `POST` | `/orchestrator/shows` | Create or update a show profile |
| `DELETE` | `/orchestrator/shows/{show_id}` | Delete a show profile |
| `GET` | `/orchestrator/shows/active` | Get the currently active show profile |
| `POST` | `/orchestrator/shows/active` | Switch active show (triggers config refresh) |
| `WS` | `/orchestrator/ws` | WebSocket: streams `OrchestratorStatus` at 10 Hz |

### Configuration API (`/api`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/settings` | Return the full settings document |
| `PUT` | `/api/settings/orchestrator` | Update orchestrator settings (applied immediately) |
| `GET` | `/api/settings/defaults` | Return suggested free OpenRouter model IDs |

---

## 🎮 How to Use

### Director Dashboard (`/`)
- **Prompt Input**: Enter semantic directions to update the show's state.
- **Live Gauges**: Monitor real-time interpolation of all numeric macros.
- **Overrides**: Use the "Pin" icon to manually control a variable.
- **Preset Bank**: Save the current state as a named preset and recall it later.

### System Settings (`/settings`)
- **LLM Model**: Choose your primary model and configure fallbacks via OpenRouter.
- **System Prompt**: Edit the core agent behaviour. Use placeholders like `{{{VARIABLE_DEFINITIONS}}}` to inject live context.
- **Engine Timing**: Adjust tick rate (default 60 Hz) and transition durations.
- **OSC Targets**: Configure host and port per category (Music, Visual, Lights).

### Macro Configuration (`/config`)
- **Define Variables**: Add new macros (Numeric or String), set descriptions, ranges, and OSC paths.
- **Categorize**: Organize variables into Music, Lights, or Visuals for correct OSC routing.

### Show Management (`/shows`)
- **Create Shows**: Define show profiles with genres and vibes to provide context to the LLM.
- **Switch Active Show**: Instantly swaps the variable set and resets the engine.
- **Per-Show Presets**: Presets are stored inside the show profile.

---

## 🛡 Security & Safety
- **Sandboxed MCP Operations**: The filesystem MCP server is restricted to `backend/sandbox/`. No arbitrary filesystem access outside this path.
- **No Code Execution**: All AI operations are confined to translating text to JSON macros. The agent cannot execute code or make external network calls beyond the configured LLM provider.
- **Credential Safety**: Never commit `.env` files or API keys. The `.env` file is listed in `.gitignore`.
- **Local Priority**: Designed to run on a local network for maximum reliability during live events.

---

*Refactored May 2026*
