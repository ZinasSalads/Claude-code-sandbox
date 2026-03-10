"""Coaching style router — mode selection, drift tracking, compliance."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.coaching import coaching_service

logger = logging.getLogger("concierge.coaching")
router = APIRouter()


class SetModeRequest(BaseModel):
    mode: str


class LogComplianceRequest(BaseModel):
    domain: str
    recommended: str
    actual: str
    complied: bool


@router.get("/settings")
async def get_settings():
    """Get current coaching settings."""
    return await coaching_service.get_settings()


@router.post("/mode")
async def set_mode(req: SetModeRequest):
    """Set coaching mode."""
    result = await coaching_service.set_mode(req.mode)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/modes")
async def get_modes():
    """List available coaching modes."""
    return coaching_service.get_available_modes()


@router.post("/compliance")
async def log_compliance(req: LogComplianceRequest):
    """Log a compliance event."""
    return await coaching_service.log_compliance(
        req.domain, req.recommended, req.actual, req.complied
    )


@router.get("/drift")
async def get_drift():
    """Get drift analysis report."""
    return await coaching_service.get_drift_report()
