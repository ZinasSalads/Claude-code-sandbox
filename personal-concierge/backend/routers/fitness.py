import json
import logging
from datetime import date, timedelta
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import supabase
from agents.fitness_agent import generate_workout, save_workout
from services.fitness_goals import fitness_goals_service

logger = logging.getLogger("concierge.fitness")
router = APIRouter()


# ── Pydantic models ────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    goal_type: str
    target_description: str
    target_date: Optional[str] = None
    baseline_description: Optional[str] = None
    priority: str = "primary"


class GoalUpdate(BaseModel):
    target_description: Optional[str] = None
    target_date: Optional[str] = None
    baseline_description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class EquipmentCreate(BaseModel):
    name: str
    category: Optional[str] = None
    equipment_type: Optional[str] = None
    notes: Optional[str] = None


class SetLog(BaseModel):
    exercise_name: str
    set_number: int
    weight_kg: Optional[float] = None
    reps_completed: Optional[int] = None
    rpe: Optional[float] = None
    notes: Optional[str] = None


class SetsPayload(BaseModel):
    workout_id: str
    sets: List[SetLog]


class RunPayload(BaseModel):
    workout_id: str
    distance_km: Optional[float] = None
    duration_minutes: Optional[float] = None
    avg_pace_per_km: Optional[float] = None
    avg_hr: Optional[int] = None
    max_hr: Optional[int] = None
    zone2_pct: Optional[float] = None
    zone3_pct: Optional[float] = None
    zone4_pct: Optional[float] = None
    run_type: Optional[str] = None
    rpe: Optional[int] = None
    notes: Optional[str] = None
    source: str = "manual"


class CompleteWorkoutPayload(BaseModel):
    notes: str = ""
    workout_id: Optional[str] = None   # if not provided, finds today's


# ── Today's Workout ────────────────────────────────────────────────────────

