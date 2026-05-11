# AI Agent Boilerplate — Next.js + FastAPI + MCP

A production-ready boilerplate for building AI agents with a **secure FastAPI backend** and a **modern Next.js frontend**. Features deep integration with the **Model Context Protocol (MCP)** for standardized, sandboxed agent tool access.

---

## 🏗 Architecture Overview

| Layer     | Technology                          | Role                                      |
|-----------|-------------------------------------|-------------------------------------------|
| **Frontend**  | Next.js 15+ (App Router) + Tailwind | Chat UI, user interaction                 |
| **Backend**   | FastAPI + smolagents + LiteLLM      | Agent orchestration, API server           |
| **Protocol**  | MCP (Model Context Protocol)        | Standardized, sandboxed tool access       |
| **LLM**       | OpenRouter (configurable)           | Model provider, supports many LLMs        |

---

## 📂 Project Structure

```text
.
├── backend/                  # FastAPI server, agent logic, MCP setup
│   ├── agent_instructions.txt  # Behavioral rules injected into the agent
│   ├── main.py               # Server entry point
│   ├── mcp_servers.json      # Dynamic MCP server configuration
│   └── sandbox/              # Restricted directory for agent file operations
├── frontend/                 # Next.js web application
│   ├── app/                  # App Router pages and layouts
│   └── components/           # Reusable React components
├── docs/                     # Detailed documentation
│   ├── ARCHITECTURE.md       # System design and data flow
│   ├── SAFETY.md             # Security and sandboxing guidelines
│   └── PLANNING.md           # Roadmap and future features
└── GEMINI.md                 # Instructions for AI agents working on this repo
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+
- [OpenRouter](https://openrouter.ai/) API key

### 1. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```
Create a `.env` in `backend/`:
```env
OPENROUTER_API_KEY=your_key_here
MODEL_ID=openrouter/anthropic/claude-3-5-sonnet
```
Start the server:
```bash
python main.py
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Access the UI at [http://localhost:3000](http://localhost:3000).

---

## 🛡 Key Features
- **Dynamic MCP Loading**: Easily extend agent capabilities via `mcp_servers.json`.
- **Sandboxed Execution**: Agent operations are restricted to the `backend/sandbox` directory.
- **Memory Integration**: Built-in support for persistent context via MCP Memory server.
- **Provider Agnostic**: Switch LLMs easily using LiteLLM via OpenRouter.
- **Modern UI**: Clean, responsive chat interface with Markdown support.

---

## 🎯 Project Roadmap

### ✅ Completed
- **Core Infrastructure**: FastAPI + smolagents + LiteLLM.
- **MCP Integration**: Dynamic loading of filesystem and memory servers.
- **Sandboxing**: Strict restriction to the `sandbox/` directory.
- **Modern UI**: Next.js interface with Markdown support.
- **Consolidated Docs**: Streamlined documentation into 3 core manuals.

### 🔄 In Progress / Planned
- **Git MCP Integration**: Add tools for commit and branch management.
- **Execution Sandbox**: Secure MCP server for code execution (Python/Node).
- **App Templates**: Scaffolding for automatic project generation.
- **Multi-Agent Orchestration**: Experimenting with Manager-Worker patterns.

---

## 📖 Documentation Index

| Topic | Description |
|-------|-------------|
| [Architecture](./docs/ARCHITECTURE.md) | System design, MCP integration, and agent behavior. |
| [Operations](./docs/OPERATIONS.md) | Local setup (Colima), Docker workflows, and deployment. |
| [Security & Safety](./docs/SECURITY.md) | Guidelines for safe AI usage and security audit. |
