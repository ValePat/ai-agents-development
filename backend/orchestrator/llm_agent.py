"""
LLM Agent for macro translation.

Uses smolagents.ToolCallingAgent with MCP tools and LiteLLM.
Returns a validated MacroTarget from a semantic show-direction prompt.
"""

import asyncio
import json
import logging
import os
import re
from typing import Any

from smolagents import LiteLLMModel, ToolCallingAgent

logger = logging.getLogger(__name__)

# Silence verbose LiteLLM HTTP logs
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

class LLMTranslationError(Exception):
    """Raised when the LLM response cannot be parsed into a valid MacroTarget."""

def _load_orchestrator_settings() -> dict:
    """Load orchestrator settings from settings.json if available."""
    settings_file = os.path.join(os.path.dirname(__file__), "..", "settings.json")
    try:
        with open(settings_file, "r", encoding="utf-8") as f:
            return json.load(f).get("orchestrator", {})
    except Exception:
        return {}

def _get_variable_definitions_text() -> str:
    """Generate a string representation of macro variables for the prompt."""
    from .config import load_variables
    variables = load_variables()
    
    text = "Numeric fields (Float [min, max]):\n"
    for v in variables:
        if v["type"] == "numeric":
            v_min = v.get("min", 0.0)
            v_max = v.get("max", 1.0)
            text += f'- "{v["name"]}": {v["description"]} (Range: [{v_min}, {v_max}])\n'

    text += "\nString fields (Short descriptions):\n"
    for v in variables:
        if v["type"] == "string":
            text += f'- "{v["name"]}": {v["description"]}\n'

    text += '\n- "duration": Transition duration in seconds (Float, typically 2.0-16.0)\n'
    return text

def _extract_json(text: str) -> dict:
    """Extract the first valid JSON object from the text."""
    # Try to find JSON in markdown blocks first
    match = re.search(r"```json\s*(.*?)\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
            
    # Fallback: try to find anything between { and }
    match = re.search(r"(\{.*\})", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
            
    # Last resort: just try to parse the whole thing
    return json.loads(text)

def _call_agent(user_prompt: str, current_status: dict | None = None) -> dict[str, Any]:
    """Synchronous agent call — run via asyncio.to_thread."""
    import main as main_module
    
    settings = _load_orchestrator_settings()
    
    model_id = os.getenv("ORCHESTRATOR_MODEL_ID", settings.get("model_id"))
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    api_base = settings.get("api_base", "https://openrouter.ai/api/v1")
    
    if not model_id:
        raise LLMTranslationError("ORCHESTRATOR_MODEL_ID not configured in settings or environment.")

    try:
        temperature = float(os.getenv("ORCHESTRATOR_TEMPERATURE", str(settings.get("temperature", 0.4))))
    except ValueError:
        temperature = 0.4
        
    try:
        max_steps = int(os.getenv("ORCHESTRATOR_MAX_STEPS", str(settings.get("max_steps", 10))))
    except ValueError:
        max_steps = 10

    model = LiteLLMModel(
        model_id=model_id,
        api_key=api_key,
        api_base=api_base,
        temperature=temperature
    )
    
    agent = ToolCallingAgent(
        tools=main_module.mcp_tools,
        model=model,
        max_steps=max_steps
    )
    
    # ── PROMPT CONSTRUCTION (Strictly Driven by Settings) ──
    raw_system_prompt = settings.get("system_prompt", "You are a macro translator.")
    
    # Replace placeholders
    var_defs = _get_variable_definitions_text()
    curr_state = json.dumps(current_status.get("current_values", {}), indent=2) if current_status else "{}"
    
    system_prompt = raw_system_prompt.replace("{{VARIABLE_DEFINITIONS}}", var_defs)
    system_prompt = system_prompt.replace("{{CURRENT_STATE}}", curr_state)
    
    # ── LOGGING: Output exact system prompt to console ──
    print("\n" + "="*80)
    print("FINAL COMPILED SYSTEM PROMPT:")
    print("-"*80)
    print(system_prompt)
    print("="*80 + "\n")

    # smolagents uses 'system_prompt' as its core instruction set
    agent.prompt_templates["system_prompt"] = system_prompt
    
    # Run the agent with the user's specific request
    # Note: We don't wrap the user_prompt in any hardcoded context here.
    # The instructions on what to return should be in the system_prompt.
    result = agent.run(user_prompt)
    
    if isinstance(result, dict):
        return result
    
    try:
        return _extract_json(str(result))
    except Exception as exc:
        raise LLMTranslationError(f"Failed to parse JSON from agent. Final answer was: {result}")

async def translate_prompt(prompt: str, duration_override: float | None = None, current_status: dict | None = None) -> Any:
    """
    Translate a semantic show-direction prompt into a MacroTarget.
    """
    from .models import MacroTarget
    from .config import load_variables
    
    try:
        data = await asyncio.to_thread(_call_agent, prompt, current_status)
    except Exception as exc:
        logger.error(f"Agent call failed: {exc}")
        raise LLMTranslationError(str(exc)) from exc

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
        # Filter extra fields
        valid_fields = set(ranges.keys()) | {v["name"] for v in variables if v["type"] == "string"} | {"duration"}
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        target = MacroTarget(**filtered_data)
    except Exception as exc:
        raise LLMTranslationError(f"MacroTarget validation failed: {exc}") from exc

    logger.info(f"Agent translated prompt → {target.model_dump()}")
    return target
