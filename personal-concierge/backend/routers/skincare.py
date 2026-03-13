"""Skincare router — manage products, routines, skin tracking, and analysis."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.skincare import skincare_service

logger = logging.getLogger("concierge.skincare")
router = APIRouter()


class SkinProfileUpdate(BaseModel):
    skin_type: Optional[str] = None
    sensitivity_level: Optional[str] = None
    concerns: Optional[list[str]] = None
    allergies: Optional[list[str]] = None
    climate: Optional[str] = None
    age_range: Optional[str] = None
    goals: Optional[list[str]] = None
    notes: Optional[str] = None


class ProductCreate(BaseModel):
    product_name: str
    brand: Optional[str] = None
    product_type: Optional[str] = None
    active_ingredients: Optional[list[str]] = None
    routine_slot: Optional[str] = "both"
    application_order: Optional[int] = None
    frequency: Optional[str] = "daily"
    notes: Optional[str] = None


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    brand: Optional[str] = None
    product_type: Optional[str] = None
    active_ingredients: Optional[list[str]] = None
    routine_slot: Optional[str] = None
    application_order: Optional[int] = None
    frequency: Optional[str] = None
    notes: Optional[str] = None


class SkinCheckin(BaseModel):
    log_date: Optional[str] = None
    overall_condition: Optional[int] = None
    breakouts: Optional[int] = None
    redness: Optional[int] = None
    dryness: Optional[int] = None
    puffiness: Optional[int] = None
    dark_circles: Optional[int] = None
    routine_completed: Optional[bool] = None
    notes: Optional[str] = None


class PhotoAnalysis(BaseModel):
    image_base64: str


@router.get("/profile")
async def get_skin_profile():
    """Get the user's skin profile."""
    return await skincare_service.get_skin_profile()


@router.put("/profile")
async def update_skin_profile(req: SkinProfileUpdate):
    """Update the user's skin profile."""
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    result = await skincare_service.save_skin_profile(updates)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/products")
async def list_products(slot: Optional[str] = None):
    """List active skincare products, optionally filtered by routine slot."""
    return await skincare_service.get_products(slot=slot)


@router.post("/products")
async def add_product(req: ProductCreate):
    """Add a skincare product with automatic conflict checking."""
    result = await skincare_service.add_product(req.model_dump())
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.put("/products/{product_id}")
async def update_product(product_id: str, req: ProductUpdate):
    """Update a skincare product."""
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    result = await skincare_service.update_product(product_id, updates)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/products/{product_id}")
async def deactivate_product(product_id: str):
    """Deactivate a skincare product (soft delete)."""
    result = await skincare_service.deactivate_product(product_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/conflicts/{product_id}")
async def check_conflicts(product_id: str):
    """Check ingredient conflicts for a specific product."""
    return await skincare_service.check_conflicts(product_id)


@router.get("/routine/morning")
async def get_morning_routine():
    """Get the morning skincare routine with reminders."""
    return await skincare_service.get_morning_routine()


@router.get("/routine/evening")
async def get_evening_routine():
    """Get the evening skincare routine."""
    return await skincare_service.get_evening_routine()


@router.post("/checkin")
async def log_skin_checkin(req: SkinCheckin):
    """Log a daily skin check-in."""
    result = await skincare_service.log_skin_checkin(req.model_dump(exclude_none=True))
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/analyze-photo")
async def analyze_skin_photo(req: PhotoAnalysis):
    """Analyze a skin photo using Claude Vision."""
    result = await skincare_service.analyze_photo(req.image_base64)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/correlations")
async def get_skin_correlations():
    """Get health-skin correlations over the last 60 days."""
    return await skincare_service.get_skin_correlations()


@router.get("/weekly")
async def get_weekly_summary():
    """Get weekly skin summary with trends."""
    return await skincare_service.get_weekly_skin_summary()
