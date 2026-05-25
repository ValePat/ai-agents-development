"""
OSC Dispatcher — sends macro values to Ableton Live and TouchDesigner via UDP.

Each tick the InterpolationEngine calls dispatch() with the current MacroState.
It maintains multiple SimpleUDPClient instances based on variable categories:
Music, Visual, and Lights.

    /orchestrator/<field_name>    <value>

The field list and categories are read dynamically from config,
so variables added or removed at runtime are reflected immediately.

python-osc is fire-and-forget: if the target is not running no exception is raised.
"""

import logging
import os
import json
from typing import Any

from pythonosc.udp_client import SimpleUDPClient

from . import config
from .models import MacroState

logger = logging.getLogger(__name__)

# OSC address pattern prefix
_PREFIX = "/orchestrator"

SETTINGS_FILE = os.path.join(os.path.dirname(__file__), "..", "settings.json")

def _load_osc_settings() -> dict[str, dict[str, Any]]:
    """Load OSC targets from settings.json."""
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            settings = json.load(f).get("orchestrator", {})
            return settings.get("osc_targets", {
                "Music": {"host": "127.0.0.1", "port": 9000},
                "Visual": {"host": "127.0.0.1", "port": 9001},
                "Lights": {"host": "127.0.0.1", "port": 9002}
            })
    except Exception:
        return {
            "Music": {"host": "127.0.0.1", "port": 9000},
            "Visual": {"host": "127.0.0.1", "port": 9001},
            "Lights": {"host": "127.0.0.1", "port": 9002}
        }

class OscDispatcher:
    """Manages multiple UDP OSC clients based on variable categories."""

    def __init__(self) -> None:
        targets = _load_osc_settings()
        self._clients: dict[str, SimpleUDPClient] = {}
        
        for category, target in targets.items():
            host = target.get("host", "127.0.0.1")
            port = int(target.get("port", 9000))
            self._clients[category] = SimpleUDPClient(host, port)
            logger.info(f"OSC dispatcher initialised for {category} — Target: {host}:{port}")

    def dispatch(self, state: MacroState) -> None:
        """Broadcast all macro values to their respective OSC targets based on category."""
        for field in config.ALL_FIELDS:
            val = getattr(state, field, None)
            if val is not None:
                category = config.VARIABLE_CATEGORIES.get(field, "Music")
                client = self._clients.get(category)
                
                if client:
                    # Use custom OSC path if defined, else default to /orchestrator/<name>
                    addr = config.OSC_PATHS.get(field) or f"{_PREFIX}/{field}"
                    client.send_message(addr, val)
                else:
                    logger.warning(f"No OSC client found for category '{category}' (field: {field})")
