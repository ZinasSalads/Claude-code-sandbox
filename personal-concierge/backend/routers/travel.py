"""Travel intelligence router."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.travel import travel_service

logger = logging.getLogger("concierge.travel")
router = APIRouter()


class TripCreate(BaseModel):
    destination: str
    departure_date: str
    return_date: str
    destination_lat: Optional[float] = None
    destination_lon: Optional[float] = None
    trip_type: Optional[str] = "leisure"
    travel_companions: Optional[str] = "solo"
    notes: Optional[str] = None


class TripUpdate(BaseModel):
    destination: Optional[str] = None
    departure_date: Optional[str] = None
    return_date: Optional[str] = None
    trip_type: Optional[str] = None
    travel_companions: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class TravelCheckIn(BaseModel):
    workout_done: bool = False
    workout_notes: Optional[str] = None
    nutrition_quality: Optional[int] = None
    sleep_quality: Optional[int] = None
    mood_score: Optional[int] = None
    highlights: Optional[str] = None


@router.get("/trips")
async def list_trips():
    """List all trips."""
    return await travel_service.get_all_trips()


@router.post("/trips")
async def create_trip(data: TripCreate):
    """Create a new trip."""
    return await travel_service.create_trip(data.model_dump(exclude_none=True))


@router.get("/trips/{trip_id}")
async def get_trip(trip_id: str):
    """Get trip detail."""
    trip = await travel_service.get_trip(trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


@router.put("/trips/{trip_id}")
async def update_trip(trip_id: str, data: TripUpdate):
    """Update a trip."""
    return await travel_service.update_trip(trip_id, data.model_dump(exclude_none=True))


@router.get("/trips/{trip_id}/prep")
async def get_pre_trip_plan(trip_id: str):
    """Generate pre-trip preparation plan."""
    return await travel_service.generate_pre_trip_plan(trip_id)


@router.post("/trips/{trip_id}/checkin")
async def travel_check_in(trip_id: str, data: TravelCheckIn):
    """Daily travel check-in."""
    return await travel_service.daily_travel_check_in(trip_id, data.model_dump())


@router.get("/trips/{trip_id}/post-trip")
async def get_post_trip_protocol(trip_id: str):
    """Generate post-trip recovery protocol."""
    return await travel_service.generate_post_trip_protocol(trip_id)


@router.get("/active")
async def get_active_trip():
    """Get currently active trip (or null)."""
    return await travel_service.get_active_trip()


@router.get("/suggestions")
async def get_suggestions(trip_id: str, type: str = "restaurants"):
    """Get local suggestions for a trip."""
    return await travel_service.get_local_suggestions(trip_id, type)
