"""
FastAPI APIRouter for the Real-Time Show Orchestrator.

All routes are mounted under the /orchestrator prefix (set in main.py).

Endpoints
---------
GET    /status               → models.OrchestratorStatus
POST   /prompt               → run LLM + set new target
POST   /override             → pin a field to a manual slider value
DELETE /override/{field}     → release a pinned field
POST   /calibrate            → adjust per-macro output clamping ranges
WebSocket /ws               → stream models.OrchestratorStatus JSON at ~10 Hz
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
import asyncio

from . import models
from .config import load_variables, save_variables, refresh_config
from .llm_agent import translate_prompt, LLMTranslationError
from .interpolation_engine import InterpolationEngine
import os
import json

logger = logging.getLogger(__name__)

router = APIRouter(tags=["orchestrator"])

SHOWS_FILE = os.path.join(os.path.dirname(__file__), "..", "shows.json")

def load_shows_data() -> dict:
    if not os.path.exists(SHOWS_FILE):
        return {"active_show_id": "default_show", "shows": []}
    with open(SHOWS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_shows_data(data: dict):
    with open(SHOWS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# ... (rest of imports and setup)

# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/status", response_model=models.OrchestratorStatus)
async def get_status() -> models.OrchestratorStatus:
    """Return the current engine state (current values, target, interpolation progress)."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")
    return engine.get_status()


@router.post("/prompt", response_model=models.MacroTarget)
async def post_prompt(request: models.PromptRequest) -> models.MacroTarget:
    """
    Translate a semantic prompt via the agent → models.MacroTarget and set it on the engine.

    The returned models.MacroTarget is the LLM's interpretation (useful for the UI preview toast).
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    try:
        current_status = engine.get_status().model_dump()
        target = await translate_prompt(request.prompt, request.show_id, request.duration, current_status)
    except LLMTranslationError as exc:
        logger.warning(f"LLM translation error: {exc}")
        raise HTTPException(status_code=422, detail=str(exc))

    await engine.set_target(target)
    return target


# ---------------------------------------------------------------------------
# Show Management endpoints
# ---------------------------------------------------------------------------

@router.get("/shows")
async def get_shows():
    """List all show profiles."""
    return load_shows_data()["shows"]

@router.post("/shows")
async def post_show(show: models.ShowProfile):
    """Create or update a show profile."""
    data = load_shows_data()
    found = False
    for i, s in enumerate(data["shows"]):
        if s["id"] == show.id:
            data["shows"][i] = show.model_dump()
            found = True
            break
    if not found:
        data["shows"].append(show.model_dump())
    save_shows_data(data)
    return {"status": "show saved", "id": show.id}

@router.delete("/shows/{show_id}")
async def delete_show(show_id: str):
    """Delete a show profile."""
    if show_id == "default_show":
        raise HTTPException(status_code=400, detail="Cannot delete the default show")
    
    data = load_shows_data()
    initial_count = len(data["shows"])
    data["shows"] = [s for s in data["shows"] if s["id"] != show_id]
    
    if len(data["shows"]) == initial_count:
        raise HTTPException(status_code=404, detail=f"Show {show_id} not found")
    
    # If the active show was deleted, reset it to the first available or default
    if data.get("active_show_id") == show_id:
        data["active_show_id"] = data["shows"][0]["id"] if data["shows"] else "default_show"
        # Trigger re-initialization if needed
        refresh_config()
        models.refresh_models()
        if engine:
            engine.reinitialize()
            
    save_shows_data(data)
    return {"status": "show deleted", "id": show_id, "new_active_id": data.get("active_show_id")}

@router.get("/shows/active")
async def get_active_show():
    """Get the currently active show profile."""
    data = load_shows_data()
    active_id = data.get("active_show_id", "default_show")
    for s in data["shows"]:
        if s["id"] == active_id:
            return s
    # Fallback if active_id not found
    if data["shows"]:
        return data["shows"][0]
    return {"id": "default_show", "name": "Default Show"}

@router.post("/shows/active")
async def set_active_show(request: dict):
    """Set the active show ID and refresh system config."""
    show_id = request.get("id")
    if not show_id:
        raise HTTPException(status_code=400, detail="Missing show ID")
    data = load_shows_data()
    data["active_show_id"] = show_id
    save_shows_data(data)
    
    # Refresh all layers to reflect the new show's variables
    refresh_config()
    models.refresh_models()
    if engine:
        engine.reinitialize()
        
    return {"status": "active show set", "id": show_id}


@router.post("/target", response_model=models.MacroTarget)
async def post_target(request: Dict[str, Any]) -> models.MacroTarget:
    """
    Set a target state directly (e.g. from a preset).
    
    Any fields in the request that don't match defined variables will be ignored
    during interpolation, but we use the models.MacroTarget model for validation.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    # We use models.MacroTarget.model_validate to handle the dynamic schema.
    # Because MacroState (base of models.MacroTarget) has extra="allow", 
    # it won't fail on extra fields, which matches the user's requirement
    # to ignore unbound variables.
    try:
        target = models.MacroTarget.model_validate(request)
    except Exception as exc:
        logger.warning(f"Target validation error: {exc}")
        raise HTTPException(status_code=422, detail=str(exc))

    await engine.set_target(target)
    return target


