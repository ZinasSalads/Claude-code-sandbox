"""Style & Wardrobe service.

Practical life tool for closet inventory, outfit planning, and occasion awareness.
Weather-integrated outfit suggestions. Wardrobe audit for unused items.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.wardrobe")

MODEL = "claude-sonnet-4-20250514"


class WardrobeService:

    async def get_wardrobe(self, category: str = None) -> list[dict]:
        """Get all active wardrobe items. Filter by category if provided."""
        if not supabase:
            return []
        try:
            query = supabase.table("wardrobe").select("*").eq("active", True)
            if category:
                query = query.eq("category", category)
            result = query.order("category").execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch wardrobe: {e}")
            return []

    async def add_item(self, data: dict) -> dict:
        """Add a wardrobe item."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = supabase.table("wardrobe").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add wardrobe item: {e}")
            return {"error": str(e)}

    async def update_item(self, item_id: str, data: dict) -> dict:
        """Update a wardrobe item."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("wardrobe")
                .update(data)
                .eq("id", item_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update wardrobe item: {e}")
            return {"error": str(e)}

    async def deactivate_item(self, item_id: str) -> dict:
        """Deactivate (soft-delete) a wardrobe item."""
        return await self.update_item(item_id, {"active": False})

    async def get_outfit_suggestion(self, occasion: str = "casual", target_date: date = None) -> dict:
        """Claude generates outfit suggestion based on wardrobe, occasion, weather."""
        items = await self.get_wardrobe()
        if not items:
            return {"message": "Add some wardrobe items first.", "outfit_items": []}

        if not ANTHROPIC_API_KEY:
            return {"message": "AI not configured", "outfit_items": []}

        # Get weather context
        weather_info = ""
        if supabase:
            try:
                env = (
                    supabase.table("environmental_data")
                    .select("temperature, weather_description, uv_index")
                    .order("date", desc=True)
                    .limit(1)
                    .execute()
                )
                if env.data:
                    e = env.data[0]
                    weather_info = f"Weather: {e.get('weather_description', 'unknown')}, {e.get('temperature', 'unknown')}°, UV {e.get('uv_index', 'unknown')}"
            except Exception:
                pass

        # Build wardrobe summary
        wardrobe_summary = json.dumps([
            {
                "id": i["id"],
                "name": i["item_name"],
                "category": i.get("category"),
                "color": i.get("color"),
                "occasion": i.get("occasion", []),
                "season": i.get("season", []),
                "times_worn": i.get("times_worn", 0),
                "last_worn": i.get("last_worn_date"),
            }
            for i in items
        ], default=str)

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=500,
                system=(
                    "You are a personal stylist. Suggest an outfit from the available wardrobe items. "
                    "Prefer items not recently worn (encourage rotation). "
                    "Return ONLY valid JSON: {outfit_items: [{id, name, category}], "
                    "reasoning: str, occasion_fit: str, weather_appropriate: bool, "
                    "alternatives: [{id, name, swap_for}]}"
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Occasion: {occasion}\n"
                        f"{weather_info}\n"
                        f"Date: {(target_date or date.today()).isoformat()}\n"
                        f"Wardrobe:\n{wardrobe_summary}"
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"message": "Failed to parse suggestion", "outfit_items": []}
        except Exception as e:
            logger.error(f"Outfit suggestion failed: {e}")
            return {"message": str(e), "outfit_items": []}

    async def log_outfit(self, outfit_data: dict) -> dict:
        """Log outfit worn today. Increments times_worn on each item."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            row = {
                "log_date": outfit_data.get("log_date", date.today().isoformat()),
                "occasion": outfit_data.get("occasion"),
                "wardrobe_item_ids": outfit_data.get("wardrobe_item_ids", []),
                "rating": outfit_data.get("rating"),
                "notes": outfit_data.get("notes"),
            }
            result = supabase.table("outfit_log").insert(row).execute()

            # Increment times_worn for each item
            for item_id in (outfit_data.get("wardrobe_item_ids") or []):
                try:
                    item = (
                        supabase.table("wardrobe")
                        .select("times_worn")
                        .eq("id", item_id)
                        .limit(1)
                        .execute()
                    )
                    if item.data:
                        new_count = (item.data[0].get("times_worn") or 0) + 1
                        supabase.table("wardrobe").update({
                            "times_worn": new_count,
                            "last_worn_date": row["log_date"],
                        }).eq("id", item_id).execute()
                except Exception as e:
                    logger.warning(f"Failed to update times_worn for {item_id}: {e}")

            return {"status": "ok", "data": result.data[0] if result.data else row}
        except Exception as e:
            logger.error(f"Failed to log outfit: {e}")
            return {"error": str(e)}

    async def get_wardrobe_audit(self) -> dict:
        """Audit report: unused, rarely worn, retire candidates."""
        items = await self.get_wardrobe()
        if not items:
            return {"total_items": 0, "never_worn": [], "rarely_worn": [], "retire_candidates": []}

        never_worn = [i for i in items if (i.get("times_worn") or 0) == 0]
        rarely_worn = [i for i in items if 0 < (i.get("times_worn") or 0) < 3]
        retire = [i for i in items if i.get("condition") in ("fair", "retire")]

        # Claude gap analysis
        gap_analysis = ""
        if ANTHROPIC_API_KEY:
            try:
                categories = {}
                for i in items:
                    cat = i.get("category", "other")
                    categories[cat] = categories.get(cat, 0) + 1

                client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=200,
                    system="You are a wardrobe consultant. In 2-3 sentences, identify gaps in this wardrobe.",
                    messages=[{"role": "user", "content": f"Category breakdown: {json.dumps(categories)}. Total items: {len(items)}."}],
                )
                gap_analysis = response.content[0].text.strip()
            except Exception as e:
                logger.warning(f"Wardrobe gap analysis failed: {e}")

        return {
            "total_items": len(items),
            "never_worn": never_worn,
            "rarely_worn": rarely_worn,
            "retire_candidates": retire,
            "gap_analysis": gap_analysis,
        }

    async def get_tomorrow_suggestion(self) -> dict:
        """Get outfit suggestion for tomorrow."""
        tomorrow = date.today() + timedelta(days=1)
        return await self.get_outfit_suggestion(occasion="casual", target_date=tomorrow)


wardrobe_service = WardrobeService()
