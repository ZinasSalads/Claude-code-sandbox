"""Data export & privacy controls router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.privacy import privacy_service

logger = logging.getLogger("concierge.privacy")
router = APIRouter()


class ExportRequest(BaseModel):
    format: str = "json"


class SensitivityUpdate(BaseModel):
    data_key: str
    tier: str  # standard, silent, private


class AmnesiaRequest(BaseModel):
    category: str
    confirm: bool = False


@router.get("/summary")
async def get_data_summary():
    """What the app knows about you — category-by-category."""
    return await privacy_service.get_data_summary()


@router.post("/export")
async def export_data(body: ExportRequest = ExportRequest()):
    """Trigger full data export."""
    return await privacy_service.export_full_profile(body.format)


@router.delete("/category/{category}")
async def delete_category(category: str, confirm: bool = False):
    """Delete all data in a category. Requires confirm=true."""
    return await privacy_service.delete_category(category, confirm)


@router.put("/sensitivity")
async def set_sensitivity(data: SensitivityUpdate):
    """Set sensitivity tier for a data key."""
    return await privacy_service.set_sensitivity_tier(data.data_key, data.tier)


@router.post("/amnesia")
async def amnesia(body: AmnesiaRequest):
    """Forget a category entirely. Irreversible."""
    return await privacy_service.amnesia(body.category, body.confirm)