@router.get("/today")
async def get_today_workout():
    """Get today's workout. Generates one if none exists."""
    if supabase:
        try:
            result = (
                supabase.table("workouts")
                .select("*")
                .eq("date", date.today().isoformat())
                .eq("recommended_by_ai", True)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if result.data:
                workout = result.data[0]
                if isinstance(workout.get("exercises"), str):
                    try:
                        workout["exercises"] = json.loads(workout["exercises"])
                    except (json.JSONDecodeError, TypeError):
                        pass
                return workout
        except Exception as e:
            logger.error(f"Failed to fetch today's workout: {e}")

    workout = await generate_workout()
    saved = await save_workout(workout)
    return saved


@router.post("/today/regenerate")
async def regenerate_today_workout():
    """Force regenerate today's workout (delete cached and create new)."""
    if supabase:
        try:
            supabase.table("workouts").delete().eq("date", date.today().isoformat()).eq("completed", False).execute()
        except Exception:
            pass
    workout = await generate_workout()
    return await save_workout(workout)


# ── Complete ───────────────────────────────────────────────────────────────

@router.post("/complete")
async def complete_workout(payload: CompleteWorkoutPayload):
    """Mark a workout as completed."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        if payload.workout_id:
            workout_id = payload.workout_id
        else:
            result = (
                supabase.table("workouts")
                .select("id")
                .eq("date", date.today().isoformat())
                .eq("recommended_by_ai", True)
                .eq("completed", False)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if not result.data:
                raise HTTPException(status_code=404, detail="No incomplete workout found for today")
            workout_id = result.data[0]["id"]

        supabase.table("workouts").update({
            "completed": True,
            "completion_notes": payload.notes,
        }).eq("id", workout_id).execute()

        return {"status": "ok", "id": workout_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete workout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Delete ─────────────────────────────────────────────────────────────

@router.delete("/{workout_id}")
async def delete_workout(workout_id: str):
    """Delete a workout and its associated sets and run data."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")
    try:
        supabase.table("workout_sets").delete().eq("workout_id", workout_id).execute()
        supabase.table("run_log").delete().eq("workout_id", workout_id).execute()
        supabase.table("workouts").delete().eq("id", workout_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        logger.error(f"Failed to delete workout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── History ────────────────────────────────────────────────────────────────

@router.get("/history")
async def get_workout_history(days: int = 30):
    """Get workout history with run data and set summaries."""
    if not supabase:
        return []
    try:
        start = (date.today() - timedelta(days=days)).isoformat()
        result = (
            supabase.table("workouts")
            .select("*")
            .gte("date", start)
            .order("date", desc=True)
            .execute()
        )
        workouts = result.data or []
        for w in workouts:
            if isinstance(w.get("exercises"), str):
                try:
                    w["exercises"] = json.loads(w["exercises"])
                except (json.JSONDecodeError, TypeError):
                    pass
        return workouts
    except Exception as e:
        logger.error(f"Failed to fetch workout history: {e}")
        return []


# ── Goals ──────────────────────────────────────────────────────────────────

@router.get("/goals")
async def get_goals(status: str = "active"):
    return await fitness_goals_service.get_goals(status)


@router.post("/goals")
async def create_goal(data: GoalCreate):
    return await fitness_goals_service.create_goal(data.model_dump(exclude_none=True))


@router.put("/goals/{goal_id}")
async def update_goal(goal_id: str, data: GoalUpdate):
    return await fitness_goals_service.update_goal(goal_id, data.model_dump(exclude_none=True))


# ── Training Plan ──────────────────────────────────────────────────────────

@router.get("/plan/current")
async def get_current_plan():
    return await fitness_goals_service.get_current_plan()


@router.post("/plan/generate")
async def generate_plan():
    return await fitness_goals_service.generate_training_plan(force=True)


@router.get("/plan/history")
async def get_plan_history(weeks: int = 8):
    return await fitness_goals_service.get_plan_history(weeks)


# ── Equipment ──────────────────────────────────────────────────────────────

@router.get("/equipment")
async def get_equipment():
    return await fitness_goals_service.get_equipment()


@router.post("/equipment")
async def add_equipment(data: EquipmentCreate):
    return await fitness_goals_service.add_equipment(data.model_dump(exclude_none=True))


@router.delete("/equipment/{equipment_id}")
async def delete_equipment(equipment_id: str):
    return await fitness_goals_service.delete_equipment(equipment_id)


# ── Result Logging ─────────────────────────────────────────────────────────

@router.post("/sets")
async def log_sets(payload: SetsPayload):
    return await fitness_goals_service.log_sets(
        payload.workout_id,
        [s.model_dump(exclude_none=True) for s in payload.sets]
    )


@router.get("/sets/{workout_id}")
async def get_sets(workout_id: str):
    return await fitness_goals_service.get_sets(workout_id)


@router.post("/run")
async def log_run(payload: RunPayload):
    data = payload.model_dump(exclude_none=True)
    workout_id = data.pop("workout_id")
    return await fitness_goals_service.log_run(workout_id, data)


@router.get("/run/{workout_id}")
async def get_run(workout_id: str):
    return await fitness_goals_service.get_run(workout_id)


# ── Progress & Analytics ───────────────────────────────────────────────────

@router.get("/progress/{exercise_name}")
async def get_exercise_progress(exercise_name: str, days: int = 90):
    return await fitness_goals_service.get_exercise_progress(exercise_name, days)


@router.get("/exercises/logged")
async def get_logged_exercises():
    """List of all exercises the user has logged (for autocomplete)."""
    return await fitness_goals_service.get_all_logged_exercises()


@router.get("/running/summary")
async def get_running_summary(weeks: int = 8):
    return await fitness_goals_service.get_running_summary(weeks)


@router.get("/stats/week")
async def get_week_stats():
    return await fitness_goals_service.get_this_week_stats()


# ── Apple Watch ────────────────────────────────────────────────────────────

@router.get("/apple-watch")
async def get_unlinked_apple_watch(date_str: Optional[str] = None):
    return await fitness_goals_service.get_unlinked_apple_watch_workouts(date_str)


@router.post("/apple-watch/link")
async def link_apple_watch(aw_id: str, workout_id: str):
    return await fitness_goals_service.link_apple_watch_workout(aw_id, workout_id)


# ── Fitness Profile Settings ───────────────────────────────────────────────

class FitnessProfileSettings(BaseModel):
    age: Optional[int] = None
    gender: Optional[str] = None
    max_hr: Optional[int] = None
    weight_kg: Optional[float] = None
    one_rep_maxes: Optional[dict] = None


@router.get("/profile-settings")
async def get_fitness_profile_settings():
    """Get fitness profile settings (age, gender, max HR, 1RM)."""
    if not supabase:
        return {}
    try:
        result = (
            supabase.table("life_profile")
            .select("value")
            .eq("key", "fitness_profile_settings")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0].get("value", {})
        return {}
    except Exception as e:
        logger.error(f"Failed to get fitness profile settings: {e}")
        return {}


@router.post("/profile-settings")
async def save_fitness_profile_settings(settings: FitnessProfileSettings):
    """Save fitness profile settings."""
    if not supabase:
        return {"error": "Supabase not configured"}
    try:
        data = {k: v for k, v in settings.model_dump().items() if v is not None}
        supabase.table("life_profile").upsert(
            {"key": "fitness_profile_settings", "value": data},
            on_conflict="key"
        ).execute()
        return {"success": True, **data}
    except Exception as e:
        logger.error(f"Failed to save fitness profile settings: {e}")
        return {"error": str(e)}
