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

from .models import MacroTarget

logger = logging.getLogger(__name__)

# Silence verbose LiteLLM HTTP logs
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

_SYSTEM_PROMPT = """\
You are a musical macro translator for a live show conductor system.
Given a plain-language description of the desired show state, return ONLY a JSON object
with the following fields (all floats in the range [0.0, 1.0]) plus a duration in seconds:

{
  "energy":          <0.0–1.0>  // Overall intensity/energy of the moment
  "tension":         <0.0–1.0>  // Harmonic and rhythmic tension (high = dissonant, tight)
  "rhythm_density":  <0.0–1.0>  // Density of rhythmic/percussive elements
  "atmosphere":      <0.0–1.0>  // Ambient/textural presence (high = lush, reverb-heavy)
  "duration":        <seconds>  // How long the transition should take (typically 2–16 s)
}

Rules:
- Output ONLY the JSON object. No explanations, no markdown, no code blocks.
- All float values must be between 0.0 and 1.0 inclusive.
- duration must be a positive number (minimum 0.5).
- Interpret the prompt creatively but literally for the intended live-show context.
"""


class LLMTranslationError(Exception):
    """Raised when the LLM response cannot be parsed into a valid MacroTarget."""


def _call_llm(prompt: str, model_id: str, api_key: str) -> dict[str, Any]:
    """Synchronous LiteLLM call — run via asyncio.to_thread."""
    response = litellm.completion(
        model=model_id,
        api_key=api_key,
        api_base="https://openrouter.ai/api/v1",
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
        max_tokens=256,
    )
    raw = response.choices[0].message.content or ""
    return json.loads(raw)


async def translate_prompt(prompt: str, duration_override: float | None = None) -> MacroTarget:
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

    # Clamp all macro floats to [0.0, 1.0]
    for field in ("energy", "tension", "rhythm_density", "atmosphere"):
        if field in data:
            data[field] = max(0.0, min(1.0, float(data[field])))

    if duration_override is not None:
        data["duration"] = duration_override
    elif "duration" in data:
        data["duration"] = max(0.5, float(data["duration"]))

    try:
        target = MacroTarget(**data)
    except Exception as exc:
        raise LLMTranslationError(f"MacroTarget validation failed: {exc}") from exc

    logger.info(f"LLM translated prompt → {target.model_dump()}")
    return target
