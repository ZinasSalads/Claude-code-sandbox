import json
import logging
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException

from config import supabase
from agents.fitness_agent import generate_workout, save_workout

logger = logging.getLogger("concierge.fitness")
router = APIRouter()


@router.get("/today")
async def get_today_workout():
    """Get today's workout recommendation. Generates one if none exists."""
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


@router.post("/complete")
async def complete_workout(notes: str = ""):
    """Mark today's workout as completed."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
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
            "completion_notes": notes,
        }).eq("id", workout_id).execute()

        return {"status": "ok", "message": "Workout marked as completed!", "id": workout_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to complete workout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_workout_history(days: int = 14):
    """Get recent workout history."""
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
