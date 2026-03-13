"""Financial context service.

Budget-aware recommendations, subscription audit, goal-scaling.
Never intrusive — builds picture through conversational anchoring.

Financial tier mapping:
  budget:      free, low-cost, DIY suggestions
  moderate:    mid-range restaurants, standard memberships
  comfortable: premium options available
  premium:     no price filtering
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.financial")

MODEL = "claude-sonnet-4-20250514"


class FinancialService:

    async def get_context(self) -> Optional[dict]:
        """Get current financial context profile."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("financial_context")
                .select("*")
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            logger.error(f"Failed to fetch financial context: {e}")
            return None

    async def update_context(self, data: dict) -> dict:
        """Update financial context. Upserts single row."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            existing = await self.get_context()
            if existing:
                result = (
                    supabase.table("financial_context")
                    .update(data)
                    .eq("id", existing["id"])
                    .execute()
                )
            else:
                result = supabase.table("financial_context").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update financial context: {e}")
            return {"error": str(e)}

    async def get_subscriptions(self) -> list[dict]:
        """Get all active subscriptions."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("subscriptions")
                .select("*")
                .eq("active", True)
                .order("monthly_cost", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch subscriptions: {e}")
            return []

    async def add_subscription(self, data: dict) -> dict:
        """Add a subscription."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = supabase.table("subscriptions").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add subscription: {e}")
            return {"error": str(e)}

    async def update_subscription(self, sub_id: str, data: dict) -> dict:
        """Update a subscription."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("subscriptions")
                .update(data)
                .eq("id", sub_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update subscription: {e}")
            return {"error": str(e)}

    async def get_subscription_audit(self) -> dict:
        """Full subscription audit report powered by Claude."""
        subs = await self.get_subscriptions()
        if not subs:
            return {
                "total_monthly_cost": 0,
                "dormant_subscriptions": [],
                "consolidation_suggestions": [],
                "hidden_value": [],
                "cancellation_candidates": [],
                "monthly_savings_potential": 0,
            }

        total = sum(s.get("monthly_cost", 0) for s in subs)
        today = date.today()

        # Basic audit without AI
        dormant = []
        cancel_candidates = []
        for s in subs:
            last_used = s.get("last_used_date")
            if last_used:
                days_unused = (today - date.fromisoformat(last_used)).days
                if days_unused > 60:
                    dormant.append({**s, "days_unused": days_unused})
            freq = s.get("usage_frequency", "")
            if freq in ("rarely", "never"):
                cancel_candidates.append(s)

        savings = sum(s.get("monthly_cost", 0) for s in cancel_candidates)

        # Claude-powered deep audit if available
        consolidation = []
        hidden_value = []
        if ANTHROPIC_API_KEY and subs:
            try:
                client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=800,
                    system=(
                        "You are a financial advisor auditing subscriptions. "
                        "Return ONLY valid JSON with: "
                        "consolidation_suggestions (list of {services: [], suggestion: str}), "
                        "hidden_value (list of {service: str, feature: str, tip: str})."
                    ),
                    messages=[{
                        "role": "user",
                        "content": f"Audit these subscriptions:\n{json.dumps(subs, default=str)}",
                    }],
                )
                raw = response.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                ai_result = json.loads(raw)
                consolidation = ai_result.get("consolidation_suggestions", [])
                hidden_value = ai_result.get("hidden_value", [])
            except Exception as e:
                logger.warning(f"AI subscription audit failed: {e}")

        return {
            "total_monthly_cost": total,
            "dormant_subscriptions": dormant,
            "consolidation_suggestions": consolidation,
            "hidden_value": hidden_value,
            "cancellation_candidates": cancel_candidates,
            "monthly_savings_potential": savings,
        }

    async def filter_by_tier(self, suggestions: list, suggestion_type: str) -> list:
        """Filter suggestions by financial tier."""
        ctx = await self.get_context()
        tier = (ctx or {}).get("socioeconomic_tier", "moderate")

        # For budget tier, filter out premium options
        if tier == "budget":
            return [s for s in suggestions if not s.get("is_premium", False)]
        return suggestions


financial_service = FinancialService()
