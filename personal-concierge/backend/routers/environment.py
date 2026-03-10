"""Environment router — UV, AQI, pollen, weather data."""

import logging
from typing import Optional

from fastapi import APIRouter

from services.environment import environment_service

logger = logging.getLogger("concierge.environment")
router = APIRouter()


@router.get("/today")
async def get_today(lat: Optional[float] = None, lon: Optional[float] = None):
    """Get today's environmental conditions."""
    return await environment_service.get_today(lat, lon)
