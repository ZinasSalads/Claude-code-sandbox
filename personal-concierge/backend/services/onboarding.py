"""Progressive onboarding service.

14-step guided setup. Resumable — never forces all at once.
After step 4 (oura_sync), the app is fully functional.
Remaining steps enhance progressively via banner nudges.
"""

import logging
from datetime import datetime, timezone

from config import supabase

logger = logging.getLogger("concierge.onboarding")

ONBOARDING_STEPS = [
    "welcome", "personality", "health_basics", "oura_sync",
    "fitness_profile", "nutrition_profile", "supplement_stack",
    "social_circle", "growth_habits", "career_basics",
    "financial_context", "wardrobe_starter", "legacy_vision", "complete",
]

STEP_CONTENT = {
    "welcome": {
        "title": "Welcome to Your Concierge",
        "description": "Your personal AI concierge for health, habits, and life optimization. Let's set things up so every recommendation is tailored to you.",
        "skip_allowed": False,
        "fields": [],
    },
    "personality": {
        "title": "Personality Assessment",
        "description": "A 10-minute assessment that personalizes your coaching style, suggestions, and communication preferences.",
        "skip_allowed": True,
        "fields": [{"key": "completed", "type": "action", "label": "Take Assessment"}],
    },
    "health_basics": {
        "title": "Health Basics",
        "description": "Core health info that powers all fitness and nutrition recommendations.",
        "skip_allowed": False,
        "fields": [
            {"key": "age", "type": "number", "label": "Age"},
            {"key": "height_cm", "type": "number", "label": "Height (cm)"},
            {"key": "weight_kg", "type": "number", "label": "Weight (kg)"},
            {"key": "biological_sex", "type": "select", "label": "Biological Sex", "options": ["male", "female"]},
            {"key": "primary_goal", "type": "select", "label": "Primary Health Goal", "options": [
                "general_wellness", "weight_loss", "muscle_gain", "endurance",
                "longevity", "stress_reduction", "better_sleep",
            ]},
        ],
    },
    "oura_sync": {
        "title": "Connect Oura Ring",
        "description": "Sync your Oura data for daily readiness, sleep, and HRV tracking. This powers intelligent daily recommendations.",
        "skip_allowed": True,
        "fields": [{"key": "synced", "type": "action", "label": "Sync Oura Data"}],
    },
    "fitness_profile": {
        "title": "Fitness Profile",
        "description": "Tell us about your fitness level and preferences for personalized workout plans.",
        "skip_allowed": True,
        "fields": [
            {"key": "fitness_level", "type": "select", "label": "Fitness Level", "options": [
                "beginner", "intermediate", "advanced",
            ]},
            {"key": "workout_preferences", "type": "multiselect", "label": "Preferred Workouts", "options": [
                "strength", "cardio", "yoga", "HIIT", "running", "swimming", "cycling", "martial_arts",
            ]},
            {"key": "equipment_available", "type": "multiselect", "label": "Available Equipment", "options": [
                "full_gym", "dumbbells", "resistance_bands", "pull_up_bar", "none",
            ]},
            {"key": "weekly_workout_days", "type": "number", "label": "Workout Days Per Week"},
        ],
    },
    "nutrition_profile": {
        "title": "Nutrition Preferences",
        "description": "Dietary preferences and restrictions for personalized meal plans.",
        "skip_allowed": True,
        "fields": [
            {"key": "diet_type", "type": "select", "label": "Diet Type", "options": [
                "no_restriction", "vegetarian", "vegan", "keto", "paleo", "mediterranean",
            ]},
            {"key": "allergies", "type": "text", "label": "Food Allergies (comma-separated)"},
            {"key": "meal_prep_comfort", "type": "select", "label": "Cooking Comfort", "options": [
                "love_cooking", "can_cook", "basic_meals", "prefer_simple",
            ]},
            {"key": "daily_meals", "type": "number", "label": "Meals Per Day"},
        ],
    },
    "supplement_stack": {
        "title": "Current Supplements",
        "description": "Enter any supplements you're currently taking. We'll track timing and interactions.",
        "skip_allowed": True,
        "fields": [{"key": "supplements", "type": "text", "label": "List your supplements (one per line)"}],
    },
    "social_circle": {
        "title": "Social Circle",
        "description": "Add 3-5 important people. We'll help you maintain those connections.",
        "skip_allowed": True,
        "fields": [
            {"key": "contacts", "type": "list", "label": "Important People", "item_fields": [
                {"key": "name", "type": "text", "label": "Name"},
                {"key": "relationship", "type": "select", "label": "Relationship", "options": [
                    "partner", "family", "close_friend", "mentor", "colleague",
                ]},
            ]},
        ],
    },
    "growth_habits": {
        "title": "Starter Habits",
        "description": "Choose 1-3 micro-habits to start your 1% growth journey.",
        "skip_allowed": True,
        "fields": [{"key": "selected_habits", "type": "action", "label": "Choose Habits"}],
    },
    "career_basics": {
        "title": "Career Profile",
        "description": "Basic career info for burnout monitoring and professional coaching.",
        "skip_allowed": True,
        "fields": [
            {"key": "role_title", "type": "text", "label": "Current Role"},
            {"key": "industry", "type": "text", "label": "Industry"},
            {"key": "top_career_goal", "type": "text", "label": "Top Career Goal"},
        ],
    },
    "financial_context": {
        "title": "Financial Context",
        "description": "Helps us tailor recommendations to your budget. Entirely optional.",
        "skip_allowed": True,
        "fields": [
            {"key": "city", "type": "text", "label": "City"},
            {"key": "budget_tier", "type": "select", "label": "Lifestyle Budget", "options": [
                "budget", "moderate", "comfortable", "premium",
            ]},
        ],
    },
    "wardrobe_starter": {
        "title": "Wardrobe Starter",
        "description": "Add 5 items to start getting outfit suggestions.",
        "skip_allowed": True,
        "fields": [{"key": "items", "type": "action", "label": "Add Wardrobe Items"}],
    },
    "legacy_vision": {
        "title": "10-Year Vision",
        "description": "One paragraph about where you want to be in 10 years. Anchors every daily decision.",
        "skip_allowed": True,
        "fields": [{"key": "vision", "type": "textarea", "label": "Your 10-Year Vision"}],
    },
    "complete": {
        "title": "Setup Complete!",
        "description": "Your app is now fully personalized. Every recommendation is tailored to you.",
        "skip_allowed": False,
        "fields": [],
    },
}


