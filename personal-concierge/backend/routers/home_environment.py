"""Home Environment router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.home_environment import home_environment_service

logger = logging.getLogger("concierge.home")
router = APIRouter()


class HomeProfileUpdate(BaseModel):
    has_air_purifier: Optional[bool] = None
    air_purifier_model: Optional[str] = None
    indoor_plants: Optional[bool] = None
    natural_light_quality: Optional[str] = None
    has_smart_lights: Optional[bool] = None
    morning_light_access: Optional[bool] = None
    blue_light_filter_device: Optional[bool] = None
    bedroom_blackout: Optional[bool] = None
    bedroom_temp_preference: Optional[str] = None
    white_noise_device: Optional[bool] = None
    desk_setup_quality: Optional[str] = None
    standing_desk: Optional[bool] = None
    monitor_at_eye_level: Optional[bool] = None
    ergonomic_chair: Optional[bool] = None
    home_type: Optional[str] = None
    square_footage_tier: Optional[str] = None
    noise_level: Optional[str] = None
    notes: Optional[str] = None


@router.get("/profile")
async def get_profile():
    """Get home environment profile."""
    return await home_environment_service.get_profile()


@router.put("/profile")
async def update_profile(data: HomeProfileUpdate):
    """Update home profile."""
    return await home_environment_service.save_profile(data.model_dump(exclude_none=True))


@router.get("/recommendations")
async def get_recommendations(completed: bool = False):
    """List recommendations."""
    return await home_environment_service.get_recommendations(completed)


@router.post("/recommendations/generate")
async def generate_recommendations():
    """Regenerate recommendations."""
    return await home_environment_service.generate_recommendations()


@router.put("/recommendations/{rec_id}/complete")
async def complete_recommendation(rec_id: str):
    """Mark recommendation as complete."""
    return await home_environment_service.complete_recommendation(rec_id)


@router.get("/correlations")
async def get_correlations():
    """Health-home correlations."""
    return await home_environment_service.get_health_correlations()
