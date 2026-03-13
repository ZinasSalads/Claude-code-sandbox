"""Digital Identity & Personal Brand router."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.digital_identity import digital_identity_service

logger = logging.getLogger("concierge.digital_identity")
router = APIRouter()


class DigitalProfileUpdate(BaseModel):
    linkedin_url: Optional[str] = None
    linkedin_headline: Optional[str] = None
    linkedin_summary: Optional[str] = None
    linkedin_skills: Optional[list[str]] = None
    personal_website: Optional[str] = None
    github_url: Optional[str] = None
    twitter_handle: Optional[str] = None
    other_platforms: Optional[dict] = None
    thought_leadership_goal: Optional[bool] = None
    content_style: Optional[str] = None
    target_audience: Optional[str] = None
    brand_keywords: Optional[list[str]] = None
    visibility_comfort: Optional[int] = None
    networking_goals: Optional[list[str]] = None
    notes: Optional[str] = None


@router.get("/profile")
async def get_digital_profile():
    """Get digital identity profile."""
    return await digital_identity_service.get_profile()


@router.put("/profile")
async def update_digital_profile(data: DigitalProfileUpdate):
    """Update digital identity profile."""
    return await digital_identity_service.save_profile(data.model_dump(exclude_none=True))


@router.post("/linkedin-audit")
async def generate_linkedin_audit():
    """Generate a LinkedIn profile audit with scoring and recommendations."""
    return await digital_identity_service.generate_linkedin_audit()


@router.get("/brand-statement")
async def get_brand_statement():
    """Get or generate a personal brand statement."""
    return await digital_identity_service.generate_personal_brand_statement()


@router.get("/content-suggestions")
async def get_content_suggestions():
    """Get content ideas matched to personality and content style."""
    suggestions = await digital_identity_service.get_content_suggestions()
    return {"suggestions": suggestions, "count": len(suggestions)}


@router.get("/audit-history")
async def get_audit_history():
    """Get past audit records."""
    history = await digital_identity_service.get_audit_history()
    return {"audits": history, "count": len(history)}
