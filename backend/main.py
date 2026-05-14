import os
import logging
import asyncio
import json
from contextlib import asynccontextmanager, AsyncExitStack
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from smolagents import LiteLLMModel, ToolCallingAgent
from smolagents.tools import ToolCollection
from mcp import StdioServerParameters

from orchestrator.router import router as orchestrator_router
import orchestrator.router as orchestrator_router_module
from orchestrator.interpolation_engine import InterpolationEngine

# -------------------- WINDOWS FIX (IMPORTANT) --------------------
# On Windows, the default event loop policy (SelectorEventLoop) doesn't support 
# subprocesses as effectively as ProactorEventLoop. Since MCP servers often 
# run as subprocesses (via npx/stdio), this fix is required for stability.
if os.name == "nt":
    asyncio.set_event_loop_policy(
        asyncio.WindowsProactorEventLoopPolicy()
    )

# -------------------- LOGGING CONFIG --------------------
# Configure basic logging to help with debugging and monitoring tool loading.
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
# Enable detailed logs for smolagents to track tool calls.
logging.getLogger("smolagents").setLevel(logging.DEBUG)
# Silence verbose logs from LiteLLM.
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

# Load environment variables from a .env file (e.g., API keys).
load_dotenv()

# -------------------- GLOBALS --------------------
# The agent is initialized once at startup and reused for all requests.
agent = None

# The interpolation engine singleton — started in lifespan, same pattern as `agent`.
interpolation_engine: InterpolationEngine | None = None

# AsyncExitStack manages the lifecycle of multiple asynchronous context managers.
# We use it to ensure all MCP server connections are closed properly on shutdown.
exit_stack = AsyncExitStack()

# -------------------- SANDBOX DIRECTORY --------------------
# Define a safe directory for filesystem operations. This ensures the agent
# remains sandboxed and cannot access files outside of this path.
SAFE_DIR = os.path.abspath("sandbox")
os.makedirs(SAFE_DIR, exist_ok=True)

# -------------------- FASTAPI LIFESPAN --------------------
# The lifespan function handles logic that runs on server startup and shutdown.
@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent, exit_stack, interpolation_engine

    # Retrieve environment variables for the LLM model.
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    MODEL_ID = os.getenv(
        "MODEL_ID",
        "openrouter/anthropic/claude-3-5-sonnet"
    )

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not found in environment")

    # -------- ORCHESTRATOR ENGINE STARTUP --------
    # Start the 60 Hz interpolation engine independently of the chat agent.
    # This ensures the orchestrator works even if MCP tools fail to load.
    interpolation_engine = InterpolationEngine()
    orchestrator_router_module.engine = interpolation_engine
    interpolation_engine.start()
    logger.info("✓ Orchestrator interpolation engine started.")

    try:
        # -------- LLM MODEL SETUP --------
        # Initialize the model using LiteLLM via OpenRouter.
        model = LiteLLMModel(
            model_id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            api_base="https://openrouter.ai/api/v1"
        )

        # -------- DYNAMIC MCP SERVER LOADING --------
        # We load MCP server configurations from an external JSON file.
        mcp_config_path = os.path.join(os.path.dirname(__file__), "mcp_servers.json")
        all_tools = []

        if os.path.exists(mcp_config_path):
            with open(mcp_config_path, "r") as f:
                mcp_config = json.load(f)

            # Iterate through each server defined in mcp_servers.json.
            for server_name, config in mcp_config.get("mcpServers", {}).items():
                command = config.get("command")
                args = config.get("args", [])
                
                # Dynamic placeholder replacement: replace {{SAFE_DIR}} with the actual path.
                processed_args = [arg.replace("{{SAFE_DIR}}", SAFE_DIR) for arg in args]
                
                logger.info(f"Starting MCP server: {server_name} ({command} {' '.join(processed_args)})")
                
                # Define connection parameters for the MCP server (Stdio transport).
                server_params = StdioServerParameters(
                    command=command,
                    args=processed_args,
                    env=config.get("env")
                )
                
                try:
                    # ToolCollection.from_mcp starts the server and discovers its tools.
                    tc_context = ToolCollection.from_mcp(
                        server_params,
                        trust_remote_code=True
                    )
                    # Use exit_stack to track this context manager for automatic cleanup.
                    tc = exit_stack.enter_context(tc_context)
                    # Add discovered tools to our global tool pool.
                    all_tools.extend(tc.tools)
                    logger.info(f"✓ Loaded tools from {server_name}: {[t.name for t in tc.tools]}")
                except Exception as e:
                    logger.error(f"Failed to load MCP server {server_name}: {e}")
        else:
            logger.warning(f"MCP config not found at {mcp_config_path}")

        # -------- AGENT INITIALIZATION --------
        # If no tools were loaded, the agent won't be very useful.
        if not all_tools:
            raise RuntimeError("❌ No MCP tools loaded from any server; agent cannot perform actions.")

        logger.info(f"✓ Total MCP tools available: {[t.name for t in all_tools]}")

        # Load system instructions from a text file to define the agent's personality/rules.
        instructions_path = os.path.join(os.path.dirname(__file__), "agent_instructions.txt")
        if os.path.exists(instructions_path):
            with open(instructions_path, "r", encoding="utf-8") as f:
                agent_instructions = f.read()
        else:
            agent_instructions = "You are a helpful AI assistant."

        # Create the ToolCallingAgent with the collected tools and LLM model.
        agent = ToolCallingAgent(
            tools=all_tools,
            model=model
        )
        # Inject the custom system prompt.
        agent.prompt_templates["system_prompt"] = agent_instructions

        logger.info("✓ Agent initialized and ready for chat.")

        yield # The application runs while this yield is active.

    except Exception as e:
        logger.error(f"Startup error: {e}", exc_info=True)
        raise

    finally:
        # -------- SHUTDOWN CLEANUP --------
        # Stop the orchestrator engine before closing MCP connections.
        if interpolation_engine is not None:
            interpolation_engine.stop()
        # Close all MCP server connections and cleanup resources.
        await exit_stack.aclose()
        agent = None
        logger.info("✓ Shutdown complete; all MCP connections closed.")


