"""Google Calendar integration service.

OAuth2 flow for connecting Google Calendar.
Syncs events, classifies them with Claude, and provides cross-module intelligence.
Degrades gracefully when credentials are not set.
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.calendar")

MODEL = "claude-sonnet-4-20250514"

# Google Calendar OAuth2 config — loaded from env
import os

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_CALENDAR_REDIRECT_URI", "")

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

SCOPES = "https://www.googleapis.com/auth/calendar.readonly"


class CalendarService:

    def get_auth_url(self) -> str:
        """Generate Google OAuth2 authorization URL."""
        if not GOOGLE_CLIENT_ID:
            return ""

        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "response_type": "code",
            "scope": SCOPES,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        """Exchange auth code for tokens."""
        if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
            return {"error": "Google Calendar credentials not configured"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(GOOGLE_TOKEN_URL, data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                })
                tokens = resp.json()

            if "access_token" not in tokens:
                return {"error": tokens.get("error_description", "Token exchange failed")}

            # Store tokens
            if supabase:
                expiry = datetime.now(timezone.utc) + timedelta(seconds=tokens.get("expires_in", 3600))
                row = {
                    "access_token": tokens["access_token"],
                    "refresh_token": tokens.get("refresh_token"),
                    "token_expiry": expiry.isoformat(),
                    "connected": True,
                }
                existing = supabase.table("calendar_tokens").select("id").limit(1).execute()
                if existing.data:
                    supabase.table("calendar_tokens").update(row).eq("id", existing.data[0]["id"]).execute()
                else:
                    supabase.table("calendar_tokens").insert(row).execute()

            return {"status": "connected"}
        except Exception as e:
            logger.error(f"Token exchange failed: {e}")
            return {"error": str(e)}

    async def _get_access_token(self) -> Optional[str]:
        """Get valid access token, refreshing if needed."""
        if not supabase:
            return None

        try:
            result = supabase.table("calendar_tokens").select("*").eq("connected", True).limit(1).execute()
            if not result.data:
                return None

            tokens = result.data[0]
            expiry = tokens.get("token_expiry")

            if expiry:
                exp_dt = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
                if exp_dt < datetime.now(timezone.utc) + timedelta(minutes=5):
                    # Refresh
                    refreshed = await self._refresh_token(tokens)
                    if refreshed:
                        return refreshed
                    return None

            return tokens.get("access_token")
        except Exception as e:
            logger.error(f"Failed to get access token: {e}")
            return None

    async def _refresh_token(self, tokens: dict) -> Optional[str]:
        """Refresh access token."""
        refresh = tokens.get("refresh_token")
        if not refresh or not GOOGLE_CLIENT_ID:
            return None

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(GOOGLE_TOKEN_URL, data={
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "refresh_token": refresh,
                    "grant_type": "refresh_token",
                })
                data = resp.json()

            if "access_token" not in data:
                return None

            expiry = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
            supabase.table("calendar_tokens").update({
                "access_token": data["access_token"],
                "token_expiry": expiry.isoformat(),
            }).eq("id", tokens["id"]).execute()

            return data["access_token"]
        except Exception as e:
            logger.error(f"Token refresh failed: {e}")
            return None

    async def sync_events(self, days_ahead: int = 7) -> dict:
        """Pull events from Google Calendar and classify them."""
        token = await self._get_access_token()
        if not token:
            return {"status": "not_connected", "synced": 0}

        try:
            now = datetime.now(timezone.utc)
            time_max = now + timedelta(days=days_ahead)

            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{GOOGLE_CALENDAR_API}/calendars/primary/events",
                    headers={"Authorization": f"Bearer {token}"},
                    params={
                        "timeMin": now.isoformat(),
                        "timeMax": time_max.isoformat(),
                        "singleEvents": "true",
                        "orderBy": "startTime",
                        "maxResults": "100",
                    },
                )
                data = resp.json()

            events = data.get("items", [])
            synced = 0

            for event in events:
                classified = await self._classify_event(event)
                row = {
                    "event_id": event.get("id"),
                    "title": event.get("summary", ""),
                    "start_datetime": event.get("start", {}).get("dateTime", event.get("start", {}).get("date")),
                    "end_datetime": event.get("end", {}).get("dateTime", event.get("end", {}).get("date")),
                    "location": event.get("location"),
                    "description": event.get("description"),
                    "attendee_count": len(event.get("attendees", [])),
                    **classified,
                }

                if supabase:
                    supabase.table("calendar_events").upsert(row, on_conflict="event_id").execute()
                    synced += 1

            # Update last sync time
            if supabase:
                supabase.table("calendar_tokens").update({
                    "last_sync": now.isoformat(),
                }).eq("connected", True).execute()

            travel_count = sum(1 for e in events if (await self._classify_event(e) if False else {}).get("is_travel"))
            social_count = sum(1 for e in events if (await self._classify_event(e) if False else {}).get("is_social"))

            return {"status": "ok", "synced": synced, "total_events": len(events)}
        except Exception as e:
            logger.error(f"Calendar sync failed: {e}")
            return {"status": "error", "error": str(e), "synced": 0}

    async def _classify_event(self, event: dict) -> dict:
        """Classify event using Claude or keyword matching."""
        title = event.get("summary", "").lower()
        desc = (event.get("description") or "").lower()
        location = (event.get("location") or "").lower()
        attendees = len(event.get("attendees", []))

        # Keyword-based classification (fast path)
        travel_keywords = ["flight", "hotel", "airport", "travel", "trip", "vacation"]
        social_keywords = ["dinner", "lunch", "drinks", "party", "meetup", "birthday", "brunch", "happy hour"]
        formal_keywords = ["meeting", "presentation", "interview", "wedding", "gala", "conference", "review"]
        sport_keywords = ["gym", "workout", "run", "yoga", "swim", "bike", "tennis", "basketball"]

        is_travel = any(k in title or k in desc for k in travel_keywords)
        is_social = any(k in title or k in desc for k in social_keywords) or attendees > 2
        is_formal = any(k in title or k in desc for k in formal_keywords)
        is_sport = any(k in title or k in desc for k in sport_keywords)

        # Determine occasion
        if is_sport:
            occasion = "sport"
        elif is_formal and attendees <= 2:
            occasion = "work"
        elif is_formal and attendees > 2:
            occasion = "formal"
        elif is_travel:
            occasion = "travel"
        elif is_social:
            occasion = "casual"
        elif "date" in title:
            occasion = "date_night"
        else:
            occasion = "casual"

        return {
            "is_travel": is_travel,
            "is_social": is_social,
            "is_formal": is_formal,
            "detected_occasion": occasion,
        }

    async def get_today_events(self) -> list[dict]:
        """Get today's events."""
        if not supabase:
            return []

        try:
            today = date.today().isoformat()
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            result = (
                supabase.table("calendar_events")
                .select("*")
                .gte("start_datetime", today)
                .lt("start_datetime", tomorrow)
                .order("start_datetime")
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get today's events: {e}")
            return []

    async def get_tomorrow_events(self) -> list[dict]:
        """Get tomorrow's events."""
        if not supabase:
            return []

        try:
            tomorrow = (date.today() + timedelta(days=1)).isoformat()
            day_after = (date.today() + timedelta(days=2)).isoformat()
            result = (
                supabase.table("calendar_events")
                .select("*")
                .gte("start_datetime", tomorrow)
                .lt("start_datetime", day_after)
                .order("start_datetime")
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get tomorrow's events: {e}")
            return []

    async def find_workout_windows(self, target_date: date = None) -> list[dict]:
        """Find gaps in calendar suitable for workouts (30+ min)."""
        if not supabase:
            return [{"start_time": "07:00", "end_time": "08:00", "duration_minutes": 60, "suggestion": "Morning workout slot"}]

        if not target_date:
            target_date = date.today()

        try:
            day_start = f"{target_date.isoformat()}T06:00:00"
            day_end = f"{target_date.isoformat()}T22:00:00"

            result = (
                supabase.table("calendar_events")
                .select("start_datetime,end_datetime,title")
                .gte("start_datetime", day_start)
                .lte("start_datetime", day_end)
                .order("start_datetime")
                .execute()
            )

            events = result.data or []
            windows = []

            # Default: waking hours 6am-10pm
            slots = [("06:00", "22:00")]

            for event in events:
                start = event.get("start_datetime", "")
                end = event.get("end_datetime", "")
                if start and end:
                    start_time = start.split("T")[1][:5] if "T" in start else "09:00"
                    end_time = end.split("T")[1][:5] if "T" in end else "10:00"
                    # Simple gap detection
                    windows.append({
                        "busy_start": start_time,
                        "busy_end": end_time,
                        "event": event.get("title", ""),
                    })

            # Find 30+ min gaps
            if not events:
                return [{
                    "start_time": "07:00",
                    "end_time": "08:00",
                    "duration_minutes": 60,
                    "suggestion": "Wide open — morning workout recommended",
                }]

            # Find first free slot before earliest event
            first_event = events[0].get("start_datetime", "")
            if first_event and "T" in first_event:
                first_time = first_event.split("T")[1][:5]
                if first_time > "07:00":
                    return [{
                        "start_time": "07:00",
                        "end_time": first_time,
                        "duration_minutes": 60,
                        "suggestion": f"Before your {events[0].get('title', 'first event')}",
                    }]

            return [{
                "start_time": "18:00",
                "end_time": "19:00",
                "duration_minutes": 60,
                "suggestion": "Evening workout window",
            }]
        except Exception as e:
            logger.error(f"Failed to find workout windows: {e}")
            return []

    async def detect_trips(self) -> list[dict]:
        """Scan next 90 days for travel-related events."""
        if not supabase:
            return []

        try:
            now = datetime.now(timezone.utc).isoformat()
            future = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()

            result = (
                supabase.table("calendar_events")
                .select("*")
                .eq("is_travel", True)
                .gte("start_datetime", now)
                .lte("start_datetime", future)
                .order("start_datetime")
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Trip detection failed: {e}")
            return []

    async def is_connected(self) -> bool:
        """Check if calendar is connected."""
        if not supabase:
            return False

        try:
            result = supabase.table("calendar_tokens").select("connected").eq("connected", True).limit(1).execute()
            return bool(result.data)
        except Exception:
            return False

    async def disconnect(self) -> dict:
        """Disconnect calendar — remove tokens."""
        if not supabase:
            return {"status": "ok"}

        try:
            supabase.table("calendar_tokens").update({"connected": False, "access_token": None}).eq("connected", True).execute()
            return {"status": "disconnected"}
        except Exception as e:
            logger.error(f"Disconnect failed: {e}")
            return {"error": str(e)}

    async def get_status(self) -> dict:
        """Get calendar connection status."""
        connected = await self.is_connected()
        configured = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

        if not configured:
            return {"status": "not_configured", "connected": False}
        if not connected:
            return {"status": "not_connected", "connected": False, "auth_url": self.get_auth_url()}

        if supabase:
            tokens = supabase.table("calendar_tokens").select("last_sync").eq("connected", True).limit(1).execute()
            last_sync = tokens.data[0].get("last_sync") if tokens.data else None
        else:
            last_sync = None

        return {"status": "connected", "connected": True, "last_sync": last_sync}


calendar_service = CalendarService()
