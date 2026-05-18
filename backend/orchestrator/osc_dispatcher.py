"""
OSC Dispatcher — sends macro values to Ableton Live and TouchDesigner via UDP.

Each tick the InterpolationEngine calls dispatch() with the current MacroState.
Two SimpleUDPClient instances (one per target) fire one OSC message per variable:

    /orchestrator/<field_name>    <value>

The field list is read dynamically from config.ALL_FIELDS on every dispatch call,
so variables added or removed at runtime (via the Config dashboard) are reflected
immediately without restarting the server.

python-osc is fire-and-forget: if the target is not running no exception is raised.
A startup log line confirms the configured addresses so the team can verify config
without hardware attached.
"""

import logging
import os

from pythonosc.udp_client import SimpleUDPClient

from . import config
from .models import MacroState

logger = logging.getLogger(__name__)

# OSC address pattern prefix
_PREFIX = "/orchestrator"


import logging
import os
import json

from pythonosc.udp_client import SimpleUDPClient

from . import config
from .models import MacroState

logger = logging.getLogger(__name__)

# OSC address pattern prefix
_PREFIX = "/orchestrator"

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "settings.json")

def _load_osc_settings() -> tuple[str, int]:
    """Load OSC host and port from settings.json."""
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            settings = json.load(f).get("orchestrator", {})
            return (
                settings.get("osc_host", "127.0.0.1"),
                int(settings.get("osc_port", 9000))
            )
    except Exception:
        return ("127.0.0.1", 9000)

class OscDispatcher:
    """Manages a configurable UDP OSC client."""

    def __init__(self) -> None:
        host, port = _load_osc_settings()
        self._client = SimpleUDPClient(host, port)

        logger.info(f"OSC dispatcher initialised — Target: {host}:{port}")

    def dispatch(self, state: MacroState) -> None:
        """Broadcast all macro values to the configured OSC target."""
        for field in config.ALL_FIELDS:
            val = getattr(state, field, None)
            if val is not None:
                # Use custom OSC path if defined, else default to /orchestrator/<name>
                addr = config.OSC_PATHS.get(field) or f"{_PREFIX}/{field}"
                self._client.send_message(addr, val)

