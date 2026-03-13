"""Data export & privacy controls.

Full profile export, category deletion, sensitivity tiers, amnesia mode.
User owns all their data entirely.
"""

import json
import logging
from datetime import date

from config import supabase

logger = logging.getLogger("concierge.privacy")

# Tables organized by category
CATEGORY_TABLES = {
    "health": ["health_data"],
    "social": ["social_contacts", "social_log"],
    "career": ["career_profile", "career_log"],
    "financial": ["financial_context", "subscriptions"],
    "personality": ["personality_profile"],
    "legacy": ["legacy_profile", "life_milestones", "values_drift_log"],
    "wardrobe": ["wardrobe", "outfit_log"],
    "learning": ["learning_profile", "books", "courses", "learning_log"],
    "growth": ["growth_habits", "growth_log"],
    "home": ["home_environment", "home_recommendations"],
    "travel": ["trips", "trip_logs"],
    "voice": ["voice_sessions"],
    "feedback": ["preference_ratings", "preference_patterns"],
    "onboarding": ["onboarding"],
}

ALL_TABLES = [
    "health_data", "life_profile", "checkins",
    "personality_profile", "onboarding",
    "social_contacts", "social_log",
    "growth_habits", "growth_log",
    "career_profile", "career_log",
    "financial_context", "subscriptions",
    "wardrobe", "outfit_log",
    "trips", "trip_logs",
    "voice_sessions",
    "push_tokens",
    "preference_ratings", "preference_patterns",
    "legacy_profile", "life_milestones", "values_drift_log",
    "home_environment", "home_recommendations",
    "learning_profile", "books", "courses", "learning_log",
    "calendar_tokens", "calendar_events",
]


class PrivacyService:

    async def export_full_profile(self, format: str = "json") -> dict:
        """Export everything the app knows about the user."""
        if not supabase:
            return {"error": "Database not configured"}

        export_data = {}

        for table in ALL_TABLES:
            try:
                result = supabase.table(table).select("*").execute()
                if result.data:
                    export_data[table] = result.data
            except Exception as e:
                logger.error(f"Export failed for {table}: {e}")
                export_data[table] = {"error": str(e)}

        return {
            "export_date": date.today().isoformat(),
            "format": format,
            "tables_exported": len([t for t in export_data if isinstance(export_data[t], list)]),
            "total_records": sum(len(v) for v in export_data.values() if isinstance(v, list)),
            "data": export_data,
        }

    async def delete_category(self, category: str, confirm: bool = False) -> dict:
        """Delete all data in a category."""
        if not confirm:
            return {"error": "Requires confirm=true. This action is irreversible."}

        tables = CATEGORY_TABLES.get(category)
        if not tables:
            return {"error": f"Unknown category: {category}. Valid: {list(CATEGORY_TABLES.keys())}"}

        if not supabase:
            return {"error": "Database not configured"}

        deleted = {}
        for table in tables:
            try:
                # Count before delete
                count = supabase.table(table).select("id", count="exact").execute()
                record_count = count.count or 0

                if record_count > 0:
                    supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
                    deleted[table] = record_count
            except Exception as e:
                logger.error(f"Delete failed for {table}: {e}")
                deleted[table] = {"error": str(e)}

        return {
            "status": "deleted",
            "category": category,
            "tables_affected": list(deleted.keys()),
            "records_deleted": deleted,
        }

    async def set_sensitivity_tier(self, data_key: str, tier: str) -> dict:
        """Set sensitivity tier for a data category."""
        valid_tiers = ["standard", "silent", "private"]
        if tier not in valid_tiers:
            return {"error": f"Invalid tier. Use: {valid_tiers}"}

        # Store sensitivity preferences in onboarding table as a config
        if not supabase:
            return {"status": "ok", "data_key": data_key, "tier": tier}

        try:
            # Use onboarding table to store sensitivity settings
            row = {
                "step_name": f"sensitivity_{data_key}",
                "completed": True,
                "data": {"tier": tier, "data_key": data_key},
            }
            supabase.table("onboarding").upsert(row, on_conflict="step_name").execute()
            return {"status": "ok", "data_key": data_key, "tier": tier}
        except Exception as e:
            logger.error(f"Sensitivity tier update failed: {e}")
            return {"error": str(e)}

    async def get_data_summary(self) -> dict:
        """What the app knows about you — organized summary."""
        if not supabase:
            return {"categories": {}}

        summary = {}
        for category, tables in CATEGORY_TABLES.items():
            cat_info = {"data_points": 0, "tables": []}
            for table in tables:
                try:
                    count = supabase.table(table).select("id", count="exact").execute()
                    records = count.count or 0
                    cat_info["data_points"] += records
                    if records > 0:
                        cat_info["tables"].append({"table": table, "records": records})
                except Exception:
                    pass
            summary[category] = cat_info

        # Add personality type if exists
        try:
            personality = (
                supabase.table("personality_profile")
                .select("mbti_type")
                .limit(1)
                .execute()
            )
            if personality.data:
                summary["personality"]["type"] = personality.data[0].get("mbti_type")
        except Exception:
            pass

        # Get date range for health data
        try:
            oldest = (
                supabase.table("health_data")
                .select("date")
                .order("date")
                .limit(1)
                .execute()
            )
            newest = (
                supabase.table("health_data")
                .select("date")
                .order("date", desc=True)
                .limit(1)
                .execute()
            )
            if oldest.data and newest.data:
                summary["health"]["date_range"] = {
                    "oldest": oldest.data[0]["date"],
                    "newest": newest.data[0]["date"],
                }
        except Exception:
            pass

        return {"categories": summary}

    async def amnesia(self, category: str, confirm: bool = False) -> dict:
        """Forget a category entirely — delete data and stop collecting."""
        if not confirm:
            return {"error": "Amnesia requires confirm=true. This is irreversible."}

        # Delete the data
        result = await self.delete_category(category, confirm=True)

        # Mark as amnesia'd so we stop collecting
        if supabase:
            try:
                row = {
                    "step_name": f"amnesia_{category}",
                    "completed": True,
                    "data": {"category": category, "amnesia_date": date.today().isoformat()},
                }
                supabase.table("onboarding").upsert(row, on_conflict="step_name").execute()
            except Exception as e:
                logger.error(f"Amnesia marker failed: {e}")

        return {
            "status": "amnesia_complete",
            "category": category,
            "message": f"All {category} data has been deleted and collection is disabled.",
            **result,
        }


privacy_service = PrivacyService()
