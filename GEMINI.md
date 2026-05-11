# AI Agents Development - Project Instructions

## 🏗 Repository Overview
This repository is a boilerplate for building AI agents using **FastAPI**, **Next.js**, and the **Model Context Protocol (MCP)**. It leverages `smolagents` for agent orchestration and `LiteLLM` for model agnostic interactions.

## 🛠 Tech Stack
- **Frontend**: Next.js 15, Tailwind CSS, TypeScript.
- **Backend**: Python 3.11, FastAPI, smolagents.
- **Protocol**: MCP (Model Context Protocol).
- **Environment**: Docker-ready, optimized for macOS with Colima.

## 📜 Conventions
- **Backend**: Follow PEP 8. Use type hints. Logic for agents should remain modular.
- **Frontend**: Use App Router. Keep components small and reusable.
- **Documentation**: All major architectural decisions should be documented in `docs/`.
- **Safety**: The agent MUST be sandboxed. The `backend/sandbox` directory is the only allowed area for agent filesystem operations.

## 🤖 Agent Workflow
1. **Research**: Understand the task and the current codebase.
2. **Memory**: Utilize the Memory MCP server to store and retrieve long-term context.
3. **Execution**: Use sandboxed tools for file operations and command execution.
4. **Validation**: Always verify changes with tests.

## 📂 Directory Structure
- `backend/`: FastAPI application and agent logic.
- `frontend/`: Next.js application.
- `docs/`: Comprehensive project documentation.
- `sandbox/`: Secure area for agent-driven development and testing.

## 🔑 Key Files
- `backend/main.py`: Main entry point for the API and Agent initialization.
- `backend/mcp_servers.json`: Configuration for dynamic MCP server loading.
- `backend/agent_instructions.txt`: System prompt for the AI agent.
