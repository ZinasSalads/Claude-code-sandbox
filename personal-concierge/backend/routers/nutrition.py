import json
import logging
from datetime import date

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import supabase
from agents.nutrition_agent import generate_meal_plan, save_meal_plan

logger = logging.getLogger("concierge.nutrition")
router = APIRouter()


@router.get("/today")
async def get_today_meals():
    """Get today's meal plan. Generates one if none exists."""
    if supabase:
        try:
            result = (
                supabase.table("meals")
                .select("*")
                .eq("date", date.today().isoformat())
                .order("created_at")
                .execute()
            )
            if result.data:
                meals = result.data
                for m in meals:
                    if isinstance(m.get("ingredients"), str):
                        try:
                            m["ingredients"] = json.loads(m["ingredients"])
                        except (json.JSONDecodeError, TypeError):
                            pass
                # Reconstruct the meal plan shape
                total_cal = sum(m.get("calories") or 0 for m in meals)
                total_protein = sum(m.get("protein_g") or 0 for m in meals)
                total_carbs = sum(m.get("carbs_g") or 0 for m in meals)
                total_fat = sum(m.get("fat_g") or 0 for m in meals)
                return {
                    "daily_targets": {
                        "calories": total_cal,
                        "protein": total_protein,
                        "carbs": total_carbs,
                        "fat": total_fat,
                    },
                    "meals": meals,
                    "ai_reasoning": meals[0].get("ai_reasoning") if meals else "",
                }
        except Exception as e:
            logger.error(f"Failed to fetch today's meals: {e}")

    meal_plan = await generate_meal_plan()
    await save_meal_plan(meal_plan)
    return meal_plan


class LogMealRequest(BaseModel):
    meal_id: str


@router.post("/log")
async def log_meal(req: LogMealRequest):
    """Log a meal as eaten."""
    if not supabase:
        raise HTTPException(status_code=503, detail="Supabase not configured")

    try:
        result = (
            supabase.table("meals")
            .update({"logged": True})
            .eq("id", req.meal_id)
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Meal not found")
        return {"status": "ok", "message": "Meal logged"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to log meal: {e}")
        raise HTTPException(status_code=500, detail=str(e))
