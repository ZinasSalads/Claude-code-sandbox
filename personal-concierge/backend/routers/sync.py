import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from config import supabase, OURA_TOKEN
from services.oura import OuraClient

logger = logging.getLogger("concierge.sync")
router = APIRouter()


@router.post("/oura")
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
        row = {k: v for k, v in record.items()}
        row["raw_oura"] = json.dumps(row["raw_oura"]) if row.get("raw_oura") else None

        result = supabase.table("health_data").upsert(row, on_conflict="date").execute()
        if result.data:
            upserted += 1

    return {
        "status": "ok",
        "days_synced": len(data),
        "records_upserted": upserted,
        "date_range": {"start": start.isoformat(), "end": end.isoformat()},
    }
