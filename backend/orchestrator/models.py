"""
Pydantic schemas for the Real-Time Show Orchestrator.
Dynamic models based on variables.json.
"""

from typing import Optional, List, Dict, Any, Type
from pydantic import BaseModel, Field, ConfigDict, create_model
from .config import load_variables


class VariableDefinition(BaseModel):
    """Definition of a macro variable."""
    name: str
    description: str
    type: str  # "numeric" or "string"
    category: str  # "Visual", "Lights", "Music"
    min: Optional[float] = 0.0
    max: Optional[float] = 1.0
    default: Any = 0.5
    osc_path: Optional[str] = None


def create_macro_state_model() -> Type[BaseModel]:
    """Dynamically create the MacroState model based on current variables."""
    variables = load_variables()
    fields = {}
    for v in variables:
        if v["type"] == "numeric":
            fields[v["name"]] = (
                float, 
                Field(
                    default=v.get("default", 0.5), 
                    ge=v.get("min", 0.0), 
                    le=v.get("max", 1.0)
                )
            )
        else:
            fields[v["name"]] = (
                str, 
                Field(default=v.get("default", ""))
            )
    
    return create_model(
        "MacroState", 
        __config__=ConfigDict(extra="allow"),
        **fields
    )


# Initial models
MacroState = create_macro_state_model()

def create_macro_target_model(base_state: Type[BaseModel]) -> Type[BaseModel]:
    return create_model(
        "MacroTarget",
        duration=(float, Field(default=4.0, ge=0.1, description="Transition duration in seconds")),
        __base__=base_state
    )

MacroTarget = create_macro_target_model(MacroState)


def create_calibration_request_model() -> Type[BaseModel]:
    variables = load_variables()
    fields = {}
    for v in variables:
        if v["type"] == "numeric":
            name = v["name"]
            v_min = v.get("min", 0.0)
            v_max = v.get("max", 1.0)
            fields[f"{name}_min"] = (float, Field(default=v_min, ge=v_min, le=v_max))
            fields[f"{name}_max"] = (float, Field(default=v_max, ge=v_min, le=v_max))
    return create_model("CalibrationRequest", **fields)

CalibrationRequest = create_calibration_request_model()


class Preset(BaseModel):
    """A named snapshot of macro values."""
    name: str
    state: Dict[str, Any]
    duration: float = 4.0


class ShowProfile(BaseModel):
    """Metadata for a specific show/project."""
    id: str = Field(..., description="Unique slug for the show (e.g., 'techno_night')")
    name: str = Field(..., description="Display name of the show")
    description: str = Field(..., description="Short description of the artistic goals")
    genres: List[str] = Field(default_factory=list, description="List of genres (e.g., ['Techno', 'House'])")
    core_vibes: List[str] = Field(default_factory=list, description="List of vibes (e.g., ['Bouncy', 'Fast'])")
    variables: List[VariableDefinition] = Field(default_factory=list, description="Show-specific macro variable definitions")
    presets: List[Preset] = Field(default_factory=list, description="Built-in presets for this show")


class PromptRequest(BaseModel):
    """Request body for POST /orchestrator/prompt."""
    prompt: str = Field(..., description="Semantic description of the desired show state")
    show_id: str = Field(default="default_show", description="The ID of the show context to use for memory and guidelines")
    duration: Optional[float] = Field(default=None, ge=0.1, description="Override LLM-suggested duration (seconds)")


class OverrideRequest(BaseModel):
    """Request body for POST /orchestrator/override — pins one field to a manual value."""
    field: str = Field(..., description="Macro field name")
    value: float = Field(..., description="Pinned value")


class OrchestratorStatus(BaseModel):
    """Full state snapshot broadcast over WebSocket and returned by GET /status."""
    current: Dict[str, Any] # Use dict for dynamic nature in status
    target: Dict[str, Any]
    is_interpolating: bool
    elapsed_seconds: float
    pinned_fields: List[str] = Field(default_factory=list)


def refresh_models():
    """Re-create the global model classes when variables change."""
    global MacroState, MacroTarget, CalibrationRequest
    MacroState = create_macro_state_model()
    MacroTarget = create_macro_target_model(MacroState)
    CalibrationRequest = create_calibration_request_model()
