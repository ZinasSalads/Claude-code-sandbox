"""Social & Life Balance router."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.social import social_service

logger = logging.getLogger("concierge.social")
router = APIRouter()


class ContactCreate(BaseModel):
    name: str
    relationship_type: Optional[str] = None
    importance_weight: int = 5
    target_contact_days: int = 14
    preferred_activities: Optional[list[str]] = None
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    relationship_type: Optional[str] = None
    importance_weight: Optional[int] = None
    target_contact_days: Optional[int] = None
    preferred_activities: Optional[list[str]] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class ConnectionLog(BaseModel):
    contact_id: str
    log_date: Optional[str] = None
    activity_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    quality_rating: Optional[int] = None
    notes: Optional[str] = None


@router.get("/circle")
async def get_social_circle():
    """Get all contacts."""
    return await social_service.get_social_circle()


@router.post("/circle")
async def add_contact(data: ContactCreate):
    """Add a new contact."""
    return await social_service.add_contact(data.model_dump(exclude_none=True))


@router.put("/circle/{contact_id}")
async def update_contact(contact_id: str, data: ContactUpdate):
    """Update a contact."""
    return await social_service.update_contact(contact_id, data.model_dump(exclude_none=True))


@router.get("/overdue")
async def get_overdue_connections():
    """Get overdue connections."""
    return await social_service.get_overdue_connections()


@router.post("/log")
async def log_connection(data: ConnectionLog):
    """Log a social interaction."""
    return await social_service.log_connection(data.contact_id, data.model_dump(exclude_none=True))


@router.get("/score")
async def get_social_score():
    """Get this week's social health score."""
    return await social_service.calculate_weekly_social_score()


@router.get("/briefing")
async def get_social_briefing():
    """Get Command Center social widget data."""
    return await social_service.get_social_briefing()


@router.post("/suggest/{contact_id}")
async def suggest_activity(contact_id: str):
    """Suggest an activity for this contact."""
    suggestion = await social_service.suggest_social_activity(contact_id)
    return {"suggestion": suggestion}
