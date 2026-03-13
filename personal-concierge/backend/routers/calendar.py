"""Google Calendar integration router."""

import logging

from fastapi import APIRouter
from fastapi.responses import RedirectResponse

from services.calendar import calendar_service

logger = logging.getLogger("concierge.calendar")
router = APIRouter()


@router.get("/auth")
async def get_auth_url():
    """Get OAuth2 URL to redirect user to."""
    url = calendar_service.get_auth_url()
    if not url:
        return {"error": "Google Calendar credentials not configured", "status": "not_configured"}
    return {"auth_url": url}


@router.get("/callback")
async def oauth_callback(code: str = ""):
    """OAuth2 callback handler."""
    if not code:
        return {"error": "No authorization code provided"}
    result = await calendar_service.exchange_code(code)
    if "error" in result:
        return result
    return {"status": "connected", "message": "Google Calendar connected successfully"}


@router.get("/status")
async def get_status():
    """Get calendar connection status."""
    return await calendar_service.get_status()


@router.post("/sync")
async def sync_events(days_ahead: int = 7):
    """Trigger manual calendar sync."""
    return await calendar_service.sync_events(days_ahead)


@router.get("/today")
async def get_today():
    """Get today's events with classifications."""
    return await calendar_service.get_today_events()


@router.get("/tomorrow")
async def get_tomorrow():
    """Get tomorrow's events."""
    return await calendar_service.get_tomorrow_events()


@router.get("/workout-windows")
async def workout_windows():
    """Get available workout slots today."""
    return await calendar_service.find_workout_windows()


@router.get("/detect-trips")
async def detect_trips():
    """Scan for trips in calendar."""
    return await calendar_service.detect_trips()


@router.delete("/disconnect")
async def disconnect():
    """Remove tokens, disconnect calendar."""
    return await calendar_service.disconnect()
