"""Skincare Service — product management, conflict detection, routine building, skin tracking.

Manages the user's skincare routine with:
- Product tracking with ingredient conflict detection
- Morning/evening routine generation
- Skin check-in logging and correlation analysis
- Photo-based skin analysis via Claude Vision
"""

import base64
import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.skincare")

MODEL = "claude-sonnet-4-20250514"

KNOWN_CONFLICTS = [
    {
        "ingredient_a": "retinol",
        "ingredient_b": "vitamin_c",
        "conflict_type": "avoid_same_routine",
        "explanation": "Retinol and Vitamin C have different optimal pH levels. Using them together can cause irritation and reduce the effectiveness of both. Use Vitamin C in the morning and Retinol at night.",
    },
    {
        "ingredient_a": "retinol",
        "ingredient_b": "aha",
        "conflict_type": "avoid_same_routine",
        "explanation": "Both retinol and AHAs increase skin cell turnover and can cause excessive irritation, peeling, and sensitivity when combined. Alternate nights or use on different days.",
    },
    {
        "ingredient_a": "retinol",
        "ingredient_b": "bha",
        "conflict_type": "avoid_same_routine",
        "explanation": "Combining retinol with BHA (salicylic acid) can over-exfoliate and compromise the skin barrier. Use BHA in the morning and retinol at night, or alternate days.",
    },
    {
        "ingredient_a": "benzoyl_peroxide",
        "ingredient_b": "retinol",
        "conflict_type": "avoid_same_routine",
        "explanation": "Benzoyl peroxide can oxidize and deactivate retinol, rendering it ineffective. Use benzoyl peroxide in the morning and retinol in the evening.",
    },
    {
        "ingredient_a": "vitamin_c",
        "ingredient_b": "niacinamide",
        "conflict_type": "reduce_efficacy",
        "explanation": "While newer research suggests they can be used together, high concentrations of both may reduce each other's efficacy and cause flushing. Wait 10-15 minutes between applications.",
    },
    {
        "ingredient_a": "aha",
        "ingredient_b": "physical_scrub",
        "conflict_type": "avoid_same_day",
        "explanation": "Using chemical exfoliants (AHA) and physical scrubs on the same day can cause micro-tears, irritation, and damage the skin barrier. Choose one exfoliation method per day.",
    },
]

SKIN_ANALYSIS_PROMPT = """You are a dermatology-trained skin analysis assistant. Analyze this photo of the user's face/skin.

Evaluate the following aspects on a scale of 0 (none/absent) to 10 (severe/very noticeable):
- Breakouts (active acne, pimples, whiteheads, blackheads)
- Redness (inflammation, rosacea-like patterns, irritation)
- Dryness (flaking, tightness, rough patches)
- Puffiness (under-eye bags, facial swelling)
- Dark circles (under-eye discoloration)

Also note:
- Texture observations (pore size, smoothness, scarring)
- Overall skin health score (1-10, where 10 is excellent)
- Key observations and recommendations

Return ONLY valid JSON (no markdown fences):
{{
  "breakouts": 0-10,
  "redness": 0-10,
  "dryness": 0-10,
  "puffiness": 0-10,
  "dark_circles": 0-10,
  "texture_notes": "description of skin texture",
  "overall_score": 1-10,
  "observations": ["observation 1", "observation 2", ...]
}}"""

CORRELATION_ANALYSIS_PROMPT = """You are a dermatology and wellness expert. Analyze these skin log entries alongside health data to identify correlations.

Skin logs (last 60 days):
{skin_logs}

Health data (last 60 days):
{health_data}

Look for patterns such as:
1. Breakouts correlating with poor sleep (sleep_score < 70)
2. Puffiness correlating with high stress check-ins
3. Skin condition improvements correlating with supplement additions
4. Hydration levels affecting skin dryness
5. Exercise patterns affecting skin clarity

Return ONLY valid JSON (no markdown fences):
{{
  "correlations": [
    {{
      "pattern": "Description of the pattern found",
      "confidence": "low|medium|high",
      "evidence": "Specific data points supporting this correlation",
      "recommendation": "Actionable suggestion based on this finding"
    }}
  ],
  "summary": "Brief overall assessment of skin-health connections"
}}"""


