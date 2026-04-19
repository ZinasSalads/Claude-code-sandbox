"""Fitness goals, training plans, progressive overload, and Apple Watch integration."""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.fitness_goals")
MODEL = "claude-sonnet-4-20250514"


class FitnessGoalsService:

    # ── Goals ──────────────────────────────────────────────────────────────

    async def create_goal(self, data: dict) -> dict:
        if not supabase:
            return {"error": "Database not configured"}
        feasibility = await self._assess_feasibility(data)
        row = {
            "goal_type": data.get("goal_type", "custom"),
            "target_description": data.get("target_description", ""),
            "target_date": data.get("target_date"),
            "baseline_description": data.get("baseline_description"),
            "priority": data.get("priority", "primary"),
            "ai_feasibility": feasibility,
            "status": "active",
        }
        try:
            result = supabase.table("fitness_goals").insert(row).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to create goal: {e}")
            return {"error": str(e)}

    async def _assess_feasibility(self, goal_data: dict) -> dict:
        if not ANTHROPIC_API_KEY:
            return {"verdict": "unknown", "summary": "AI not configured"}
        target = goal_data.get("target_description", "")
        target_date = goal_data.get("target_date", "")
        baseline = goal_data.get("baseline_description", "")
        weeks_available = None
        if target_date:
            try:
                td = date.fromisoformat(target_date)
                weeks_available = max(1, (td - date.today()).days // 7)
            except Exception:
                pass
        prompt = f"""You are an expert running and strength coach assessing a fitness goal. Be encouraging and supportive.

CRITICAL RULES:
- Default to "realistic" unless there is a very strong reason otherwise.
- If the user has already completed the distance before (e.g., ran a half marathon before), improving their time is REALISTIC with enough training time.
- A 3-5 minute improvement on a half marathon over 20+ weeks is REALISTIC.
- A 5-10% improvement from baseline is REALISTIC.
- A 10-20% improvement with 20+ weeks is AMBITIOUS at most.
- "unrealistic" is ONLY for physically impossible goals (e.g., sub-60min marathon, couch to ultra in 4 weeks).
- "very_ambitious" is ONLY for extreme transformations (e.g., 2:30 to sub-1:30 half marathon).
- When in doubt, lean toward "realistic" or "ambitious".

Goal: {target}
Baseline: {baseline or 'Not specified'}
Target date: {target_date or 'Open-ended'}
Weeks available: {weeks_available or 'Unlimited'}

Respond in JSON only, no markdown:
{{
  "verdict": "realistic|ambitious|very_ambitious|unrealistic",
  "summary": "2-3 encouraging sentences explaining WHY this verdict and what it takes. Be specific about the path forward.",
  "conditions": ["specific condition 1", "specific condition 2", "specific condition 3"],
  "timeline_weeks_needed": 20,
  "weekly_requirements": {{"run_km": 50, "strength_sessions": 2, "key_workouts": ["long run", "tempo run", "intervals"]}},
  "phases": ["Phase 1 - Base (weeks 1-6): description", "Phase 2 - Build (weeks 7-14): description", "Phase 3 - Peak (weeks 15-20): description"],
  "risk_factors": ["specific risk 1"],
  "roadmap": "A concise 3-4 sentence training roadmap explaining the progression from current fitness to goal. Be specific about weekly mileage targets, key workouts, and race-week strategy."
}}"""
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=MODEL, max_tokens=1200,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Feasibility assessment failed: {e}")
            return {"verdict": "unknown", "summary": str(e)}

    async def get_goals(self, status: str = "active") -> list:
        if not supabase:
            return []
        try:
            result = (
                supabase.table("fitness_goals")
                .select("*")
                .eq("status", status)
                .order("created_at", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get goals: {e}")
            return []

    async def update_goal(self, goal_id: str, data: dict) -> dict:
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("fitness_goals")
                .update(data)
                .eq("id", goal_id)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to update goal: {e}")
            return {}

    # ── Training Plans ─────────────────────────────────────────────────────

    async def get_current_plan(self) -> dict:
        if not supabase:
            return {}
        week_start = date.today() - timedelta(days=date.today().weekday())
        next_week_start = week_start + timedelta(days=7)
        try:
            result = (
                supabase.table("training_plans")
                .select("*")
                .in_("week_start", [week_start.isoformat(), next_week_start.isoformat()])
                .order("week_start")
                .execute()
            )
            if result.data:
                # Merge this week + next week into one plan for the frontend
                this_week = next((r for r in result.data if r["week_start"] == week_start.isoformat()), None)
                next_week = next((r for r in result.data if r["week_start"] == next_week_start.isoformat()), None)
                if this_week:
                    merged_sessions = list(this_week.get("planned_sessions") or [])
                    if next_week:
                        merged_sessions += list(next_week.get("planned_sessions") or [])
                    return {**this_week, "planned_sessions": merged_sessions}
                return result.data[0]
            return await self.generate_training_plan()
        except Exception as e:
            logger.error(f"Failed to get current plan: {e}")
            return {}

    async def generate_training_plan(self, force: bool = False) -> dict:
        if not supabase or not ANTHROPIC_API_KEY:
            return {"error": "Service not configured"}
        goals = await self.get_goals("active")
        if not goals:
            return {"error": "No active goals"}

        week_ago = (date.today() - timedelta(days=14)).isoformat()
        try:
            w_result = (
                supabase.table("workouts")
                .select("date,workout_type,title,completed,intensity,duration_minutes")
                .gte("date", week_ago)
                .order("date", desc=True)
                .execute()
            )
            recent_workouts = w_result.data or []
        except Exception:
            recent_workouts = []

        try:
            equip_result = supabase.table("user_equipment").select("name,category").execute()
            equipment = [e["name"] for e in (equip_result.data or [])]
        except Exception:
            equipment = []

        goals_text = "\n".join([
            f"- [{g['priority'].upper()}] {g['goal_type']}: {g['target_description']}"
            + (f" (by {g['target_date']})" if g.get("target_date") else "")
            for g in goals
        ])
        equip_text = ", ".join(equipment) if equipment else "Standard gym equipment"
        week_start = date.today() - timedelta(days=date.today().weekday())
        next_week_start = week_start + timedelta(days=7)

        # Generate 14 days: this week + next week
        days = [(week_start + timedelta(days=i)).isoformat() for i in range(14)]
        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

        prompt = f"""You are an expert coach. Build a 14-day training plan covering this week and next week.

Goals:
{goals_text}

Available equipment: {equip_text}

Recent 2-week history (completed workouts):
{json.dumps([w for w in recent_workouts if w.get('completed')], indent=2)}

Plan dates: {days[0]} through {days[13]}
Today: {date.today().isoformat()}

CRITICAL RULES:
- Respect recovery: no hard sessions on back-to-back days
- Balance running and strength based on goal priorities
- If primary goal is running_race, max 2 strength sessions/week
- Include at least 1 rest day per week
- EQUIPMENT: For strength sessions, prescribe exercises using the available equipment listed. Do NOT default to bodyweight if equipment is available.
- For each strength session, include 4-6 exercises in targets.exercises with specific sets, reps, and weight guidance.
- The plan must cover ALL 14 days (including rest days).

Respond in JSON only, no markdown:
{{
  "phase": "base|build|peak|taper|maintenance",
  "weekly_run_km_target": 35,
  "weekly_strength_sessions_target": 2,
  "ai_notes": "Brief focus for the coming 2 weeks",
  "sessions": [
    {{
      "date": "{days[0]}",
      "day": "{day_names[0]}",
      "session_type": "easy_run|tempo_run|long_run|interval_run|strength|recovery|rest|cross_train",
      "title": "Easy Run",
      "duration_minutes": 45,
      "description": "Conversational pace, zone 2",
      "targets": {{
        "distance_km": 8,
        "pace_per_km": 6.0,
        "hr_zone": 2,
        "exercises": [
          {{"name": "Barbell Squat", "sets": 4, "reps": "6-8", "notes": "70-80% 1RM"}}
        ]
      }}
    }}
  ]
}}"""

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=MODEL, max_tokens=4000,
                messages=[{"role": "user", "content": prompt}]
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            plan_data = json.loads(raw)

            all_sessions = plan_data.get("sessions", [])
            this_week_sessions = [s for s in all_sessions if s.get("date", "") < next_week_start.isoformat()]
            next_week_sessions = [s for s in all_sessions if s.get("date", "") >= next_week_start.isoformat()]

            base_row = {
                "goal_id": goals[0]["id"],
                "phase": plan_data.get("phase", "base"),
                "weekly_run_km_target": plan_data.get("weekly_run_km_target"),
                "weekly_strength_sessions_target": plan_data.get("weekly_strength_sessions_target"),
                "ai_notes": plan_data.get("ai_notes"),
            }

            supabase.table("training_plans").upsert(
                {**base_row, "week_start": week_start.isoformat(), "planned_sessions": this_week_sessions},
                on_conflict="week_start"
            ).execute()

            if next_week_sessions:
                supabase.table("training_plans").upsert(
                    {**base_row, "week_start": next_week_start.isoformat(), "planned_sessions": next_week_sessions},
                    on_conflict="week_start"
                ).execute()

            return plan_data
        except Exception as e:
            logger.error(f"Training plan generation failed: {e}")
            return {"error": str(e)}

    async def get_plan_history(self, weeks: int = 8) -> list:
        if not supabase:
            return []
        try:
            start = (date.today() - timedelta(weeks=weeks)).isoformat()
            result = (
                supabase.table("training_plans")
                .select("*")
                .gte("week_start", start)
                .order("week_start", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            return []

    # ── Equipment ──────────────────────────────────────────────────────────

    async def get_equipment(self) -> list:
        if not supabase:
            return []
        try:
            result = supabase.table("user_equipment").select("*").order("category").execute()
            return result.data or []
        except Exception:
            return []

    async def add_equipment(self, data: dict) -> dict:
        if not supabase:
            return {}
        try:
            result = supabase.table("user_equipment").insert(data).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            return {"error": str(e)}

    async def delete_equipment(self, equipment_id: str) -> dict:
        if not supabase:
            return {}
        try:
            supabase.table("user_equipment").delete().eq("id", equipment_id).execute()
            return {"status": "deleted"}
        except Exception as e:
            return {"error": str(e)}

    # ── Result Logging ─────────────────────────────────────────────────────

    async def log_sets(self, workout_id: str, sets: list) -> dict:
        if not supabase:
            return {"error": "Database not configured"}
        try:
            # Clear existing sets for this workout before re-saving
            supabase.table("workout_sets").delete().eq("workout_id", workout_id).execute()
            if not sets:
                return {"logged": 0}
            rows = [
                {
                    "workout_id": workout_id,
                    "exercise_name": s.get("exercise_name", ""),
                    "set_number": s.get("set_number", 1),
                    "weight_kg": s.get("weight_kg"),
                    "reps_completed": s.get("reps_completed"),
                    "rpe": s.get("rpe"),
                    "notes": s.get("notes"),
                }
                for s in sets if s.get("exercise_name")
            ]
            result = supabase.table("workout_sets").insert(rows).execute()
            return {"logged": len(result.data or [])}
        except Exception as e:
            logger.error(f"Failed to log sets: {e}")
            return {"error": str(e)}

    async def log_run(self, workout_id: str, run_data: dict) -> dict:
        if not supabase:
            return {"error": "Database not configured"}
        try:
            # Upsert: one run per workout
            supabase.table("run_log").delete().eq("workout_id", workout_id).execute()
            fields = ["distance_km", "duration_minutes", "avg_pace_per_km", "avg_hr",
                      "max_hr", "zone2_pct", "zone3_pct", "zone4_pct", "run_type",
                      "rpe", "notes", "source"]
            row = {"workout_id": workout_id}
            row.update({k: v for k, v in run_data.items() if k in fields})
            result = supabase.table("run_log").insert(row).execute()
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to log run: {e}")
            return {"error": str(e)}

    async def get_sets(self, workout_id: str) -> list:
        if not supabase:
            return []
        try:
            result = (
                supabase.table("workout_sets")
                .select("*")
                .eq("workout_id", workout_id)
                .order("exercise_name")
                .order("set_number")
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    async def get_run(self, workout_id: str) -> dict:
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("run_log")
                .select("*")
                .eq("workout_id", workout_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception:
            return {}

    # ── Progress & Analytics ───────────────────────────────────────────────

    async def get_exercise_progress(self, exercise_name: str, days: int = 90) -> list:
        if not supabase:
            return []
        try:
            start = (date.today() - timedelta(days=days)).isoformat()
            w_result = (
                supabase.table("workouts")
                .select("id,date")
                .gte("date", start)
                .execute()
            )
            workout_map = {w["id"]: w["date"] for w in (w_result.data or [])}
            if not workout_map:
                return []
            sets_result = (
                supabase.table("workout_sets")
                .select("*")
                .ilike("exercise_name", f"%{exercise_name}%")
                .in_("workout_id", list(workout_map.keys()))
                .execute()
            )
            sets = sets_result.data or []
            for s in sets:
                s["date"] = workout_map.get(s["workout_id"], "")
            sets.sort(key=lambda x: (x.get("date", ""), x.get("exercise_name", ""), x.get("set_number", 0)))
            return sets
        except Exception as e:
            logger.error(f"Failed to get exercise progress: {e}")
            return []

    async def get_all_logged_exercises(self) -> list:
        """Return distinct exercise names that have been logged."""
        if not supabase:
            return []
        try:
            result = supabase.table("workout_sets").select("exercise_name").execute()
            names = sorted(set(r["exercise_name"] for r in (result.data or []) if r.get("exercise_name")))
            return names
        except Exception:
            return []

    async def get_running_summary(self, weeks: int = 8) -> dict:
        if not supabase:
            return {"weekly": []}
        try:
            start = (date.today() - timedelta(weeks=weeks)).isoformat()
            result = (
                supabase.table("run_log")
                .select("workout_id,distance_km,run_type,created_at")
                .gte("created_at", start)
                .execute()
            )
            weekly: dict = {}
            for r in (result.data or []):
                if r.get("created_at"):
                    d = date.fromisoformat(r["created_at"][:10])
                    wk = (d - timedelta(days=d.weekday())).isoformat()
                    if wk not in weekly:
                        weekly[wk] = {"km": 0, "runs": 0}
                    weekly[wk]["km"] = round(weekly[wk]["km"] + (r.get("distance_km") or 0), 1)
                    weekly[wk]["runs"] += 1
            return {"weekly": [{"week": k, **v} for k, v in sorted(weekly.items())]}
        except Exception:
            return {"weekly": []}

    async def get_this_week_stats(self) -> dict:
        """Quick stats for FitnessHub: km run, strength sessions, workouts done this week."""
        if not supabase:
            return {"run_km": 0, "strength_sessions": 0, "workouts_done": 0}
        week_start = (date.today() - timedelta(days=date.today().weekday())).isoformat()
        try:
            w_result = (
                supabase.table("workouts")
                .select("id,workout_type,completed")
                .gte("date", week_start)
                .eq("completed", True)
                .execute()
            )
            workouts = w_result.data or []
            workout_ids = [w["id"] for w in workouts]
            strength = sum(1 for w in workouts if w.get("workout_type") == "strength")
            run_km = 0.0
            if workout_ids:
                r_result = (
                    supabase.table("run_log")
                    .select("distance_km")
                    .in_("workout_id", workout_ids)
                    .execute()
                )
                run_km = round(sum((r.get("distance_km") or 0) for r in (r_result.data or [])), 1)
            return {
                "run_km": run_km,
                "strength_sessions": strength,
                "workouts_done": len(workouts),
            }
        except Exception as e:
            logger.error(f"Failed to get week stats: {e}")
            return {"run_km": 0, "strength_sessions": 0, "workouts_done": 0}

    # ── Apple Watch ────────────────────────────────────────────────────────

    async def sync_apple_watch_workouts(self, workouts: list) -> dict:
        if not supabase:
            return {"error": "Database not configured"}
        synced = 0
        for w in workouts:
            try:
                row = {
                    "apple_uuid": w.get("apple_uuid"),
                    "activity_type": w.get("activity_type"),
                    "start_time": w.get("start_time"),
                    "end_time": w.get("end_time"),
                    "duration_minutes": w.get("duration_minutes"),
                    "calories": w.get("calories"),
                    "distance_km": w.get("distance_km"),
                    "avg_hr": w.get("avg_hr"),
                    "max_hr": w.get("max_hr"),
                    "source_app": w.get("source_app"),
                    "date": w.get("date"),
                }
                supabase.table("apple_watch_workouts").upsert(
                    row, on_conflict="apple_uuid"
                ).execute()
                synced += 1
            except Exception as e:
                logger.warning(f"AW workout sync failed: {e}")
        return {"synced": synced}

    async def get_unlinked_apple_watch_workouts(self, for_date: str = None) -> list:
        if not supabase:
            return []
        target = for_date or date.today().isoformat()
        try:
            result = (
                supabase.table("apple_watch_workouts")
                .select("*")
                .eq("date", target)
                .is_("linked_workout_id", "null")
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    async def link_apple_watch_workout(self, aw_id: str, workout_id: str) -> dict:
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("apple_watch_workouts")
                .update({"linked_workout_id": workout_id})
                .eq("id", aw_id)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            return {"error": str(e)}

    async def get_last_sets_for_exercise(self, exercise_name: str) -> list:
        """Return most recent logged sets for an exercise (for progressive overload)."""
        if not supabase:
            return []
        try:
            # Find most recent workout with this exercise
            sets_result = (
                supabase.table("workout_sets")
                .select("*, workouts(date)")
                .ilike("exercise_name", f"%{exercise_name}%")
                .order("created_at", desc=True)
                .limit(20)
                .execute()
            )
            sets = sets_result.data or []
            if not sets:
                return []
            # Get sets from the most recent session only
            latest_workout_id = sets[0].get("workout_id")
            return [s for s in sets if s.get("workout_id") == latest_workout_id]
        except Exception:
            return []


fitness_goals_service = FitnessGoalsService()
