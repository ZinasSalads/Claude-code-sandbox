"""Oura Ring API v2 client.

Handles fetching readiness, sleep, activity data from the Oura API
and normalizing it into our health_data schema.
"""

import asyncio
import logging
from datetime import date
from typing import Optional

import httpx

from config import OURA_TOKEN

logger = logging.getLogger("concierge.oura")

BASE_URL = "https://api.ouraring.com/v2/usercollection"

ENDPOINTS = {
    "readiness": f"{BASE_URL}/daily_readiness",
    "sleep": f"{BASE_URL}/daily_sleep",
    "sleep_periods": f"{BASE_URL}/sleep",
    "activity": f"{BASE_URL}/daily_activity",
}


class OuraClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or OURA_TOKEN
        if not self.token:
            logger.warning("OURA_PERSONAL_ACCESS_TOKEN not set — Oura sync disabled")
        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @property
    def is_configured(self) -> bool:
        return bool(self.token)

    async def _fetch(self, endpoint: str, start_date: date, end_date: date) -> list:
        """Fetch data from an Oura API v2 endpoint with retry on 429."""
        if not self.is_configured:
            return []

        params = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        }

        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(3):
                resp = await client.get(endpoint, headers=self.headers, params=params)

                if resp.status_code == 429:
                    wait = 2 ** (attempt + 1)
                    logger.warning(f"Oura rate limit hit, waiting {wait}s...")
                    await asyncio.sleep(wait)
                    continue

                if resp.status_code != 200:
                    logger.error(f"Oura API error {resp.status_code}: {resp.text[:200]}")
                    return []

                data = resp.json()
                return data.get("data", [])

        logger.error("Oura API: max retries exceeded")
        return []

    async def fetch_readiness(self, start_date: date, end_date: date) -> list:
        return await self._fetch(ENDPOINTS["readiness"], start_date, end_date)

    async def fetch_sleep(self, start_date: date, end_date: date) -> list:
        return await self._fetch(ENDPOINTS["sleep"], start_date, end_date)

    async def fetch_activity(self, start_date: date, end_date: date) -> list:
        return await self._fetch(ENDPOINTS["activity"], start_date, end_date)

    async def fetch_sleep_periods(self, start_date: date, end_date: date) -> list:
        return await self._fetch(ENDPOINTS["sleep_periods"], start_date, end_date)

    async def fetch_all_for_range(self, start_date: date, end_date: date) -> dict:
        """Fetch all data types for a date range. Returns dict keyed by date string."""
        readiness = await self.fetch_readiness(start_date, end_date)
        sleep = await self.fetch_sleep(start_date, end_date)
        activity = await self.fetch_activity(start_date, end_date)
        sleep_periods = await self.fetch_sleep_periods(start_date, end_date)

        readiness_by_day = {r.get("day"): r for r in readiness}
        sleep_by_day = {s.get("day"): s for s in sleep}
        activity_by_day = {a.get("day"): a for a in activity}

        # Build HRV map from sleep periods (actual ms values)
        hrv_by_day: dict = {}
        for sp in sleep_periods:
            sp_day = sp.get("day")
            avg_hrv = sp.get("average_hrv")
            if sp_day and avg_hrv is not None:
                if sp_day not in hrv_by_day or sp.get("type") == "long_sleep":
                    hrv_by_day[sp_day] = avg_hrv

        all_dates = set(readiness_by_day) | set(sleep_by_day) | set(activity_by_day)
        result = {}

        for day in sorted(all_dates):
            r = readiness_by_day.get(day, {})
            s = sleep_by_day.get(day, {})
            a = activity_by_day.get(day, {})

            r_contrib = r.get("contributors", {})
            s_contrib = s.get("contributors", {})

            sleep_seconds = s.get("total_sleep_duration")
            sleep_hours = round(sleep_seconds / 3600, 2) if sleep_seconds else None

            result[day] = {
                "date": day,
                "readiness_score": r.get("score"),
                "readiness_temperature": r_contrib.get("body_temperature"),
                "hrv": hrv_by_day.get(day),
                "hrv_balance": r_contrib.get("hrv_balance"),
                "resting_heart_rate": r_contrib.get("resting_heart_rate"),
                "sleep_score": s.get("score"),
                "sleep_duration": sleep_hours,
                "deep_sleep_minutes": _seconds_to_minutes(s.get("deep_sleep_duration")),
                "rem_sleep_minutes": _seconds_to_minutes(s.get("rem_sleep_duration")),
                "light_sleep_minutes": _seconds_to_minutes(s.get("light_sleep_duration")),
                "awake_minutes": _seconds_to_minutes(s.get("awake_time")),
                "sleep_efficiency": s_contrib.get("efficiency"),
                "respiratory_rate": s.get("average_breath"),
                "spo2_avg": None,
                "activity_score": a.get("score"),
                "steps": a.get("steps"),
                "calories_active": a.get("active_calories"),
                "raw_oura": {
                    "readiness": r or None,
                    "sleep": s or None,
                    "activity": a or None,
                },
            }

        return result


def _seconds_to_minutes(seconds: Optional[int]) -> Optional[int]:
    """Convert seconds to minutes, returning None if input is None."""
    if seconds is None:
        return None
    return round(seconds / 60)


# Module-level singleton
oura_client = OuraClient()
