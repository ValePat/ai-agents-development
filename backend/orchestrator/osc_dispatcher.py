"""
OSC Dispatcher — sends macro values to Ableton Live and TouchDesigner via UDP.

Each tick the InterpolationEngine calls dispatch() with the current MacroState.
Two SimpleUDPClient instances (one per target) fire four OSC messages:

    /orchestrator/energy          <float>
    /orchestrator/tension         <float>
    /orchestrator/rhythm_density  <float>
    /orchestrator/atmosphere      <float>

python-osc is fire-and-forget: if the target is not running no exception is raised.
A startup log line confirms the configured addresses so the team can verify config
without hardware attached.
"""

import logging
import os

from pythonosc.udp_client import SimpleUDPClient

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
        """Broadcast all four macro values to both OSC targets."""
        for client in (self._ableton, self._td):
            client.send_message(f"{_PREFIX}/energy", float(state.energy))
            client.send_message(f"{_PREFIX}/tension", float(state.tension))
            client.send_message(f"{_PREFIX}/rhythm_density", float(state.rhythm_density))
            client.send_message(f"{_PREFIX}/atmosphere", float(state.atmosphere))
