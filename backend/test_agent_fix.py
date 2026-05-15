
import os
import sys
import json
import logging
from unittest.mock import MagicMock

# Add backend to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

# Mock LiteLLMModel and ToolCallingAgent to avoid actual API calls
import smolagents
smolagents.LiteLLMModel = MagicMock()
smolagents.ToolCallingAgent = MagicMock()

from backend.orchestrator import llm_agent

# Mock tools
mock_tool = MagicMock()
mock_tool.name = "test_tool"
mock_tool.description = "A test tool"
llm_agent.mcp_tools = [mock_tool]

# Mock settings
llm_agent._load_orchestrator_settings = MagicMock(return_value={
    "model_id": "test-model",
    "system_prompt": "Show: {{{SHOW_ID}}}. Tools: {{{tools_descriptions}}}. State: {{{CURRENT_STATE}}}"
})

# Mock shows data
from backend.orchestrator import router
router.load_shows_data = MagicMock(return_value={"shows": [{"id": "test_show", "name": "Test Show"}]})

def test_prompt_construction():
    print("Testing prompt construction...")
    try:
        # We don't want agent.run to actually do anything, but we want to see the prints
        llm_agent._call_agent("hello", "test_show", {"current": {"vol": 0.5}})
    except Exception as e:
        # It will likely fail at agent.run() because we mocked it, but that's after the print
        print(f"Caught expected exception during run: {e}")

if __name__ == "__main__":
    test_prompt_construction()
