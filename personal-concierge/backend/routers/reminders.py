"""Reminders router — contextual notifications."""

import logging

from fastapi import APIRouter

from services.reminders import reminder_service

logger = logging.getLogger("concierge.reminders")
router = APIRouter()


@router.get("/pending")
async def get_pending():
    """Get all pending reminders for the current time."""
    return await reminder_service.get_pending_reminders()
