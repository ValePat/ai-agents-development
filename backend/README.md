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

### `POST /api/chat`

Send a message to the agent and receive a response.

**Request Body:**
```json
{
  "message": "List the files in the sandbox",
  "history": []
}
```

**Response:**
```json
{
  "response": "The sandbox contains the following files: ...",
  "tools_used": ["list_directory"]
}
```

---

## MCP Configuration

The backend initializes an MCP Filesystem Server at startup using `npx`:

```python
filesystem_params = StdioServerParameters(
    command="npx",
    args=["-y", "@modelcontextprotocol/server-filesystem", SAFE_DIR],
)
```

The `SAFE_DIR` is resolved to `os.path.abspath("sandbox")`, ensuring the agent can never escape this directory regardless of the input it receives.

---

## Agent Instructions

The file `agent_instructions.txt` defines the agent's behavioral boundaries (sandboxing rules, secret protection, communication ethics). It is loaded automatically at startup and should be kept up to date with any project-level security policies.
