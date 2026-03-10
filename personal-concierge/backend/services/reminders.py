"""Notifications & Reminders — backend reminder engine.

Generates time-appropriate reminders based on user schedule,
supplement timing, and coaching settings. Designed to be polled
by the mobile app.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from config import supabase

logger = logging.getLogger("concierge.reminders")


class ReminderService:
    """Generates contextual reminders based on time and user state."""

    async def get_pending_reminders(self) -> list[dict]:
        """Get all pending reminders for right now."""
        reminders = []
        now = datetime.now(timezone.utc)
        hour = now.hour

        # Morning reminders (6-10)
        if 6 <= hour < 10:
            reminders.extend(await self._morning_reminders())

        # Midday (11-14)
        if 11 <= hour < 14:
            reminders.extend(await self._midday_reminders())

        # Evening (17-21)
        if 17 <= hour < 21:
            reminders.extend(await self._evening_reminders())

        # Bedtime (21-23)
        if 21 <= hour < 23:
            reminders.extend(await self._bedtime_reminders())

        # All-day supplement reminders
        reminders.extend(await self._supplement_reminders())

        # Profile question
        question = await self._profile_question_reminder()
        if question:
            reminders.append(question)

        return reminders

    async def _morning_reminders(self) -> list[dict]:
        """Morning-specific reminders."""
        reminders = []

        # Check if check-in is done
        if supabase:
            try:
                result = (
                    supabase.table("check_ins")
                    .select("id")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if not result.data:
                    reminders.append({
                        "type": "checkin",
                        "priority": "high",
                        "title": "Morning Check-In",
                        "message": "Rate your energy, mood, stress, and soreness. Takes 30 seconds.",
                        "action": "checkin",
                    })
            except Exception as e:
                logger.error(f"Check-in reminder error: {e}")

        # Check if Oura data is synced
        if supabase:
            try:
                result = (
                    supabase.table("health_data")
                    .select("id")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if not result.data:
                    reminders.append({
                        "type": "sync",
                        "priority": "medium",
                        "title": "Sync Wearable",
                        "message": "Sync your Oura ring to get today's readiness score.",
                        "action": "sync_oura",
                    })
            except Exception as e:
                logger.error(f"Sync reminder error: {e}")

        return reminders

    async def _midday_reminders(self) -> list[dict]:
        """Midday reminders."""
        reminders = []

        # Check if workout is done
        if supabase:
            try:
                result = (
                    supabase.table("workouts")
                    .select("id, completed")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data and not result.data[0].get("completed"):
                    reminders.append({
                        "type": "workout",
                        "priority": "medium",
                        "title": "Workout Pending",
                        "message": "You have a workout planned for today. Time to move!",
                        "action": "workout",
                    })
            except Exception as e:
                logger.error(f"Workout reminder error: {e}")

        return reminders

    async def _evening_reminders(self) -> list[dict]:
        """Evening reminders."""
        reminders = []

        # Check meals logged
        if supabase:
            try:
                result = (
                    supabase.table("meals")
                    .select("id, logged")
                    .eq("date", date.today().isoformat())
                    .execute()
                )
                meals = result.data or []
                unlogged = [m for m in meals if not m.get("logged")]
                if unlogged:
                    reminders.append({
                        "type": "nutrition",
                        "priority": "low",
                        "title": "Log Your Meals",
                        "message": f"You have {len(unlogged)} unlogged meal(s) today.",
                        "action": "meals",
                    })
            except Exception as e:
                logger.error(f"Meal reminder error: {e}")

        return reminders

    async def _bedtime_reminders(self) -> list[dict]:
        """Bedtime reminders."""
        return [
            {
                "type": "sleep",
                "priority": "low",
                "title": "Wind Down",
                "message": "Consider starting your bedtime routine. Good sleep drives recovery.",
                "action": None,
            }
        ]

    async def _supplement_reminders(self) -> list[dict]:
        """Check supplement adherence for today."""
        if not supabase:
            return []

        reminders = []
        now = datetime.now(timezone.utc)
        hour = now.hour

        # Map timing to hours
        timing_windows = {
            "morning": (6, 10),
            "afternoon": (12, 15),
            "evening": (17, 20),
            "with_meals": (7, 20),
            "bedtime": (21, 23),
        }

        try:
            # Get active supplements
            stack = (
                supabase.table("supplements")
                .select("id, name, timing, dose_amount, dose_unit")
                .eq("active", True)
                .execute()
            )
            supplements = stack.data or []
            if not supplements:
                return []

            # Get today's log
            log = (
                supabase.table("supplement_log")
                .select("supplement_id, taken")
                .eq("date", date.today().isoformat())
                .execute()
            )
            taken_ids = {l["supplement_id"] for l in (log.data or []) if l.get("taken")}

            for s in supplements:
                if s["id"] in taken_ids:
                    continue

                timing = s.get("timing", "morning")
                window = timing_windows.get(timing, (6, 23))

                if window[0] <= hour <= window[1]:
                    reminders.append({
                        "type": "supplement",
                        "priority": "medium",
                        "title": f"Take {s['name']}",
                        "message": f"{s.get('dose_amount', '')} {s.get('dose_unit', '')} — scheduled for {timing}",
                        "action": "supplements",
                        "supplement_id": s["id"],
                    })
        except Exception as e:
            logger.error(f"Supplement reminder error: {e}")

        return reminders

    async def _profile_question_reminder(self) -> Optional[dict]:
        """Check if there's an unanswered profile question."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("profile_questions")
                .select("id, question, category")
                .eq("answered", False)
                .eq("skipped", False)
                .is_("asked_date", "null")
                .limit(1)
                .execute()
            )
            if result.data:
                q = result.data[0]
                return {
                    "type": "profile",
                    "priority": "low",
                    "title": "Quick Question",
                    "message": q["question"],
                    "action": "profile_question",
                    "question_id": q["id"],
                }
        except Exception as e:
            logger.error(f"Profile question reminder error: {e}")
        return None


reminder_service = ReminderService()
