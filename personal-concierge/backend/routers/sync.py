import json
import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import supabase, OURA_TOKEN
from services.oura import OuraClient

logger = logging.getLogger("concierge.sync")
router = APIRouter()


@router.api_route("/oura", methods=["GET", "POST"])
async def sync_oura(days: int = 7):
    """Trigger Oura data sync for the last N days."""
    if not OURA_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="OURA_PERSONAL_ACCESS_TOKEN not configured. Set it in .env to enable Oura sync.",
        )

    if not supabase:
        raise HTTPException(
            status_code=503,
            detail="Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.",
        )

    client = OuraClient()
    end = date.today()
    start = end - timedelta(days=days)

    data = await client.fetch_all_for_range(start, end)

    if not data:
        return {"status": "ok", "message": "No data returned from Oura API", "days_synced": 0}

    upserted = 0
    for day_str, record in data.items():
        try:
            row = {k: v for k, v in record.items()}
            row["raw_oura"] = json.dumps(row["raw_oura"]) if row.get("raw_oura") else None

            result = supabase.table("health_data").upsert(row, on_conflict="date").execute()
            if result.data:
                upserted += 1
        except Exception as e:
            logger.warning(f"Failed to upsert health_data for {day_str}: {e}")

    return {
        "status": "ok",
        "days_synced": len(data),
        "records_upserted": upserted,
        "date_range": {"start": start.isoformat(), "end": end.isoformat()},
    }


# --- Apple Health sync ---

class AppleHealthDay(BaseModel):
    date: str
    steps: Optional[int] = None
    heart_rate_avg: Optional[int] = None
    hrv: Optional[int] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[str] = None
    active_calories: Optional[int] = None
    workouts: Optional[list] = None


class AppleHealthSync(BaseModel):
    days: list[AppleHealthDay]


@router.post("/apple-health")
async def sync_apple_health(body: AppleHealthSync):
    """Accept Apple Health data and merge into health_data. Only fills NULL fields."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")

    synced = 0
    for day in body.days:
        try:
            # Get existing record
            existing = (
                supabase.table("health_data")
                .select("*")
                .eq("date", day.date)
                .limit(1)
                .execute()
            )

            if existing.data:
                row = existing.data[0]
                updates = {}
                # Only fill NULL fields
                if row.get("steps") is None and day.steps is not None:
                    updates["steps"] = day.steps
                if row.get("resting_heart_rate") is None and day.heart_rate_avg is not None:
                    updates["resting_heart_rate"] = day.heart_rate_avg
                if row.get("hrv") is None and day.hrv is not None:
                    updates["hrv"] = day.hrv
                if row.get("sleep_duration") is None and day.sleep_hours is not None:
                    updates["sleep_duration"] = day.sleep_hours
                if row.get("active_calories") is None and day.active_calories is not None:
                    updates["active_calories"] = day.active_calories

                if updates:
                    supabase.table("health_data").update(updates).eq("date", day.date).execute()
                    synced += 1
            else:
                # No Oura data for this date — insert Apple Health data
                row = {
                    "date": day.date,
                    "steps": day.steps,
                    "resting_heart_rate": day.heart_rate_avg,
                    "hrv": day.hrv,
                    "sleep_duration": day.sleep_hours,
                    "active_calories": day.active_calories,
                    "data_source": "apple_health",
                }
                supabase.table("health_data").upsert(row, on_conflict="date").execute()
                synced += 1
        except Exception as e:
            logger.error(f"Apple Health sync error for {day.date}: {e}")

    return {"status": "ok", "synced": synced, "total_days": len(body.days)}


@router.get("/gaps")
async def get_health_gaps():
    """Return dates where health_data has null fields that Apple Health could fill."""
    if not supabase:
        return []

    try:
        week_ago = (date.today() - timedelta(days=30)).isoformat()
        result = (
            supabase.table("health_data")
            .select("date,steps,sleep_score,hrv")
            .gte("date", week_ago)
            .order("date")
            .execute()
        )

        gaps = []
        for row in (result.data or []):
            if row.get("sleep_score") is None or row.get("hrv") is None:
                gaps.append(row["date"])
        return gaps
    except Exception as e:
        logger.error(f"Failed to get health gaps: {e}")
        return []
