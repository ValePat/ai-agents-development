import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from dotenv import load_dotenv
from smolagents import CodeAgent, LiteLLMModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

# Load environment variables
load_dotenv()

# Track tool usage (Note: smolagents tracks its own internal steps, 
# but we'll keep this structure if you decide to add manual logging later)
_tool_calls = []

# Global agent variable
agent = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global agent
    
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    MODEL_ID = os.getenv("MODEL_ID", "openrouter/anthropic/claude-3-5-sonnet")

    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not found in environment variables.")

    # Initialize the model via LiteLLM
    model = LiteLLMModel(
        model_id=MODEL_ID,
        api_key=OPENROUTER_API_KEY,
        api_base="https://openrouter.ai/api/v1"
    )

    # Initialize the Agent without custom MCP/Skills tools
    # add_base_tools=True gives the agent built-in capabilities like DuckDuckGo search if installed
    agent = CodeAgent(
        tools=[], 
        model=model, 
        add_base_tools=True
    )
    
    logger.info("✓ Agent initialized successfully")
    yield
    agent = None

app = FastAPI(title="AI Agent API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    response: str
    tools_used: Optional[List[str]] = None

@app.get("/")
async def root():
    return {"message": "AI Agent Backend is running"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if agent is None:
        raise HTTPException(status_code=503, detail="Agent not initialized")
    
    try:
        logger.info(f"User message: {request.message}")
        
        # Run the agent. Smolagents handles the thought/action loop automatically.
        result = agent.run(request.message)
        
        # In smolagents, tools used are often part of the internal memory. 
        # For now, returning an empty list as we removed custom tool logging.
        return ChatResponse(
            response=str(result), 
            tools_used=None 
        )
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)