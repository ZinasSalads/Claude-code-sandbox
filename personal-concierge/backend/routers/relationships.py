"""Relationship Coaching router."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.relationship_coaching import relationship_coaching_service

logger = logging.getLogger("concierge.relationships")
router = APIRouter()


class InteractionCheckin(BaseModel):
    interaction_quality: int  # 1-10
    interaction_type: Optional[str] = None
    energy_after: Optional[int] = None  # -5 to 5
    notes: Optional[str] = None
    checkin_date: Optional[str] = None


class RelationshipUpdate(BaseModel):
    notes: Optional[str] = None
    importance_weight: Optional[int] = None
    target_contact_days: Optional[int] = None
    relationship_type: Optional[str] = None
    attachment_style: Optional[str] = None
    love_language: Optional[str] = None
    goals: Optional[list[str]] = None


# NOTE: /health and /briefing are defined BEFORE /{contact_id} routes
# to avoid FastAPI treating "health" or "briefing" as a contact_id.


@router.get("/health")
async def get_overall_health():
    """Get overall relationship health across all relationships."""
    return await relationship_coaching_service.get_overall_health()


@router.get("/briefing")
async def get_weekly_briefing():
    """Get weekly relationship briefing."""
    return await relationship_coaching_service.get_weekly_relationship_briefing()


@router.get("/")
async def get_all_relationships():
    """Get all relationships with scores."""
    return await relationship_coaching_service.get_all_relationships()


@router.get("/{contact_id}")
async def get_relationship(contact_id: str):
    """Get single relationship detail."""
    result = await relationship_coaching_service.get_relationship(contact_id)
    if not result:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return result


@router.put("/{contact_id}")
async def update_relationship(contact_id: str, data: RelationshipUpdate):
    """Update relationship profile."""
    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    return await relationship_coaching_service.update_relationship(contact_id, update_data)


@router.post("/{contact_id}/checkin")
async def log_interaction(contact_id: str, data: InteractionCheckin):
    """Log a relationship interaction checkin."""
    if not 1 <= data.interaction_quality <= 10:
        raise HTTPException(status_code=400, detail="interaction_quality must be between 1 and 10")
    result = await relationship_coaching_service.log_interaction(contact_id, data.model_dump(exclude_none=True))
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.get("/{contact_id}/coaching")
async def get_coaching_insight(contact_id: str):
    """Get AI coaching insight for a specific relationship."""
    return await relationship_coaching_service.get_coaching_insight(contact_id)
