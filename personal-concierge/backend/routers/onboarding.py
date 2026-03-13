"""Progressive onboarding router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.onboarding import onboarding_service

logger = logging.getLogger("concierge.onboarding")
router = APIRouter()


class StepData(BaseModel):
    data: Optional[dict] = None


@router.get("/status")
async def get_status():
    """Get onboarding completion status."""
    return await onboarding_service.get_status()


@router.get("/steps")
async def get_all_steps():
    """Get all steps with status."""
    return await onboarding_service.get_all_steps()


@router.get("/step/{name}")
async def get_step_content(name: str):
    """Get step content and fields."""
    return await onboarding_service.get_step_content(name)


@router.post("/step/{name}")
async def complete_step(name: str, body: StepData = StepData()):
    """Complete a step with captured data."""
    return await onboarding_service.complete_step(name, body.data)


@router.post("/step/{name}/skip")
async def skip_step(name: str):
    """Skip a step."""
    return await onboarding_service.skip_step(name)


@router.get("/habits-suggest")
async def suggest_habits():
    """Get 5 suggested starter habits."""
    return await onboarding_service.seed_suggested_habits()
