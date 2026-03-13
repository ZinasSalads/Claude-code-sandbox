"""Home Environment Optimization service.

Profiles the home as a health variable — light, air, temp, noise, ergonomics.
Generates recommendations ranked by priority, effort, and budget tier.
"""

import json
import logging
from datetime import date, timedelta

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.home")

MODEL = "claude-sonnet-4-20250514"


class HomeEnvironmentService:

    async def get_profile(self) -> dict:
        """Get home environment profile."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("home_environment")
                .select("*")
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to get home profile: {e}")
            return {}

    async def save_profile(self, data: dict) -> dict:
        """Save profile and trigger recommendation regeneration."""
        if not supabase:
            return data
        try:
            existing = await self.get_profile()
            if existing.get("id"):
                result = (
                    supabase.table("home_environment")
                    .update(data)
                    .eq("id", existing["id"])
                    .execute()
                )
                saved = result.data[0] if result.data else data
            else:
                result = supabase.table("home_environment").insert(data).execute()
                saved = result.data[0] if result.data else data

            # Regenerate recommendations
            await self.generate_recommendations()
            return saved
        except Exception as e:
            logger.error(f"Failed to save home profile: {e}")
            return {"error": str(e)}

    async def generate_recommendations(self) -> list[dict]:
        """Generate personalized home recommendations."""
        profile = await self.get_profile()
        if not profile:
            return []

        # Get health context
        health_context = await self._get_health_context()
        financial_tier = await self._get_financial_tier()

        if not ANTHROPIC_API_KEY:
            return self._fallback_recommendations(profile)

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                system=(
                    "You are a home environment optimization expert. Generate specific, "
                    "actionable recommendations to improve the home for health and performance.\n"
                    "Categories: sleep, focus, air, light, ergonomics\n"
                    "Each recommendation: {category, recommendation, priority (high/medium/low), "
                    "effort (quick_win/moderate/investment), estimated_impact}\n"
                    f"Budget tier: {financial_tier} — filter by affordability.\n"
                    "Return ONLY valid JSON array of 5-8 recommendations."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Home profile: {json.dumps(profile, default=str)}\n"
                        f"Health context: {json.dumps(health_context)}"
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            recs = json.loads(raw)

            # Save to DB
            if supabase:
                # Clear old uncompleted recs
                supabase.table("home_recommendations").delete().eq("completed", False).execute()
                for rec in recs:
                    supabase.table("home_recommendations").insert(rec).execute()

            return recs
        except Exception as e:
            logger.error(f"Recommendation generation failed: {e}")
            return self._fallback_recommendations(profile)

    def _fallback_recommendations(self, profile: dict) -> list[dict]:
        """Fallback recommendations when Claude unavailable."""
        recs = []
        if not profile.get("bedroom_blackout"):
            recs.append({
                "category": "sleep", "recommendation": "Install blackout curtains in bedroom",
                "priority": "high", "effort": "moderate", "estimated_impact": "Improved sleep quality by reducing light disruption",
            })
        if not profile.get("morning_light_access"):
            recs.append({
                "category": "light", "recommendation": "Get 10 minutes of natural light within 30 minutes of waking",
                "priority": "high", "effort": "quick_win", "estimated_impact": "Better circadian rhythm alignment",
            })
        if profile.get("desk_setup_quality") in ("fair", "poor"):
            recs.append({
                "category": "ergonomics", "recommendation": "Raise monitor to eye level using a stand or stack of books",
                "priority": "medium", "effort": "quick_win", "estimated_impact": "Reduced neck strain and improved focus posture",
            })
        if not profile.get("indoor_plants"):
            recs.append({
                "category": "air", "recommendation": "Add 2-3 air-purifying plants (snake plant, pothos, peace lily)",
                "priority": "medium", "effort": "moderate", "estimated_impact": "Improved air quality and reduced stress",
            })
        if profile.get("noise_level") in ("moderate", "noisy") and not profile.get("white_noise_device"):
            recs.append({
                "category": "sleep", "recommendation": "Use a white noise machine or app for sleep",
                "priority": "medium", "effort": "quick_win", "estimated_impact": "More consistent sleep in noisy environments",
            })
        return recs

    async def get_recommendations(self, completed: bool = False) -> list[dict]:
        """Get recommendations filtered by completion status."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("home_recommendations")
                .select("*")
                .eq("completed", completed)
                .order("priority")
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get recommendations: {e}")
            return []

    async def complete_recommendation(self, rec_id: str) -> dict:
        """Mark recommendation as done."""
        if not supabase:
            return {"status": "ok"}
        try:
            result = (
                supabase.table("home_recommendations")
                .update({"completed": True, "completed_at": date.today().isoformat()})
                .eq("id", rec_id)
                .execute()
            )
            return result.data[0] if result.data else {"status": "ok"}
        except Exception as e:
            logger.error(f"Failed to complete recommendation: {e}")
            return {"error": str(e)}

    async def get_health_correlations(self) -> list[dict]:
        """Find correlations between home environment and health data."""
        profile = await self.get_profile()
        if not profile or not ANTHROPIC_API_KEY:
            return []

        health_context = await self._get_health_context()
        if not health_context.get("avg_sleep_score"):
            return []

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=300,
                system=(
                    "You are analyzing correlations between home environment and health metrics. "
                    "Generate 2-3 specific, data-informed observations. "
                    "Return ONLY valid JSON array of {observation: str, confidence: high/medium/low}."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Home: {json.dumps(profile, default=str)}\n"
                        f"Health: {json.dumps(health_context)}"
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Correlation analysis failed: {e}")
            return []

    async def _get_health_context(self) -> dict:
        """Get recent health data for recommendations."""
        if not supabase:
            return {}
        try:
            month_ago = (date.today() - timedelta(days=30)).isoformat()
            result = (
                supabase.table("health_data")
                .select("sleep_score,hrv,readiness_score")
                .gte("date", month_ago)
                .execute()
            )
            data = result.data or []
            if not data:
                return {}

            return {
                "avg_sleep_score": sum(d.get("sleep_score", 0) or 0 for d in data) / len(data),
                "avg_hrv": sum(d.get("hrv", 0) or 0 for d in data) / len(data),
                "avg_readiness": sum(d.get("readiness_score", 0) or 0 for d in data) / len(data),
                "data_points": len(data),
            }
        except Exception:
            return {}

    async def _get_financial_tier(self) -> str:
        """Get financial tier for budget-aware recommendations."""
        if not supabase:
            return "moderate"
        try:
            result = (
                supabase.table("financial_context")
                .select("socioeconomic_tier")
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0].get("socioeconomic_tier", "moderate")
            return "moderate"
        except Exception:
            return "moderate"


home_environment_service = HomeEnvironmentService()
