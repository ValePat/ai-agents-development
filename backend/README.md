# AI Agent Backend

FastAPI-based backend for the AI Agent, powered by `smolagents` and integrated with the Model Context Protocol (MCP).

## Tech Stack

- **FastAPI**: High-performance web framework.
- **smolagents**: Framework for building lightweight AI agents.
- **LiteLLM**: Universal interface for LLM providers.
- **MCP (Model Context Protocol)**: Used to provide the agent with standardized tools.

## Key Features

- **Filesystem Tools via MCP**: The agent is equipped with tools from the `@modelcontextprotocol/server-filesystem` MCP server.
- **Sandboxed Operations**: All filesystem operations are restricted to the `backend/sandbox` directory for security.
- **Windows Support**: Configured with `WindowsProactorEventLoopPolicy` for reliable performance on Windows systems.

## Setup Instructions

1. **Virtual Environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**:
   Create a `.env` file in this directory:
   ```env
   OPENROUTER_API_KEY=your_key_here
   MODEL_ID=openrouter/anthropic/claude-3-5-sonnet
   ```

4. **Running the Server**:
   ```bash
   python main.py
   ```
   The API will be available at `http://localhost:8000`.

## API Endpoints

- `GET /`: Health check.
- `POST /api/chat`: Send a message to the agent.
  - Body: `{ "message": "string", "history": [] }`
  - Response: `{ "response": "string", "tools_used": [] }`

## MCP Configuration

The backend currently initializes an MCP Filesystem Server using `npx`. Ensure you have Node.js installed to allow the agent to use these tools.
