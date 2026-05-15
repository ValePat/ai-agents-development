# Agent Tool Usage & Guidelines Fix Plan

## Problem Statement
The Orchestrator agent is failing to utilize MCP tools (Filesystem, Memory). This is caused by:
1.  **Prompt Overwriting**: The code manually overwrites the `smolagents` system prompt template, removing the framework's internal logic for tool calling.
2.  **Restrictive Prompting**: The `system_prompt` in `settings.json` forbids the agent from outputting anything other than raw JSON, which prevents it from generating "thoughts" or "tool calls."
3.  **Ignored Guidelines**: The `agent_instructions.txt` file is documented as the "behavioral boundary" but is never actually loaded or read by the code.
4.  **Missing Termination**: The agent is not instructed to use the mandatory `final_answer` tool to return its result.

## Proposed Changes

### 1. Update `backend/orchestrator/llm_agent.py`
Modify the `_call_agent` function to load the guidelines and stop overwriting the core template.

```python
# In llm_agent.py

def _call_agent(user_prompt: str, show_id: str, current_status: dict | None = None) -> dict[str, Any]:
    # ... (existing loading logic) ...

    # NEW: Load behavioral guidelines from agent_instructions.txt
    guidelines_path = os.path.join(os.path.dirname(__file__), "..", "agent_instructions.txt")
    guidelines = ""
    try:
        with open(guidelines_path, "r", encoding="utf-8") as f:
            guidelines = f.read()
    except Exception as e:
        logger.warning(f"Could not load agent_instructions.txt: {e}")

    # ... (existing prompt replacement logic for var_defs, etc.) ...

    # NEW: Combine guidelines with show-specific rules
    # This ensures the agent knows its safety boundaries AND show goals.
    custom_instructions = f"{guidelines}\n\n## Show-Specific Instructions:\n{system_prompt}"

    # FIX: Remove this line that breaks smolagents tool calling:
    # agent.prompt_templates["system_prompt"] = system_prompt 

    # RUN: Pass custom_instructions to the run method
    result = agent.run(user_prompt, custom_instructions=custom_instructions)
    
    # ...
```

### 2. Update `backend/settings.json`
Refine the `system_prompt` to allow tool use and mandate the `final_answer` tool.

**Current (Restrictive):**
> "You MUST end your response with the final JSON object. Output ONLY the JSON object as your final answer, no extra text or markdown code blocks."

**Proposed (Collaborative):**
> "You must provide your final macro translation as a JSON object using the 'final_answer' tool. You are encouraged to use MCP tools to check context or memory before providing the final answer if the user's request is complex or refers to past state."

### 3. Verification Strategy
1.  **Log Inspection**: Verify that the "FINAL COMPILED SYSTEM PROMPT" log shows both the `smolagents` internal instructions AND the custom show rules.
2.  **Tool Triggering**: Send a prompt like *"Check my memory for my favorite vibe and then set the state"* and verify in the backend console that `retrieve_memory` is called.
3.  **JSON Validation**: Ensure the final output still arrives as a valid JSON object despite the model now being allowed to "think."

## Impact
Aligns the codebase with the project's architectural documentation (`README.md`, `AGENTS.md`) and enables the "Autonomous Development" capabilities requested for the orchestrator.
