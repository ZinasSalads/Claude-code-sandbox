"""Fitness agent — goal-aware workout generation using Claude.

Uses goals, training plan, biometrics, check-in, previous exercise results,
and available equipment to generate today's precise workout with targets.
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


async def _get_today_health() -> dict:
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
        return {}


async def _get_recent_workouts(days: int = 7) -> list:
    if not supabase:
        return []
    try:
        start = (date.today() - timedelta(days=days)).isoformat()
        result = (
            supabase.table("workouts")
            .select("date,workout_type,title,intensity,duration_minutes,completed")
            .gte("date", start)
            .order("date", desc=True)
            .execute()
        )
        return result.data or []
    except Exception:
        return []


async def _get_active_goals() -> list:
    if not supabase:
        return []
    try:
        result = (
            supabase.table("fitness_goals")
            .select("goal_type,target_description,target_date,priority,ai_feasibility")
            .eq("status", "active")
            .execute()
        )
        return result.data or []
    except Exception:
        return []


async def _get_todays_planned_session() -> Optional[dict]:
    """Return today's session from the current training plan, if one exists."""
    if not supabase:
        return None
    try:
        week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
        result = (
            supabase.table("training_plans")
            .select("planned_sessions,phase")
            .eq("week_start", week_start)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        sessions = result.data[0].get("planned_sessions") or []
        today_str = date.today().isoformat()
        for session in sessions:
            if session.get("date") == today_str:
                return {**session, "phase": result.data[0].get("phase")}
        return None
    except Exception:
        return None


async def _get_equipment() -> list:
    if not supabase:
        return []
    try:
        result = supabase.table("user_equipment").select("name,category").execute()
        return [e["name"] for e in (result.data or [])]
    except Exception:
        return []


async def _get_recent_sets_for_exercises(exercise_names: list) -> dict:
    """For each exercise name, return the last logged sets (for progressive overload)."""
    if not supabase or not exercise_names:
        return {}
    try:
        results = {}
        for name in exercise_names[:6]:  # limit to avoid too many queries
            sets_result = (
                supabase.table("workout_sets")
                .select("exercise_name,set_number,weight_kg,reps_completed,rpe,created_at")
                .ilike("exercise_name", f"%{name.split()[0]}%")  # match first word
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            sets = sets_result.data or []
            if sets:
                # Only keep sets from the most recent session
                latest_id_result = (
                    supabase.table("workout_sets")
                    .select("workout_id")
                    .ilike("exercise_name", f"%{name.split()[0]}%")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if latest_id_result.data:
                    latest_wid = latest_id_result.data[0]["workout_id"]
                    sets = (
                        supabase.table("workout_sets")
                        .select("set_number,weight_kg,reps_completed,rpe")
                        .ilike("exercise_name", f"%{name.split()[0]}%")
                        .eq("workout_id", latest_wid)
                        .order("set_number")
                        .execute()
                    ).data or []
                results[name] = sets
        return results
    except Exception:
        return {}


async def _get_last_run() -> Optional[dict]:
    """Return the most recent run log entry."""
    if not supabase:
        return None
    try:
        result = (
            supabase.table("run_log")
            .select("distance_km,duration_minutes,avg_pace_per_km,avg_hr,run_type,rpe")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
    except Exception:
        return None


def _format_recent_workouts(workouts: list) -> str:
    if not workouts:
        return "No workouts logged in the last 7 days."
    lines = []
    for w in workouts:
        status = "✓ completed" if w.get("completed") else "planned"
        lines.append(
            f"  {w.get('date')}: {w.get('title', 'Unknown')} "
            f"({w.get('workout_type', '?')}, {w.get('intensity', '?')}, "
            f"{w.get('duration_minutes', '?')}min, {status})"
        )
    return "\n".join(lines)


def _format_goals(goals: list) -> str:
    if not goals:
        return "No active goals set."
    lines = []
    for g in goals:
        feasibility = g.get("ai_feasibility") or {}
        lines.append(
            f"  [{g.get('priority', 'primary').upper()}] {g.get('target_description')}"
            + (f" by {g.get('target_date')}" if g.get("target_date") else "")
            + (f" — AI: {feasibility.get('verdict', '')}" if feasibility.get("verdict") else "")
        )
    return "\n".join(lines)


async def generate_workout() -> dict:
    """Generate today's workout — goal-aware, readiness-adjusted, equipment-specific."""
    if not ANTHROPIC_API_KEY:
        return _fallback_workout("ANTHROPIC_API_KEY not configured")

    health = await _get_today_health()
    checkin = await _get_today_checkin()
    recent = await _get_recent_workouts()
    user_context = await build_user_context()
    goals = await _get_active_goals()
    planned = await _get_todays_planned_session()
    equipment = await _get_equipment()
    last_run = await _get_last_run()

    readiness = health.get("readiness_score", 70)
    equipment_str = ", ".join(equipment) if equipment else "Standard gym equipment (barbell, dumbbells, machines)"

    # If there's a planned session, get the exercises to fetch progressive overload data
    planned_exercises = []
    if planned and planned.get("targets", {}).get("exercises"):
        planned_exercises = [e.get("name", "") for e in planned["targets"]["exercises"] if e.get("name")]

    prev_sets = await _get_recent_sets_for_exercises(planned_exercises) if planned_exercises else {}

    prev_sets_text = ""
    if prev_sets:
        lines = []
        for ex, sets in prev_sets.items():
            if sets:
                set_strs = [f"Set {s['set_number']}: {s.get('weight_kg','?')}kg×{s.get('reps_completed','?')} RPE {s.get('rpe','?')}" for s in sets]
                lines.append(f"  {ex}: {', '.join(set_strs)}")
        prev_sets_text = "\n".join(lines) if lines else "No previous data"
    else:
        prev_sets_text = "No previous data"

    last_run_text = "No recent run logged"
    if last_run:
        pace = last_run.get("avg_pace_per_km")
        pace_str = f"{int(pace)}:{int((pace % 1) * 60):02d}/km" if pace else "unknown"
        last_run_text = (
            f"{last_run.get('run_type', 'run')}: "
            f"{last_run.get('distance_km', '?')}km @ {pace_str}, "
            f"avg HR {last_run.get('avg_hr', '?')}, RPE {last_run.get('rpe', '?')}"
        )

    planned_text = "No training plan for today — generate based on readiness."
    if planned:
        planned_text = (
            f"Planned: {planned.get('session_type')} — {planned.get('title')}\n"
            f"  Duration: {planned.get('duration_minutes')}min\n"
            f"  Description: {planned.get('description')}\n"
            f"  Phase: {planned.get('phase', 'unknown')}"
        )
        if planned.get("targets"):
            t = planned["targets"]
            if t.get("distance_km"):
                planned_text += f"\n  Target: {t['distance_km']}km @ {t.get('pace_per_km', '?')}/km (zone {t.get('hr_zone', '?')})"

    system = f"""You are an expert personal trainer generating today's precise workout.

USER GOALS:
{_format_goals(goals)}

TODAY'S PLANNED SESSION:
{planned_text}

PREVIOUS EXERCISE DATA (for progressive overload):
{prev_sets_text}

LAST RUN LOGGED:
{last_run_text}

TODAY'S BIOMETRICS:
- Readiness: {readiness}/100
- HRV: {health.get('hrv', 'N/A')}ms
- Resting HR: {health.get('resting_heart_rate', 'N/A')}bpm
- Sleep: {health.get('sleep_duration', 'N/A')}h (score: {health.get('sleep_score', 'N/A')})
- Energy: {checkin.get('energy', 'N/A')}/10
- Soreness: {checkin.get('soreness', 'N/A')}/10
- Stress: {checkin.get('stress', 'N/A')}/10

RECENT WORKOUTS (7 days):
{_format_recent_workouts(recent)}

AVAILABLE EQUIPMENT:
{equipment_str}

USER CONTEXT:
{user_context}

READINESS RULES:
- 85-100: Full intensity, apply progressive overload
- 70-84: Normal training, maintain planned targets
- 55-69: Reduce volume 20%, lower intensity one notch
- 40-54: Active recovery or light technique only
- Below 40: Rest or gentle movement only

PROGRESSIVE OVERLOAD RULES:
- If last weight × reps met target at RPE ≤ 7: increase weight 2.5-5kg
- If last reps hit top of range at RPE ≤ 8: add 1-2 reps or add a set
- For running: if last run felt easy (RPE ≤ 6): add 1km or increase pace 5-10 sec/km

Respond in this exact JSON (no markdown, raw JSON only):
{{
  "workout_type": "strength|cardio|recovery|rest|technique",
  "title": "Descriptive title",
  "intensity": "low|moderate|high",
  "duration_minutes": 45,
  "ai_reasoning": "2-3 sentences: why this session today, referencing goals and readiness",
  "warmup": [{{"exercise": "", "duration_or_sets": ""}}],
  "exercises": [
    {{
      "name": "Exercise Name",
      "sets": 3,
      "reps": "8-10",
      "rest_seconds": 90,
      "weight_guidance": "85kg (up 2.5kg from last week) or RPE 7-8",
      "notes": "Form cue or progression note"
    }}
  ],
  "run_targets": {{
    "distance_km": 10,
    "pace_per_km": 5.5,
    "run_type": "easy|tempo|long|interval|recovery",
    "hr_zone": 2,
    "notes": "Stay conversational, check HR every 5km"
  }},
  "cooldown": [{{"exercise": "", "duration_or_sets": ""}}],
  "coaching_note": "One motivational or technical cue"
}}

Note: include run_targets only for cardio/running workouts; include exercises only for strength workouts."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            system=system,
            messages=[{"role": "user", "content": "Generate today's workout."}],
        )
        raw = response.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return _fallback_workout("AI response parse error")
    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return _fallback_workout(str(e))


def _fallback_workout(reason: str) -> dict:
    return {
        "workout_type": "rest",
        "title": "Rest Day",
        "intensity": "low",
        "duration_minutes": 0,
        "ai_reasoning": f"Workout generation unavailable: {reason}",
        "warmup": [],
        "exercises": [],
        "run_targets": None,
        "cooldown": [],
        "coaching_note": "Take a rest day and check your setup.",
    }


async def save_workout(workout: dict) -> Optional[dict]:
    if not supabase:
        return workout
    try:
        today = date.today().isoformat()
        # Check for any existing AI-recommended incomplete workout today to avoid duplicates
        existing = (
            supabase.table("workouts")
            .select("id")
            .eq("date", today)
            .eq("recommended_by_ai", True)
            .eq("completed", False)
            .limit(1)
            .execute()
        )
        if existing.data:
            saved = {**workout, "id": existing.data[0]["id"]}
            return saved

        health = await _get_today_health()
        row = {
            "date": today,
            "workout_type": workout.get("workout_type"),
            "title": workout.get("title"),
            "description": workout.get("ai_reasoning"),
            "exercises": json.dumps(workout.get("exercises", [])),
            "duration_minutes": workout.get("duration_minutes"),
            "intensity": workout.get("intensity"),
            "ai_reasoning": workout.get("ai_reasoning"),
            "recommended_by_ai": True,
            "completed": False,
            "readiness_at_recommendation": health.get("readiness_score"),
        }
        result = supabase.table("workouts").insert(row).execute()
        if result.data:
            saved = {**workout, "id": result.data[0].get("id")}
            return saved
    except Exception as e:
        logger.error(f"Failed to save workout: {e}")
    return workout
