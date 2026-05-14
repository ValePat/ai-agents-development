"""
FastAPI APIRouter for the Real-Time Show Orchestrator.

All routes are mounted under the /orchestrator prefix (set in main.py).

Endpoints
---------
GET    /status               → OrchestratorStatus
POST   /prompt               → run LLM + set new target
POST   /override             → pin a field to a manual slider value
DELETE /override/{field}     → release a pinned field
POST   /calibrate            → adjust per-macro output clamping ranges
WebSocket /ws               → stream OrchestratorStatus JSON at ~10 Hz
"""

import logging
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
import asyncio

from .models import (
    OrchestratorStatus,
    PromptRequest,
    OverrideRequest,
    CalibrationRequest,
    MacroTarget,
    VariableDefinition,
    refresh_models,
)
from .config import load_variables, save_variables, refresh_config
from .llm_agent import translate_prompt, LLMTranslationError
from .interpolation_engine import InterpolationEngine

logger = logging.getLogger(__name__)

router = APIRouter(tags=["orchestrator"])

# Module-level engine reference — set from main.py during lifespan startup.
# Following the same global-singleton pattern used for `agent` in main.py.
engine: InterpolationEngine | None = None


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@router.get("/status", response_model=OrchestratorStatus)
async def get_status() -> OrchestratorStatus:
    """Return the current engine state (current values, target, interpolation progress)."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")
    return engine.get_status()


@router.post("/prompt", response_model=MacroTarget)
async def post_prompt(request: PromptRequest) -> MacroTarget:
    """
    Translate a semantic prompt via the agent → MacroTarget and set it on the engine.

    The returned MacroTarget is the LLM's interpretation (useful for the UI preview toast).
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    try:
        current_status = engine.get_status().model_dump()
        target = await translate_prompt(request.prompt, request.duration, current_status)
    except LLMTranslationError as exc:
        logger.warning(f"LLM translation error: {exc}")
        raise HTTPException(status_code=422, detail=str(exc))

    await engine.set_target(target)
    return target


@router.post("/target", response_model=MacroTarget)
async def post_target(request: Dict[str, Any]) -> MacroTarget:
    """
    Set a target state directly (e.g. from a preset).
    
    Any fields in the request that don't match defined variables will be ignored
    during interpolation, but we use the MacroTarget model for validation.
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    # We use MacroTarget.model_validate to handle the dynamic schema.
    # Because MacroState (base of MacroTarget) has extra="allow", 
    # it won't fail on extra fields, which matches the user's requirement
    # to ignore unbound variables.
    try:
        target = MacroTarget.model_validate(request)
    except Exception as exc:
        logger.warning(f"Target validation error: {exc}")
        raise HTTPException(status_code=422, detail=str(exc))

    await engine.set_target(target)
    return target


@router.post("/override")
async def post_override(request: OverrideRequest) -> dict:
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
async def post_calibrate(request: CalibrationRequest) -> dict:
    """Adjust per-macro output clamping ranges (rehearsal tuning)."""
    if engine is None:
        raise HTTPException(status_code=503, detail="Orchestrator engine not initialised")

    engine.apply_calibration(request)
    return {"status": "calibration applied"}


# ---------------------------------------------------------------------------
# Variable Configuration endpoints
# ---------------------------------------------------------------------------

@router.get("/variables", response_model=list[VariableDefinition])
async def get_variables():
    """Return all defined macro variables."""
    return load_variables()


@router.post("/variables")
async def post_variable(var: VariableDefinition) -> dict:
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
    refresh_models()
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
    refresh_models()
    if engine:
        engine.reinitialize()
        
    return {"status": "variable deleted", "name": name}


# ---------------------------------------------------------------------------
# WebSocket — streams OrchestratorStatus at ~10 Hz
# ---------------------------------------------------------------------------

@router.websocket("/ws")
async def websocket_status(websocket: WebSocket) -> None:
    """
    Streams OrchestratorStatus JSON at ~10 Hz to the director's browser.

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
