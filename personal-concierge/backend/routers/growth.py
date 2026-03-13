"""1% Growth Engine router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.growth import growth_service

logger = logging.getLogger("concierge.growth")
router = APIRouter()


class HabitCreate(BaseModel):
    name: str
    category: Optional[str] = "health"
    description: Optional[str] = None
    target_frequency: str = "daily"
    difficulty: int = 3
    micro_win_message: Optional[str] = None


class HabitUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    target_frequency: Optional[str] = None
    difficulty: Optional[int] = None
    micro_win_message: Optional[str] = None
    active: Optional[bool] = None


class HabitLog(BaseModel):
    habit_id: str
    completed: bool = True
    quality_rating: Optional[int] = None
    notes: Optional[str] = None


@router.get("/habits")
async def list_habits():
    """List habits with status."""
    return await growth_service.get_habits()


@router.post("/habits")
async def add_habit(data: HabitCreate):
    """Add a new habit."""
    return await growth_service.add_habit(data.model_dump(exclude_none=True))


@router.put("/habits/{habit_id}")
async def update_habit(habit_id: str, data: HabitUpdate):
    """Update a habit."""
    return await growth_service.update_habit(habit_id, data.model_dump(exclude_none=True))


@router.delete("/habits/{habit_id}")
async def deactivate_habit(habit_id: str):
    """Deactivate a habit."""
    return await growth_service.deactivate_habit(habit_id)


@router.get("/today")
async def get_today_habits():
    """Get today's habits widget data."""
    return await growth_service.get_today_habits()


@router.post("/log")
async def log_habit(data: HabitLog):
    """Log habit completion."""
    return await growth_service.log_habit(
        habit_id=data.habit_id,
        completed=data.completed,
        quality=data.quality_rating,
        notes=data.notes,
    )


@router.get("/weekly")
async def get_weekly_report():
    """Get weekly compound report."""
    return await growth_service.get_weekly_report()


@router.get("/suggest")
async def suggest_next_habit():
    """Get Claude's habit suggestion."""
    return await growth_service.suggest_next_habit()


@router.get("/score")
async def get_compound_score():
    """Get compound growth score."""
    return await growth_service.calculate_compound_score()
