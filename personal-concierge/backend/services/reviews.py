"""Weekly & Monthly Review Service.

Synthesizes all tracked data into wisdom — turning numbers into narrative,
patterns into insights, and weeks into a story of growth.

Weekly reviews surface wins, patterns, and coaching insights.
Monthly reviews connect the dots to your 10-year vision.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.reviews")

MODEL = "claude-sonnet-4-20250514"


class ReviewService:

    def _get_week_start(self, d: date = None) -> date:
        """Get Monday of the week containing the given date."""
        if d is None:
            d = date.today()
        return d - timedelta(days=d.weekday())

    def _get_month_start(self, d: date = None) -> date:
        """Get 1st of the month containing the given date."""
        if d is None:
            d = date.today()
        return d.replace(day=1)

    async def _gather_week_data(self, week_start: date, week_end: date) -> dict:
        """Gather all data sources for a given week."""
        data = {
            "health": {},
            "workouts": {},
            "social": {},
            "growth": {},
            "learning": {},
            "check_ins": {},
            "skin": {},
        }

        if not supabase:
            return data

        ws = week_start.isoformat()
        we = week_end.isoformat()

        # Health data (Oura-style): avg readiness, sleep_score, hrv
        try:
            result = (
                supabase.table("health_data")
                .select("readiness_score, sleep_score, hrv")
                .gte("date", ws)
                .lte("date", we)
                .execute()
            )
            rows = result.data or []
            if rows:
                readiness_vals = [r["readiness_score"] for r in rows if r.get("readiness_score") is not None]
                sleep_vals = [r["sleep_score"] for r in rows if r.get("sleep_score") is not None]
                hrv_vals = [r["hrv"] for r in rows if r.get("hrv") is not None]
                data["health"] = {
                    "avg_readiness": round(sum(readiness_vals) / len(readiness_vals), 1) if readiness_vals else None,
                    "avg_sleep_score": round(sum(sleep_vals) / len(sleep_vals), 1) if sleep_vals else None,
                    "avg_hrv": round(sum(hrv_vals) / len(hrv_vals), 1) if hrv_vals else None,
                    "days_tracked": len(rows),
                }
        except Exception as e:
            logger.error(f"Failed to fetch health data: {e}")

        # Workouts: completed vs total
        try:
            result = (
                supabase.table("workouts")
                .select("id, completed")
                .gte("scheduled_date", ws)
                .lte("scheduled_date", we)
                .execute()
            )
            rows = result.data or []
            completed = sum(1 for r in rows if r.get("completed"))
            data["workouts"] = {
                "completed": completed,
                "total": len(rows),
                "completion_rate": round(completed / max(len(rows), 1), 2),
            }
        except Exception as e:
            logger.error(f"Failed to fetch workouts: {e}")

        # Social interactions count
        try:
            result = (
                supabase.table("social_log")
                .select("id")
                .gte("date", ws)
                .lte("date", we)
                .execute()
            )
            rows = result.data or []
            data["social"] = {"interactions": len(rows)}
        except Exception as e:
            logger.error(f"Failed to fetch social log: {e}")

        # Growth habit completion rate
        try:
            result = (
                supabase.table("growth_habit_log")
                .select("completed")
                .gte("log_date", ws)
                .lte("log_date", we)
                .execute()
            )
            rows = result.data or []
            completed = sum(1 for r in rows if r.get("completed"))
            data["growth"] = {
                "completed": completed,
                "total": len(rows),
                "completion_rate": round(completed / max(len(rows), 1), 2),
            }
        except Exception as e:
            logger.error(f"Failed to fetch growth habit log: {e}")

        # Learning sessions: total minutes
        try:
            result = (
                supabase.table("learning_sessions")
                .select("duration_minutes")
                .gte("date", ws)
                .lte("date", we)
                .execute()
            )
            rows = result.data or []
            total_mins = sum(r.get("duration_minutes", 0) for r in rows)
            data["learning"] = {
                "sessions": len(rows),
                "total_minutes": total_mins,
            }
        except Exception as e:
            logger.error(f"Failed to fetch learning sessions: {e}")

        # Check-ins: avg mood, energy, stress
        try:
            result = (
                supabase.table("check_ins")
                .select("mood, energy, stress")
                .gte("date", ws)
                .lte("date", we)
                .execute()
            )
            rows = result.data or []
            if rows:
                mood_vals = [r["mood"] for r in rows if r.get("mood") is not None]
                energy_vals = [r["energy"] for r in rows if r.get("energy") is not None]
                stress_vals = [r["stress"] for r in rows if r.get("stress") is not None]
                data["check_ins"] = {
                    "avg_mood": round(sum(mood_vals) / len(mood_vals), 1) if mood_vals else None,
                    "avg_energy": round(sum(energy_vals) / len(energy_vals), 1) if energy_vals else None,
                    "avg_stress": round(sum(stress_vals) / len(stress_vals), 1) if stress_vals else None,
                    "entries": len(rows),
                }
        except Exception as e:
            logger.error(f"Failed to fetch check-ins: {e}")

        # Skin log: avg condition (optional table)
        try:
            result = (
                supabase.table("skin_log")
                .select("condition_score")
                .gte("date", ws)
                .lte("date", we)
                .execute()
            )
            rows = result.data or []
            if rows:
                scores = [r["condition_score"] for r in rows if r.get("condition_score") is not None]
                data["skin"] = {
                    "avg_condition": round(sum(scores) / len(scores), 1) if scores else None,
                    "entries": len(rows),
                }
        except Exception:
            # skin_log table may not exist — that's fine
            pass

        return data

    async def generate_weekly_review(self, week_start: date) -> dict:
        """Generate a weekly review synthesizing all data into narrative wisdom."""
        week_start = self._get_week_start(week_start)
        week_end = week_start + timedelta(days=6)

        week_data = await self._gather_week_data(week_start, week_end)

        metrics = {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "health": week_data["health"],
            "workouts": week_data["workouts"],
            "social": week_data["social"],
            "growth": week_data["growth"],
            "learning": week_data["learning"],
            "check_ins": week_data["check_ins"],
            "skin": week_data["skin"],
        }

        if not ANTHROPIC_API_KEY:
            review = {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "week_summary": "Another week in the books. Review your metrics below to see how you did.",
                "wins": [
                    "You showed up and tracked your data",
                    "You made it through the week",
                    "You're reflecting on your progress right now",
                ],
                "patterns": ["Review your metrics for patterns"],
                "attention_items": ["Consider setting specific goals for next week"],
                "coach_insight": "Consistent tracking is itself a win. Keep building the habit of reflection.",
                "next_week_intention": "Stay consistent with tracking and reflection",
                "metrics": metrics,
            }
            self._save_weekly_review(week_start, review)
            return review

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=1000,
                system=(
                    "You are a personal life coach reviewing someone's weekly data. "
                    "Be warm, specific, and encouraging. Always find 3 wins even in tough weeks. "
                    "Return ONLY valid JSON with these exact keys: "
                    "week_summary (1 paragraph narrative), "
                    "wins (array of 3 specific wins — always find them even in bad weeks), "
                    "patterns (array of 2-3 notable patterns), "
                    "attention_items (array of 1-2 things needing attention), "
                    "coach_insight (personalized coaching paragraph), "
                    "next_week_intention (single focus for next week)"
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Here is my data for the week of {week_start.isoformat()} to {week_end.isoformat()}:\n\n"
                        f"{json.dumps(week_data, indent=2)}\n\n"
                        "Please synthesize this into my weekly review."
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            synthesis = json.loads(raw)

            review = {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "week_summary": synthesis.get("week_summary", ""),
                "wins": synthesis.get("wins", []),
                "patterns": synthesis.get("patterns", []),
                "attention_items": synthesis.get("attention_items", []),
                "coach_insight": synthesis.get("coach_insight", ""),
                "next_week_intention": synthesis.get("next_week_intention", ""),
                "metrics": metrics,
            }
        except Exception as e:
            logger.error(f"Failed to generate weekly review with Claude: {e}")
            review = {
                "week_start": week_start.isoformat(),
                "week_end": week_end.isoformat(),
                "week_summary": "Review generation encountered an issue. Here are your raw metrics.",
                "wins": [
                    "You tracked your data consistently",
                    "You completed another week",
                    "You're taking time to reflect",
                ],
                "patterns": ["Check metrics below for trends"],
                "attention_items": ["Review could not be fully generated"],
                "coach_insight": "Even when things don't go as planned, showing up matters.",
                "next_week_intention": "Keep showing up",
                "metrics": metrics,
            }

        self._save_weekly_review(week_start, review)
        return review

    def _save_weekly_review(self, week_start: date, review: dict) -> None:
        """Save weekly review to database."""
        if not supabase:
            return
        try:
            row = {
                "week_start": week_start.isoformat(),
                "review_data": json.dumps(review),
                "generated_at": date.today().isoformat(),
            }
            supabase.table("weekly_reviews").upsert(
                row, on_conflict="week_start"
            ).execute()
        except Exception as e:
            logger.error(f"Failed to save weekly review: {e}")

    async def generate_monthly_review(self, month_start: date) -> dict:
        """Generate a monthly review aggregating weekly reviews and monthly data."""
        month_start = self._get_month_start(month_start)

        # Determine month end
        if month_start.month == 12:
            month_end = date(month_start.year + 1, 1, 1) - timedelta(days=1)
        else:
            month_end = date(month_start.year, month_start.month + 1, 1) - timedelta(days=1)

        # Gather weekly reviews for this month
        weekly_reviews = []
        if supabase:
            try:
                result = (
                    supabase.table("weekly_reviews")
                    .select("*")
                    .gte("week_start", month_start.isoformat())
                    .lte("week_start", month_end.isoformat())
                    .order("week_start")
                    .execute()
                )
                for row in (result.data or []):
                    try:
                        weekly_reviews.append(json.loads(row["review_data"]))
                    except (json.JSONDecodeError, KeyError):
                        weekly_reviews.append(row)
            except Exception as e:
                logger.error(f"Failed to fetch weekly reviews for month: {e}")

        # Aggregate monthly metrics from the weekly reviews
        monthly_metrics = {
            "month_start": month_start.isoformat(),
            "month_end": month_end.isoformat(),
            "weeks_reviewed": len(weekly_reviews),
            "weekly_summaries": [w.get("week_summary", "") for w in weekly_reviews],
            "all_wins": [win for w in weekly_reviews for win in w.get("wins", [])],
            "all_patterns": [p for w in weekly_reviews for p in w.get("patterns", [])],
        }

        # Aggregate numeric metrics across weeks
        health_readiness = []
        health_sleep = []
        health_hrv = []
        workout_completed = 0
        workout_total = 0
        social_interactions = 0
        growth_rate = []
        learning_minutes = 0
        mood_vals = []
        energy_vals = []
        stress_vals = []

        for w in weekly_reviews:
            m = w.get("metrics", {})
            h = m.get("health", {})
            if h.get("avg_readiness") is not None:
                health_readiness.append(h["avg_readiness"])
            if h.get("avg_sleep_score") is not None:
                health_sleep.append(h["avg_sleep_score"])
            if h.get("avg_hrv") is not None:
                health_hrv.append(h["avg_hrv"])

            wo = m.get("workouts", {})
            workout_completed += wo.get("completed", 0)
            workout_total += wo.get("total", 0)

            social_interactions += m.get("social", {}).get("interactions", 0)

            gr = m.get("growth", {})
            if gr.get("completion_rate") is not None:
                growth_rate.append(gr["completion_rate"])

            learning_minutes += m.get("learning", {}).get("total_minutes", 0)

            ci = m.get("check_ins", {})
            if ci.get("avg_mood") is not None:
                mood_vals.append(ci["avg_mood"])
            if ci.get("avg_energy") is not None:
                energy_vals.append(ci["avg_energy"])
            if ci.get("avg_stress") is not None:
                stress_vals.append(ci["avg_stress"])

        monthly_metrics["aggregated"] = {
            "avg_readiness": round(sum(health_readiness) / len(health_readiness), 1) if health_readiness else None,
            "avg_sleep_score": round(sum(health_sleep) / len(health_sleep), 1) if health_sleep else None,
            "avg_hrv": round(sum(health_hrv) / len(health_hrv), 1) if health_hrv else None,
            "workouts_completed": workout_completed,
            "workouts_total": workout_total,
            "social_interactions": social_interactions,
            "avg_growth_rate": round(sum(growth_rate) / len(growth_rate), 2) if growth_rate else None,
            "learning_minutes": learning_minutes,
            "avg_mood": round(sum(mood_vals) / len(mood_vals), 1) if mood_vals else None,
            "avg_energy": round(sum(energy_vals) / len(energy_vals), 1) if energy_vals else None,
            "avg_stress": round(sum(stress_vals) / len(stress_vals), 1) if stress_vals else None,
        }

        if not ANTHROPIC_API_KEY:
            review = {
                "month_start": month_start.isoformat(),
                "month_end": month_end.isoformat(),
                "month_narrative": "Another month complete. Review your aggregated metrics below.",
                "progress_summary": "See weekly reviews for detailed progress.",
                "biggest_win": "Staying consistent with tracking throughout the month",
                "biggest_challenge": "Review your patterns to identify challenges",
                "health_trajectory": "stable — review metrics for details",
                "legacy_connection": "Each month of tracking brings you closer to your long-term vision.",
                "next_month_intention": "Continue building on this month's momentum",
                "metrics": monthly_metrics,
            }
            self._save_monthly_review(month_start, review)
            return review

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=1200,
                system=(
                    "You are a personal life coach reviewing someone's monthly data. "
                    "Provide a high-level narrative arc of the month. Be thoughtful and specific. "
                    "Return ONLY valid JSON with these exact keys: "
                    "month_narrative (arc of the month in 2-3 paragraphs), "
                    "progress_summary (concise progress overview), "
                    "biggest_win (single most impactful win), "
                    "biggest_challenge (single biggest challenge), "
                    "health_trajectory (improving/stable/declining + brief why), "
                    "legacy_connection (how this month connected to their 10-year vision), "
                    "next_month_intention (single focus for next month)"
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Here is my monthly data for {month_start.strftime('%B %Y')}:\n\n"
                        f"Weekly summaries:\n{json.dumps(monthly_metrics['weekly_summaries'], indent=2)}\n\n"
                        f"All wins this month:\n{json.dumps(monthly_metrics['all_wins'], indent=2)}\n\n"
                        f"All patterns observed:\n{json.dumps(monthly_metrics['all_patterns'], indent=2)}\n\n"
                        f"Aggregated metrics:\n{json.dumps(monthly_metrics['aggregated'], indent=2)}\n\n"
                        "Please synthesize this into my monthly review."
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            synthesis = json.loads(raw)

            review = {
                "month_start": month_start.isoformat(),
                "month_end": month_end.isoformat(),
                "month_narrative": synthesis.get("month_narrative", ""),
                "progress_summary": synthesis.get("progress_summary", ""),
                "biggest_win": synthesis.get("biggest_win", ""),
                "biggest_challenge": synthesis.get("biggest_challenge", ""),
                "health_trajectory": synthesis.get("health_trajectory", ""),
                "legacy_connection": synthesis.get("legacy_connection", ""),
                "next_month_intention": synthesis.get("next_month_intention", ""),
                "metrics": monthly_metrics,
            }
        except Exception as e:
            logger.error(f"Failed to generate monthly review with Claude: {e}")
            review = {
                "month_start": month_start.isoformat(),
                "month_end": month_end.isoformat(),
                "month_narrative": "Monthly review generation encountered an issue. Here are your aggregated metrics.",
                "progress_summary": "See individual weekly reviews for details.",
                "biggest_win": "Completing another month of tracking",
                "biggest_challenge": "Review could not be fully generated",
                "health_trajectory": "stable — review metrics manually",
                "legacy_connection": "Every month of awareness brings clarity to your long-term path.",
                "next_month_intention": "Keep building momentum",
                "metrics": monthly_metrics,
            }

        self._save_monthly_review(month_start, review)
        return review

    def _save_monthly_review(self, month_start: date, review: dict) -> None:
        """Save monthly review to database."""
        if not supabase:
            return
        try:
            row = {
                "month_start": month_start.isoformat(),
                "review_data": json.dumps(review),
                "generated_at": date.today().isoformat(),
            }
            supabase.table("monthly_reviews").upsert(
                row, on_conflict="month_start"
            ).execute()
        except Exception as e:
            logger.error(f"Failed to save monthly review: {e}")

    async def get_weekly_review(self, week_start: date) -> dict:
        """Get stored weekly review, or generate if not exists. week_start should be a Monday."""
        week_start = self._get_week_start(week_start)

        if supabase:
            try:
                result = (
                    supabase.table("weekly_reviews")
                    .select("*")
                    .eq("week_start", week_start.isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    try:
                        return json.loads(result.data[0]["review_data"])
                    except (json.JSONDecodeError, KeyError):
                        return result.data[0]
            except Exception as e:
                logger.error(f"Failed to fetch weekly review: {e}")

        return await self.generate_weekly_review(week_start)

    async def get_monthly_review(self, month_start: date) -> dict:
        """Get stored monthly review, or generate if not exists. month_start should be 1st of month."""
        month_start = self._get_month_start(month_start)

        if supabase:
            try:
                result = (
                    supabase.table("monthly_reviews")
                    .select("*")
                    .eq("month_start", month_start.isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    try:
                        return json.loads(result.data[0]["review_data"])
                    except (json.JSONDecodeError, KeyError):
                        return result.data[0]
            except Exception as e:
                logger.error(f"Failed to fetch monthly review: {e}")

        return await self.generate_monthly_review(month_start)

    async def get_review_history(self, review_type: str, limit: int = 12) -> list[dict]:
        """Get past weekly or monthly reviews, ordered by date desc."""
        if not supabase:
            return []

        table = "weekly_reviews" if review_type == "weekly" else "monthly_reviews"
        date_col = "week_start" if review_type == "weekly" else "month_start"

        try:
            result = (
                supabase.table(table)
                .select("*")
                .order(date_col, desc=True)
                .limit(limit)
                .execute()
            )
            reviews = []
            for row in (result.data or []):
                try:
                    reviews.append(json.loads(row["review_data"]))
                except (json.JSONDecodeError, KeyError):
                    reviews.append(row)
            return reviews
        except Exception as e:
            logger.error(f"Failed to fetch {review_type} review history: {e}")
            return []


review_service = ReviewService()
