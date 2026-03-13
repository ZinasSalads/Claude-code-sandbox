"""Financial planning service.

Savings goals, progress tracking, financial stress monitoring,
and life-goal alignment. Not a finance app — just enough structure
to keep savings on track and flag when stress should shift other
modules to budget-conscious mode.
"""

import logging
from datetime import date, datetime, timedelta
from typing import Optional

from config import supabase

logger = logging.getLogger("concierge.financial_planning")


class FinancialPlanningService:

    # ------------------------------------------------------------------
    # Goals
    # ------------------------------------------------------------------

    async def get_goals(self) -> list[dict]:
        """Get all financial goals with calculated progress percentage."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("financial_goals")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
            goals = result.data or []
            for goal in goals:
                target = goal.get("target_amount") or 0
                current = goal.get("current_amount") or 0
                goal["progress_pct"] = round(
                    (current / target * 100) if target > 0 else 0, 2
                )
            return goals
        except Exception as e:
            logger.error(f"Failed to fetch financial goals: {e}")
            return []

    async def add_goal(self, data: dict) -> dict:
        """Insert a new financial goal.

        If target_date is provided, calculate the monthly contribution
        needed to reach the target on time.
        """
        if not supabase:
            return {}
        try:
            target_amount = data.get("target_amount", 0)
            current_amount = data.get("current_amount", 0)
            monthly_contribution = data.get("monthly_contribution", 0)
            months_to_goal: Optional[float] = None
            monthly_needed: Optional[float] = None

            target_date_str = data.get("target_date")
            if target_date_str:
                target_dt = datetime.strptime(target_date_str, "%Y-%m-%d").date()
                today = date.today()
                months_remaining = (
                    (target_dt.year - today.year) * 12
                    + (target_dt.month - today.month)
                )
                if months_remaining > 0:
                    remaining = target_amount - current_amount
                    monthly_needed = round(remaining / months_remaining, 2) if remaining > 0 else 0
                    months_to_goal = months_remaining
                    # Auto-set monthly_contribution if not explicitly provided
                    if not monthly_contribution and monthly_needed:
                        data["monthly_contribution"] = monthly_needed

            result = (
                supabase.table("financial_goals")
                .insert(data)
                .execute()
            )
            saved = result.data[0] if result.data else data
            return {
                "goal_saved": saved,
                "months_to_goal": months_to_goal,
                "monthly_needed": monthly_needed,
            }
        except Exception as e:
            logger.error(f"Failed to add financial goal: {e}")
            return {}

    async def update_goal(self, goal_id: str, data: dict) -> dict:
        """Update a financial goal by id."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("financial_goals")
                .update(data)
                .eq("id", goal_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update goal {goal_id}: {e}")
            return {}

    async def update_goal_progress(self, goal_id: str, current_amount: float) -> dict:
        """Update the current_amount for a goal and return progress + projection."""
        if not supabase:
            return {}
        try:
            # Fetch existing goal first
            existing = (
                supabase.table("financial_goals")
                .select("*")
                .eq("id", goal_id)
                .limit(1)
                .execute()
            )
            goal = existing.data[0] if existing.data else None
            if not goal:
                return {"error": "Goal not found"}

            # Update current amount
            supabase.table("financial_goals").update(
                {"current_amount": current_amount}
            ).eq("id", goal_id).execute()

            target = goal.get("target_amount", 0)
            progress_pct = round((current_amount / target * 100) if target > 0 else 0, 2)

            # Project when goal will be met based on monthly contribution rate
            monthly_contribution = goal.get("monthly_contribution", 0)
            projected_completion: Optional[str] = None
            if monthly_contribution and monthly_contribution > 0:
                remaining = target - current_amount
                if remaining > 0:
                    months_left = remaining / monthly_contribution
                    projected_date = date.today() + timedelta(days=months_left * 30.44)
                    projected_completion = projected_date.isoformat()
                else:
                    projected_completion = date.today().isoformat()

            return {
                "goal_id": goal_id,
                "current_amount": current_amount,
                "target_amount": target,
                "progress_pct": progress_pct,
                "projected_completion": projected_completion,
            }
        except Exception as e:
            logger.error(f"Failed to update progress for goal {goal_id}: {e}")
            return {}

    # ------------------------------------------------------------------
    # Financial Stress
    # ------------------------------------------------------------------

    async def log_financial_stress(
        self, stress_level: int, stressor: Optional[str] = None
    ) -> dict:
        """Insert or upsert financial stress for the current week (Monday-based).

        If stress >= 7, return a flag indicating budget-conscious mode should
        activate and list the modules that should shift.
        """
        if not supabase:
            return {}
        try:
            today = date.today()
            # Monday of the current week
            week_start = (today - timedelta(days=today.weekday())).isoformat()

            row = {
                "week_start": week_start,
                "stress_level": stress_level,
                "primary_stressor": stressor,
                "logged_at": datetime.utcnow().isoformat(),
            }

            supabase.table("financial_stress_log").upsert(
                row, on_conflict="week_start"
            ).execute()

            result: dict = {"logged": True, "week_start": week_start, "stress_level": stress_level}

            if stress_level >= 7:
                result["budget_conscious_mode"] = {
                    "active": True,
                    "modules": [
                        "travel",
                        "nutrition",
                        "supplements",
                        "wardrobe",
                        "social",
                    ],
                }

            return result
        except Exception as e:
            logger.error(f"Failed to log financial stress: {e}")
            return {}

    async def get_stress_flag(self) -> dict:
        """Return True if there is a stress_level >= 7 in the last 2 weeks."""
        if not supabase:
            return {"active": False}
        try:
            cutoff = (date.today() - timedelta(weeks=2)).isoformat()
            result = (
                supabase.table("financial_stress_log")
                .select("stress_level, week_start")
                .gte("week_start", cutoff)
                .gte("stress_level", 7)
                .limit(1)
                .execute()
            )
            active = bool(result.data)
            return {"active": active, "recent_high_stress": result.data or []}
        except Exception as e:
            logger.error(f"Failed to fetch stress flag: {e}")
            return {"active": False}

    # ------------------------------------------------------------------
    # Timeline & Projections
    # ------------------------------------------------------------------

    async def get_goal_timeline(self) -> list[dict]:
        """Get all active goals ordered by target_date with projections."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("financial_goals")
                .select("*")
                .eq("status", "active")
                .order("target_date")
                .execute()
            )
            goals = result.data or []
            timeline = []
            for goal in goals:
                target = goal.get("target_amount", 0)
                current = goal.get("current_amount", 0)
                monthly = goal.get("monthly_contribution", 0)
                progress_pct = round((current / target * 100) if target > 0 else 0, 2)

                projected_completion: Optional[str] = None
                if monthly and monthly > 0:
                    remaining = target - current
                    if remaining > 0:
                        months_left = remaining / monthly
                        projected_date = date.today() + timedelta(days=months_left * 30.44)
                        projected_completion = projected_date.isoformat()
                    else:
                        projected_completion = date.today().isoformat()

                timeline.append({
                    "goal_id": goal.get("id"),
                    "goal_name": goal.get("goal_name"),
                    "target_date": goal.get("target_date"),
                    "progress_pct": progress_pct,
                    "projected_completion": projected_completion,
                })
            return timeline
        except Exception as e:
            logger.error(f"Failed to build goal timeline: {e}")
            return []

    # ------------------------------------------------------------------
    # Annual Prompt
    # ------------------------------------------------------------------

    async def get_annual_prompt(self) -> Optional[dict]:
        """Check if an annual financial review prompt is due.

        Looks for a record with marker='annual_review' in the last 365 days.
        If none found, return the review prompt. Otherwise return None.
        """
        if not supabase:
            return None
        try:
            cutoff = (date.today() - timedelta(days=365)).isoformat()
            result = (
                supabase.table("financial_stress_log")
                .select("id")
                .eq("primary_stressor", "annual_review")
                .gte("logged_at", cutoff)
                .limit(1)
                .execute()
            )
            if result.data:
                return None

            return {
                "prompt_due": True,
                "review_areas": [
                    {
                        "area": "emergency_fund",
                        "question": "Do you have 3-6 months of expenses saved in a liquid account?",
                    },
                    {
                        "area": "insurance",
                        "question": "Are your health, life, disability, and property insurance policies up to date?",
                    },
                    {
                        "area": "will_beneficiaries",
                        "question": "Is your will current and are beneficiary designations correct on all accounts?",
                    },
                    {
                        "area": "investments",
                        "question": "Have you reviewed your investment allocations and rebalanced if needed?",
                    },
                    {
                        "area": "debt",
                        "question": "What is your current debt balance and do you have a payoff strategy?",
                    },
                ],
            }
        except Exception as e:
            logger.error(f"Failed to check annual prompt status: {e}")
            return None

    # ------------------------------------------------------------------
    # Life-Goal Alignment
    # ------------------------------------------------------------------

    async def get_life_goal_alignment(self) -> list[dict]:
        """Get financial goals with linked_life_goal and map to funding status.

        Attempts to match linked goals with trips from the trips table
        or other legacy goals.
        """
        if not supabase:
            return []
        try:
            result = (
                supabase.table("financial_goals")
                .select("*")
                .neq("linked_life_goal", None)
                .execute()
            )
            goals = result.data or []
            if not goals:
                return []

            # Fetch trips for cross-reference
            trips_result = (
                supabase.table("trips")
                .select("id, destination, departure_date, status")
                .execute()
            )
            trips = {t["destination"].lower(): t for t in (trips_result.data or [])}

            # Fetch legacy goals for cross-reference
            legacy_result = (
                supabase.table("legacy_goals")
                .select("id, title, status")
                .execute()
            )
            legacy_map = {g["title"].lower(): g for g in (legacy_result.data or [])}

            alignment = []
            for goal in goals:
                target = goal.get("target_amount", 0)
                current = goal.get("current_amount", 0)
                progress_pct = round((current / target * 100) if target > 0 else 0, 2)
                linked = goal.get("linked_life_goal", "")

                matched_trip = trips.get(linked.lower())
                matched_legacy = legacy_map.get(linked.lower())

                entry = {
                    "goal_id": goal.get("id"),
                    "goal_name": goal.get("goal_name"),
                    "linked_life_goal": linked,
                    "funding_progress_pct": progress_pct,
                    "current_amount": current,
                    "target_amount": target,
                    "matched_trip": matched_trip,
                    "matched_legacy_goal": matched_legacy,
                }
                alignment.append(entry)

            return alignment
        except Exception as e:
            logger.error(f"Failed to build life-goal alignment: {e}")
            return []


financial_planning_service = FinancialPlanningService()
