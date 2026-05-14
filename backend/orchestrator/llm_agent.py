"""
LLM Agent for macro translation.

Calls Gemini Flash (via OpenRouter + LiteLLM) with response_format=json_object.
Returns a validated MacroTarget from a semantic show-direction prompt.

Usage
-----
    from orchestrator.llm_agent import translate_prompt

    target = await translate_prompt("Build tension towards a climax over 8 seconds")

Design notes
------------
- litellm.completion() is synchronous; wrapped in asyncio.to_thread.
- JSON mode is used (not function-calling) for reliability with Gemini Flash.
- All returned float values are clamped to [0.0, 1.0] as a safety measure.
- LLMTranslationError is raised on parse failure so the router returns HTTP 422.
"""

import asyncio
import json
import logging
import os
from typing import Any

import litellm

logger = logging.getLogger(__name__)

# Silence verbose LiteLLM HTTP logs
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

def _load_orchestrator_settings() -> dict:
    """Load orchestrator settings from settings.json if available."""
    settings_file = os.path.join(os.path.dirname(__file__), "..", "settings.json")
    try:
        with open(settings_file, "r", encoding="utf-8") as f:
            return json.load(f).get("orchestrator", {})
    except Exception:
        return {}


def _build_system_prompt() -> str:
    """Build the system prompt dynamically from config and settings."""
    from .config import load_variables

    settings = _load_orchestrator_settings()
    variables = load_variables()
    
    prefix = settings.get(
        "system_prompt_prefix",
        "You are a musical macro translator for a live show conductor system.\n"
        "Given a plain-language description of the desired show state, return ONLY a JSON object\n"
        "with the following fields:\n\n",
    )
    rules = settings.get(
        "system_prompt_rules",
        "- Output ONLY the JSON object. No explanations, no markdown, no code blocks.\n"
        "- All numeric values must stay within their specified ranges.\n"
        "- duration must be a positive number (minimum 0.5).\n"
        "- Interpret the prompt creatively but literally for the intended live-show context.",
    )

    prompt = prefix
    prompt += "Numeric fields:\n"
    for v in variables:
        if v["type"] == "numeric":
            v_min = v.get("min", 0.0)
            v_max = v.get("max", 1.0)
            prompt += f'- "{v["name"]}": {v["description"]} (Range: [{v_min}, {v_max}])\n'

    prompt += "\nString fields (short expressive descriptions):\n"
    for v in variables:
        if v["type"] == "string":
            prompt += f'- "{v["name"]}": {v["description"]}\n'

    prompt += '\n- "duration": Transition duration in seconds (typically 2–16 s)\n'

    prompt += "\nRules:\n"
    prompt += rules + "\n"

    return prompt


class LLMTranslationError(Exception):
    """Raised when the LLM response cannot be parsed into a valid MacroTarget."""


def _call_llm(prompt: str, model_id: str, api_key: str) -> dict[str, Any]:
    """Synchronous LiteLLM call — run via asyncio.to_thread."""
    system_prompt = _build_system_prompt()

    # Allow runtime overrides from config_router (written to env vars)
    try:
        temperature = float(os.getenv("ORCHESTRATOR_TEMPERATURE", "0.4"))
    except ValueError:
        temperature = 0.4
    try:
        max_tokens = int(os.getenv("ORCHESTRATOR_MAX_TOKENS", "512"))
    except ValueError:
        max_tokens = 512

    response = litellm.completion(
        model=model_id,
        api_key=api_key,
        api_base="https://openrouter.ai/api/v1",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=temperature,
        max_tokens=max_tokens,
    )
    raw = response.choices[0].message.content or ""
    return json.loads(raw)


async def translate_prompt(prompt: str, duration_override: float | None = None) -> Any:
    """
    Translate a semantic show-direction prompt into a MacroTarget.

    Parameters
    ----------
    prompt:
        Natural-language show direction, e.g. "Build to a climax over 8 seconds".
    duration_override:
        If provided, replaces the LLM-suggested duration (for UI slider control).

    Raises
    ------
    LLMTranslationError
        When the LLM output cannot be parsed or validated.
    """
    from .models import MacroTarget
    from .config import load_variables
    
    model_id = os.getenv(
        "ORCHESTRATOR_MODEL_ID",
        "openrouter/google/gemini-3.1-flash-lite"
    )
    api_key = os.getenv("OPENROUTER_API_KEY", "")

    if not api_key:
        logger.warning("OPENROUTER_API_KEY not set; LLM call will likely fail")

    try:
        data = await asyncio.to_thread(_call_llm, prompt, model_id, api_key)
    except json.JSONDecodeError as exc:
        raise LLMTranslationError(f"LLM returned non-JSON: {exc}") from exc
    except Exception as exc:
        raise LLMTranslationError(f"LLM call failed: {exc}") from exc

    # Load variable definitions for clamping
    variables = load_variables()
    ranges = {
        v["name"]: (v.get("min", 0.0), v.get("max", 1.0), v.get("default", 0.5))
        for v in variables if v["type"] == "numeric"
    }

    # Clamp all macro floats to their specific ranges
    for field, (v_min, v_max, v_default) in ranges.items():
        if field in data:
            try:
                data[field] = max(v_min, min(v_max, float(data[field])))
            except (ValueError, TypeError):
                data[field] = v_default

    if duration_override is not None:
        data["duration"] = duration_override
    elif "duration" in data:
        try:
            data["duration"] = max(0.5, float(data["duration"]))
        except (ValueError, TypeError):
            data["duration"] = 4.0

    try:
        target = MacroTarget(**data)
    except Exception as exc:
        raise LLMTranslationError(f"MacroTarget validation failed: {exc}") from exc

    logger.info(f"LLM translated prompt → {target.model_dump()}")
    return target
