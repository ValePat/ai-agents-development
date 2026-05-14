"""
Configuration API Router.

Provides REST endpoints for reading and updating fine-tuning controls for:
- Chat agent (model, system prompt, temperature, max_steps)
- Orchestrator LLM agent (model, system prompt prefix/rules, temperature, max_tokens)
- Interpolation engine settings (tick rate, transition durations)

All settings are persisted to settings.json and applied at runtime where possible.
"""

import json
import logging
import os
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "settings.json")

router = APIRouter(tags=["config"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class OrchestratorSettings(BaseModel):
    model_id: str = Field(..., description="OpenRouter model ID for the orchestrator LLM")
    api_base: str = Field(default="https://openrouter.ai/api/v1", description="API base URL for the LLM provider")
    system_prompt: str = Field(..., description="Full system prompt injected into the orchestrator agent")
    max_steps: int = Field(default=10, ge=1, le=50, description="Maximum reasoning steps per request")
    temperature: float = Field(default=0.4, ge=0.0, le=2.0, description="Sampling temperature")
    max_tokens: int = Field(default=512, ge=64, le=4096, description="Max tokens in LLM response")
    tick_rate: int = Field(default=60, ge=1, le=120, description="Interpolation engine tick rate (Hz)")
    default_transition_duration: float = Field(default=4.0, ge=0.1, le=120.0, description="Default macro transition duration (seconds)")
    min_transition_duration: float = Field(default=0.5, ge=0.1, le=10.0, description="Minimum allowed transition duration (seconds)")


class FullSettings(BaseModel):
    orchestrator: OrchestratorSettings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_settings() -> dict:
    if not os.path.exists(SETTINGS_FILE):
        raise FileNotFoundError(f"settings.json not found at {SETTINGS_FILE}")
    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_settings(data: dict) -> None:
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=FullSettings)
async def get_settings() -> FullSettings:
    """Return the full settings document."""
    try:
        data = _load_settings()
        return FullSettings(**data)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"Failed to read settings: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/settings/orchestrator", response_model=OrchestratorSettings)
async def update_orchestrator_settings(settings: OrchestratorSettings) -> OrchestratorSettings:
    """
    Update orchestrator settings and apply compatible changes at runtime.

    - system_prompt / temperature / max_tokens / max_steps are applied
      immediately (they are read per-request in llm_agent.py).
    - tick_rate / transition duration changes require a restart to take full effect.
    """
    try:
        data = _load_settings()
        data["orchestrator"] = settings.model_dump()
        _save_settings(data)

        # Push key settings into env vars so llm_agent picks them up
        os.environ["ORCHESTRATOR_MODEL_ID"] = settings.model_id
        os.environ["ORCHESTRATOR_TEMPERATURE"] = str(settings.temperature)
        os.environ["ORCHESTRATOR_MAX_TOKENS"] = str(settings.max_tokens)
        os.environ["ORCHESTRATOR_MAX_STEPS"] = str(settings.max_steps)

        logger.info(
            f"Orchestrator settings updated: model={settings.model_id} "
            f"temp={settings.temperature} max_tokens={settings.max_tokens} "
            f"max_steps={settings.max_steps}"
        )

        return settings
    except Exception as exc:
        logger.error(f"Failed to update orchestrator settings: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/settings/defaults")
async def get_defaults():
    """Return a list of well-known OpenRouter model IDs as suggestions."""
    return {
        "suggested_models": [
            "openrouter/anthropic/claude-3-5-haiku",
            "openrouter/anthropic/claude-3-5-sonnet",
            "openrouter/anthropic/claude-3-opus",
            "openrouter/google/gemini-3.1-flash-lite",
            "openrouter/google/gemini-2.0-flash-001",
            "openrouter/openai/gpt-4o-mini",
            "openrouter/openai/gpt-4o",
            "openrouter/meta-llama/llama-3.3-70b-instruct",
            "openrouter/mistralai/mistral-small-3.1-24b-instruct",
        ]
    }
