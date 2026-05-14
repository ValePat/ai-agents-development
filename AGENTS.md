# AI Agents Development - Project Instructions

## 🏗 Repository Overview
This repository is a production-ready framework for building AI agents, currently focused on the **Real-Time Show Orchestrator**. It uses **FastAPI**, **Next.js**, and the **Model Context Protocol (MCP)**.

The primary application is the **Orchestrator**, which translates semantic director prompts into real-time OSC signals for Ableton Live and TouchDesigner, using an LLM-driven interpolation engine.

## 🛠 Tech Stack
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, TypeScript, WebSockets.
- **Backend**: Python 3.11, FastAPI, `smolagents`, `LiteLLM`, `python-osc`.
- **Protocol**: MCP (Model Context Protocol) for tool-calling and filesystem access.
- **Environment**: Docker-ready, optimized for macOS with Colima.

## 📜 Conventions & Mandates
- **Backend**: Follow PEP 8. Use strict type hints (Pydantic).
- **Orchestrator Logic**: 
    - The **Interpolation Engine** runs a 60Hz `asyncio` loop. Avoid blocking calls in this loop.
    - Use `litellm.completion(response_format=json_object)` for structured macro extraction.
    - OSC signals must be broadcast to both Ableton (9000) and TouchDesigner (9001).
- **Frontend**: Keep components small. Use `framer-motion` or CSS transitions for smooth gauge animations.
- **Safety**: The agent MUST be sandboxed. `backend/sandbox` is the only allowed area for general agent filesystem operations.
- **Documentation**: Update `docs/` for any architectural changes.

## 📂 Directory Structure
- `backend/`: FastAPI application.
    - `orchestrator/`: Core logic for the Show Orchestrator (Models, Engine, OSC).
    - `sandbox/`: Secure area for agent-driven development.
- `frontend/`: Next.js application.
    - `components/orchestrator/`: UI for the director console.
- `docs/`: Comprehensive project documentation (Architecture, Operations, Security).

## 🔑 Key Files
- `backend/main.py`: API entry point and lifespan management.
- `backend/orchestrator/interpolation_engine.py`: The 60Hz smooth-transition logic.
- `backend/orchestrator/llm_agent.py`: LLM translation logic.
- `backend/mcp_servers.json`: Config for dynamic MCP server loading.
- `backend/agent_instructions.txt`: System prompt for the autonomous agent.
- `AGENTS.md`: This file (Project Instructions).
