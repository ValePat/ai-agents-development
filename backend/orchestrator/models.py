"""
Pydantic schemas for the Real-Time Show Orchestrator.
"""

from typing import Optional
from pydantic import BaseModel, Field


class MacroState(BaseModel):
    """Current or target state of the 4 show macro parameters (all values 0.0–1.0)."""
    energy: float = Field(default=0.5, ge=0.0, le=1.0, description="Overall energy level")
    tension: float = Field(default=0.5, ge=0.0, le=1.0, description="Harmonic and rhythmic tension")
    rhythm_density: float = Field(default=0.5, ge=0.0, le=1.0, description="Density of rhythmic elements")
    atmosphere: float = Field(default=0.5, ge=0.0, le=1.0, description="Ambient/textural atmosphere level")


class MacroTarget(MacroState):
    """A target MacroState plus a transition duration in seconds."""
    duration: float = Field(default=4.0, ge=0.1, description="Transition duration in seconds")


class PromptRequest(BaseModel):
    """Request body for POST /orchestrator/prompt."""
    prompt: str = Field(..., description="Semantic description of the desired show state")
    duration: Optional[float] = Field(default=None, ge=0.1, description="Override LLM-suggested duration (seconds)")


class OverrideRequest(BaseModel):
    """Request body for POST /orchestrator/override — pins one field to a manual value."""
    field: str = Field(..., description="Macro field name: energy | tension | rhythm_density | atmosphere")
    value: float = Field(..., ge=0.0, le=1.0, description="Pinned value (0.0–1.0)")


class CalibrationRequest(BaseModel):
    """Request body for POST /orchestrator/calibrate — adjusts per-macro output clamping."""
    energy_min: float = Field(default=0.0, ge=0.0, le=1.0)
    energy_max: float = Field(default=1.0, ge=0.0, le=1.0)
    tension_min: float = Field(default=0.0, ge=0.0, le=1.0)
    tension_max: float = Field(default=1.0, ge=0.0, le=1.0)
    rhythm_density_min: float = Field(default=0.0, ge=0.0, le=1.0)
    rhythm_density_max: float = Field(default=1.0, ge=0.0, le=1.0)
    atmosphere_min: float = Field(default=0.0, ge=0.0, le=1.0)
    atmosphere_max: float = Field(default=1.0, ge=0.0, le=1.0)


class OrchestratorStatus(BaseModel):
    """Full state snapshot broadcast over WebSocket and returned by GET /status."""
    current: MacroState
    target: MacroTarget
    is_interpolating: bool
    elapsed_seconds: float
    pinned_fields: list[str] = Field(default_factory=list)
