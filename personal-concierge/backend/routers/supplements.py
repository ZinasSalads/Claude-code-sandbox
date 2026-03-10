"""Supplement stack router — manage supplements, log adherence, check interactions."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.supplements import supplement_service

logger = logging.getLogger("concierge.supplements")
router = APIRouter()


class AddSupplementRequest(BaseModel):
    name: str
    brand: Optional[str] = None
    dose_amount: Optional[float] = None
    dose_unit: Optional[str] = None
    timing: Optional[str] = "morning"
    timing_notes: Optional[str] = None
    purpose: Optional[str] = None
    category: Optional[str] = None
    started_date: Optional[str] = None
    evidence_grade: Optional[str] = None
    notes: Optional[str] = None


class UpdateSupplementRequest(BaseModel):
    name: Optional[str] = None
    dose_amount: Optional[float] = None
    dose_unit: Optional[str] = None
    timing: Optional[str] = None
    timing_notes: Optional[str] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


class LogAdherenceRequest(BaseModel):
    supplement_id: str
    taken: bool
    skipped_reason: Optional[str] = None


@router.get("/stack")
async def get_stack(active_only: bool = True):
    """Get current supplement stack."""
    return await supplement_service.get_stack(active_only)


@router.post("/add")
async def add_supplement(req: AddSupplementRequest):
    """Add a supplement with interaction checking."""
    result = await supplement_service.add_supplement(req.model_dump())
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.put("/{supplement_id}")
async def update_supplement(supplement_id: str, req: UpdateSupplementRequest):
    """Update a supplement."""
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    result = await supplement_service.update_supplement(supplement_id, updates)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{supplement_id}")
async def deactivate_supplement(supplement_id: str):
    """Deactivate a supplement (soft delete)."""
    result = await supplement_service.deactivate_supplement(supplement_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return {"status": "ok", "message": "Supplement deactivated"}


@router.post("/log")
async def log_adherence(req: LogAdherenceRequest):
    """Log supplement adherence for today."""
    result = await supplement_service.log_adherence(
        req.supplement_id, req.taken, req.skipped_reason
    )
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/today")
async def get_today_log():
    """Get today's supplement log with take/skip status."""
    return await supplement_service.get_today_log()


@router.get("/stats")
async def get_stats(days: int = 30):
    """Get adherence stats for the period."""
    return await supplement_service.get_adherence_stats(days)


@router.get("/schedule")
async def get_schedule():
    """Get supplements organized by timing."""
    return await supplement_service.get_schedule()


@router.post("/check-interactions")
async def check_interactions(req: AddSupplementRequest):
    """Check interactions without adding the supplement."""
    return await supplement_service.check_interactions(req.model_dump())
