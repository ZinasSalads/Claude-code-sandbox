"""Cross-Module Arbitrator — synthesizes data from all modules into a daily plan.

Gathers context from every module and uses Claude to produce a unified,
non-contradictory daily plan covering fitness, nutrition, supplements,
environment, and coaching.
"""

import json
import logging
from datetime import date
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.arbitrator")

MODEL = "claude-sonnet-4-20250514"

ARBITRATOR_PROMPT = """You are the master health concierge AI. You have access to all data modules for this user. Your job is to synthesize everything into one coherent, non-contradictory daily plan.

IMPORTANT RULES:
1. Never contradict — if blood work says low iron, nutrition plan should include iron-rich foods
2. Environment matters — if AQI is high, move workout indoors
3. Supplements align with biomarkers — recommend what's actually needed
4. Coaching tone matches the user's settings
5. Be specific and actionable

{coaching_tone}

USER CONTEXT:
{user_context}

TODAY'S DATA:
- Wearable: {wearable}
- Check-in: {checkin}
- Environment: {environment}
- Flagged biomarkers: {flagged_biomarkers}
- Active supplements: {supplements}
- Compliance drift: {drift_score}

Return ONLY valid JSON (no markdown fences):
{{
  "greeting": "Personalized morning greeting based on data",
  "today_summary": "One paragraph summary of what the day looks like",
  "priority_actions": ["Top 3 most important things to do today"],
  "fitness_adjustments": "Any modifications to workout based on environment/recovery",
  "nutrition_focus": "Key nutrition priorities based on biomarkers/training",
  "supplement_reminders": "Which supplements matter most today and why",
  "environment_advisory": "Outdoor/UV/air quality guidance for today",
  "coaching_message": "Motivational or accountability message in the chosen style",
  "alerts": ["Any urgent items needing attention"]
}}"""


