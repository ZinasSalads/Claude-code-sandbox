"""Financial context router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.financial import financial_service

logger = logging.getLogger("concierge.financial")
router = APIRouter()


class FinancialContextUpdate(BaseModel):
    monthly_lifestyle_budget: Optional[float] = None
    city_tier: Optional[str] = None
    socioeconomic_tier: Optional[str] = None
    home_cook_ratio: Optional[float] = None
    gym_has_membership: Optional[bool] = None
    notes: Optional[str] = None


class SubscriptionCreate(BaseModel):
    service_name: str
    category: Optional[str] = None
    monthly_cost: Optional[float] = None
    billing_cycle: str = "monthly"
    last_used_date: Optional[str] = None
    usage_frequency: Optional[str] = None
    notes: Optional[str] = None


class SubscriptionUpdate(BaseModel):
    service_name: Optional[str] = None
    category: Optional[str] = None
    monthly_cost: Optional[float] = None
    last_used_date: Optional[str] = None
    usage_frequency: Optional[str] = None
    keeps_value: Optional[bool] = None
    active: Optional[bool] = None
    notes: Optional[str] = None


@router.get("/context")
async def get_financial_context():
    """Get financial profile."""
    return await financial_service.get_context()


@router.put("/context")
async def update_financial_context(data: FinancialContextUpdate):
    """Update financial profile."""
    return await financial_service.update_context(data.model_dump(exclude_none=True))


@router.get("/subscriptions")
async def list_subscriptions():
    """List all active subscriptions."""
    return await financial_service.get_subscriptions()


@router.post("/subscriptions")
async def add_subscription(data: SubscriptionCreate):
    """Add a subscription."""
    return await financial_service.add_subscription(data.model_dump(exclude_none=True))


@router.put("/subscriptions/{sub_id}")
async def update_subscription(sub_id: str, data: SubscriptionUpdate):
    """Update a subscription."""
    return await financial_service.update_subscription(sub_id, data.model_dump(exclude_none=True))


@router.get("/audit")
async def get_audit():
    """Get subscription audit report."""
    return await financial_service.get_subscription_audit()
