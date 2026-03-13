"""Travel intelligence service.

Pre-trip: supplement travel stack, jet lag plan, workout continuity, destination environment.
During trip: daily check-in, local suggestions, budget tracking.
Post-trip: recovery protocol, nutrition reset, reflection.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.travel")

MODEL = "claude-sonnet-4-20250514"


class TravelService:

    async def get_upcoming_trips(self) -> list[dict]:
        """Get all trips with status='upcoming', sorted by departure_date."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("trips")
                .select("*")
                .eq("status", "upcoming")
                .order("departure_date")
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch upcoming trips: {e}")
            return []

    async def get_all_trips(self) -> list[dict]:
        """Get all trips."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("trips")
                .select("*")
                .order("departure_date", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch trips: {e}")
            return []

    async def get_trip(self, trip_id: str) -> Optional[dict]:
        """Get a single trip by ID."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("trips")
                .select("*")
                .eq("id", trip_id)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to fetch trip {trip_id}: {e}")
            return None

    async def create_trip(self, trip_data: dict) -> dict:
        """Create a new trip."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = supabase.table("trips").insert(trip_data).execute()
            return result.data[0] if result.data else trip_data
        except Exception as e:
            logger.error(f"Failed to create trip: {e}")
            return {"error": str(e)}

    async def update_trip(self, trip_id: str, data: dict) -> dict:
        """Update a trip."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("trips")
                .update(data)
                .eq("id", trip_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update trip {trip_id}: {e}")
            return {"error": str(e)}

    async def generate_pre_trip_plan(self, trip_id: str) -> dict:
        """Generate a comprehensive pre-trip preparation plan."""
        trip = await self.get_trip(trip_id)
        if not trip:
            return {"error": "Trip not found"}
        if not ANTHROPIC_API_KEY:
            return {"error": "AI not configured"}

        # Gather user context
        context_parts = [
            f"Destination: {trip['destination']}",
            f"Dates: {trip['departure_date']} to {trip['return_date']}",
            f"Trip type: {trip.get('trip_type', 'leisure')}",
            f"Companions: {trip.get('travel_companions', 'solo')}",
        ]

        if supabase:
            try:
                supps = (
                    supabase.table("supplements")
                    .select("name, dose_amount, dose_unit, timing")
                    .eq("active", True)
                    .execute()
                )
                if supps.data:
                    context_parts.append(f"Current supplement stack: {json.dumps(supps.data)}")
            except Exception:
                pass

        context = "\n".join(context_parts)

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                system=(
                    "You are a personal health concierge preparing a client for travel. "
                    "Generate a comprehensive pre-trip plan. Return ONLY valid JSON with these keys: "
                    "supplement_travel_stack (list of supplements to pack with dosing), "
                    "jet_lag_plan (object with adjustment_days and daily_steps list), "
                    "workout_plan (object with hotel_gym_routine and outdoor_options), "
                    "packing_health_checklist (list of health items to pack), "
                    "food_strategy (string with nutrition approach), "
                    "health_safety_notes (string with destination-specific health notes)."
                ),
                messages=[{"role": "user", "content": context}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"error": "Failed to parse AI response", "raw": raw}
        except Exception as e:
            logger.error(f"Pre-trip plan generation failed: {e}")
            return {"error": str(e)}

    async def get_active_trip(self) -> Optional[dict]:
        """Get the currently active trip if today is between departure and return."""
        if not supabase:
            return None
        try:
            today = date.today().isoformat()
            result = (
                supabase.table("trips")
                .select("*")
                .lte("departure_date", today)
                .gte("return_date", today)
                .limit(1)
                .execute()
            )
            if result.data:
                trip = result.data[0]
                # Auto-update status to active
                if trip.get("status") != "active":
                    supabase.table("trips").update({"status": "active"}).eq("id", trip["id"]).execute()
                    trip["status"] = "active"
                return trip
            return None
        except Exception as e:
            logger.error(f"Failed to check active trip: {e}")
            return None

    async def daily_travel_check_in(self, trip_id: str, data: dict) -> dict:
        """Process travel daily check-in."""
        if not supabase:
            return {"error": "Database not configured"}

        try:
            row = {
                "trip_id": trip_id,
                "log_date": date.today().isoformat(),
                "workout_done": data.get("workout_done", False),
                "workout_notes": data.get("workout_notes"),
                "nutrition_quality": data.get("nutrition_quality"),
                "sleep_quality": data.get("sleep_quality"),
                "mood_score": data.get("mood_score"),
                "highlights": data.get("highlights"),
            }
            result = (
                supabase.table("trip_logs")
                .upsert(row, on_conflict="trip_id,log_date")
                .execute()
            )
            return {
                "status": "ok",
                "data": result.data[0] if result.data else row,
            }
        except Exception as e:
            logger.error(f"Failed to save travel check-in: {e}")
            return {"error": str(e)}

    async def generate_post_trip_protocol(self, trip_id: str) -> dict:
        """Generate return-to-baseline protocol after a trip."""
        trip = await self.get_trip(trip_id)
        if not trip:
            return {"error": "Trip not found"}
        if not ANTHROPIC_API_KEY:
            return {"error": "AI not configured"}

        # Get trip logs
        logs = []
        if supabase:
            try:
                result = (
                    supabase.table("trip_logs")
                    .select("*")
                    .eq("trip_id", trip_id)
                    .order("log_date")
                    .execute()
                )
                logs = result.data or []
            except Exception:
                pass

        context = (
            f"Trip: {trip['destination']}, {trip['departure_date']} to {trip['return_date']}\n"
            f"Type: {trip.get('trip_type', 'leisure')}\n"
            f"Daily logs: {json.dumps(logs) if logs else 'No logs recorded'}"
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=1000,
                system=(
                    "You are a health concierge creating a post-trip recovery protocol. "
                    "Return ONLY valid JSON with: "
                    "recovery_days (int), daily_plan (list of day objects with day_number, focus, workout, nutrition, sleep_tip), "
                    "supplement_adjustments (list), overall_strategy (string)."
                ),
                messages=[{"role": "user", "content": context}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"error": "Failed to parse AI response"}
        except Exception as e:
            logger.error(f"Post-trip protocol generation failed: {e}")
            return {"error": str(e)}

    async def get_local_suggestions(self, trip_id: str, suggestion_type: str) -> list:
        """Get local suggestions for restaurants, workouts, or activities."""
        trip = await self.get_trip(trip_id)
        if not trip:
            return []
        if not ANTHROPIC_API_KEY:
            return [{"name": "AI not configured", "description": "Set ANTHROPIC_API_KEY"}]

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                system=(
                    f"You are a local concierge in {trip['destination']}. "
                    f"Suggest 5 {suggestion_type} options. "
                    f"Trip type: {trip.get('trip_type', 'leisure')}, companions: {trip.get('travel_companions', 'solo')}. "
                    "Return ONLY a JSON array of objects with: name, description, why_recommended."
                ),
                messages=[{"role": "user", "content": f"Suggest {suggestion_type} in {trip['destination']}"}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Local suggestions failed: {e}")
            return []


travel_service = TravelService()