class OnboardingService:

    async def get_status(self) -> dict:
        """Get onboarding completion status."""
        if not supabase:
            return {
                "total_steps": len(ONBOARDING_STEPS),
                "completed_steps": 0,
                "completion_percent": 0,
                "next_step": "welcome",
                "skipped_steps": [],
                "is_complete": False,
            }

        try:
            result = supabase.table("onboarding").select("*").execute()
            rows = {r["step_name"]: r for r in (result.data or [])}

            completed = [s for s in ONBOARDING_STEPS if rows.get(s, {}).get("completed")]
            skipped = [s for s in ONBOARDING_STEPS if rows.get(s, {}).get("skipped")]
            done_or_skipped = set(completed) | set(skipped)

            next_step = None
            for s in ONBOARDING_STEPS:
                if s not in done_or_skipped:
                    next_step = s
                    break

            total = len(ONBOARDING_STEPS)
            completed_count = len(completed)

            return {
                "total_steps": total,
                "completed_steps": completed_count,
                "completion_percent": round(completed_count / total * 100, 1),
                "next_step": next_step,
                "skipped_steps": skipped,
                "is_complete": next_step is None,
            }
        except Exception as e:
            logger.error(f"Failed to get onboarding status: {e}")
            return {
                "total_steps": len(ONBOARDING_STEPS),
                "completed_steps": 0,
                "completion_percent": 0,
                "next_step": "welcome",
                "skipped_steps": [],
                "is_complete": False,
            }

    async def get_all_steps(self) -> list[dict]:
        """Get all steps with their status."""
        if not supabase:
            return [
                {"step_name": s, "completed": False, "skipped": False, "index": i}
                for i, s in enumerate(ONBOARDING_STEPS)
            ]

        try:
            result = supabase.table("onboarding").select("*").execute()
            rows = {r["step_name"]: r for r in (result.data or [])}

            steps = []
            for i, s in enumerate(ONBOARDING_STEPS):
                row = rows.get(s, {})
                steps.append({
                    "step_name": s,
                    "index": i,
                    "completed": row.get("completed", False),
                    "skipped": row.get("skipped", False),
                    "completed_at": row.get("completed_at"),
                    "title": STEP_CONTENT.get(s, {}).get("title", s),
                })
            return steps
        except Exception as e:
            logger.error(f"Failed to get steps: {e}")
            return []

    async def get_step_content(self, step_name: str) -> dict:
        """Get content/fields for a step."""
        content = STEP_CONTENT.get(step_name)
        if not content:
            return {"error": f"Unknown step: {step_name}"}

        idx = ONBOARDING_STEPS.index(step_name) if step_name in ONBOARDING_STEPS else -1
        return {
            "step_name": step_name,
            "index": idx,
            "total_steps": len(ONBOARDING_STEPS),
            **content,
        }

    async def complete_step(self, step_name: str, data: dict = None) -> dict:
        """Mark step complete with captured data."""
        if step_name not in ONBOARDING_STEPS:
            return {"error": f"Unknown step: {step_name}"}

        if not supabase:
            return {"status": "ok", "next_step": self._next_step(step_name)}

        try:
            row = {
                "step_name": step_name,
                "completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "skipped": False,
                "data": data or {},
            }
            supabase.table("onboarding").upsert(row, on_conflict="step_name").execute()

            # Seed data based on step
            if data:
                await self._seed_from_step(step_name, data)

            next_step = self._next_step(step_name)
            status = await self.get_status()

            result = {"status": "ok", "next_step": next_step, **status}

            # Celebration messages at milestones
            completed = status.get("completed_steps", 0)
            if completed == 4:
                result["celebration"] = "Core setup complete! Your app is now fully functional."
            elif completed == 7:
                result["celebration"] = "Halfway there! Your recommendations are getting smarter."
            elif completed >= len(ONBOARDING_STEPS) - 1:
                result["celebration"] = "Setup complete! Every recommendation is now personalized to you."

            return result
        except Exception as e:
            logger.error(f"Failed to complete step {step_name}: {e}")
            return {"error": str(e)}

    async def skip_step(self, step_name: str) -> dict:
        """Skip a step."""
        if step_name not in ONBOARDING_STEPS:
            return {"error": f"Unknown step: {step_name}"}

        content = STEP_CONTENT.get(step_name, {})
        if not content.get("skip_allowed", True):
            return {"error": "This step cannot be skipped"}

        if not supabase:
            return {"status": "skipped", "next_step": self._next_step(step_name)}

        try:
            row = {
                "step_name": step_name,
                "completed": False,
                "skipped": True,
            }
            supabase.table("onboarding").upsert(row, on_conflict="step_name").execute()

            next_step = self._next_step(step_name)
            return {"status": "skipped", "next_step": next_step}
        except Exception as e:
            logger.error(f"Failed to skip step: {e}")
            return {"error": str(e)}

    async def seed_suggested_habits(self) -> list[dict]:
        """Generate 5 starter habit suggestions."""
        suggestions = [
            {"name": "Morning Hydration", "category": "health", "description": "Drink a full glass of water within 5 minutes of waking", "micro_win_message": "Hydrated and ready!"},
            {"name": "5-Min Meditation", "category": "mindset", "description": "5 minutes of guided or silent meditation", "micro_win_message": "Mind clear, day ready."},
            {"name": "Daily Walk", "category": "health", "description": "10-minute walk, any time of day", "micro_win_message": "Steps in, mood up!"},
            {"name": "Gratitude Note", "category": "mindset", "description": "Write one thing you're grateful for", "micro_win_message": "Perspective gained."},
            {"name": "Read 10 Pages", "category": "skill", "description": "Read 10 pages of any book", "micro_win_message": "Knowledge growing!"},
        ]
        return suggestions

    def _next_step(self, current: str) -> str | None:
        """Get next step after current."""
        try:
            idx = ONBOARDING_STEPS.index(current)
            if idx + 1 < len(ONBOARDING_STEPS):
                return ONBOARDING_STEPS[idx + 1]
        except ValueError:
            pass
        return None

    async def _seed_from_step(self, step_name: str, data: dict):
        """Seed module data from onboarding step."""
        if not supabase:
            return

        try:
            if step_name == "health_basics":
                # Update life_profile with health basics
                profile_data = {
                    "age": data.get("age"),
                    "height_cm": data.get("height_cm"),
                    "weight_kg": data.get("weight_kg"),
                    "biological_sex": data.get("biological_sex"),
                    "primary_goal": data.get("primary_goal"),
                }
                existing = supabase.table("life_profile").select("id").limit(1).execute()
                if existing.data:
                    supabase.table("life_profile").update(profile_data).eq("id", existing.data[0]["id"]).execute()
                else:
                    supabase.table("life_profile").insert(profile_data).execute()

            elif step_name == "career_basics":
                career_data = {
                    "role_title": data.get("role_title"),
                    "industry": data.get("industry"),
                    "career_goals": [data.get("top_career_goal")] if data.get("top_career_goal") else [],
                }
                existing = supabase.table("career_profile").select("id").limit(1).execute()
                if existing.data:
                    supabase.table("career_profile").update(career_data).eq("id", existing.data[0]["id"]).execute()
                else:
                    supabase.table("career_profile").insert(career_data).execute()

            elif step_name == "financial_context":
                fin_data = {
                    "city_tier": data.get("city"),
                    "socioeconomic_tier": data.get("budget_tier"),
                }
                existing = supabase.table("financial_context").select("id").limit(1).execute()
                if existing.data:
                    supabase.table("financial_context").update(fin_data).eq("id", existing.data[0]["id"]).execute()
                else:
                    supabase.table("financial_context").insert(fin_data).execute()

            elif step_name == "supplement_stack":
                raw = data.get("supplements", "")
                if raw:
                    lines = [s.strip() for s in raw.split("\n") if s.strip()]
                    for name in lines:
                        existing = supabase.table("supplements").select("id").eq("name", name).limit(1).execute()
                        if not existing.data:
                            supabase.table("supplements").insert({
                                "name": name,
                                "active": True,
                                "timing": "morning",
                            }).execute()

        except Exception as e:
            logger.error(f"Failed to seed data from {step_name}: {e}")


onboarding_service = OnboardingService()