# -------------------- FASTAPI APPLICATION --------------------
app = FastAPI(
    title="AI Agent API (Dynamic MCP)",
    lifespan=lifespan
)

# Include the orchestrator router under /orchestrator prefix.
app.include_router(orchestrator_router, prefix="/orchestrator")

# Enable CORS to allow the frontend (running on port 3000) to communicate with this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- DATA SCHEMAS (PYDANTIC) --------------------
# Request schema for the chat endpoint.
class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None

# Response schema for the chat endpoint.
class ChatResponse(BaseModel):
    response: str
    tools_used: Optional[List[str]] = None


# -------------------- API ROUTES --------------------

@app.get("/")
async def root():
    """Simple health check endpoint."""
    return {"message": "AI Agent with Dynamic MCP is running"}


@app.get("/api/tools")
async def list_tools():
    """Returns a list of tools available to the agent."""
    global agent
    if agent is None:
        return {"tools": []}
    return {"tools": [tool.name for tool in agent.tools.values()]}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Primary chat endpoint. Passes the user message to the smolagents agent.
    Runs the agent in a separate thread to avoid blocking the main async loop.
    """
    global agent

    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="Agent not initialized (startup may have failed)"
        )

    try:
        logger.info(f"User Request: {request.message}")
        
        # Construct the prompt with history if available for short-term context.
        prompt = request.message
        if request.history:
            history_str = "\n".join([f"{m['role']}: {m['content']}" for m in request.history])
            prompt = f"Previous conversation:\n{history_str}\n\nUser: {request.message}"

        # agent.run is a blocking call, so we wrap it in to_thread for async compatibility.
        result = await asyncio.to_thread(
            agent.run,
            prompt
        )

        return ChatResponse(
            response=str(result),
            tools_used=[t.name for t in agent.tools.values()] # Returning all available tools for now
        )

    except Exception as e:
        logger.error(f"Chat execution error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# -------------------- SERVER ENTRYPOINT --------------------
if __name__ == "__main__":
    import uvicorn

    # Run the server using Uvicorn.
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )