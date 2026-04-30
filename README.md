# AI Agent Boilerplate — Next.js + FastAPI + MCP

A production-ready boilerplate for building AI agents with a **secure FastAPI backend** and a **modern Next.js frontend**. Features deep integration with the **Model Context Protocol (MCP)** for standardized, sandboxed agent tool access.

---

## Architecture Overview

| Layer     | Technology                          | Role                                      |
|-----------|-------------------------------------|-------------------------------------------|
| Frontend  | Next.js 15+ (App Router) + Tailwind | Chat UI, user interaction                 |
| Backend   | FastAPI + smolagents + LiteLLM      | Agent orchestration, API server           |
| Protocol  | MCP (Model Context Protocol)        | Standardized, sandboxed tool access       |
| LLM       | OpenRouter (configurable)           | Model provider, supports many LLMs        |

---

## Project Structure

```text
ai-agent-training/
├── backend/                  # FastAPI server, agent logic, MCP setup
│   ├── agent_instructions.txt  # Behavioral rules injected into the agent
│   ├── main.py               # Server entry point
│   ├── requirements.txt      # Python dependencies
│   └── sandbox/              # Restricted directory for agent file operations
├── frontend/                 # Next.js web application
│   ├── app/                  # App Router pages and layouts
│   └── components/           # Reusable React components
├── .geminiignore             # Files excluded from Gemini CLI context
├── docs/                     # Documentation folder
│   ├── SAFETY.md             # AI tool usage safety guidelines
│   └── SECURITY_AUDIT.md     # Security audit report
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai/) API key

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:

```env
OPENROUTER_API_KEY=your_key_here
MODEL_ID=openrouter/anthropic/claude-3-5-sonnet  # optional, this is the default
```

Start the server:

```bash
python main.py
```

The API will be available at [http://localhost:8000](http://localhost:8000).

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the chat interface.

---

## Key Features

- **MCP Filesystem Integration** — The agent can safely read and write files, but only within the `backend/sandbox/` directory.
- **LiteLLM Support** — Easily switch between LLM providers (OpenAI, Anthropic, Google, etc.) via a single config change.
- **Sandboxed Agent** — All file operations are restricted at the MCP server level, preventing any path traversal.
- **Behavioral Instructions** — The agent's personality and restrictions are defined in `backend/agent_instructions.txt`.
- **Modern Chat UI** — Responsive, Markdown-aware chat interface built with Next.js and Tailwind CSS.
- **Cross-Platform** — Includes specific fixes for asynchronous execution on Windows.

---

## Documentation

| Document                                            | Description                                      |
|-----------------------------------------------------|--------------------------------------------------|
| [Backend README](./backend/README.md)               | Backend setup, API reference, MCP configuration |
| [Frontend README](./frontend/README.md)             | Frontend setup and component overview            |
| [SAFETY.md](./docs/SAFETY.md)                    | Guidelines for safe AI tool usage                |
| [SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md)    | Security audit findings and recommendations      |
