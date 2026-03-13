"""Financial planning router."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.financial_planning import financial_planning_service

logger = logging.getLogger("concierge.financial_planning")
router = APIRouter()


class GoalCreate(BaseModel):
    goal_name: str
    goal_type: Optional[str] = None
    target_amount: Optional[float] = 0
    current_amount: Optional[float] = 0
    monthly_contribution: Optional[float] = 0
    target_date: Optional[str] = None
    linked_life_goal: Optional[str] = None
    notes: Optional[str] = None


class GoalUpdate(BaseModel):
    goal_name: Optional[str] = None
    goal_type: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    monthly_contribution: Optional[float] = None
    target_date: Optional[str] = None
    linked_life_goal: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class ProgressUpdate(BaseModel):
    current_amount: float


class StressLog(BaseModel):
    stress_level: int
    primary_stressor: Optional[str] = None


@router.get("/goals")
async def list_goals():
    """List all financial goals with progress percentages."""
    return await financial_planning_service.get_goals()


@router.post("/goals")
async def add_goal(data: GoalCreate):
    """Add a new financial goal."""
    result = await financial_planning_service.add_goal(data.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=500, detail="Failed to create goal")
    return result


@router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, data: GoalUpdate):
    """Update an existing financial goal."""
    result = await financial_planning_service.update_goal(
        goal_id, data.model_dump(exclude_none=True)
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update goal")
    return result


@router.put("/goals/{goal_id}/progress")
async def update_goal_progress(goal_id: str, data: ProgressUpdate):
    """Update the current amount for a goal and get projection."""
    result = await financial_planning_service.update_goal_progress(
        goal_id, data.current_amount
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to update progress")
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/stress")
async def log_stress(data: StressLog):
    """Log financial stress for the current week."""
    result = await financial_planning_service.log_financial_stress(
        data.stress_level, data.primary_stressor
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to log stress")
    return result


@router.get("/stress-flag")
async def get_stress_flag():
    """Check if financial stress is currently active."""
    return await financial_planning_service.get_stress_flag()


@router.get("/timeline")
async def get_timeline():
    """Get goal timeline with projected completion dates."""
    return await financial_planning_service.get_goal_timeline()


@router.get("/annual-prompt")
async def get_annual_prompt():
    """Get annual financial review prompt if due."""
    result = await financial_planning_service.get_annual_prompt()
    if result is None:
        return {"prompt_due": False}
    return result


@router.get("/alignment")
async def get_alignment():
    """Get life-goal alignment map showing funding status."""
    return await financial_planning_service.get_life_goal_alignment()
