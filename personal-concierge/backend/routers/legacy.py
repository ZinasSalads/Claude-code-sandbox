"""Legacy & Long-Term Vision router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.legacy import legacy_service

logger = logging.getLogger("concierge.legacy")
router = APIRouter()


class LegacyProfileUpdate(BaseModel):
    ten_year_vision: Optional[str] = None
    career_legacy: Optional[str] = None
    relationship_legacy: Optional[str] = None
    health_legacy: Optional[str] = None
    contribution_legacy: Optional[str] = None
    identity_goals: Optional[list[str]] = None
    experience_goals: Optional[list[str]] = None


class MilestoneCreate(BaseModel):
    milestone_date: str
    category: Optional[str] = "personal"
    title: str
    description: Optional[str] = None
    significance: int = 5
    linked_goal: Optional[str] = None


@router.get("/profile")
async def get_profile():
    """Get legacy profile."""
    return await legacy_service.get_profile()


@router.put("/profile")
async def save_profile(data: LegacyProfileUpdate):
    """Save legacy vision."""
    return await legacy_service.save_profile(data.model_dump(exclude_none=True))


@router.get("/milestones")
async def get_milestones(limit: int = 20):
    """List milestones."""
    return await legacy_service.get_milestones(limit)


@router.post("/milestones")
async def log_milestone(data: MilestoneCreate):
    """Log a milestone."""
    return await legacy_service.log_milestone(data.model_dump(exclude_none=True))


@router.get("/drift")
async def check_drift():
    """Check values drift."""
    result = await legacy_service.check_values_drift()
    return result or {"detected": False}


@router.get("/bridge")
async def get_bridge():
    """Get daily-to-legacy bridge moment."""
    bridge = await legacy_service.generate_daily_bridge()
    return {"bridge": bridge}


@router.get("/annual-review")
async def get_annual_review():
    """Get annual review prompts."""
    return await legacy_service.get_annual_review_prompt()
