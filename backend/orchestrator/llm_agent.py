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
from smolagents.agents import PromptTemplates

logger = logging.getLogger(__name__)

# Silence verbose LiteLLM HTTP logs
logging.getLogger("LiteLLM").setLevel(logging.WARNING)

# MCP tools will be populated by main.py during startup.
mcp_tools = []

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

def _call_agent(user_prompt: str, show_id: str, current_status: dict | None = None) -> dict[str, Any]:
    """Synchronous agent call — run via asyncio.to_thread."""
    from .router import load_shows_data
    
    settings = _load_orchestrator_settings()
    
    # ── SHOW CONTEXT LOADING ──
    shows_data = load_shows_data()
    show_profile = next((s for s in shows_data["shows"] if s["id"] == show_id), None)
    
    show_context_text = "No specific show context provided."
    if show_profile:
        show_context_text = (
            f"Active Show: {show_profile.get('name', 'Unknown')}\n"
            f"Description: {show_profile.get('description', 'N/A')}\n"
            f"Genres: {', '.join(show_profile.get('genres', []))}\n"
            f"Core Vibes: {', '.join(show_profile.get('core_vibes', []))}"
        )

    # Favor settings.json (the Dashboard) over environment variables for runtime control.
    model_id = settings.get("model_id") or os.getenv("ORCHESTRATOR_MODEL_ID")
    api_base = settings.get("api_base", "https://openrouter.ai/api/v1")

    # Robust prefixing: if using OpenRouter but prefix is missing, add it.
    if "openrouter.ai" in api_base and model_id and not model_id.startswith("openrouter/"):
        model_id = f"openrouter/{model_id}"

    # LiteLLMModel automatically uses the environment variables for API keys/base
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    
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
    
    # Ensure mcp_tools is populated (it should be set by main.py)
    if not mcp_tools:
        logger.warning("No MCP tools available in llm_agent.mcp_tools. Agent will have limited capabilities.")

    # ── LOAD BEHAVIORAL GUIDELINES ──
    # Secondary instructions from file.
    guidelines_path = os.path.join(os.path.dirname(__file__), "..", "agent_instructions.txt")
    guidelines = ""
    try:
        with open(guidelines_path, "r", encoding="utf-8") as f:
            guidelines = f.read()
    except Exception as e:
        logger.warning(f"Could not load agent_instructions.txt: {e}")

    # ── PROMPT CONSTRUCTION ──
    # The UI Dashboard controls `raw_system_prompt` via settings.json.
    raw_dashboard_prompt = settings.get("system_prompt")
    if not raw_dashboard_prompt:
        raise LLMTranslationError("System prompt is missing in settings.json. Please configure it in the Dashboard.")

    # 1. Prepare dynamic variables
    var_defs = _get_variable_definitions_text()
    curr_state = json.dumps(current_status.get("current", {}), indent=2) if current_status else "{}"
    
    # 2. Combine Guidelines and Dashboard Prompt into a single instructions block
    # We follow the structure seen in prompt-sample.txt: Guidelines -> Show-Specific Instructions -> Dashboard Prompt
    instructions_block = guidelines
    instructions_block += "\n\n## Show-Specific Instructions:\n"
    instructions_block += raw_dashboard_prompt
    
    # 3. Resolve all placeholders in the combined instructions block
    # This handles placeholders in both the guidelines and the dashboard prompt.
    replacements = {
        "{{{VARIABLE_DEFINITIONS}}}": var_defs,
        "{{{CURRENT_STATE}}}": curr_state,
        "{{{SHOW_CONTEXT}}}": show_context_text,
        "{{{SHOW_ID}}}": show_id,
        "{{{GUIDELINES}}}": "", # Already included at the top
        "{{{tools_descriptions}}}": "" # Legacy
    }
    
    for k, v in replacements.items():
        instructions_block = instructions_block.replace(k, v)

    # ── AGENT CONSTRUCTION ──
    # We use the default smolagents template (which includes the ReAct preamble and tool list)
    # and inject our resolved instructions via the 'instructions' parameter.
    # We do NOT pass prompt_templates here to let smolagents use its full default set.
    agent = ToolCallingAgent(
        tools=mcp_tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions_block
    )

    # ── LOGGING: Output the fully compiled system prompt for debugging ──
    compiled_system_prompt = agent.system_prompt
    print("\n" + "="*80)
    print("FINAL COMPILED SYSTEM PROMPT (sent to model):")
    print("-"*80)
    print(compiled_system_prompt)
    print("-"*80)
    print(f"AVAILABLE TOOLS: {[t.name for t in agent.tools.values()]}")
    print("="*80 + "\n")

    # Run the agent — no extra kwargs needed; instructions are already baked in.
    result = agent.run(user_prompt)
    
    if isinstance(result, dict):
        return result
    
    try:
        return _extract_json(str(result))
    except Exception as exc:
        raise LLMTranslationError(f"Failed to parse JSON from agent. Final answer was: {result}")

async def translate_prompt(prompt: str, show_id: str = "default_show", duration_override: float | None = None, current_status: dict | None = None) -> Any:
    """
    Translate a semantic show-direction prompt into a MacroTarget.
    """
    from .models import MacroTarget
    from .config import load_variables
    
    try:
        data = await asyncio.to_thread(_call_agent, prompt, show_id, current_status)
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
