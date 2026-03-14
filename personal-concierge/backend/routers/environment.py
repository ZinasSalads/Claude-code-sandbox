"""Environment router — UV, AQI, pollen, weather data."""

import logging
from typing import Optional

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from config import supabase
from services.environment import environment_service

logger = logging.getLogger("concierge.environment")
router = APIRouter()


class LocationUpdate(BaseModel):
    city: str


@router.get("/today")
async def get_today(lat: Optional[float] = None, lon: Optional[float] = None):
    """Get today's environmental conditions."""
    return await environment_service.get_today(lat, lon)


@router.get("/location")
async def get_location():
    """Get saved location."""
    if not supabase:
        return {"configured": False}
    try:
        result = (
            supabase.table("life_profile")
            .select("value")
            .eq("key", "location")
            .limit(1)
            .execute()
        )
        if result.data:
            val = result.data[0].get("value", {})
            return {"configured": True, **val}
        return {"configured": False}
    except Exception as e:
        logger.error(f"Failed to get location: {e}")
        return {"configured": False}


@router.post("/set-location")
async def set_location(data: LocationUpdate):
    """Geocode a city name and save as user location."""
    # Use Open-Meteo free geocoding
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://geocoding-api.open-meteo.com/v1/search",
                params={"name": data.city, "count": 1, "language": "en"},
            )
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                if not results:
                    return {"error": f"Could not find '{data.city}'. Try a more specific name."}
                place = results[0]
                location = {
                    "lat": place["latitude"],
                    "lon": place["longitude"],
                    "city": place.get("name", data.city),
                    "country": place.get("country", ""),
                    "admin1": place.get("admin1", ""),
                }
            else:
                return {"error": "Geocoding service unavailable. Try again later."}
    except Exception as e:
        logger.error(f"Geocoding error: {e}")
        return {"error": "Failed to look up location. Check your connection."}

    # Save to life_profile
    if supabase:
        try:
            row = {"key": "location", "value": location}
            supabase.table("life_profile").upsert(row, on_conflict="key").execute()
        except Exception as e:
            logger.error(f"Failed to save location: {e}")
            return {"error": "Location found but failed to save. Try again."}

    # Clear cached env data so next fetch uses new location
    try:
        from datetime import date
        supabase.table("environmental_data").delete().eq("date", date.today().isoformat()).execute()
    except Exception:
        pass

    return {"success": True, **location}
