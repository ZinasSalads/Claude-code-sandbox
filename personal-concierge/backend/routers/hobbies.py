"""Hobbies & Competing Priorities router."""

import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.hobbies import hobbies_service

logger = logging.getLogger("concierge.hobbies")
router = APIRouter()


# --- Pydantic models ---

class HobbyCreate(BaseModel):
    name: str
    category: Optional[str] = None
    status: Optional[str] = "active"
    seasonal: Optional[bool] = False
    active_months: Optional[list[int]] = None
    weekly_hours_target: Optional[float] = None
    satisfaction_rating: Optional[int] = None
    health_benefit: Optional[str] = None
    notes: Optional[str] = None


class HobbyUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    seasonal: Optional[bool] = None
    active_months: Optional[list[int]] = None
    weekly_hours_target: Optional[float] = None
    satisfaction_rating: Optional[int] = None
    health_benefit: Optional[str] = None
    notes: Optional[str] = None


class SessionLog(BaseModel):
    duration_minutes: int
    quality_rating: Optional[int] = None  # 1-5
    notes: Optional[str] = None


class ConflictResolve(BaseModel):
    conflict_date: str
    competing_items: list[dict]
    resolution: str
    chosen_option: str


# --- Routes: static paths first to avoid /{hobby_id} capturing them ---

@router.get("/dormant")
async def get_dormant_hobbies():
    """Get hobbies that are active but haven't been practiced recently."""
    return await hobbies_service.get_dormant_hobbies()


@router.get("/seasonal")
async def get_seasonal_upcoming():
    """Get seasonal hobbies coming up in the next 30 days."""
    return await hobbies_service.get_seasonal_upcoming()


@router.get("/health-score")
async def get_health_score():
    """Get overall hobby health score (0-100)."""
    return await hobbies_service.get_hobby_health_score()


@router.get("/conflicts")
async def get_conflicts():
    """Check for priority conflicts over the next 7 days."""
    conflicts = []
    today = date.today()
    for i in range(7):
        target = today + timedelta(days=i)
        conflict = await hobbies_service.detect_priority_conflict(target)
        if conflict:
            conflicts.append(conflict)
    return conflicts


@router.post("/conflicts/resolve")
async def resolve_conflict(data: ConflictResolve):
    """Log a conflict resolution."""
    conflict_data = {
        "conflict_date": data.conflict_date,
        "competing_items": data.competing_items,
        "resolution": data.resolution,
    }
    return await hobbies_service.resolve_conflict(conflict_data, data.chosen_option)


@router.get("/briefing")
async def get_briefing():
    """Get the weekly hobby briefing."""
    return await hobbies_service.get_weekly_hobby_briefing()


# --- Routes with path parameters ---

@router.get("/")
async def list_hobbies(status: Optional[str] = None):
    """List all hobbies, optionally filtered by status."""
    return await hobbies_service.get_hobbies(status=status)


@router.post("/")
async def add_hobby(data: HobbyCreate):
    """Add a new hobby."""
    return await hobbies_service.add_hobby(data.model_dump(exclude_none=True))


@router.put("/{hobby_id}")
async def update_hobby(hobby_id: str, data: HobbyUpdate):
    """Update an existing hobby."""
    return await hobbies_service.update_hobby(hobby_id, data.model_dump(exclude_none=True))


@router.post("/{hobby_id}/log")
async def log_session(hobby_id: str, data: SessionLog):
    """Log a hobby session."""
    return await hobbies_service.log_session(hobby_id, data.model_dump(exclude_none=True))
