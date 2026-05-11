# AI Agent Backend

FastAPI-based backend for the AI Agent, powered by `smolagents` and integrated with the **Model Context Protocol (MCP)** for standardized, sandboxed tool access.

---

## Tech Stack

| Library / Tool    | Role                                                      |
|-------------------|-----------------------------------------------------------|
| **FastAPI**       | High-performance async web framework                      |
| **smolagents**    | Lightweight framework for building AI tool-calling agents |
| **LiteLLM**       | Universal interface for switching LLM providers           |
| **MCP**           | Standardized protocol for providing tools to agents       |
| **python-dotenv** | Environment variable management                           |

---

## Key Features

- **Filesystem Tools via MCP**: The agent is equipped with tools from the `@modelcontextprotocol/server-filesystem` MCP server.
- **Sandboxed Operations**: All filesystem operations are hard-restricted to the `backend/sandbox/` directory.
- **Behavioral Instructions**: Agent behavior is governed by `agent_instructions.txt`, loaded at startup.
- **Cross-Platform**: Includes `WindowsProactorEventLoopPolicy` for reliable async execution on Windows.

---

## Setup Instructions

### 1. Virtual Environment

```bash
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

> [!NOTE]
> Node.js must also be installed, as the MCP filesystem server is launched via `npx` at startup.

### 3. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
OPENROUTER_API_KEY=your_key_here
MODEL_ID=openrouter/anthropic/claude-3-5-sonnet   # optional
```

### 4. Run the Server

```bash
python main.py
```

The API will be available at [http://localhost:8000](http://localhost:8000).

---

## API Reference

### `GET /`

Health check. Returns a status message confirming the agent is running.

**Response:**
```json
{ "message": "AI Agent with MCP is running" }
```

### `GET /api/tools`

Returns a list of tools currently available to the agent.

**Response:**
```json
{ "tools": ["read_file", "write_file", "create_entities", ...] }
```

### `POST /api/chat`

Send a message to the agent and receive a response. Supports history for short-term context.

**Request Body:**
```json
{
  "message": "What did we discuss about the architecture?",
  "history": [
    {"role": "user", "content": "Let's use a microservices approach."},
    {"role": "agent", "content": "Understood. I've noted that in the memory graph."}
  ]
}
```

**Response:**
```json
{
  "response": "We discussed using a microservices approach...",
  "tools_used": ["read_graph", "search_nodes"]
}
```

---

## MCP Configuration

The backend loads MCP server configurations dynamically from `mcp_servers.json`. This allows you to easily add or remove tools without modifying the core logic.

### Default Servers:
1. **Filesystem**: Safe file operations within `sandbox/`.
2. **Memory**: Persistent context using a Knowledge Graph approach.

The `{{SAFE_DIR}}` placeholder is automatically resolved to the absolute path of `backend/sandbox/`, ensuring the agent remains sandboxed.

---

## Agent Instructions

The file `agent_instructions.txt` defines the agent's behavioral boundaries (sandboxing rules, secret protection, communication ethics). It is loaded automatically at startup and should be kept up to date with any project-level security policies.
