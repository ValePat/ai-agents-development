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

from smolagents.tools import ToolCollection
from mcp import StdioServerParameters

from orchestrator.router import router as orchestrator_router
import orchestrator.router as orchestrator_router_module
import orchestrator.llm_agent as llm_agent_module
from orchestrator.interpolation_engine import InterpolationEngine
from config_router import router as config_router

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

# -------------------- SETTINGS BOOTSTRAP --------------------
# Pre-populate env vars from settings.json so config_router defaults are honoured
# even before the first PUT /api/settings/orchestrator call.
def _bootstrap_settings_env() -> None:
    settings_file = os.path.join(os.path.dirname(__file__), "settings.json")
    try:
        with open(settings_file, "r", encoding="utf-8") as f:
            s = json.load(f)
        orch = s.get("orchestrator", {})
        if "model_id" in orch and not os.getenv("ORCHESTRATOR_MODEL_ID"):
            os.environ["ORCHESTRATOR_MODEL_ID"] = orch["model_id"]
        if "temperature" in orch and not os.getenv("ORCHESTRATOR_TEMPERATURE"):
            os.environ["ORCHESTRATOR_TEMPERATURE"] = str(orch["temperature"])
        if "max_tokens" in orch and not os.getenv("ORCHESTRATOR_MAX_TOKENS"):
            os.environ["ORCHESTRATOR_MAX_TOKENS"] = str(orch["max_tokens"])
        if "max_steps" in orch and not os.getenv("ORCHESTRATOR_MAX_STEPS"):
            os.environ["ORCHESTRATOR_MAX_STEPS"] = str(orch["max_steps"])
    except Exception:
        pass  # Non-fatal; defaults still apply

_bootstrap_settings_env()

# -------------------- GLOBALS --------------------
# The MCP tools are initialized once at startup and made available for the orchestrator agent.
mcp_tools = []

# The interpolation engine singleton — started in lifespan.
interpolation_engine: InterpolationEngine | None = None

# AsyncExitStack manages the lifecycle of multiple asynchronous context managers.
# We use it to ensure all MCP server connections are closed properly on shutdown.
exit_stack = AsyncExitStack()

# -------------------- SANDBOX DIRECTORY --------------------
# Define a safe directory for filesystem operations. This ensures the agent
# remains sandboxed and cannot access files outside of this path.
SAFE_DIR = os.path.abspath("sandbox")
os.makedirs(SAFE_DIR, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mcp_tools, exit_stack, interpolation_engine

    # -------- ORCHESTRATOR ENGINE STARTUP --------
    # Start the 60 Hz interpolation engine.
    interpolation_engine = InterpolationEngine()
    orchestrator_router_module.engine = interpolation_engine
    interpolation_engine.start()
    logger.info("✓ Orchestrator interpolation engine started.")

    try:
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
                
                # Also replace in environment variables if present
                processed_env = config.get("env")
                if processed_env:
                    processed_env = {k: v.replace("{{SAFE_DIR}}", SAFE_DIR) for k, v in processed_env.items()}
                
                logger.info(f"Starting MCP server: {server_name} ({command} {' '.join(processed_args)})")
                
                # Define connection parameters for the MCP server (Stdio transport).
                server_params = StdioServerParameters(
                    command=command,
                    args=processed_args,
                    env=processed_env
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

        # Expose tools globally for orchestrator
        mcp_tools = all_tools
        llm_agent_module.mcp_tools = all_tools

        if all_tools:
            logger.info(f"✓ Total MCP tools available: {[t.name for t in all_tools]}")
        else:
            logger.warning("⚠️ No MCP tools loaded; orchestrator agent will have no tool capabilities.")

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
        mcp_tools = []
        logger.info("✓ Shutdown complete; all MCP connections closed.")


# -------------------- FASTAPI APPLICATION --------------------
app = FastAPI(
    title="Show Orchestrator API",
    lifespan=lifespan
)

# Include the orchestrator router under /orchestrator prefix.
app.include_router(orchestrator_router, prefix="/orchestrator")

# Include the configuration router under /api prefix.
app.include_router(config_router, prefix="/api")

# Enable CORS to allow the frontend (running on port 3000) to communicate with this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- API ROUTES --------------------

@app.get("/")
async def root():
    """Simple health check endpoint."""
    return {"message": "Show Orchestrator API is running"}


# -------------------- SERVER ENTRYPOINT --------------------
if __name__ == "__main__":
    import uvicorn

    # Run the server using Uvicorn.
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )