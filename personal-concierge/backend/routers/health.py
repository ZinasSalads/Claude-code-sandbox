import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from config import supabase
from services.memory import add_memory

logger = logging.getLogger("concierge.health")
router = APIRouter()


class CheckInRequest(BaseModel):
    energy: int = Field(ge=1, le=10)
    mood: int = Field(ge=1, le=10)
    stress: int = Field(ge=1, le=10)
    soreness: int = Field(ge=1, le=10)
    notes: Optional[str] = None


@router.post("")
async def submit_checkin(data: CheckInRequest):
    """Save daily morning check-in."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    today = date.today().isoformat()

    try:
        row = {
            "date": today,
            "energy": data.energy,
            "mood": data.mood,
            "stress": data.stress,
            "soreness": data.soreness,
            "notes": data.notes,
        }

        # Upsert to allow updating today's check-in
        result = supabase.table("check_ins").upsert(row, on_conflict="date").execute()

        # Store as memory for AI context
        memory_text = (
            f"On {today}, user reported: energy {data.energy}/10, mood {data.mood}/10, "
            f"stress {data.stress}/10, soreness {data.soreness}/10."
        )
        if data.notes:
            memory_text += f" Notes: {data.notes}"
        await add_memory(memory_text, category="health", source="checkin")

        # Invalidate today's workout cache by deleting uncommpleted AI workouts for today
        # This forces regeneration with the new check-in data
        try:
            supabase.table("workouts").delete().eq(
                "date", today
            ).eq("recommended_by_ai", True).eq("completed", False).execute()
        except Exception as e:
            logger.warning(f"Failed to invalidate workout cache: {e}")

        return {
            "status": "ok",
            "message": "Check-in saved",
            "data": result.data[0] if result.data else row,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save check-in: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/today")
async def get_today_checkin():
    """Get today's check-in if it exists."""
    if not supabase:
        return None

    try:
        result = (
            supabase.table("check_ins")
            .select("*")
            .eq("date", date.today().isoformat())
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"Failed to fetch today's check-in: {e}")
        return None


@router.get("/history")
async def get_checkin_history(days: int = 30):
    """Get recent check-in history."""
    if not supabase:
        return []

    try:
        start = (date.today() - timedelta(days=days)).isoformat()
        result = (
            supabase.table("check_ins")
            .select("*")
            .gte("date", start)
            .order("date", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to fetch check-in history: {e}")
        return []
