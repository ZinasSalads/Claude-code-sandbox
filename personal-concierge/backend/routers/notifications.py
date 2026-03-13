"""Push notifications router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.notifications import notification_service

logger = logging.getLogger("concierge.notifications")
router = APIRouter()


class RegisterToken(BaseModel):
    token: str
    platform: str = "ios"


@router.post("/register")
async def register_token(data: RegisterToken):
    """Register Expo push token."""
    return await notification_service.register_token(data.token, data.platform)


@router.post("/send-morning")
async def send_morning_briefing():
    """Trigger morning briefing notification."""
    return await notification_service.send_morning_briefing()


@router.post("/send-habits")
async def send_habit_nudges():
    """Trigger habit nudge notifications."""
    return await notification_service.send_habit_nudges()


@router.post("/schedule")
async def run_notification_schedule():
    """Run full notification check (for cron)."""
    return await notification_service.check_and_send_scheduled()