@router.post("/override")
async def post_override(request: models.OverrideRequest) -> dict:
    """Pin a macro field to a manual value (slider override)."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    try:
        engine.hard_override(request.field, request.value)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {"status": "pinned", "field": request.field, "value": request.value}


@router.delete("/override/{field}")
async def delete_override(field: str) -> dict:
    """Release a pinned field back to interpolation."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    try:
        engine.release_override(field)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {"status": "released", "field": field}


@router.post("/calibrate")
async def post_calibrate(request: models.CalibrationRequest) -> dict:
    """Adjust per-macro output clamping ranges (rehearsal tuning)."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    engine.apply_calibration(request)
    return {"status": "calibration applied"}


# ---------------------------------------------------------------------------
# Variable Configuration endpoints
# ---------------------------------------------------------------------------

@router.get("/variables", response_model=list[models.VariableDefinition])
async def get_variables():
    """Return all defined macro variables."""
    return load_variables()


@router.post("/variables")
async def post_variable(var: models.VariableDefinition) -> dict:
    """Add or update a macro variable."""
    vars_list = load_variables()
    
    # Update if exists, else append
    found = False
    for i, v in enumerate(vars_list):
        if v["name"] == var.name:
            vars_list[i] = var.model_dump()
            found = True
            break
    if not found:
        vars_list.append(var.model_dump())
        
    save_variables(vars_list)
    
    # Refresh all layers
    refresh_config()
    models.refresh_models()
    if engine:
        engine.reinitialize()
        
    return {"status": "variable saved", "name": var.name}


@router.delete("/variables/{name}")
async def delete_variable(name: str) -> dict:
    """Remove a macro variable."""
    vars_list = load_variables()
    new_vars = [v for v in vars_list if v["name"] != name]
    
    if len(new_vars) == len(vars_list):
        raise HTTPException(status_code=404, detail=f"Variable {name} not found")
        
    save_variables(new_vars)
    
    # Refresh all layers
    refresh_config()
    models.refresh_models()
    if engine:
        engine.reinitialize()
        
    return {"status": "variable deleted", "name": name}


# ---------------------------------------------------------------------------
# WebSocket — streams models.OrchestratorStatus at ~10 Hz
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def websocket_status(websocket: WebSocket) -> None:
    """
    Streams models.OrchestratorStatus JSON at ~10 Hz to the director's browser.

    Only one director is expected at a time; no pub/sub bus required.
    """
    await websocket.accept()
    logger.info("Orchestrator WebSocket client connected")
    try:
        while True:
            if engine is not None:
                status = engine.get_status()
                await websocket.send_json(status.model_dump())
            await asyncio.sleep(0.1)  # 10 Hz
    except WebSocketDisconnect:
        logger.info("Orchestrator WebSocket client disconnected")
    except Exception as exc:
        logger.error(f"WebSocket error: {exc}")
