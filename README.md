# Real-Time Show Orchestrator

A production-ready system for live show control, translating natural language director prompts into real-time OSC signals for Ableton Live and TouchDesigner. Built with **FastAPI**, **Next.js**, and **smolagents**.

---

## 🏗 Architecture & Design Intent

The Orchestrator is designed for live performance environments where a director needs to steer technical and emotional states dynamically. It operates through a **Think-Interpolate-Dispatch** pipeline.

### High-Level Flow
1. **Director Console (Frontend)**: A modern Next.js dashboard where the director inputs semantic prompts.
2. **LLM Translation (Backend)**: A FastAPI service uses **Gemini Flash (via OpenRouter)** to map prompts to a structured JSON object containing numeric and string macros.
3. **Interpolation Engine**: A 60 Hz asyncio loop smoothly transitions numeric macros toward targets using **smoothstep easing**, ensuring jitter-free control.
4. **OSC Dispatch**: Industry-standard OSC messages are broadcast via UDP to music (Ableton) and visual (TouchDesigner) systems.

### Technology Stack
- **Frontend**: Next.js 15+, Tailwind CSS, WebSockets (for 10Hz status updates).
- **Backend**: FastAPI, smolagents, LiteLLM, python-osc.
- **Protocol**: OSC (Open Sound Control) for low-latency hardware/software control.

---

## 🧠 System Prompt & Agent Logic

The Orchestrator's behavior is governed by a dynamic system prompt that transforms director intent into technical state.

### Dynamic Placeholders
The system prompt (configured in `/settings`) supports high-level placeholders that are injected with real-time context before being sent to the LLM:

- `{{{VARIABLE_DEFINITIONS}}}`: Automatically generates a list of all numeric and string macros, including their descriptions and [min, max] ranges defined in `/config`.
- `{{{CURRENT_STATE}}}`: Injects the current value of all macros to help the LLM make relative adjustments (e.g., "make it *brighter* than it is now").
- `{{{SHOW_CONTEXT}}}`: Pulls metadata from the active show profile (Genres, Core Vibes, Description).
- `{{{SHOW_ID}}}`: The identifier for the currently active performance.

### Configuration & Persistence
- **UI Editing**: The system prompt can be edited in real-time from the **Settings** page.
- **Persistence**: Changes are saved to `backend/settings.json`.
- **Fallback**: If the dashboard prompt is empty, the system defaults to the static instructions in `backend/agent_instructions.txt`.

---

## 🚀 Key Features
- **Semantic Control**: Control complex setups with natural language (e.g., *"Make it feel more industrial and dark"*).
- **Smooth Transitions**: 60 Hz interpolation for professional-grade parameter smoothing.
- **Manual Overrides**: Pin specific macros to manual values via the UI while others remain automated.
- **Dynamic Configuration**: Create, delete, and tune macro variables directly from the dashboard.
- **Show Profiles**: Save different sets of variables and descriptions for different performances.

---

## 📂 Project Structure

```text
.
├── backend/                # FastAPI Application
│   ├── orchestrator/       # Core Orchestrator Logic (Engine, Agent, OSC)
│   ├── main.py             # Entry point & lifespan management
│   ├── config_router.py    # System settings API
│   ├── settings.json       # Persisted LLM & Engine configuration
│   └── shows.json          # Show profiles and active show state
├── frontend/               # Next.js Application
│   ├── app/                # App Router (Pages: Orchestrator, Settings, Config)
│   └── components/         # UI Components (Gauges, Sliders, Dashboard)
└── docs/                   # (Removed - consolidated into this README)
```

---

## ⚙️ Configuration & Setup

### 1. Docker & Environment (macOS/Colima)
If you are running on macOS without Docker Desktop, use **Colima**:
1. **Start Colima**: `colima start --cpu 2 --memory 4`
2. **Launch Stack**: `docker-compose up -d`
3. **Check Status**: `docker-compose ps`
4. **View Logs**: `docker-compose logs -f backend`

### 2. Backend Setup (Local venv)
To run the backend locally for development:
1. Navigate to `backend/`.
2. **Create Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install Dependencies**: `pip install -r requirements.txt`
4. **Configure Environment**: Create a `.env` file:
   ```dotenv
   OPENROUTER_API_KEY=your_api_key_here
   ORCHESTRATOR_MODEL_ID=openrouter/google/gemini-2.0-flash-001
   ```
5. **Run Server**: `python main.py`

### 3. Frontend Setup
1. Navigate to `frontend/`.
2. **Install Dependencies**: `npm install`
3. **Run Development Server**: `npm run dev`
4. **Access UI**: Open [http://localhost:3000](http://localhost:3000)

### 4. OSC Targets
You can configure the target **OSC Host** and **Port** directly from the **Settings** page in the dashboard. By default, the system streams to `127.0.0.1:9000`. This allows you to route messages to any OSC-compatible software or hardware on your network.

---

## 🎮 How to Use

### Director Dashboard (`/`)
- **Prompt Input**: Enter semantic directions to update the show's state.
- **Live Gauges**: Monitor real-time interpolation of all numeric macros.
- **Overrides**: Use the "Pin" icon to manually control a variable.

### System Settings (`/settings`)
- **LLM Model**: Choose your preferred model via OpenRouter.
- **System Prompt**: Edit the core behavior of the agent. Use placeholders like `{{{VARIABLE_DEFINITIONS}}}` to inject live context.
- **Engine Timing**: Adjust tick rate (default 60Hz) and transition durations.

### Macro Configuration (`/config`)
- **Define Variables**: Add new macros (Numeric or String) and set their OSC paths.
- **Categorize**: Organize variables into Music, Lights, or Visuals.

---

## 🛡 Security & Safety
- **Sandboxed Operations**: All AI operations are confined to translating text to JSON. No arbitrary code execution or direct filesystem access is allowed by the agent.
- **Credential Safety**: Never commit `.env` files or API keys.
- **Local Priority**: Designed to run on a local network for maximum reliability during live events.

---

*Refactored May 2026*
