"""Social & Life Balance service.

Tracks social circle, connection cadence, social health scoring,
and intentional leisure vs passive consumption.

Social Health Score (0-100) calculated weekly:
  Connection Score:  Did you meet connection goals? (40%)
  Quality Score:     Rated quality of interactions (30%)
  Leisure Score:     Intentional leisure ratio (20%)
  Balance Score:     Social vs solo recovery balance (10%)
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.social")

MODEL = "claude-sonnet-4-20250514"


class SocialService:

    async def get_social_circle(self) -> list[dict]:
        """Get all active contacts with last_contact_date and days since."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("social_contacts")
                .select("*")
                .eq("active", True)
                .order("importance_weight", desc=True)
                .execute()
            )
            contacts = result.data or []
            today = date.today()
            for c in contacts:
                if c.get("last_contact_date"):
                    last = date.fromisoformat(c["last_contact_date"])
                    c["days_since_contact"] = (today - last).days
                    c["is_overdue"] = c["days_since_contact"] > (c.get("target_contact_days") or 14)
                else:
                    c["days_since_contact"] = None
                    c["is_overdue"] = True
            return contacts
        except Exception as e:
            logger.error(f"Failed to fetch social circle: {e}")
            return []

    async def add_contact(self, data: dict) -> dict:
        """Add a new contact."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = supabase.table("social_contacts").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add contact: {e}")
            return {"error": str(e)}

    async def update_contact(self, contact_id: str, data: dict) -> dict:
        """Update a contact."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("social_contacts")
                .update(data)
                .eq("id", contact_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update contact: {e}")
            return {"error": str(e)}

    async def get_overdue_connections(self) -> list[dict]:
        """Returns contacts overdue for connection, sorted by importance."""
        contacts = await self.get_social_circle()
        overdue = [c for c in contacts if c.get("is_overdue")]
        overdue.sort(key=lambda c: (-(c.get("importance_weight") or 0), -(c.get("days_since_contact") or 0)))
        return overdue

    async def log_connection(self, contact_id: str, data: dict) -> dict:
        """Log a social interaction. Updates last_contact_date on contact."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            row = {
                "contact_id": contact_id,
                "log_date": data.get("log_date", date.today().isoformat()),
                "activity_type": data.get("activity_type"),
                "duration_minutes": data.get("duration_minutes"),
                "quality_rating": data.get("quality_rating"),
                "notes": data.get("notes"),
            }
            result = supabase.table("social_log").insert(row).execute()

            # Update last_contact_date on the contact
            supabase.table("social_contacts").update(
                {"last_contact_date": row["log_date"]}
            ).eq("id", contact_id).execute()

            return {"status": "ok", "data": result.data[0] if result.data else row}
        except Exception as e:
            logger.error(f"Failed to log connection: {e}")
            return {"error": str(e)}

    async def calculate_weekly_social_score(self, week_start: date = None) -> dict:
        """Calculate weekly social health score."""
        if not supabase:
            return {"score": 0, "error": "Database not configured"}

        if not week_start:
            today = date.today()
            week_start = today - timedelta(days=today.weekday())

        week_end = week_start + timedelta(days=6)

        try:
            # Get connections this week
            logs = (
                supabase.table("social_log")
                .select("*, social_contacts(name, importance_weight, target_contact_days)")
                .gte("log_date", week_start.isoformat())
                .lte("log_date", week_end.isoformat())
                .execute()
            )
            week_logs = logs.data or []

            # Get all contacts
            contacts = (
                supabase.table("social_contacts")
                .select("*")
                .eq("active", True)
                .execute()
            )
            all_contacts = contacts.data or []

            # Connection score (40%): % of contacts connected with this week who are due
            due_contacts = [c for c in all_contacts if (c.get("target_contact_days") or 14) <= 7]
            connected_ids = set(l.get("contact_id") for l in week_logs)
            connection_pct = len(connected_ids) / max(len(due_contacts), 1)
            connection_score = min(100, int(connection_pct * 100))

            # Quality score (30%): average quality rating
            ratings = [l.get("quality_rating") for l in week_logs if l.get("quality_rating")]
            quality_score = int((sum(ratings) / max(len(ratings), 1)) * 20) if ratings else 50

            # Leisure score (20%): placeholder — based on number of interactions
            leisure_score = min(100, len(week_logs) * 20)

            # Balance score (10%): having some social time but not too much
            total_minutes = sum(l.get("duration_minutes", 0) for l in week_logs)
            balance_score = 100 if 60 <= total_minutes <= 600 else max(0, 100 - abs(total_minutes - 300) // 5)

            overall = int(
                connection_score * 0.4
                + quality_score * 0.3
                + leisure_score * 0.2
                + balance_score * 0.1
            )

            # Generate insight
            insight = f"You connected with {len(connected_ids)} people this week."
            nudges = []
            overdue = await self.get_overdue_connections()
            if overdue:
                nudges.append(f"Reach out to {overdue[0]['name']} — it's been a while.")
            if not ratings:
                nudges.append("Rate your social interactions to improve this score.")
            if total_minutes < 60:
                nudges.append("Try to schedule at least one quality social interaction this week.")

            return {
                "score": overall,
                "connection_score": connection_score,
                "quality_score": quality_score,
                "leisure_score": leisure_score,
                "balance_score": balance_score,
                "top_insight": insight,
                "nudges": nudges,
                "week_start": week_start.isoformat(),
            }
        except Exception as e:
            logger.error(f"Failed to calculate social score: {e}")
            return {"score": 0, "error": str(e)}

    async def get_social_briefing(self) -> dict:
        """For Command Center widget."""
        overdue = await self.get_overdue_connections()
        score = await self.calculate_weekly_social_score()

        nudge = None
        if overdue:
            top = overdue[0]
            days = top.get("days_since_contact")
            if days:
                nudge = f"It's been {days} days since you connected with {top['name']}."
            else:
                nudge = f"You haven't connected with {top['name']} yet."

        return {
            "score": score.get("score", 0),
            "overdue_connections": overdue[:3],
            "nudge": nudge,
        }

    async def suggest_social_activity(self, contact_id: str) -> str:
        """Claude suggests an activity for this contact."""
        if not ANTHROPIC_API_KEY:
            return "Consider reaching out with a simple message or call."

        contact = None
        if supabase:
            try:
                result = (
                    supabase.table("social_contacts")
                    .select("*")
                    .eq("id", contact_id)
                    .limit(1)
                    .execute()
                )
                contact = result.data[0] if result.data else None
            except Exception:
                pass

        if not contact:
            return "Reach out and suggest catching up."

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=100,
                system="You suggest one specific social activity. 1-2 sentences. Natural, not forced.",
                messages=[{
                    "role": "user",
                    "content": (
                        f"Suggest an activity for {contact['name']} "
                        f"(relationship: {contact.get('relationship_type', 'friend')}, "
                        f"preferred activities: {contact.get('preferred_activities', ['casual'])})"
                    ),
                }],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Social activity suggestion failed: {e}")
            return "Consider reaching out for a casual catch-up."


social_service = SocialService()
