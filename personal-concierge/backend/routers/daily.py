"""Daily plan router — cross-module intelligence endpoint.

Uses the multi-agent council (10 specialist agents in parallel)
with structured arbitration for unified daily planning.
"""

import logging

from fastapi import APIRouter

from agents.council import agent_council
from services.arbitrator import arbitrator_service

logger = logging.getLogger("concierge.daily")
router = APIRouter()


@router.get("/plan")
async def get_daily_plan():
    """Generate a comprehensive daily plan from the 10-agent council."""
    try:
        return await agent_council.run_full_council()
    except Exception as e:
        logger.error(f"Council failed, falling back to arbitrator: {e}")
        return await arbitrator_service.generate_daily_plan()


@router.get("/council-debug")
async def get_council_debug():
    """Return all 10 agent positions + conflicts found before arbitration."""
    return await agent_council.get_debug_positions()