class SkincareService:
    """Manages skincare products, routines, conflicts, and skin tracking."""

    async def seed_conflicts(self) -> dict:
        """Seed the skincare_conflicts table with known ingredient conflicts if empty."""
        if not supabase:
            return {"seeded": 0}
        try:
            existing = supabase.table("skincare_conflicts").select("id").limit(1).execute()
            if existing.data:
                return {"seeded": 0, "message": "Conflicts table already populated"}

            result = supabase.table("skincare_conflicts").insert(KNOWN_CONFLICTS).execute()
            count = len(result.data) if result.data else 0
            logger.info(f"Seeded {count} skincare conflicts")
            return {"seeded": count}
        except Exception as e:
            logger.error(f"Failed to seed conflicts: {e}")
            return {"seeded": 0, "error": str(e)}

    async def get_skin_profile(self) -> dict:
        """Get the user's skin profile."""
        if not supabase:
            return {}
        try:
            result = supabase.table("skin_profile").select("*").limit(1).execute()
            if result.data:
                return result.data[0]
            return {}
        except Exception as e:
            logger.error(f"Failed to fetch skin profile: {e}")
            return {}

    async def save_skin_profile(self, data: dict) -> dict:
        """Upsert the user's skin profile."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = supabase.table("skin_profile").upsert(data).execute()
            if result.data:
                return result.data[0]
            return {}
        except Exception as e:
            logger.error(f"Failed to save skin profile: {e}")
            return {"error": str(e)}

    async def get_products(self, slot: Optional[str] = None) -> list[dict]:
        """Get active skincare products, optionally filtered by routine slot."""
        if not supabase:
            return []
        try:
            q = supabase.table("skincare_products").select("*").eq("active", True)
            if slot:
                q = q.eq("routine_slot", slot)
            result = q.execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch skincare products: {e}")
            return []

    async def add_product(self, data: dict) -> dict:
        """Add a skincare product and check for ingredient conflicts."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = supabase.table("skincare_products").insert(data).execute()
            if not result.data:
                return {"error": "Failed to insert product"}

            product = result.data[0]
            conflicts = await self.check_conflicts(product["id"])

            response = {"product": product}
            if conflicts:
                response["conflict_warnings"] = conflicts
            return response
        except Exception as e:
            logger.error(f"Failed to add skincare product: {e}")
            return {"error": str(e)}

    async def update_product(self, product_id: str, data: dict) -> dict:
        """Update a skincare product by ID."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = (
                supabase.table("skincare_products")
                .update(data)
                .eq("id", product_id)
                .execute()
            )
            if result.data:
                return result.data[0]
            return {"error": "Product not found"}
        except Exception as e:
            logger.error(f"Failed to update skincare product {product_id}: {e}")
            return {"error": str(e)}

    async def deactivate_product(self, product_id: str) -> dict:
        """Soft-delete a product by setting active=False."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = (
                supabase.table("skincare_products")
                .update({"active": False})
                .eq("id", product_id)
                .execute()
            )
            if result.data:
                return {"status": "deactivated", "product": result.data[0]}
            return {"error": "Product not found"}
        except Exception as e:
            logger.error(f"Failed to deactivate skincare product {product_id}: {e}")
            return {"error": str(e)}

    async def check_conflicts(self, product_id: str) -> list[dict]:
        """Check if a product's ingredients conflict with other active products."""
        if not supabase:
            return []
        try:
            # Get the target product
            prod_result = (
                supabase.table("skincare_products")
                .select("*")
                .eq("id", product_id)
                .execute()
            )
            if not prod_result.data:
                return []

            product = prod_result.data[0]
            product_ingredients = product.get("active_ingredients", [])
            if not product_ingredients:
                return []

            # Get all known conflicts
            conflicts_result = supabase.table("skincare_conflicts").select("*").execute()
            known = conflicts_result.data or []

            # Get all other active products
            others_result = (
                supabase.table("skincare_products")
                .select("*")
                .eq("active", True)
                .neq("id", product_id)
                .execute()
            )
            other_products = others_result.data or []

            # Normalize ingredient names for comparison
            product_ing_set = {ing.strip().lower() for ing in product_ingredients}

            found_conflicts = []
            for other in other_products:
                other_ingredients = other.get("active_ingredients", [])
                if not other_ingredients:
                    continue
                other_ing_set = {ing.strip().lower() for ing in other_ingredients}

                for conflict in known:
                    a = conflict["ingredient_a"].strip().lower()
                    b = conflict["ingredient_b"].strip().lower()

                    # Check if product has ingredient_a and other has ingredient_b, or vice versa
                    match = (a in product_ing_set and b in other_ing_set) or (
                        b in product_ing_set and a in other_ing_set
                    )

                    if match:
                        found_conflicts.append(
                            {
                                "product_a": product.get("product_name", "Unknown"),
                                "product_b": other.get("product_name", "Unknown"),
                                "ingredient_a": conflict["ingredient_a"],
                                "ingredient_b": conflict["ingredient_b"],
                                "conflict_type": conflict["conflict_type"],
                                "explanation": conflict["explanation"],
                            }
                        )

            return found_conflicts
        except Exception as e:
            logger.error(f"Failed to check conflicts for product {product_id}: {e}")
            return []

    async def get_morning_routine(self) -> dict:
        """Get the morning skincare routine with products ordered by application order."""
        if not supabase:
            return {"products": [], "reminders": []}
        try:
            result = (
                supabase.table("skincare_products")
                .select("*")
                .eq("active", True)
                .in_("routine_slot", ["morning", "both"])
                .order("application_order")
                .execute()
            )
            products = result.data or []

            reminders = []

            # Check for SPF product
            has_spf = any(
                "spf" in (p.get("product_name", "") + " ".join(p.get("active_ingredients", []))).lower()
                for p in products
            )
            if not has_spf:
                reminders.append(
                    {
                        "type": "spf_missing",
                        "message": "No SPF product found in your morning routine. Sunscreen is essential for skin health and protecting against UV damage.",
                    }
                )

            # Check for UV data and add reminder if available
            try:
                uv_result = (
                    supabase.table("health_data")
                    .select("uv_index")
                    .order("recorded_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if uv_result.data and uv_result.data[0].get("uv_index"):
                    uv_index = uv_result.data[0]["uv_index"]
                    if uv_index >= 6:
                        reminders.append(
                            {
                                "type": "high_uv",
                                "message": f"UV index is {uv_index} (high). Reapply sunscreen every 2 hours if outdoors. Consider a hat and sunglasses.",
                            }
                        )
                    elif uv_index >= 3:
                        reminders.append(
                            {
                                "type": "moderate_uv",
                                "message": f"UV index is {uv_index} (moderate). Ensure sunscreen is applied before heading outside.",
                            }
                        )
            except Exception as e:
                logger.warning(f"Could not fetch UV data: {e}")

            return {"products": products, "reminders": reminders}
        except Exception as e:
            logger.error(f"Failed to fetch morning routine: {e}")
            return {"products": [], "reminders": []}

    async def get_evening_routine(self) -> dict:
        """Get the evening skincare routine with products ordered by application order."""
        if not supabase:
            return {"products": []}
        try:
            result = (
                supabase.table("skincare_products")
                .select("*")
                .eq("active", True)
                .in_("routine_slot", ["evening", "both"])
                .order("application_order")
                .execute()
            )
            return {"products": result.data or []}
        except Exception as e:
            logger.error(f"Failed to fetch evening routine: {e}")
            return {"products": []}

    async def log_skin_checkin(self, data: dict) -> dict:
        """Log a daily skin check-in and detect correlations."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            log_date = data.get("log_date", str(date.today()))
            data["log_date"] = log_date

            result = (
                supabase.table("skin_log")
                .upsert(data, on_conflict="log_date")
                .execute()
            )
            if not result.data:
                return {"error": "Failed to log check-in"}

            log_entry = result.data[0]

            # Check for correlations with recent data
            correlation_insight = await self._check_correlations(log_entry)

            response = {"log": log_entry}
            if correlation_insight:
                response["correlation_insight"] = correlation_insight
            return response
        except Exception as e:
            logger.error(f"Failed to log skin check-in: {e}")
            return {"error": str(e)}

    async def _check_correlations(self, log_entry: dict) -> Optional[str]:
        """Quick correlation check after a skin check-in."""
        if not supabase:
            return None
        try:
            # Get recent health data for quick pattern detection
            week_ago = str(date.today() - timedelta(days=7))
            health_result = (
                supabase.table("health_data")
                .select("*")
                .gte("recorded_at", week_ago)
                .order("recorded_at", desc=True)
                .execute()
            )
            health_data = health_result.data or []
            if not health_data:
                return None

            insights = []

            # Check breakouts after poor sleep
            if log_entry.get("breakouts", 0) >= 3:
                poor_sleep_days = [
                    h for h in health_data
                    if h.get("sleep_score") and h["sleep_score"] < 70
                ]
                if poor_sleep_days:
                    insights.append(
                        "You've reported breakouts after several nights of poor sleep (score < 70). "
                        "Sleep quality directly affects skin healing and inflammation."
                    )

            # Check puffiness after high stress
            if log_entry.get("puffiness", 0) >= 3:
                high_stress = [
                    h for h in health_data
                    if h.get("stress_level") and h["stress_level"] >= 7
                ]
                if high_stress:
                    insights.append(
                        "Elevated puffiness may be linked to recent high stress levels. "
                        "Stress triggers cortisol release which can cause water retention and inflammation."
                    )

            if insights:
                return " | ".join(insights)
            return None
        except Exception as e:
            logger.warning(f"Correlation check failed: {e}")
            return None

    async def get_skin_correlations(self) -> dict:
        """Analyze correlations between skin logs and health data over the last 60 days."""
        if not supabase:
            return {"correlations": [], "summary": "No data available"}
        try:
            sixty_days_ago = str(date.today() - timedelta(days=60))

            # Fetch skin logs
            skin_result = (
                supabase.table("skin_log")
                .select("*")
                .gte("log_date", sixty_days_ago)
                .order("log_date", desc=True)
                .execute()
            )
            skin_logs = skin_result.data or []

            # Fetch health data
            health_result = (
                supabase.table("health_data")
                .select("*")
                .gte("recorded_at", sixty_days_ago)
                .order("recorded_at", desc=True)
                .execute()
            )
            health_data = health_result.data or []

            if not skin_logs:
                return {"correlations": [], "summary": "No skin logs found in the last 60 days"}

            # Try Claude analysis if API key available
            if ANTHROPIC_API_KEY and health_data:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    prompt = CORRELATION_ANALYSIS_PROMPT.format(
                        skin_logs=json.dumps(skin_logs[:60], default=str),
                        health_data=json.dumps(health_data[:60], default=str),
                    )
                    response = client.messages.create(
                        model=MODEL,
                        max_tokens=1500,
                        messages=[{"role": "user", "content": prompt}],
                    )
                    analysis = json.loads(response.content[0].text)
                    # Return top 3 correlations
                    correlations = analysis.get("correlations", [])[:3]
                    return {
                        "correlations": correlations,
                        "summary": analysis.get("summary", ""),
                    }
                except Exception as e:
                    logger.warning(f"Claude correlation analysis failed, using rule-based: {e}")

            # Rule-based fallback correlation analysis
            correlations = []

            # Pattern 1: Breakouts after poor sleep
            breakout_days = [s for s in skin_logs if s.get("breakouts", 0) >= 3]
            poor_sleep_days = [h for h in health_data if h.get("sleep_score") and h["sleep_score"] < 70]
            if breakout_days and poor_sleep_days:
                correlations.append(
                    {
                        "pattern": "Breakouts tend to appear after nights with poor sleep quality",
                        "confidence": "medium",
                        "evidence": f"Found {len(breakout_days)} breakout days and {len(poor_sleep_days)} poor sleep days in the last 60 days",
                        "recommendation": "Prioritize sleep hygiene. Aim for 7-9 hours of quality sleep to support skin repair.",
                    }
                )

            # Pattern 2: Puffiness after high stress
            puffy_days = [s for s in skin_logs if s.get("puffiness", 0) >= 3]
            stress_days = [h for h in health_data if h.get("stress_level") and h["stress_level"] >= 7]
            if puffy_days and stress_days:
                correlations.append(
                    {
                        "pattern": "Facial puffiness correlates with high-stress periods",
                        "confidence": "medium",
                        "evidence": f"Found {len(puffy_days)} puffy days and {len(stress_days)} high-stress days in the last 60 days",
                        "recommendation": "Incorporate stress management techniques. Consider facial massage or cold compress on high-stress days.",
                    }
                )

            # Pattern 3: Skin condition improving with supplements
            good_skin_days = [s for s in skin_logs if s.get("overall_condition", 0) >= 7]
            if good_skin_days and len(good_skin_days) > len(skin_logs) * 0.3:
                correlations.append(
                    {
                        "pattern": "Skin condition shows improvement trend, possibly linked to supplement regimen",
                        "confidence": "low",
                        "evidence": f"{len(good_skin_days)} out of {len(skin_logs)} logged days had good skin condition (7+/10)",
                        "recommendation": "Continue current supplement and skincare routine. Track specific supplements to isolate which are most beneficial.",
                    }
                )

            summary = (
                f"Analysis of {len(skin_logs)} skin logs and {len(health_data)} health records "
                f"over the last 60 days. Found {len(correlations)} potential correlation(s)."
            )
            return {"correlations": correlations[:3], "summary": summary}
        except Exception as e:
            logger.error(f"Failed to compute skin correlations: {e}")
            return {"correlations": [], "summary": "Error computing correlations"}

    async def get_weekly_skin_summary(self) -> dict:
        """Aggregate the last 7 days of skin log data into a summary."""
        if not supabase:
            return {}
        try:
            week_ago = str(date.today() - timedelta(days=7))
            result = (
                supabase.table("skin_log")
                .select("*")
                .gte("log_date", week_ago)
                .order("log_date", desc=True)
                .execute()
            )
            logs = result.data or []

            if not logs:
                return {
                    "avg_condition": None,
                    "breakout_days": 0,
                    "trend": "no_data",
                    "routine_adherence": None,
                    "days_logged": 0,
                }

            # Average condition score
            conditions = [l.get("overall_condition", 0) for l in logs if l.get("overall_condition") is not None]
            avg_condition = round(sum(conditions) / len(conditions), 1) if conditions else None

            # Count breakout days
            breakout_days = sum(1 for l in logs if l.get("breakouts", 0) >= 2)

            # Determine trend (compare first half vs second half of the week)
            if len(conditions) >= 4:
                mid = len(conditions) // 2
                first_half_avg = sum(conditions[:mid]) / mid
                second_half_avg = sum(conditions[mid:]) / (len(conditions) - mid)
                if second_half_avg > first_half_avg + 0.5:
                    trend = "improving"
                elif second_half_avg < first_half_avg - 0.5:
                    trend = "declining"
                else:
                    trend = "stable"
            elif len(conditions) >= 2:
                if conditions[0] > conditions[-1] + 0.5:
                    trend = "improving"
                elif conditions[0] < conditions[-1] - 0.5:
                    trend = "declining"
                else:
                    trend = "stable"
            else:
                trend = "insufficient_data"

            # Routine adherence (% of days with routine_completed flag)
            adherence_logs = [l for l in logs if l.get("routine_completed") is not None]
            if adherence_logs:
                completed = sum(1 for l in adherence_logs if l["routine_completed"])
                routine_adherence = round(completed / len(adherence_logs) * 100, 1)
            else:
                routine_adherence = None

            return {
                "avg_condition": avg_condition,
                "breakout_days": breakout_days,
                "trend": trend,
                "routine_adherence": routine_adherence,
                "days_logged": len(logs),
                "period_start": week_ago,
                "period_end": str(date.today()),
            }
        except Exception as e:
            logger.error(f"Failed to compute weekly skin summary: {e}")
            return {}

    async def analyze_photo(self, image_base64: str) -> dict:
        """Analyze a skin photo using Claude Vision API."""
        if not ANTHROPIC_API_KEY:
            return {"error": "Anthropic API key not configured for photo analysis"}
        try:
            # Detect image media type from base64 header or default to jpeg
            media_type = "image/jpeg"
            if image_base64.startswith("/9j/"):
                media_type = "image/jpeg"
            elif image_base64.startswith("iVBOR"):
                media_type = "image/png"
            elif image_base64.startswith("R0lGOD"):
                media_type = "image/gif"
            elif image_base64.startswith("UklGR"):
                media_type = "image/webp"

            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_base64,
                                },
                            },
                            {
                                "type": "text",
                                "text": SKIN_ANALYSIS_PROMPT,
                            },
                        ],
                    }
                ],
            )

            analysis = json.loads(response.content[0].text)
            return analysis
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse skin analysis response: {e}")
            return {"error": "Failed to parse analysis results"}
        except Exception as e:
            logger.error(f"Failed to analyze skin photo: {e}")
            return {"error": str(e)}


skincare_service = SkincareService()
