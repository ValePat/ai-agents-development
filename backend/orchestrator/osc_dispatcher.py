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


class OscDispatcher:
    """Manages two UDP OSC clients: one for Ableton, one for TouchDesigner."""

    def __init__(self) -> None:
        ableton_host = os.getenv("ABLETON_OSC_HOST", "127.0.0.1")
        ableton_port = int(os.getenv("ABLETON_OSC_PORT", "9000"))
        td_host = os.getenv("TD_OSC_HOST", "127.0.0.1")
        td_port = int(os.getenv("TD_OSC_PORT", "9001"))

        self._ableton = SimpleUDPClient(ableton_host, ableton_port)
        self._td = SimpleUDPClient(td_host, td_port)

        logger.info(
            "OSC dispatcher initialised — "
            f"Ableton: {ableton_host}:{ableton_port}  "
            f"TouchDesigner: {td_host}:{td_port}"
        )

    def dispatch(self, state: MacroState) -> None:
        """Broadcast all macro values to both OSC targets."""
        for client in (self._ableton, self._td):
            for field in config.ALL_FIELDS:
                val = getattr(state, field, None)
                if val is not None:
                    # Use custom OSC path if defined, else default to /orchestrator/<name>
                    addr = config.OSC_PATHS.get(field) or f"{_PREFIX}/{field}"
                    client.send_message(addr, val)
