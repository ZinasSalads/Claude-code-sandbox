"""Feedback & preference learning engine.

Rating model:
  loved_it   → +2 (add to rotation, weight up similar attributes)
  it_was_fine → +1 (neutral, keep in rotation)
  not_for_me  → -2 (remove from suggestions, weight down attributes)

Threshold logic:
  3 loved_it for same attribute → lock into regular rotation
  3 not_for_me for same attribute → remove from suggestions
  1 month of no ratings → surprise mode triggers
"""

import json
import logging
from datetime import date, timedelta

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.learning_engine")

MODEL = "claude-sonnet-4-20250514"


class LearningEngine:

    async def log_rating(self, category: str, item_id: str,
                         item_description: str, rating: str,
                         explicit_feedback: str = None) -> dict:
        """Log a preference rating."""
        if rating not in ("loved_it", "it_was_fine", "not_for_me"):
            return {"error": "Invalid rating. Use: loved_it, it_was_fine, not_for_me"}

        if not supabase:
            return {"logged": True, "pattern_updated": False, "insight": None}

        try:
            row = {
                "category": category,
                "item_id": item_id,
                "item_description": item_description,
                "rating": rating,
                "explicit_feedback": explicit_feedback,
            }
            supabase.table("preference_ratings").insert(row).execute()

            # Check if we should update patterns (every 3 ratings)
            count = (
                supabase.table("preference_ratings")
                .select("id", count="exact")
                .eq("category", category)
                .execute()
            )
            total = count.count or 0

            pattern_updated = False
            insight = None
            if total % 3 == 0:
                await self.update_patterns(category)
                pattern_updated = True
                insight = f"Preference pattern updated for {category} after {total} ratings."

            return {"logged": True, "pattern_updated": pattern_updated, "insight": insight}
        except Exception as e:
            logger.error(f"Failed to log rating: {e}")
            return {"logged": False, "error": str(e)}

    async def update_patterns(self, category: str) -> dict:
        """Recalculate preference patterns for a category."""
        if not supabase:
            return {}

        try:
            result = (
                supabase.table("preference_ratings")
                .select("*")
                .eq("category", category)
                .order("created_at", desc=True)
                .limit(50)
                .execute()
            )
            ratings = result.data or []

            if not ratings:
                return {}

            loved = [r for r in ratings if r["rating"] == "loved_it"]
            disliked = [r for r in ratings if r["rating"] == "not_for_me"]
            neutral = [r for r in ratings if r["rating"] == "it_was_fine"]

            if ANTHROPIC_API_KEY and len(ratings) >= 3:
                patterns = await self._extract_patterns_claude(category, loved, disliked, neutral)
            else:
                patterns = self._extract_patterns_simple(category, loved, disliked, neutral)

            # Save patterns
            row = {
                "category": category,
                "liked_attributes": patterns.get("liked", {}),
                "disliked_attributes": patterns.get("disliked", {}),
                "neutral_attributes": patterns.get("neutral", {}),
                "surprise_mode_due": (date.today() + timedelta(days=30)).isoformat(),
            }
            supabase.table("preference_patterns").upsert(row, on_conflict="category").execute()

            return patterns
        except Exception as e:
            logger.error(f"Pattern update failed: {e}")
            return {}

    async def _extract_patterns_claude(self, category: str, loved: list, disliked: list, neutral: list) -> dict:
        """Use Claude to extract attribute patterns from ratings."""
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

            loved_desc = [r.get("item_description", "") for r in loved[:10]]
            disliked_desc = [r.get("item_description", "") for r in disliked[:10]]

            response = client.messages.create(
                model=MODEL,
                max_tokens=400,
                system=(
                    f"You are analyzing preference patterns for the category '{category}'. "
                    "Extract common attributes from liked vs disliked items. "
                    "Return ONLY valid JSON: "
                    "{liked: {attribute_type: [values]}, disliked: {attribute_type: [values]}, neutral: {}}"
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Loved items: {json.dumps(loved_desc)}\n"
                        f"Disliked items: {json.dumps(disliked_desc)}\n"
                        "Extract the common attributes."
                    ),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Claude pattern extraction failed: {e}")
            return self._extract_patterns_simple("", loved, disliked, neutral)

    def _extract_patterns_simple(self, category: str, loved: list, disliked: list, neutral: list) -> dict:
        """Simple keyword-based pattern extraction."""
        liked_items = [r.get("item_description", "") for r in loved]
        disliked_items = [r.get("item_description", "") for r in disliked]

        return {
            "liked": {"items": liked_items[:5]},
            "disliked": {"items": disliked_items[:5]},
            "neutral": {"count": len(neutral)},
        }

    async def get_patterns(self, category: str = None) -> dict:
        """Get preference patterns."""
        if not supabase:
            return {}

        try:
            query = supabase.table("preference_patterns").select("*")
            if category:
                query = query.eq("category", category)
            result = query.execute()

            if category:
                return result.data[0] if result.data else {}
            return {r["category"]: r for r in (result.data or [])}
        except Exception as e:
            logger.error(f"Failed to get patterns: {e}")
            return {}

    async def filter_suggestions(self, suggestions: list, category: str) -> list:
        """Re-rank suggestions based on learned preferences."""
        patterns = await self.get_patterns(category)
        if not patterns or not patterns.get("liked_attributes"):
            return suggestions

        liked = patterns.get("liked_attributes", {})
        disliked = patterns.get("disliked_attributes", {})

        # Simple scoring: +1 for liked attribute match, -1 for disliked
        scored = []
        for s in suggestions:
            desc = str(s).lower()
            score = 0
            for attrs in liked.values():
                if isinstance(attrs, list):
                    score += sum(1 for a in attrs if a.lower() in desc)
            for attrs in disliked.values():
                if isinstance(attrs, list):
                    score -= sum(1 for a in attrs if a.lower() in desc)
            scored.append((score, s))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [s for _, s in scored]

    async def check_surprise_mode(self, category: str) -> bool:
        """Check if it's time to suggest something outside comfort zone."""
        if not supabase:
            return False

        try:
            result = (
                supabase.table("preference_patterns")
                .select("surprise_mode_due")
                .eq("category", category)
                .limit(1)
                .execute()
            )
            if result.data:
                due = result.data[0].get("surprise_mode_due")
                if due:
                    return date.fromisoformat(due) <= date.today()
            return False
        except Exception:
            return False

    async def get_learning_summary(self) -> dict:
        """Summary of what the app has learned."""
        if not supabase:
            return {"total_ratings": 0, "categories_learned": [], "strongest_preferences": []}

        try:
            # Count total ratings
            count_result = (
                supabase.table("preference_ratings")
                .select("id", count="exact")
                .execute()
            )
            total = count_result.count or 0

            # Get all patterns
            patterns = (
                supabase.table("preference_patterns")
                .select("category,liked_attributes,disliked_attributes")
                .execute()
            )

            categories = [p["category"] for p in (patterns.data or [])]

            # Strongest preferences: categories with most ratings
            strongest = []
            for cat in categories:
                cat_count = (
                    supabase.table("preference_ratings")
                    .select("id", count="exact")
                    .eq("category", cat)
                    .execute()
                )
                strongest.append({"category": cat, "ratings": cat_count.count or 0})

            strongest.sort(key=lambda x: x["ratings"], reverse=True)

            # Recent discoveries
            recent = (
                supabase.table("preference_ratings")
                .select("category,item_description,rating")
                .eq("rating", "loved_it")
                .order("created_at", desc=True)
                .limit(5)
                .execute()
            )

            summary = {
                "total_ratings": total,
                "categories_learned": categories,
                "strongest_preferences": strongest[:5],
                "recent_discoveries": recent.data or [],
            }

            # Generate evolution summary if enough data
            if total >= 10 and ANTHROPIC_API_KEY:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    resp = client.messages.create(
                        model=MODEL,
                        max_tokens=150,
                        system="Write a 1-paragraph summary of how this user's preferences have evolved. Be warm and specific.",
                        messages=[{"role": "user", "content": json.dumps(summary)}],
                    )
                    summary["profile_evolution"] = resp.content[0].text.strip()
                except Exception:
                    pass

            return summary
        except Exception as e:
            logger.error(f"Learning summary failed: {e}")
            return {"total_ratings": 0, "categories_learned": []}


learning_engine = LearningEngine()
