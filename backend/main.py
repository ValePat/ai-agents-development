import os
import logging
import asyncio
from contextlib import asynccontextmanager, AsyncExitStack
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from smolagents import LiteLLMModel, ToolCallingAgent
from smolagents.tools import ToolCollection
from mcp import StdioServerParameters

# -------------------- WINDOWS FIX (IMPORTANTISSIMO) --------------------

if os.name == "nt":
    asyncio.set_event_loop_policy(
        asyncio.WindowsProactorEventLoopPolicy()
    )

# -------------------- CONFIG --------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

load_dotenv()

# -------------------- GLOBALS --------------------

agent = None
exit_stack = AsyncExitStack()

# -------------------- SAFE DIR --------------------

SAFE_DIR = os.path.abspath("sandbox")
os.makedirs(SAFE_DIR, exist_ok=True)

# -------------------- LIFESPAN --------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent, exit_stack

    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    MODEL_ID = os.getenv(
        "MODEL_ID",
        "openrouter/anthropic/claude-3-5-sonnet"
    )

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not found")

    try:
        # -------- MODEL --------
        model = LiteLLMModel(
            model_id=MODEL_ID,
            api_key=OPENROUTER_API_KEY,
            api_base="https://openrouter.ai/api/v1"
        )

        # -------- MCP SERVER (FILESYSTEM) --------
        filesystem_params = StdioServerParameters(
            command="npx",
            args=[
                "-y",
                "@modelcontextprotocol/server-filesystem",
                SAFE_DIR
            ],
        )

        logger.info(f"MCP starting with dir: {SAFE_DIR}")

        # -------- TOOL COLLECTION (MCP ADAPTER) --------
        tc_context = ToolCollection.from_mcp(
            filesystem_params,
            trust_remote_code=True
        )

        tc = exit_stack.enter_context(tc_context)
        tools = list(tc.tools)

        # -------- SAFETY CHECK --------
        if not tools:
            raise RuntimeError("❌ MCP tools not loaded (filesystem server failed)")

        logger.info(f"✓ MCP tools loaded: {[t.name for t in tools]}")

        # -------- AGENT --------
        agent = ToolCallingAgent(
            tools=tools,
            model=model,
        )

        logger.info("✓ Agent initialized with MCP")

        yield

    except Exception as e:
        logger.error(f"Startup error: {e}", exc_info=True)
        raise

    finally:
        await exit_stack.aclose()
        agent = None
        logger.info("✓ Shutdown complete")


# -------------------- FASTAPI --------------------

app = FastAPI(
    title="AI Agent API (MCP enabled)",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- SCHEMAS --------------------

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    response: str
    tools_used: Optional[List[str]] = None


# -------------------- ROUTES --------------------

@app.get("/")
async def root():
    return {"message": "AI Agent with MCP is running"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    global agent

    if agent is None:
        raise HTTPException(
            status_code=503,
            detail="Agent not initialized"
        )

    try:
        logger.info(f"User: {request.message}")

        result = await asyncio.to_thread(
            agent.run,
            request.message
        )

        return ChatResponse(
            response=str(result),
            tools_used=None
        )

    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# -------------------- ENTRYPOINT --------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )