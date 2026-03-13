"""Style & Wardrobe router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.wardrobe import wardrobe_service

logger = logging.getLogger("concierge.wardrobe")
router = APIRouter()


class WardrobeItemCreate(BaseModel):
    item_name: str
    category: Optional[str] = None
    color: Optional[str] = None
    occasion: Optional[list[str]] = None
    season: Optional[list[str]] = None
    brand: Optional[str] = None
    condition: str = "good"
    notes: Optional[str] = None


class WardrobeItemUpdate(BaseModel):
    item_name: Optional[str] = None
    category: Optional[str] = None
    color: Optional[str] = None
    occasion: Optional[list[str]] = None
    season: Optional[list[str]] = None
    brand: Optional[str] = None
    condition: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None


class OutfitLog(BaseModel):
    occasion: Optional[str] = None
    wardrobe_item_ids: Optional[list[str]] = None
    rating: Optional[int] = None
    notes: Optional[str] = None


@router.get("/items")
async def list_items(category: str = None):
    """List wardrobe items."""
    return await wardrobe_service.get_wardrobe(category=category)


@router.post("/items")
async def add_item(data: WardrobeItemCreate):
    """Add a wardrobe item."""
    return await wardrobe_service.add_item(data.model_dump(exclude_none=True))


@router.put("/items/{item_id}")
async def update_item(item_id: str, data: WardrobeItemUpdate):
    """Update a wardrobe item."""
    return await wardrobe_service.update_item(item_id, data.model_dump(exclude_none=True))


@router.delete("/items/{item_id}")
async def deactivate_item(item_id: str):
    """Deactivate a wardrobe item."""
    return await wardrobe_service.deactivate_item(item_id)


@router.get("/suggest")
async def suggest_outfit(occasion: str = "casual"):
    """Get outfit suggestion for today."""
    return await wardrobe_service.get_outfit_suggestion(occasion=occasion)


@router.get("/tomorrow")
async def suggest_tomorrow():
    """Get tomorrow's outfit suggestion."""
    return await wardrobe_service.get_tomorrow_suggestion()


@router.post("/log")
async def log_outfit(data: OutfitLog):
    """Log outfit worn today."""
    return await wardrobe_service.log_outfit(data.model_dump(exclude_none=True))


@router.get("/audit")
async def wardrobe_audit():
    """Get wardrobe audit report."""
    return await wardrobe_service.get_wardrobe_audit()
