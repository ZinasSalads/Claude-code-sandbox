"""Nutrition agent — generates personalized daily meal plans using Claude.

Considers today's workout, biometric data, biomarkers, and user preferences
to produce practical, real-food meal recommendations.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase
from services.memory import build_user_context

logger = logging.getLogger("concierge.nutrition_agent")

MODEL = "claude-sonnet-4-20250514"

DEFAULT_MACROS = {"protein": 180, "carbs": 250, "fat": 70}

SYSTEM_PROMPT = """You are an expert sports nutritionist and meal planner with deep knowledge of macronutrient timing, micronutrient optimization, and practical cooking.

You are coaching a single user. Everything you know about them:
{user_context}

Today's context:
- Today's workout: {workout_summary}
- Workout intensity: {workout_intensity}
- Readiness score: {readiness_score}/100
- Sleep score: {sleep_score}/100
- Energy (self-reported): {energy}/10
- Stress (self-reported): {stress}/10

Current macro targets (from profile or defaults):
- Protein: {protein_target}g
- Carbs: {carbs_target}g
- Fat: {fat_target}g

Recent biomarker flags (if any):
{biomarker_flags}

NUTRITION RULES:
1. Adjust carbs UP on high-intensity training days (+30-50g), DOWN on rest days (-30-50g)
2. Keep protein consistent regardless of training day (recovery needs are constant)
3. Increase fat slightly on rest/recovery days for satiety
4. If any biomarker is flagged:
   - Low Vitamin D → suggest fatty fish, eggs, mushrooms
   - Low ferritin/iron → suggest red meat, spinach, pair with Vitamin C sources
   - High LDL → reduce saturated fat, increase fiber, suggest oats/nuts/olive oil
   - Low B12 → suggest eggs, dairy, nutritional yeast
5. Prioritize whole, real foods over processed alternatives
6. Each meal should be practical — under 30 min prep for weekdays
7. Include variety — don't repeat proteins across meals
8. Consider meal timing around workouts (carbs + protein post-workout)

Respond in this exact JSON structure (no markdown, no code fences, just raw JSON):
{{
  "daily_targets": {{"calories": 2400, "protein": 180, "carbs": 250, "fat": 70}},
  "ai_reasoning": "2-3 sentences explaining why these targets and food choices today",
  "meals": [
    {{
      "meal_type": "breakfast",
      "title": "Brief descriptive title",
      "description": "1-2 sentence description of the meal",
      "key_ingredients": ["ingredient1", "ingredient2"],
      "estimated_calories": 600,
      "estimated_protein": 40,
      "estimated_carbs": 60,
      "estimated_fat": 20,
      "prep_time_minutes": 10,
      "notes": "Optional cooking tip or variation"
    }}
  ],
  "hydration_target_ml": 2500,
  "nutrition_note": "One key focus for today's nutrition"
}}

Always include breakfast, lunch, dinner, and optionally a snack if needed to hit targets."""


async def _get_today_workout() -> dict:
    """Get today's workout to inform nutrition."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("workouts")
            .select("workout_type, title, intensity, duration_minutes")
            .eq("date", date.today().isoformat())
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Failed to fetch today's workout: {e}")
        return {}


async def _get_today_health() -> dict:
    """Get today's health data."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("health_data")
            .select("readiness_score, sleep_score")
            .eq("date", date.today().isoformat())
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Failed to fetch health data: {e}")
        return {}


async def _get_today_checkin() -> dict:
    """Get today's check-in."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("check_ins")
            .select("energy, stress")
            .eq("date", date.today().isoformat())
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Failed to fetch check-in: {e}")
        return {}


async def _get_macro_targets() -> dict:
    """Get user's macro targets from profile, or use defaults."""
    if not supabase:
        return DEFAULT_MACROS
    try:
        result = (
            supabase.table("user_profile")
            .select("value")
            .eq("key", "macro_targets")
            .limit(1)
            .execute()
        )
        if result.data:
            val = result.data[0]["value"]
            if isinstance(val, str):
                val = json.loads(val)
            return val
    except Exception as e:
        logger.error(f"Failed to fetch macro targets: {e}")
    return DEFAULT_MACROS


