"""Career & Professional Development router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.career import career_service

logger = logging.getLogger("concierge.career")
router = APIRouter()


class CareerProfileUpdate(BaseModel):
    role_title: Optional[str] = None
    industry: Optional[str] = None
    years_experience: Optional[int] = None
    career_goals: Optional[list[str]] = None
    skills_to_develop: Optional[list[str]] = None
    skills_strong: Optional[list[str]] = None
    work_style: Optional[str] = None
    stress_level: Optional[int] = None
    satisfaction_score: Optional[int] = None
    next_milestone: Optional[str] = None
    notes: Optional[str] = None


class WeeklyReflection(BaseModel):
    wins: Optional[list[str]] = None
    challenges: Optional[list[str]] = None
    learning: Optional[str] = None
    energy_level: Optional[int] = None
    productivity_score: Optional[int] = None
    notes: Optional[str] = None


@router.get("/profile")
async def get_career_profile():
    """Get career profile."""
    return await career_service.get_profile()


@router.put("/profile")
async def update_career_profile(data: CareerProfileUpdate):
    """Update career profile."""
    return await career_service.update_profile(data.model_dump(exclude_none=True))


@router.post("/reflection")
async def log_reflection(data: WeeklyReflection):
    """Log weekly career reflection."""
    return await career_service.log_weekly_reflection(data.model_dump(exclude_none=True))


@router.get("/reflections")
async def get_reflections():
    """Get reflection history."""
    return await career_service.get_reflections()


@router.get("/burnout")
async def get_burnout_risk():
    """Get burnout risk assessment."""
    return await career_service.get_burnout_risk()


@router.get("/coaching")
async def get_career_coaching():
    """Get weekly coaching insight."""
    coaching = await career_service.get_weekly_career_coaching()
    return {"coaching": coaching}


@router.get("/correlations")
async def get_correlations():
    """Get health-performance correlations."""
    return await career_service.correlate_performance_with_health()