class ArbitratorService:
    """Synthesizes all module data into unified daily intelligence."""

    async def generate_daily_plan(self) -> dict:
        """Generate a comprehensive daily plan from all modules."""
        # Gather data from all modules
        context = await self._gather_context()

        if not ANTHROPIC_API_KEY:
            return self._fallback_plan(context)

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            prompt = ARBITRATOR_PROMPT.format(**context)
            response = client.messages.create(
                model=MODEL,
                max_tokens=2000,
                messages=[
                    {
                        "role": "user",
                        "content": "Generate today's comprehensive daily plan.",
                    }
                ],
                system=prompt,
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            plan = json.loads(raw)
            plan["generated_date"] = date.today().isoformat()
            plan["data_sources"] = context.get("available_sources", [])
            return plan
        except Exception as e:
            logger.error(f"Arbitrator error: {e}")
            return self._fallback_plan(context)

    async def _gather_context(self) -> dict:
        """Gather data from all modules."""
        available_sources = []

        # User context from memory
        user_context = ""
        try:
            from services.memory import build_user_context
            user_context = await build_user_context()
            if user_context:
                available_sources.append("memory")
        except Exception as e:
            logger.error(f"Memory context error: {e}")

        # Wearable data
        wearable = "No data"
        if supabase:
            try:
                result = (
                    supabase.table("health_data")
                    .select("*")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    h = result.data[0]
                    wearable = (
                        f"Readiness: {h.get('readiness_score', 'N/A')}/100, "
                        f"HRV: {h.get('hrv', 'N/A')}ms, "
                        f"RHR: {h.get('resting_heart_rate', 'N/A')}bpm, "
                        f"Sleep: {h.get('sleep_duration', 'N/A')}h (score: {h.get('sleep_score', 'N/A')}/100)"
                    )
                    available_sources.append("wearable")
            except Exception as e:
                logger.error(f"Wearable data error: {e}")

        # Check-in
        checkin = "Not completed"
        if supabase:
            try:
                result = (
                    supabase.table("check_ins")
                    .select("*")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    c = result.data[0]
                    checkin = (
                        f"Energy: {c.get('energy')}/10, Mood: {c.get('mood')}/10, "
                        f"Stress: {c.get('stress')}/10, Soreness: {c.get('soreness')}/10"
                    )
                    if c.get("notes"):
                        checkin += f", Notes: {c['notes']}"
                    available_sources.append("checkin")
            except Exception as e:
                logger.error(f"Check-in data error: {e}")

        # Environment
        environment = "No data"
        try:
            from services.environment import environment_service
            env = await environment_service.get_today()
            if env and not env.get("error"):
                parts = []
                if env.get("temp_c") is not None:
                    parts.append(f"Temp: {env['temp_c']}°C")
                if env.get("uv_index_max") is not None:
                    parts.append(f"UV: {env['uv_index_max']} ({env.get('uv_risk_level', '')})")
                if env.get("aqi") is not None:
                    parts.append(f"AQI: {env['aqi']} ({env.get('aqi_category', '')})")
                if env.get("pollen_risk_level"):
                    parts.append(f"Pollen: {env['pollen_risk_level']}")
                if env.get("air_quality_notes"):
                    parts.append(env["air_quality_notes"])
                environment = ", ".join(parts) if parts else "No data"
                if parts:
                    available_sources.append("environment")
        except Exception as e:
            logger.error(f"Environment data error: {e}")

        # Flagged biomarkers
        flagged = "None"
        try:
            from services.bloodwork import bloodwork_service
            flagged_list = await bloodwork_service.get_flagged_biomarkers()
            if flagged_list:
                flagged = ", ".join(
                    f"{b['name']}: {b['value']} {b.get('unit', '')} ({b.get('optimal_status', '')})"
                    for b in flagged_list[:10]
                )
                available_sources.append("biomarkers")
        except Exception as e:
            logger.error(f"Biomarker data error: {e}")

        # Supplements
        supplements = "None"
        try:
            from services.supplements import supplement_service
            stack = await supplement_service.get_stack()
            if stack:
                supplements = ", ".join(
                    f"{s['name']} ({s.get('dose_amount', '')} {s.get('dose_unit', '')} @ {s.get('timing', '')})"
                    for s in stack
                )
                available_sources.append("supplements")
        except Exception as e:
            logger.error(f"Supplement data error: {e}")

        # Coaching drift
        drift_score = 0
        coaching_tone = ""
        try:
            from services.coaching import coaching_service
            settings = await coaching_service.get_settings()
            drift_score = settings.get("current_drift_score", 0)
            coaching_tone = f"COACHING STYLE: {await coaching_service.get_active_tone()}"
            available_sources.append("coaching")
        except Exception as e:
            logger.error(f"Coaching data error: {e}")

        return {
            "user_context": user_context or "No profile data yet",
            "wearable": wearable,
            "checkin": checkin,
            "environment": environment,
            "flagged_biomarkers": flagged,
            "supplements": supplements,
            "drift_score": drift_score,
            "coaching_tone": coaching_tone,
            "available_sources": available_sources,
        }

    def _fallback_plan(self, context: dict) -> dict:
        """Generate a basic plan without AI."""
        return {
            "generated_date": date.today().isoformat(),
            "greeting": "Good morning! Here's your daily summary.",
            "today_summary": "Configure your Anthropic API key for AI-powered daily plans.",
            "priority_actions": [
                "Complete your morning check-in",
                "Follow today's workout recommendation",
                "Take your supplements on schedule",
            ],
            "fitness_adjustments": "Check your wearable data for recovery status.",
            "nutrition_focus": "Focus on hitting your protein target.",
            "supplement_reminders": "Take all supplements as scheduled.",
            "environment_advisory": context.get("environment", "Check local conditions."),
            "coaching_message": "Consistency is the key to results.",
            "alerts": [],
            "data_sources": context.get("available_sources", []),
        }


arbitrator_service = ArbitratorService()
