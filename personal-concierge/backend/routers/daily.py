"""Daily plan router — cross-module intelligence endpoint."""

import logging

from fastapi import APIRouter

from services.arbitrator import arbitrator_service

logger = logging.getLogger("concierge.daily")
router = APIRouter()


@router.get("/plan")
async def get_daily_plan():
    """Generate a comprehensive daily plan from all modules."""
    return await arbitrator_service.generate_daily_plan()
