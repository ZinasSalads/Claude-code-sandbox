"""Daily plan router — cache-first with 10-agent council generation.

Returns cached plan instantly (<100ms) on repeat calls the same day.
Only regenerates when: new day, explicit refresh, or cache invalidated (e.g. after check-in).
"""

import json
import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter

from agents.council import agent_council
from config import supabase
from services.arbitrator import arbitrator_service

logger = logging.getLogger("concierge.daily")
router = APIRouter()


async def _get_cached_plan() -> dict | None:
    """Fetch today's cached plan from Supabase if valid."""
    if not supabase:
        return None
    try:
        result = (
            supabase.table("daily_plans")
            .select("plan,generated_at,invalidated")
            .eq("date", date.today().isoformat())
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        row = result.data[0]
        if row.get("invalidated"):
            return None
        plan = row["plan"]
        if isinstance(plan, str):
            plan = json.loads(plan)
        plan["generated_at"] = row["generated_at"]
        plan["cached"] = True
        return plan
    except Exception as e:
        logger.error(f"Cache read error: {e}")
        return None


async def _save_plan_to_cache(plan: dict) -> dict:
    """Save generated plan to Supabase cache and return it with generated_at."""
    now = datetime.now(timezone.utc)
    plan["generated_at"] = now.isoformat()
    plan["cached"] = False

    if supabase:
        try:
            row = {
                "date": date.today().isoformat(),
                "plan": json.dumps(plan),
                "generated_at": now.isoformat(),
                "invalidated": False,
            }
            supabase.table("daily_plans").upsert(row, on_conflict="date").execute()
        except Exception as e:
            logger.error(f"Cache write error: {e}")

    return plan


async def _generate_fresh_plan() -> dict:
    """Generate a new plan via council (with arbitrator fallback)."""
    try:
        plan = await agent_council.run_full_council()
    except Exception as e:
        logger.error(f"Council failed, falling back to arbitrator: {e}")
        plan = await arbitrator_service.generate_daily_plan()
    return await _save_plan_to_cache(plan)


async def invalidate_daily_plan_cache():
    """Mark today's cached plan as invalidated so next fetch regenerates."""
    if not supabase:
        return
    try:
        supabase.table("daily_plans").update(
            {"invalidated": True}
        ).eq("date", date.today().isoformat()).execute()
        logger.info("Daily plan cache invalidated")
    except Exception as e:
        logger.warning(f"Failed to invalidate daily plan cache: {e}")


@router.get("/plan")
async def get_daily_plan(refresh: bool = False):
    """Get today's daily plan. Returns cache instantly; use ?refresh=true to regenerate."""
    if not refresh:
        cached = await _get_cached_plan()
        if cached:
            return cached

    return await _generate_fresh_plan()


@router.get("/council-debug")
async def get_council_debug():
    """Return all 10 agent positions + conflicts found before arbitration."""
    return await agent_council.get_debug_positions()
