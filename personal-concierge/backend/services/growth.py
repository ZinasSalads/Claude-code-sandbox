"""1% Growth Engine.

Small, consistent improvements compound into massive results.
1% better every day = 37x better in a year.

Manages the habit stack, tracks streaks, calculates compound progress,
and uses Claude to personalize which habits to add next.

Categories: health / skill / relationship / mindset / financial / creative
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.growth")

MODEL = "claude-sonnet-4-20250514"


class GrowthService:

    async def get_habits(self, active_only: bool = True) -> list[dict]:
        """Get habits with streak data and today's completion status."""
        if not supabase:
            return []
        try:
            query = supabase.table("growth_habits").select("*")
            if active_only:
                query = query.eq("active", True)
            result = query.order("category").execute()
            habits = result.data or []

            # Check today's completion
            today = date.today().isoformat()
            for h in habits:
                try:
                    log = (
                        supabase.table("growth_log")
                        .select("completed, quality_rating")
                        .eq("habit_id", h["id"])
                        .eq("log_date", today)
                        .limit(1)
                        .execute()
                    )
                    if log.data:
                        h["completed_today"] = log.data[0].get("completed", False)
                        h["today_quality"] = log.data[0].get("quality_rating")
                    else:
                        h["completed_today"] = False
                        h["today_quality"] = None
                except Exception:
                    h["completed_today"] = False
                    h["today_quality"] = None

            return habits
        except Exception as e:
            logger.error(f"Failed to fetch habits: {e}")
            return []

    async def add_habit(self, data: dict) -> dict:
        """Add a new habit."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = supabase.table("growth_habits").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add habit: {e}")
            return {"error": str(e)}

    async def update_habit(self, habit_id: str, data: dict) -> dict:
        """Update a habit."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("growth_habits")
                .update(data)
                .eq("id", habit_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update habit: {e}")
            return {"error": str(e)}

    async def deactivate_habit(self, habit_id: str) -> dict:
        """Deactivate a habit."""
        return await self.update_habit(habit_id, {"active": False})

    async def log_habit(self, habit_id: str, completed: bool, quality: int = None, notes: str = None) -> dict:
        """Log habit completion. Updates streak."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            today = date.today().isoformat()
            row = {
                "habit_id": habit_id,
                "log_date": today,
                "completed": completed,
                "quality_rating": quality,
                "notes": notes,
            }
            supabase.table("growth_log").upsert(row, on_conflict="habit_id,log_date").execute()

            # Update streak
            habit = (
                supabase.table("growth_habits")
                .select("current_streak, longest_streak, total_completions, micro_win_message")
                .eq("id", habit_id)
                .limit(1)
                .execute()
            )
            if habit.data:
                h = habit.data[0]
                if completed:
                    new_streak = (h.get("current_streak") or 0) + 1
                    new_total = (h.get("total_completions") or 0) + 1
                    longest = max(new_streak, h.get("longest_streak") or 0)
                    supabase.table("growth_habits").update({
                        "current_streak": new_streak,
                        "longest_streak": longest,
                        "total_completions": new_total,
                    }).eq("id", habit_id).execute()

                    message = h.get("micro_win_message", "Great job!")
                    if new_streak in (7, 14, 21, 30, 60, 90, 365):
                        message = f"Milestone! {new_streak}-day streak!"

                    return {"status": "ok", "streak": new_streak, "message": message}
                else:
                    supabase.table("growth_habits").update({
                        "current_streak": 0,
                    }).eq("id", habit_id).execute()
                    return {"status": "ok", "streak": 0, "message": "No worries. Tomorrow is a new day."}

            return {"status": "ok"}
        except Exception as e:
            logger.error(f"Failed to log habit: {e}")
            return {"error": str(e)}

    async def get_today_habits(self) -> dict:
        """Returns habits to surface today with completion stats."""
        habits = await self.get_habits(active_only=True)
        # Max 5 active habits
        habits = habits[:5]

        completed = sum(1 for h in habits if h.get("completed_today"))
        total = len(habits)
        streak_at_risk = [
            h for h in habits
            if not h.get("completed_today") and (h.get("current_streak") or 0) > 0
        ]

        # Compound progress: total completions this year
        total_completions = sum(h.get("total_completions", 0) for h in habits)

        return {
            "habits": habits,
            "completion_rate": completed / max(total, 1),
            "completed": completed,
            "total": total,
            "streak_at_risk": streak_at_risk[:3],
            "compound_progress": {
                "total_completions_all_time": total_completions,
                "active_habits": total,
            },
        }

    async def suggest_next_habit(self) -> dict:
        """Claude suggests the next habit to add."""
        if not ANTHROPIC_API_KEY:
            return {
                "name": "Morning Meditation",
                "category": "mindset",
                "description": "5 minutes of guided meditation",
                "why_now": "Foundation habit for mental clarity",
                "micro_win_message": "Mind clear, day ready.",
            }

        current_habits = await self.get_habits()
        habits_summary = ", ".join(h["name"] for h in current_habits) if current_habits else "None yet"

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=300,
                system=(
                    "You are a habit coach using the 1% improvement philosophy. "
                    "Suggest ONE specific micro-habit to add. Must be small enough to do in under 5 minutes. "
                    "Return ONLY valid JSON: {name, category, description, why_now, micro_win_message}"
                ),
                messages=[{
                    "role": "user",
                    "content": f"Current habits: {habits_summary}\nSuggest the next habit to add.",
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Habit suggestion failed: {e}")
            return {"name": "Daily Walk", "category": "health", "description": "10-minute walk", "why_now": "Simple start", "micro_win_message": "Steps in!"}

    async def get_weekly_report(self, week_start: date = None) -> dict:
        """Weekly compound growth report."""
        if not week_start:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        habits = await self.get_habits()

        if not supabase:
            return {"completion_rate": 0, "habits": habits}

        try:
            logs = (
                supabase.table("growth_log")
                .select("*")
                .gte("log_date", week_start.isoformat())
                .lte("log_date", week_end.isoformat())
                .execute()
            )
            week_logs = logs.data or []

            completed_count = sum(1 for l in week_logs if l.get("completed"))
            total_possible = len(habits) * 7
            completion_rate = completed_count / max(total_possible, 1)

            # Find milestones
            milestones = [
                h for h in habits
                if (h.get("current_streak") or 0) in (7, 14, 21, 30, 60, 90, 365)
            ]

            best_streak = max(habits, key=lambda h: h.get("current_streak", 0)) if habits else None

            return {
                "completion_rate": completion_rate,
                "completed_count": completed_count,
                "total_possible": total_possible,
                "best_streak": best_streak,
                "habits_at_milestone": milestones,
                "week_start": week_start.isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to generate weekly report: {e}")
            return {"completion_rate": 0, "error": str(e)}

    async def calculate_compound_score(self) -> dict:
        """Growth score (0-100) across all life domains."""
        habits = await self.get_habits()
        if not habits:
            return {"score": 0, "domains": {}}

        domains = {}
        for h in habits:
            cat = h.get("category", "general")
            if cat not in domains:
                domains[cat] = {"completions": 0, "total": 0, "streaks": []}
            domains[cat]["total"] += 1
            domains[cat]["completions"] += h.get("total_completions", 0)
            domains[cat]["streaks"].append(h.get("current_streak", 0))

        domain_scores = {}
        for cat, data in domains.items():
            avg_streak = sum(data["streaks"]) / max(len(data["streaks"]), 1)
            domain_scores[cat] = min(100, int(avg_streak * 5 + data["completions"] * 0.5))

        overall = int(sum(domain_scores.values()) / max(len(domain_scores), 1))
        return {"score": overall, "domains": domain_scores}


growth_service = GrowthService()
