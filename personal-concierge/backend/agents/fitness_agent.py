"""Fitness agent — generates personalized workout recommendations using Claude.

Uses today's biometric data, check-in, recent training history, and user context
to produce a single optimized workout recommendation.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase
from services.memory import build_user_context

logger = logging.getLogger("concierge.fitness_agent")

MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """You are an expert personal trainer and fitness coach with deep knowledge of exercise science, recovery optimization, and progressive overload principles.

You are coaching a single user. Everything you know about them:
{user_context}

Today's biometric data:
- Readiness score: {readiness_score}/100
- HRV: {hrv}ms
- Resting heart rate: {rhr}bpm
- Sleep duration: {sleep_hours} hours
- Sleep score: {sleep_score}/100
- Energy (self-reported): {energy}/10
- Soreness (self-reported): {soreness}/10
- Stress (self-reported): {stress}/10

Recent training history (last 7 days):
{recent_workouts}

READINESS INTERPRETATION:
- 85-100: Elite recovery. Push hard. Progressive overload appropriate.
- 70-84: Good recovery. Normal training. Maintain planned intensity.
- 55-69: Moderate recovery. Reduce volume by 20%. Avoid PRs.
- 40-54: Poor recovery. Active recovery or light technique work only.
- Below 40: Rest or very gentle movement (walk, stretching) only.

EQUIPMENT AVAILABLE: Home gym with barbell, full weight plates, adjustable dumbbells (up to 50kg), pull-up bar, resistance bands, gymnastic rings.

RULES:
1. Never recommend high intensity if readiness < 55
2. Never recommend the same muscle group two consecutive days
3. Always provide warm-up and cool-down
4. Explain WHY you chose this workout based on today's data
5. Be specific: exercise name, sets, reps, rest periods, weight guidance
6. If readiness is high, proactively suggest progressive overload
7. Keep recommendation focused — quality over quantity

Respond in this exact JSON structure (no markdown, no code fences, just raw JSON):
{{
  "workout_type": "strength|cardio|recovery|rest|technique",
  "title": "Brief descriptive title",
  "intensity": "low|moderate|high",
  "duration_minutes": 45,
  "ai_reasoning": "2-3 sentences explaining why this workout today",
  "warmup": [{{"exercise": "", "duration_or_sets": ""}}],
  "exercises": [
    {{
      "name": "",
      "sets": 4,
      "reps": "8-10",
      "rest_seconds": 90,
      "weight_guidance": "75% of 1RM or RPE 7-8",
      "notes": ""
    }}
  ],
  "cooldown": [{{"exercise": "", "duration_or_sets": ""}}],
  "coaching_note": "One motivational or technical cue for today"
}}"""


async def _get_today_health() -> dict:
    """Get today's health data from Supabase."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("health_data")
            .select("*")
            .eq("date", date.today().isoformat())
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Failed to fetch health data: {e}")
        return {}


async def _get_today_checkin() -> dict:
    """Get today's check-in from Supabase."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("check_ins")
            .select("*")
            .eq("date", date.today().isoformat())
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Failed to fetch check-in: {e}")
        return {}


async def _get_recent_workouts(days: int = 7) -> list[dict]:
    """Get recent workouts from Supabase."""
    if not supabase:
        return []
    try:
        start = (date.today() - timedelta(days=days)).isoformat()
        result = (
            supabase.table("workouts")
            .select("date, workout_type, title, intensity, duration_minutes, completed")
            .gte("date", start)
            .order("date", desc=True)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.error(f"Failed to fetch recent workouts: {e}")
        return []


def _format_recent_workouts(workouts: list[dict]) -> str:
    """Format recent workouts into a readable string for the prompt."""
    if not workouts:
        return "No workouts logged in the last 7 days."

    lines = []
    for w in workouts:
        status = "completed" if w.get("completed") else "planned"
        lines.append(
            f"  - {w.get('date')}: {w.get('title', 'Unknown')} "
            f"({w.get('workout_type', '?')}, {w.get('intensity', '?')} intensity, "
            f"{w.get('duration_minutes', '?')} min, {status})"
        )
    return "\n".join(lines)


async def generate_workout() -> dict:
    """Generate a personalized workout recommendation for today."""
    if not ANTHROPIC_API_KEY:
        return {
            "error": "ANTHROPIC_API_KEY not configured",
            "workout_type": "rest",
            "title": "API key needed",
            "intensity": "low",
            "duration_minutes": 0,
            "ai_reasoning": "Cannot generate recommendation — ANTHROPIC_API_KEY not set in .env",
            "warmup": [],
            "exercises": [],
            "cooldown": [],
            "coaching_note": "Set up your Anthropic API key to get AI-powered workout recommendations.",
        }

    # Gather context
    health = await _get_today_health()
    checkin = await _get_today_checkin()
    recent = await _get_recent_workouts()
    user_context = await build_user_context()

    # Build prompt with available data
    prompt = SYSTEM_PROMPT.format(
        user_context=user_context,
        readiness_score=health.get("readiness_score", "N/A"),
        hrv=health.get("hrv", "N/A"),
        rhr=health.get("resting_heart_rate", "N/A"),
        sleep_hours=health.get("sleep_duration", "N/A"),
        sleep_score=health.get("sleep_score", "N/A"),
        energy=checkin.get("energy", "N/A"),
        soreness=checkin.get("soreness", "N/A"),
        stress=checkin.get("stress", "N/A"),
        recent_workouts=_format_recent_workouts(recent),
    )

    # Call Claude
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=prompt,
            messages=[
                {
                    "role": "user",
                    "content": "Generate today's workout recommendation based on the data provided.",
                }
            ],
        )

        raw_text = response.content[0].text.strip()

        # Parse JSON — handle potential markdown fences
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        workout = json.loads(raw_text)
        return workout

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}")
        logger.error(f"Raw response: {raw_text[:500]}")
        return {
            "error": "Failed to parse AI response",
            "workout_type": "rest",
            "title": "Recommendation error",
            "intensity": "low",
            "duration_minutes": 0,
            "ai_reasoning": f"AI response could not be parsed. Raw: {raw_text[:200]}",
            "warmup": [],
            "exercises": [],
            "cooldown": [],
            "coaching_note": "Please try again.",
        }
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return {
            "error": str(e),
            "workout_type": "rest",
            "title": "API error",
            "intensity": "low",
            "duration_minutes": 0,
            "ai_reasoning": f"Error calling AI: {e}",
            "warmup": [],
            "exercises": [],
            "cooldown": [],
            "coaching_note": "Check your ANTHROPIC_API_KEY and try again.",
        }


async def save_workout(workout: dict) -> Optional[dict]:
    """Save a generated workout to Supabase."""
    if not supabase:
        return workout

    try:
        row = {
            "date": date.today().isoformat(),
            "workout_type": workout.get("workout_type"),
            "title": workout.get("title"),
            "description": workout.get("ai_reasoning"),
            "exercises": json.dumps(workout.get("exercises", [])),
            "duration_minutes": workout.get("duration_minutes"),
            "intensity": workout.get("intensity"),
            "ai_reasoning": workout.get("ai_reasoning"),
            "recommended_by_ai": True,
            "completed": False,
        }

        # Get today's readiness for the record
        health = await _get_today_health()
        row["readiness_at_recommendation"] = health.get("readiness_score")

        result = supabase.table("workouts").insert(row).execute()
        if result.data:
            return {**workout, "id": result.data[0].get("id")}
    except Exception as e:
        logger.error(f"Failed to save workout: {e}")

    return workout
