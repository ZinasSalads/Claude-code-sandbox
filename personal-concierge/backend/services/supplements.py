"""Supplement Stack Manager — scheduling, interaction checking, adherence.

Manages the user's supplement stack with:
- Add/update/deactivate supplements
- Timing and scheduling
- Interaction checking via Claude
- Adherence logging and streaks
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.supplements")

MODEL = "claude-sonnet-4-20250514"

INTERACTION_CHECK_PROMPT = """You are a pharmacology expert. Analyze this supplement stack for interactions.

Current stack:
{stack}

New supplement being added:
{new_supplement}

Check for:
1. Direct interactions between supplements
2. Absorption conflicts (e.g., calcium blocks iron absorption)
3. Timing conflicts (e.g., both need to be taken on empty stomach but conflict)
4. Dosage concerns (e.g., redundant ingredients, exceeding safe upper limits)

Return ONLY valid JSON (no markdown fences):
{{
  "safe": true/false,
  "interactions": [
    {{
      "severity": "low|moderate|high",
      "supplements": ["name1", "name2"],
      "description": "What the interaction is",
      "recommendation": "What to do about it"
    }}
  ],
  "timing_suggestions": "Suggested timing to minimize conflicts",
  "overall_assessment": "Brief safety summary"
}}"""


class SupplementService:
    """Manages supplement stack, interactions, and adherence."""

    async def get_stack(self, active_only: bool = True) -> list[dict]:
        """Get current supplement stack."""
        if not supabase:
            return []
        try:
            q = supabase.table("supplements").select("*").order("name")
            if active_only:
                q = q.eq("active", True)
            result = q.execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch supplements: {e}")
            return []

    async def add_supplement(self, data: dict) -> dict:
        """Add a supplement to the stack. Checks interactions first."""
        if not supabase:
            return {"error": "Supabase not configured"}

        # Check interactions with existing stack
        interactions = await self.check_interactions(data)

        try:
            row = {
                "name": data["name"],
                "brand": data.get("brand"),
                "dose_amount": data.get("dose_amount"),
                "dose_unit": data.get("dose_unit"),
                "timing": data.get("timing", "morning"),
                "timing_notes": data.get("timing_notes"),
                "purpose": data.get("purpose"),
                "category": data.get("category"),
                "active": True,
                "started_date": data.get("started_date", date.today().isoformat()),
                "evidence_grade": data.get("evidence_grade"),
                "interactions": json.dumps(interactions.get("interactions", [])) if interactions else None,
                "notes": data.get("notes"),
            }
            result = supabase.table("supplements").insert(row).execute()
            supplement = result.data[0] if result.data else row
            supplement["interaction_check"] = interactions
            return supplement
        except Exception as e:
            logger.error(f"Failed to add supplement: {e}")
            return {"error": str(e)}

    async def update_supplement(self, supplement_id: str, data: dict) -> dict:
        """Update a supplement."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = (
                supabase.table("supplements")
                .update(data)
                .eq("id", supplement_id)
                .execute()
            )
            if not result.data:
                return {"error": "Supplement not found"}
            return result.data[0]
        except Exception as e:
            logger.error(f"Failed to update supplement: {e}")
            return {"error": str(e)}

    async def deactivate_supplement(self, supplement_id: str) -> dict:
        """Deactivate (soft-delete) a supplement."""
        return await self.update_supplement(supplement_id, {"active": False})

    async def check_interactions(self, new_supplement: dict) -> dict:
        """Use Claude to check interactions with current stack."""
        if not ANTHROPIC_API_KEY:
            return {"safe": True, "interactions": [], "overall_assessment": "Interaction check unavailable (no API key)"}

        stack = await self.get_stack()
        if not stack:
            return {"safe": True, "interactions": [], "overall_assessment": "No existing supplements — no interactions to check."}

        stack_text = "\n".join(
            f"- {s['name']}: {s.get('dose_amount', '?')} {s.get('dose_unit', '')} ({s.get('timing', 'unknown timing')})"
            for s in stack
        )
        new_text = f"{new_supplement['name']}: {new_supplement.get('dose_amount', '?')} {new_supplement.get('dose_unit', '')} ({new_supplement.get('timing', 'unknown timing')})"

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                messages=[
                    {
                        "role": "user",
                        "content": INTERACTION_CHECK_PROMPT.format(
                            stack=stack_text, new_supplement=new_text
                        ),
                    }
                ],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Interaction check error: {e}")
            return {"safe": True, "interactions": [], "overall_assessment": f"Check failed: {e}"}

    async def log_adherence(self, supplement_id: str, taken: bool, skipped_reason: Optional[str] = None) -> dict:
        """Log whether a supplement was taken today."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            row = {
                "date": date.today().isoformat(),
                "supplement_id": supplement_id,
                "taken": taken,
                "skipped_reason": skipped_reason,
            }
            if taken:
                from datetime import datetime, timezone
                row["taken_at"] = datetime.now(timezone.utc).isoformat()

            # Upsert by date + supplement_id
            result = supabase.table("supplement_log").upsert(row, on_conflict="date,supplement_id").execute()
            return result.data[0] if result.data else {"status": "ok"}
        except Exception as e:
            logger.error(f"Failed to log adherence: {e}")
            return {"error": str(e)}

    async def get_today_log(self) -> list[dict]:
        """Get today's adherence log with supplement details."""
        if not supabase:
            return []
        try:
            stack = await self.get_stack()
            log_result = (
                supabase.table("supplement_log")
                .select("*")
                .eq("date", date.today().isoformat())
                .execute()
            )
            logged = {l["supplement_id"]: l for l in (log_result.data or [])}

            combined = []
            for s in stack:
                entry = {
                    "supplement_id": s["id"],
                    "name": s["name"],
                    "dose_amount": s.get("dose_amount"),
                    "dose_unit": s.get("dose_unit"),
                    "timing": s.get("timing"),
                    "taken": False,
                    "skipped_reason": None,
                }
                if s["id"] in logged:
                    entry["taken"] = logged[s["id"]].get("taken", False)
                    entry["skipped_reason"] = logged[s["id"]].get("skipped_reason")
                combined.append(entry)
            return combined
        except Exception as e:
            logger.error(f"Failed to get today log: {e}")
            return []

    async def get_adherence_stats(self, days: int = 30) -> dict:
        """Calculate adherence stats for the period."""
        if not supabase:
            return {}
        try:
            start = (date.today() - timedelta(days=days)).isoformat()
            result = (
                supabase.table("supplement_log")
                .select("supplement_id, taken, date")
                .gte("date", start)
                .execute()
            )
            logs = result.data or []
            if not logs:
                return {"period_days": days, "total_logs": 0, "adherence_pct": 0}

            taken = sum(1 for l in logs if l.get("taken"))
            total = len(logs)

            # Per-supplement breakdown
            by_supp: dict[str, dict] = {}
            for l in logs:
                sid = l["supplement_id"]
                if sid not in by_supp:
                    by_supp[sid] = {"taken": 0, "total": 0}
                by_supp[sid]["total"] += 1
                if l.get("taken"):
                    by_supp[sid]["taken"] += 1

            # Get supplement names
            stack = await self.get_stack(active_only=False)
            name_map = {s["id"]: s["name"] for s in stack}

            breakdown = []
            for sid, stats in by_supp.items():
                breakdown.append({
                    "supplement_id": sid,
                    "name": name_map.get(sid, "Unknown"),
                    "taken": stats["taken"],
                    "total": stats["total"],
                    "adherence_pct": round((stats["taken"] / stats["total"]) * 100, 1) if stats["total"] else 0,
                })

            # Current streak
            streak = await self._calculate_streak()

            return {
                "period_days": days,
                "total_logs": total,
                "total_taken": taken,
                "adherence_pct": round((taken / total) * 100, 1) if total else 0,
                "current_streak_days": streak,
                "breakdown": breakdown,
            }
        except Exception as e:
            logger.error(f"Failed to get adherence stats: {e}")
            return {}

    async def _calculate_streak(self) -> int:
        """Calculate current consecutive days of full adherence."""
        if not supabase:
            return 0
        try:
            stack = await self.get_stack()
            if not stack:
                return 0
            stack_size = len(stack)

            streak = 0
            check_date = date.today()
            for _ in range(365):
                result = (
                    supabase.table("supplement_log")
                    .select("taken")
                    .eq("date", check_date.isoformat())
                    .eq("taken", True)
                    .execute()
                )
                taken_count = len(result.data or [])
                if taken_count >= stack_size:
                    streak += 1
                    check_date -= timedelta(days=1)
                else:
                    break
            return streak
        except Exception as e:
            logger.error(f"Streak calculation error: {e}")
            return 0

    async def get_schedule(self) -> dict[str, list[dict]]:
        """Get supplements organized by timing."""
        stack = await self.get_stack()
        schedule: dict[str, list[dict]] = {
            "morning": [],
            "afternoon": [],
            "evening": [],
            "with_meals": [],
            "bedtime": [],
        }
        for s in stack:
            timing = s.get("timing", "morning")
            if timing in schedule:
                schedule[timing].append(s)
            else:
                schedule["morning"].append(s)
        return schedule


supplement_service = SupplementService()
