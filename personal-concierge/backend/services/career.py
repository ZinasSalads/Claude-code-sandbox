"""Career & Professional Development service.

Not a productivity app — a health-aware career coach.
Correlates HRV, sleep, mood, and workout data with self-reported
work performance and satisfaction — surfacing connections most
people feel but never quantify.

Features:
- Career profile: role, goals, skills, satisfaction
- Weekly reflection log with coaching insight
- Burnout monitoring from integrated health data
- Health-performance correlation analysis
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.career")

MODEL = "claude-sonnet-4-20250514"


class CareerService:

    async def get_profile(self) -> Optional[dict]:
        """Get career profile."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("career_profile")
                .select("*")
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to fetch career profile: {e}")
            return None

    async def update_profile(self, data: dict) -> dict:
        """Update career profile. Upserts single row."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            existing = await self.get_profile()
            if existing:
                result = (
                    supabase.table("career_profile")
                    .update(data)
                    .eq("id", existing["id"])
                    .execute()
                )
            else:
                result = supabase.table("career_profile").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update career profile: {e}")
            return {"error": str(e)}

    async def log_weekly_reflection(self, data: dict) -> dict:
        """Log weekly career reflection with Claude coaching insight."""
        if not supabase:
            return {"error": "Database not configured"}

        try:
            today = date.today()
            week_start = (today - timedelta(days=today.weekday())).isoformat()
            row = {
                "week_start": week_start,
                "wins": data.get("wins", []),
                "challenges": data.get("challenges", []),
                "learning": data.get("learning"),
                "energy_level": data.get("energy_level"),
                "productivity_score": data.get("productivity_score"),
                "notes": data.get("notes"),
            }
            result = (
                supabase.table("career_log")
                .upsert(row, on_conflict="week_start")
                .execute()
            )

            # Generate coaching insight
            coaching_insight = None
            if ANTHROPIC_API_KEY:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    profile = await self.get_profile()
                    context = f"Reflection: {json.dumps(row, default=str)}"
                    if profile:
                        context += f"\nCareer profile: {json.dumps(profile, default=str)}"

                    response = client.messages.create(
                        model=MODEL,
                        max_tokens=300,
                        system=(
                            "You are an executive career coach. Based on this weekly reflection, "
                            "provide one specific, actionable coaching insight. 2-3 sentences. "
                            "Be honest and direct."
                        ),
                        messages=[{"role": "user", "content": context}],
                    )
                    coaching_insight = response.content[0].text.strip()
                except Exception as e:
                    logger.warning(f"Career coaching insight failed: {e}")

            return {
                "reflection_saved": True,
                "data": result.data[0] if result.data else row,
                "coaching_insight": coaching_insight,
            }
        except Exception as e:
            logger.error(f"Failed to save career reflection: {e}")
            return {"error": str(e)}

    async def get_reflections(self, limit: int = 12) -> list[dict]:
        """Get reflection history."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("career_log")
                .select("*")
                .order("week_start", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch career reflections: {e}")
            return []

    async def get_burnout_risk(self) -> dict:
        """Calculate burnout risk score from health + career data."""
        if not supabase:
            return {"risk_score": 0, "risk_level": "unknown", "contributing_factors": [], "recommendations": []}

        risk_factors = []
        risk_points = 0

        try:
            # HRV trend (14 days)
            start_14d = (date.today() - timedelta(days=14)).isoformat()
            health = (
                supabase.table("health_data")
                .select("hrv, sleep_score, readiness_score")
                .gte("date", start_14d)
                .order("date")
                .execute()
            )
            health_data = health.data or []

            if len(health_data) >= 7:
                hrvs = [h["hrv"] for h in health_data if h.get("hrv")]
                if len(hrvs) >= 4:
                    first_half = sum(hrvs[:len(hrvs)//2]) / (len(hrvs)//2)
                    second_half = sum(hrvs[len(hrvs)//2:]) / (len(hrvs) - len(hrvs)//2)
                    if second_half < first_half * 0.9:
                        risk_points += 20
                        risk_factors.append("HRV declining over past 2 weeks")

                sleep_scores = [h["sleep_score"] for h in health_data if h.get("sleep_score")]
                if sleep_scores:
                    avg_sleep = sum(sleep_scores) / len(sleep_scores)
                    if avg_sleep < 75:
                        risk_points += 15
                        risk_factors.append(f"Average sleep score {int(avg_sleep)}/100 (below 75)")

            # Check-in stress levels
            checkins = (
                supabase.table("check_ins")
                .select("stress, energy, mood")
                .gte("date", start_14d)
                .execute()
            )
            checkin_data = checkins.data or []

            if checkin_data:
                avg_stress = sum(c.get("stress", 5) for c in checkin_data) / len(checkin_data)
                avg_energy = sum(c.get("energy", 5) for c in checkin_data) / len(checkin_data)
                if avg_stress > 7:
                    risk_points += 20
                    risk_factors.append(f"High stress levels (avg {avg_stress:.1f}/10)")
                if avg_energy < 4:
                    risk_points += 15
                    risk_factors.append(f"Low energy levels (avg {avg_energy:.1f}/10)")

            # Career satisfaction
            profile = await self.get_profile()
            if profile:
                satisfaction = profile.get("satisfaction_score")
                if satisfaction and satisfaction <= 4:
                    risk_points += 15
                    risk_factors.append(f"Low career satisfaction ({satisfaction}/10)")
                stress_level = profile.get("stress_level")
                if stress_level and stress_level >= 8:
                    risk_points += 15
                    risk_factors.append(f"High work stress ({stress_level}/10)")

        except Exception as e:
            logger.error(f"Failed to calculate burnout risk: {e}")

        risk_score = min(100, risk_points)
        if risk_score >= 70:
            risk_level = "high"
        elif risk_score >= 50:
            risk_level = "elevated"
        elif risk_score >= 30:
            risk_level = "moderate"
        else:
            risk_level = "low"

        recommendations = []
        if risk_score >= 50:
            recommendations.append("Consider reducing workout intensity this week")
            recommendations.append("Prioritize 8+ hours of sleep")
        if risk_score >= 30:
            recommendations.append("Schedule at least one restorative activity")

        return {
            "risk_score": risk_score,
            "risk_level": risk_level,
            "contributing_factors": risk_factors,
            "recommendations": recommendations,
            "data_window_days": 14,
        }

    async def get_weekly_career_coaching(self) -> str:
        """Claude-generated weekly career coaching insight."""
        if not ANTHROPIC_API_KEY:
            return "Career coaching requires AI configuration."

        profile = await self.get_profile()
        burnout = await self.get_burnout_risk()
        reflections = await self.get_reflections(limit=2)

        context = (
            f"Career profile: {json.dumps(profile, default=str) if profile else 'Not set'}\n"
            f"Burnout risk: {burnout['risk_level']} ({burnout['risk_score']}/100)\n"
            f"Recent reflections: {json.dumps(reflections, default=str) if reflections else 'None'}"
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=400,
                system=(
                    "You are an executive career coach with access to health data. "
                    "Provide a weekly career coaching insight. 2-3 paragraphs. "
                    "Be honest, specific, and actionable. Connect health data to career performance."
                ),
                messages=[{"role": "user", "content": context}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Career coaching failed: {e}")
            return "Unable to generate career coaching this week."

    async def correlate_performance_with_health(self) -> dict:
        """Find correlations between health data and career performance."""
        if not supabase:
            return {"correlations": [], "error": "Database not configured"}

        try:
            # Get career logs with health data for matching weeks
            reflections = await self.get_reflections(limit=12)
            if not reflections:
                return {"correlations": [], "message": "Not enough data yet"}

            correlations = []

            # Compare productivity with sleep/HRV
            for ref in reflections:
                week = ref.get("week_start")
                if not week or not ref.get("productivity_score"):
                    continue
                week_end = (date.fromisoformat(week) + timedelta(days=6)).isoformat()

                health = (
                    supabase.table("health_data")
                    .select("sleep_score, hrv, readiness_score")
                    .gte("date", week)
                    .lte("date", week_end)
                    .execute()
                )
                if health.data:
                    avg_sleep = sum(h.get("sleep_score", 0) for h in health.data if h.get("sleep_score")) / max(len(health.data), 1)
                    correlations.append({
                        "week": week,
                        "productivity": ref["productivity_score"],
                        "avg_sleep": round(avg_sleep, 1),
                        "energy": ref.get("energy_level"),
                    })

            # Generate insight
            insight = ""
            if ANTHROPIC_API_KEY and correlations:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    response = client.messages.create(
                        model=MODEL,
                        max_tokens=200,
                        system="Analyze health-performance correlations. Return top 3 insights as a JSON array of strings.",
                        messages=[{"role": "user", "content": json.dumps(correlations)}],
                    )
                    raw = response.content[0].text.strip()
                    if raw.startswith("```"):
                        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    insight = json.loads(raw)
                except Exception:
                    insight = ["Not enough data to identify clear patterns yet."]

            return {"correlations": correlations, "insights": insight}
        except Exception as e:
            logger.error(f"Failed to correlate performance: {e}")
            return {"correlations": [], "error": str(e)}


career_service = CareerService()
