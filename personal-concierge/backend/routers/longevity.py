"""Longevity dashboard router — biological age, scores, trends."""

import logging
from typing import Optional

from fastapi import APIRouter

from services.longevity import longevity_service

logger = logging.getLogger("concierge.longevity")
router = APIRouter()


@router.post("/calculate")
async def calculate(age: Optional[int] = None):
    """Calculate longevity metrics. Optionally provide chronological age."""
    return await longevity_service.calculate(age)


@router.get("/latest")
async def get_latest():
    """Get the most recent longevity calculation."""
    result = await longevity_service.get_latest()
    if not result:
        return {"message": "No longevity data yet. Run POST /longevity/calculate first."}
    return result


@router.get("/history")
async def get_history(days: int = 90):
    """Get longevity metric history."""
    return await longevity_service.get_history(days)
