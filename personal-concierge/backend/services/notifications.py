"""Push notification service using Expo Push API.

Sends notifications via: https://exp.host/--/api/v2/push/send

Notification types:
  morning_briefing    — 7:00am daily
  habit_reminder      — configurable time, daily habit nudge
  supplement_reminder — based on supplement timing
  connection_nudge    — when contact is 3+ days overdue
  streak_milestone    — 7/21/30/90 day streak achieved
"""

import logging
from datetime import date, datetime

import httpx

from config import supabase

logger = logging.getLogger("concierge.notifications")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class NotificationService:

    async def register_token(self, token: str, platform: str = "ios") -> dict:
        """Register Expo push token."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("push_tokens")
                .upsert(
                    {"token": token, "device_platform": platform, "active": True},
                    on_conflict="token",
                )
                .execute()
            )
            return {"status": "ok", "data": result.data[0] if result.data else {"token": token}}
        except Exception as e:
            logger.error(f"Failed to register push token: {e}")
            return {"error": str(e)}

    async def _get_active_tokens(self) -> list[str]:
        """Get all active push tokens."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("push_tokens")
                .select("token")
                .eq("active", True)
                .execute()
            )
            return [t["token"] for t in (result.data or [])]
        except Exception as e:
            logger.error(f"Failed to fetch push tokens: {e}")
            return []

    async def send(self, token: str, title: str, body: str, data: dict = None) -> dict:
        """Send single push notification via Expo API."""
        try:
            payload = {
                "to": token,
                "title": title,
                "body": body,
                "sound": "default",
            }
            if data:
                payload["data"] = data

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    EXPO_PUSH_URL,
                    json=payload,
                    headers={"Content-Type": "application/json"},
                    timeout=10.0,
                )
                resp.raise_for_status()
                return resp.json()
        except Exception as e:
            logger.error(f"Push notification failed: {e}")
            return {"error": str(e)}

    async def _send_to_all(self, title: str, body: str, data: dict = None) -> dict:
        """Send notification to all registered devices."""
        tokens = await self._get_active_tokens()
        if not tokens:
            return {"status": "no_tokens", "sent": 0}

        results = []
        for token in tokens:
            result = await self.send(token, title, body, data)
            results.append(result)

        return {"status": "ok", "sent": len(results), "results": results}

    async def send_morning_briefing(self) -> dict:
        """Send personalized morning briefing notification."""
        title = "Good morning"
        body = "Your daily health briefing is ready."

        if supabase:
            try:
                health = (
                    supabase.table("health_data")
                    .select("readiness_score, sleep_score")
                    .order("date", desc=True)
                    .limit(1)
                    .execute()
                )
                if health.data:
                    h = health.data[0]
                    readiness = h.get("readiness_score", "N/A")
                    sleep = h.get("sleep_score", "N/A")
                    body = f"Readiness {readiness} | Sleep {sleep}. Tap for your full plan."
            except Exception:
                pass

        return await self._send_to_all(title, body, {"type": "morning_briefing"})

    async def send_habit_nudges(self) -> dict:
        """Send habit nudge for highest streak-at-risk habit."""
        if not supabase:
            return {"status": "no_database"}

        try:
            today = date.today().isoformat()
            habits = (
                supabase.table("growth_habits")
                .select("id, name, current_streak")
                .eq("active", True)
                .order("current_streak", desc=True)
                .execute()
            )
            if not habits.data:
                return {"status": "no_habits"}

            # Find habits not yet completed today with active streaks
            for habit in habits.data:
                log = (
                    supabase.table("growth_log")
                    .select("completed")
                    .eq("habit_id", habit["id"])
                    .eq("log_date", today)
                    .limit(1)
                    .execute()
                )
                if not log.data or not log.data[0].get("completed"):
                    if (habit.get("current_streak") or 0) > 0:
                        return await self._send_to_all(
                            f"{habit['name']} — {habit['current_streak']} day streak",
                            "Don't break the chain! Tap to log.",
                            {"type": "habit_reminder", "habit_id": habit["id"]},
                        )

            return {"status": "all_done"}
        except Exception as e:
            logger.error(f"Habit nudge failed: {e}")
            return {"error": str(e)}

    async def send_supplement_reminders(self) -> dict:
        """Send supplement reminder based on time of day."""
        if not supabase:
            return {"status": "no_database"}

        hour = datetime.now().hour
        if hour < 12:
            timing = "morning"
        elif hour < 18:
            timing = "afternoon"
        else:
            timing = "evening"

        try:
            supps = (
                supabase.table("supplements")
                .select("name")
                .eq("active", True)
                .eq("timing", timing)
                .execute()
            )
            if not supps.data:
                return {"status": "no_supplements_due"}

            names = [s["name"] for s in supps.data[:3]]
            body = f"Time for: {', '.join(names)}"
            if len(supps.data) > 3:
                body += f" (+{len(supps.data) - 3} more)"

            return await self._send_to_all(
                f"{timing.title()} supplements",
                body,
                {"type": "supplement_reminder"},
            )
        except Exception as e:
            logger.error(f"Supplement reminder failed: {e}")
            return {"error": str(e)}

    async def check_and_send_scheduled(self) -> dict:
        """Main scheduler — checks all notification types and sends appropriate ones."""
        hour = datetime.now().hour
        results = {}

        if hour == 7:
            results["morning_briefing"] = await self.send_morning_briefing()
        if hour == 8 or hour == 21:
            results["supplement_reminder"] = await self.send_supplement_reminders()
        if hour == 18:
            results["habit_nudge"] = await self.send_habit_nudges()

        if not results:
            results["status"] = f"No notifications scheduled for hour {hour}"

        return results


notification_service = NotificationService()
