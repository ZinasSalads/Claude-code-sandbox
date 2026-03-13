"""Legacy & Long-Term Vision service.

Holds the 10-year horizon — what the user wants to build, experience,
become, and leave behind.

Values drift detection compares actual behavior to stated priorities.
Daily bridge moments connect short-term actions to long-term vision.
"""

import json
import logging
from datetime import date, timedelta

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.legacy")

MODEL = "claude-sonnet-4-20250514"


class LegacyService:

    async def get_profile(self) -> dict:
        """Get legacy profile."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("legacy_profile")
                .select("*")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to get legacy profile: {e}")
            return {}

    async def save_profile(self, data: dict) -> dict:
        """Save/update legacy vision."""
        if not supabase:
            return data
        try:
            existing = await self.get_profile()
            if existing.get("id"):
                data["last_reviewed"] = date.today().isoformat()
                result = (
                    supabase.table("legacy_profile")
                    .update(data)
                    .eq("id", existing["id"])
                    .execute()
                )
                return result.data[0] if result.data else data
            else:
                data["last_reviewed"] = date.today().isoformat()
                result = supabase.table("legacy_profile").insert(data).execute()
                return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to save legacy profile: {e}")
            return {"error": str(e)}

    async def get_milestones(self, limit: int = 20) -> list[dict]:
        """Get life milestones, most recent first."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("life_milestones")
                .select("*")
                .order("milestone_date", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get milestones: {e}")
            return []

    async def log_milestone(self, data: dict) -> dict:
        """Log a life milestone."""
        if not supabase:
            return data
        try:
            # Generate significance note if not provided
            if not data.get("description") and ANTHROPIC_API_KEY:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    resp = client.messages.create(
                        model=MODEL,
                        max_tokens=100,
                        system="Write a 1-sentence significance note for this life milestone. Warm and celebratory.",
                        messages=[{"role": "user", "content": f"Milestone: {data.get('title', '')} (category: {data.get('category', '')})"}],
                    )
                    data["description"] = resp.content[0].text.strip()
                except Exception:
                    pass

            result = supabase.table("life_milestones").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to log milestone: {e}")
            return {"error": str(e)}

    async def check_values_drift(self) -> dict | None:
        """Weekly values drift check."""
        if not supabase:
            return None

        try:
            profile = await self.get_profile()
            if not profile or not profile.get("ten_year_vision"):
                return None

            # Check if we already surfaced drift this week
            week_start = date.today() - timedelta(days=date.today().weekday())
            existing = (
                supabase.table("values_drift_log")
                .select("*")
                .eq("week_start", week_start.isoformat())
                .limit(1)
                .execute()
            )
            if existing.data:
                row = existing.data[0]
                if row.get("drift_detected"):
                    return {
                        "detected": True,
                        "stated_priority": row.get("stated_priority_1", ""),
                        "actual_behavior": json.dumps(row.get("actual_time_split", {})),
                        "gentle_observation": row.get("drift_description", ""),
                    }
                return None

            # Estimate actual time split from recent data
            time_split = await self._estimate_time_split()

            # Compare to stated priorities
            vision = profile.get("ten_year_vision", "")
            career_legacy = profile.get("career_legacy", "")
            health_legacy = profile.get("health_legacy", "")

            drift_detected = False
            drift_description = ""

            if ANTHROPIC_API_KEY:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    resp = client.messages.create(
                        model=MODEL,
                        max_tokens=200,
                        system=(
                            "You are analyzing whether someone's recent behavior aligns with their "
                            "stated life vision. If there's a significant mismatch, write a warm, "
                            "non-judgmental 2-sentence observation. If things are aligned, return "
                            "exactly: ALIGNED"
                        ),
                        messages=[{
                            "role": "user",
                            "content": (
                                f"10-year vision: {vision}\n"
                                f"Career legacy: {career_legacy}\n"
                                f"Health legacy: {health_legacy}\n"
                                f"Recent time allocation: {json.dumps(time_split)}"
                            ),
                        }],
                    )
                    result_text = resp.content[0].text.strip()
                    if result_text != "ALIGNED":
                        drift_detected = True
                        drift_description = result_text
                except Exception as e:
                    logger.error(f"Drift analysis failed: {e}")

            # Log the drift check
            drift_row = {
                "week_start": week_start.isoformat(),
                "stated_priority_1": vision[:100] if vision else None,
                "actual_time_split": time_split,
                "drift_detected": drift_detected,
                "drift_description": drift_description if drift_detected else None,
                "surfaced_to_user": drift_detected,
            }
            supabase.table("values_drift_log").upsert(drift_row, on_conflict="week_start").execute()

            if drift_detected:
                return {
                    "detected": True,
                    "stated_priority": vision[:100],
                    "actual_behavior": json.dumps(time_split),
                    "gentle_observation": drift_description,
                }
            return None

        except Exception as e:
            logger.error(f"Values drift check failed: {e}")
            return None

    async def _estimate_time_split(self) -> dict:
        """Estimate time allocation from recent data."""
        time_split = {"work": 0.4, "health": 0.15, "social": 0.1, "learning": 0.05, "rest": 0.3}

        if not supabase:
            return time_split

        try:
            week_ago = (date.today() - timedelta(days=7)).isoformat()

            # Check-in stress levels (proxy for work load)
            checkins = (
                supabase.table("checkins")
                .select("stress,energy")
                .gte("date", week_ago)
                .execute()
            )
            if checkins.data:
                avg_stress = sum(c.get("stress", 5) for c in checkins.data) / len(checkins.data)
                time_split["work"] = min(0.6, avg_stress / 10)

            # Social interactions
            social = (
                supabase.table("social_log")
                .select("id", count="exact")
                .gte("interaction_date", week_ago)
                .execute()
            )
            social_count = social.count or 0
            time_split["social"] = min(0.25, social_count * 0.04)

            # Growth habits completion
            habits = (
                supabase.table("growth_log")
                .select("completed")
                .gte("log_date", week_ago)
                .eq("completed", True)
                .execute()
            )
            habit_count = len(habits.data or [])
            time_split["learning"] = min(0.15, habit_count * 0.02)

            # Normalize
            total = sum(time_split.values())
            if total > 0:
                time_split = {k: round(v / total, 2) for k, v in time_split.items()}

        except Exception:
            pass

        return time_split

    async def generate_daily_bridge(self) -> str | None:
        """Generate a connection between recent behavior and 10-year vision."""
        if not supabase or not ANTHROPIC_API_KEY:
            return None

        try:
            profile = await self.get_profile()
            if not profile or not profile.get("ten_year_vision"):
                return None

            # Only generate once per week
            week_ago = (date.today() - timedelta(days=7)).isoformat()
            # Check if bridge was generated recently (use milestones as proxy)

            # Gather recent data points
            context_parts = []

            # Recent habits
            habits = (
                supabase.table("growth_habits")
                .select("name,current_streak,total_completions")
                .eq("active", True)
                .execute()
            )
            if habits.data:
                for h in habits.data[:3]:
                    if h.get("current_streak", 0) > 3:
                        context_parts.append(
                            f"Habit '{h['name']}': {h['current_streak']}-day streak, "
                            f"{h.get('total_completions', 0)} total completions"
                        )

            # Recent health trends
            health = (
                supabase.table("health_data")
                .select("hrv,sleep_score,readiness_score")
                .order("date", desc=True)
                .limit(7)
                .execute()
            )
            if health.data:
                avg_hrv = sum(h.get("hrv", 0) or 0 for h in health.data) / max(len(health.data), 1)
                if avg_hrv > 0:
                    context_parts.append(f"Average HRV this week: {avg_hrv:.0f}ms")

            if not context_parts:
                return None

            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            resp = client.messages.create(
                model=MODEL,
                max_tokens=150,
                system=(
                    "You generate 'daily bridge' moments — one warm, specific sentence "
                    "connecting a recent behavior to the user's 10-year vision. "
                    "Make it feel meaningful but not preachy. Include a concrete projection "
                    "if possible (e.g., 'at this pace, that's X in a year')."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"10-year vision: {profile['ten_year_vision']}\n"
                        f"Recent data: {'; '.join(context_parts)}"
                    ),
                }],
            )
            return resp.content[0].text.strip()

        except Exception as e:
            logger.error(f"Bridge generation failed: {e}")
            return None

    async def get_annual_review_prompt(self) -> dict:
        """Generate annual review questions with data context."""
        profile = await self.get_profile()
        milestones = await self.get_milestones(limit=50)

        return {
            "vision": profile.get("ten_year_vision", ""),
            "milestones_this_year": [
                m for m in milestones
                if m.get("milestone_date", "").startswith(str(date.today().year))
            ],
            "prompts": [
                "What was your biggest achievement this year?",
                "What surprised you about your progress?",
                "What would you do differently?",
                "How has your 10-year vision evolved?",
                "What's one area you want to invest more in next year?",
            ],
        }


legacy_service = LegacyService()
