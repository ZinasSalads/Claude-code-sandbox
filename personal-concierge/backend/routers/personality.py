"""Personality & Values Assessment router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.personality import personality_service

logger = logging.getLogger("concierge.personality")
router = APIRouter()


class AssessmentResponse(BaseModel):
    question_id: int
    selected_option: Optional[str] = None
    selected_index: Optional[int] = None
    answer: Optional[str] = None


class AssessmentSubmit(BaseModel):
    responses: list[AssessmentResponse]


class ProfileUpdate(BaseModel):
    mbti_type: Optional[str] = None
    energy_source: Optional[str] = None
    decision_style: Optional[str] = None
    structure_preference: Optional[str] = None
    stress_response: Optional[str] = None
    urban_nature_score: Optional[float] = None
    secular_spiritual_score: Optional[float] = None
    individualist_communal_score: Optional[float] = None
    competitive_collaborative_score: Optional[float] = None
    risk_seeking_score: Optional[float] = None
    style_orientation: Optional[str] = None
    comfort_appearance_balance: Optional[float] = None


@router.get("/questions")
async def get_questions():
    """Get assessment questions."""
    return await personality_service.get_questions()


@router.post("/score")
async def score_assessment(data: AssessmentSubmit):
    """Score assessment responses and save profile."""
    responses = [r.model_dump(exclude_none=True) for r in data.responses]
    return await personality_service.score_assessment(responses)


@router.get("/profile")
async def get_profile():
    """Get personality profile."""
    return await personality_service.get_profile()


@router.get("/insight")
async def get_insight():
    """Get Claude-generated personality insight."""
    return await personality_service.generate_insight()


@router.get("/coaching-style")
async def get_coaching_style():
    """Get coaching tone modifiers based on personality."""
    return await personality_service.get_coaching_instructions()


@router.put("/profile")
async def update_profile(data: ProfileUpdate):
    """Manually update personality profile."""
    return await personality_service.update_profile(data.model_dump(exclude_none=True))
