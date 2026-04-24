# AI Agent Boilerplate (Next.js + FastAPI + MCP)

This project is a professional boilerplate for building AI agents with a secure FastAPI backend and a modern Next.js frontend. It features integration with the **Model Context Protocol (MCP)** for enhanced agent capabilities.

## Architecture

- **Frontend**: Next.js (App Router) with Tailwind CSS.
- **Backend**: FastAPI server using `smolagents` and `LiteLLM`.
- **Agent Protocol**: Integrated with MCP (Model Context Protocol) to provide tools like filesystem access.

## Project Structure

```text
ai-agent-training/
├── backend/          # FastAPI server, agent logic, MCP setup
│   └── sandbox/      # Restricted directory for agent file operations
├── frontend/         # Next.js web application
└── README.md         # Project overview
```

## Quick Start

### 1. Backend Setup
1. `cd backend`
2. Create virtual environment: `python -m venv venv`
3. Activate venv: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. `pip install -r requirements.txt`
5. Configure `.env` (set `OPENROUTER_API_KEY`)
6. `python main.py`

### 2. Frontend Setup
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Access the application at [http://localhost:3000](http://localhost:3000).

## Features

- **MCP Filesystem Integration**: The agent can safely read and write files within the `backend/sandbox` directory.
- **LiteLLM Support**: Easily switch between different LLM providers (defaulting to OpenRouter).
- **Modern UI**: Clean chat interface built with Tailwind CSS.
- **Windows Optimized**: Includes specific fixes for asynchronous execution on Windows.

For detailed instructions, see the READMEs in the respective directories:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)