async def _get_biomarker_flags() -> str:
    """Get recent biomarker flags that are out of range."""
    if not supabase:
        return "No biomarker data available."
    try:
        result = (
            supabase.table("biomarkers")
            .select("marker_name, value, unit, status, reference_min, reference_max")
            .in_("status", ["low", "high", "critical"])
            .order("test_date", desc=True)
            .limit(10)
            .execute()
        )
        if not result.data:
            return "No flagged biomarkers — all within normal range."

        lines = []
        for b in result.data:
            lines.append(
                f"  - {b['marker_name']}: {b['value']} {b.get('unit', '')} "
                f"(status: {b['status']}, range: {b.get('reference_min', '?')}-{b.get('reference_max', '?')})"
            )
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Failed to fetch biomarkers: {e}")
        return "Could not retrieve biomarker data."


async def generate_meal_plan() -> dict:
    """Generate a personalized daily meal plan."""
    if not ANTHROPIC_API_KEY:
        return {
            "error": "ANTHROPIC_API_KEY not configured",
            "daily_targets": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
            "ai_reasoning": "Cannot generate meal plan — ANTHROPIC_API_KEY not set in .env",
            "meals": [],
            "hydration_target_ml": 2500,
            "nutrition_note": "Set up your Anthropic API key for AI-powered nutrition plans.",
        }

    workout = await _get_today_workout()
    health = await _get_today_health()
    checkin = await _get_today_checkin()
    macros = await _get_macro_targets()
    biomarker_flags = await _get_biomarker_flags()
    user_context = await build_user_context()

    workout_summary = "Rest day (no workout planned)"
    workout_intensity = "none"
    if workout:
        workout_summary = f"{workout.get('title', 'Workout')} ({workout.get('workout_type', '?')}, {workout.get('duration_minutes', '?')} min)"
        workout_intensity = workout.get("intensity", "moderate")

    prompt = SYSTEM_PROMPT.format(
        user_context=user_context,
        workout_summary=workout_summary,
        workout_intensity=workout_intensity,
        readiness_score=health.get("readiness_score", "N/A"),
        sleep_score=health.get("sleep_score", "N/A"),
        energy=checkin.get("energy", "N/A"),
        stress=checkin.get("stress", "N/A"),
        protein_target=macros.get("protein", 180),
        carbs_target=macros.get("carbs", 250),
        fat_target=macros.get("fat", 70),
        biomarker_flags=biomarker_flags,
    )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2500,
            system=prompt,
            messages=[
                {
                    "role": "user",
                    "content": "Generate today's meal plan based on the data provided.",
                }
            ],
        )

        raw_text = response.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        meal_plan = json.loads(raw_text)
        return meal_plan

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Claude response as JSON: {e}")
        return {
            "error": "Failed to parse AI response",
            "daily_targets": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
            "ai_reasoning": f"AI response could not be parsed: {raw_text[:200]}",
            "meals": [],
            "hydration_target_ml": 2500,
            "nutrition_note": "Please try again.",
        }
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return {
            "error": str(e),
            "daily_targets": {"calories": 0, "protein": 0, "carbs": 0, "fat": 0},
            "ai_reasoning": f"Error calling AI: {e}",
            "meals": [],
            "hydration_target_ml": 2500,
            "nutrition_note": "Check your ANTHROPIC_API_KEY and try again.",
        }


async def save_meal_plan(meal_plan: dict) -> dict:
    """Save generated meals to Supabase."""
    if not supabase:
        return meal_plan

    try:
        for meal in meal_plan.get("meals", []):
            row = {
                "date": date.today().isoformat(),
                "meal_type": meal.get("meal_type"),
                "title": meal.get("title"),
                "description": meal.get("description"),
                "ingredients": json.dumps(meal.get("key_ingredients", [])),
                "calories": meal.get("estimated_calories"),
                "protein_g": meal.get("estimated_protein"),
                "carbs_g": meal.get("estimated_carbs"),
                "fat_g": meal.get("estimated_fat"),
                "ai_reasoning": meal_plan.get("ai_reasoning"),
                "logged": False,
            }
            supabase.table("meals").insert(row).execute()
    except Exception as e:
        logger.error(f"Failed to save meal plan: {e}")

    return meal_plan
