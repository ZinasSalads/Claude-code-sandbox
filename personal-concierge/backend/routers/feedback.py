"""Feedback & preference learning router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.learning_engine import learning_engine

logger = logging.getLogger("concierge.feedback")
router = APIRouter()


class RatingSubmit(BaseModel):
    category: str
    item_id: str
    item_description: str
    rating: str  # loved_it, it_was_fine, not_for_me
    explicit_feedback: Optional[str] = None


@router.post("/rate")
async def submit_rating(data: RatingSubmit):
    """Submit a preference rating."""
    return await learning_engine.log_rating(
        category=data.category,
        item_id=data.item_id,
        item_description=data.item_description,
        rating=data.rating,
        explicit_feedback=data.explicit_feedback,
    )


@router.get("/patterns")
async def get_all_patterns():
    """Get all preference patterns."""
    return await learning_engine.get_patterns()


@router.get("/patterns/{category}")
async def get_category_patterns(category: str):
    """Get patterns for one category."""
    return await learning_engine.get_patterns(category)


@router.get("/summary")
async def get_summary():
    """Get learning summary."""
    return await learning_engine.get_learning_summary()
