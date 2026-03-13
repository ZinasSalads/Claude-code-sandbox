"""Contextual Intelligence router."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.contextual_intelligence import contextual_engine

logger = logging.getLogger("concierge.contextual")
router = APIRouter()


class SignalInput(BaseModel):
    signal_text: str
    signal_type: Optional[str] = "manual_mention"


class CalendarEventSignal(BaseModel):
    event_title: str
    event_date: str
    event_type: Optional[str] = None


@router.post("/signal")
async def process_manual_signal(data: SignalInput):
    """Process a manual signal and return cross-domain implications."""
    result = await contextual_engine.expand_signal(data.signal_text, data.signal_type)
    return result


@router.get("/signals")
async def get_recent_signals(days: int = 7):
    """Get recent signals and their expansions."""
    return await contextual_engine.get_recent_signals(days=days)


@router.get("/anomalies")
async def get_anomalies():
    """Detect and return current data anomalies across all modules."""
    return await contextual_engine.monitor_anomalies()


@router.post("/calendar-event")
async def process_calendar_event(data: CalendarEventSignal):
    """Process a calendar event signal for contextual expansion."""
    event = {
        "event_title": data.event_title,
        "event_date": data.event_date,
        "event_type": data.event_type,
    }
    result = await contextual_engine.process_calendar_event(event)
    return result
