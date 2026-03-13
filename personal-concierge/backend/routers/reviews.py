"""Weekly & Monthly Review router."""

import logging
from datetime import date

from fastapi import APIRouter

from services.reviews import review_service

logger = logging.getLogger("concierge.reviews")
router = APIRouter()


@router.get("/weekly")
async def get_weekly_review():
    """Get this week's review (generate if needed)."""
    week_start = review_service._get_week_start()
    return await review_service.get_weekly_review(week_start)


@router.get("/monthly")
async def get_monthly_review():
    """Get this month's review (generate if needed)."""
    month_start = review_service._get_month_start()
    return await review_service.get_monthly_review(month_start)


@router.post("/weekly/generate")
async def force_generate_weekly():
    """Force regenerate this week's review."""
    week_start = review_service._get_week_start()
    return await review_service.generate_weekly_review(week_start)


@router.post("/monthly/generate")
async def force_generate_monthly():
    """Force regenerate this month's review."""
    month_start = review_service._get_month_start()
    return await review_service.generate_monthly_review(month_start)


@router.get("/history/weekly")
async def get_weekly_history():
    """Get last 12 weekly reviews."""
    return await review_service.get_review_history("weekly", limit=12)


@router.get("/history/monthly")
async def get_monthly_history():
    """Get last 12 monthly reviews."""
    return await review_service.get_review_history("monthly", limit=12)


@router.get("/weekly/{date_str}")
async def get_specific_weekly_review(date_str: str):
    """Get a specific week's review. Date auto-adjusted to Monday."""
    d = date.fromisoformat(date_str)
    return await review_service.get_weekly_review(d)


@router.get("/monthly/{date_str}")
async def get_specific_monthly_review(date_str: str):
    """Get a specific month's review. Date auto-adjusted to 1st of month."""
    d = date.fromisoformat(date_str)
    return await review_service.get_monthly_review(d)
