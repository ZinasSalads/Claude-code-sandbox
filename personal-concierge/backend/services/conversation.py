"""Conversation Service — AI concierge chat with deep context awareness.

Builds a rich system prompt from the user's health data, goals, reminders,
check-ins, and context signals so every response feels personal and grounded
in real data rather than generic advice.
"""

import json
import logging
import uuid
from datetime import date, timedelta, datetime, timezone

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.conversation")

MODEL = "claude-sonnet-4-20250514"


class ConversationService:
    """Full AI concierge chat — deeply context-aware."""

    # ------------------------------------------------------------------
    # System prompt
    # ------------------------------------------------------------------

    async def build_system_prompt(self) -> str:
        """Build a full context-aware system prompt fresh for each session.

        Each section is wrapped in try/except so a missing or empty table
        never breaks the whole prompt.
        """
        today = date.today()
        day_of_week = today.strftime("%A")
        sections: list[str] = []

        sections.append(
            f"You are a personal concierge AI. Today is {today.isoformat()} ({day_of_week})."
        )

        # --- User profile / name ---
        user_name = "there"
        try:
            if supabase:
                result = (
                    supabase.table("user_profile")
                    .select("*")
                    .limit(1)
                    .execute()
                )
                if result.data:
                    profile = result.data[0]
                    user_name = profile.get("name") or profile.get("first_name") or "there"
                    sections.append(
                        f"User profile: {json.dumps(profile, default=str)}"
                    )
        except Exception as e:
            logger.error(f"Error loading user profile: {e}")

        sections.append(f"Address the user as \"{user_name}\".")

        # --- Health data (today + 7-day trends) ---
        try:
            if supabase:
                week_ago = (today - timedelta(days=7)).isoformat()
                result = (
                    supabase.table("health_data")
                    .select("date, readiness_score, sleep_score, hrv_average")
                    .gte("date", week_ago)
                    .order("date", desc=False)
                    .execute()
                )
                rows = result.data or []
                if rows:
                    today_row = next(
                        (r for r in rows if r.get("date") == today.isoformat()), None
                    )
                    avg_readiness = _safe_avg([r.get("readiness_score") for r in rows])
                    avg_sleep = _safe_avg([r.get("sleep_score") for r in rows])
                    avg_hrv = _safe_avg([r.get("hrv_average") for r in rows])

                    health_lines = ["Health summary (last 7 days):"]
                    if today_row:
                        health_lines.append(
                            f"  Today — readiness: {today_row.get('readiness_score')}, "
                            f"sleep: {today_row.get('sleep_score')}, "
                            f"HRV: {today_row.get('hrv_average')}"
                        )
                    health_lines.append(
                        f"  7-day averages — readiness: {avg_readiness}, "
                        f"sleep: {avg_sleep}, HRV: {avg_hrv}"
                    )
                    sections.append("\n".join(health_lines))
        except Exception as e:
            logger.error(f"Error loading health data: {e}")

        # --- Current check-in ---
        try:
            if supabase:
                result = (
                    supabase.table("check_ins")
                    .select("*")
                    .eq("date", today.isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    ci = result.data[0]
                    sections.append(
                        f"Today's check-in: energy={ci.get('energy')}, "
                        f"mood={ci.get('mood')}, stress={ci.get('stress')}, "
                        f"soreness={ci.get('soreness')}, notes=\"{ci.get('notes', '')}\""
                    )
        except Exception as e:
            logger.error(f"Error loading check-in data: {e}")

        # --- Active goals ---
        try:
            if supabase:
                goals_parts: list[str] = []

                # Financial goals
                try:
                    fg = (
                        supabase.table("financial_goals")
                        .select("name, target_amount, current_amount, target_date, status")
                        .eq("status", "active")
                        .execute()
                    )
                    if fg.data:
                        goals_parts.append(
                            "Financial goals: " + json.dumps(fg.data, default=str)
                        )
                except Exception:
                    pass

                # Legacy profile goals
                try:
                    lg = (
                        supabase.table("legacy_profile")
                        .select("*")
                        .limit(1)
                        .execute()
                    )
                    if lg.data:
                        goals_parts.append(
                            "Legacy/life goals: " + json.dumps(lg.data[0], default=str)
                        )
                except Exception:
                    pass

                if goals_parts:
                    sections.append("Active goals:\n  " + "\n  ".join(goals_parts))
        except Exception as e:
            logger.error(f"Error loading goals: {e}")

        # --- Active reminders ---
        try:
            if supabase:
                result = (
                    supabase.table("reminders")
                    .select("title, message, due_at, priority")
                    .eq("status", "active")
                    .order("due_at", desc=False)
                    .limit(10)
                    .execute()
                )
                if result.data:
                    sections.append(
                        "Active reminders: " + json.dumps(result.data, default=str)
                    )
        except Exception as e:
            logger.error(f"Error loading reminders: {e}")

        # --- Recent context signals ---
        try:
            if supabase:
                result = (
                    supabase.table("context_signals")
                    .select("signal_type, value, created_at")
                    .order("created_at", desc=True)
                    .limit(3)
                    .execute()
                )
                if result.data:
                    sections.append(
                        "Recent context signals: " + json.dumps(result.data, default=str)
                    )
        except Exception as e:
            logger.error(f"Error loading context signals: {e}")

        # --- Coaching instructions ---
        sections.append(
            "Coaching instructions:\n"
            "- Be conversational and warm, but never sycophantic.\n"
            "- Reference specific data points when relevant (scores, trends, goals).\n"
            "- If the user's readiness or sleep is low, acknowledge it and adjust advice.\n"
            "- Proactively surface reminders or goals that are relevant to the conversation.\n"
            "- Keep responses concise unless the user asks for detail.\n"
            "- Never fabricate data. If you don't have information, say so."
        )

        return "\n\n".join(sections)

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    async def send_message(
        self,
        session_id: str,
        user_message: str,
        history: list[dict] | None = None,
    ) -> dict:
        """Send a message and get a concierge response.

        Parameters
        ----------
        session_id : str
            UUID grouping messages in a session.
        user_message : str
            The latest user message.
        history : list[dict] | None
            Optional prior messages as [{role, content}, ...].

        Returns
        -------
        dict  {response: str, session_id: str}
        """
        if not ANTHROPIC_API_KEY:
            return {
                "response": (
                    "The Anthropic API key is not configured. "
                    "Please set ANTHROPIC_API_KEY in your environment to enable the concierge."
                ),
                "session_id": session_id,
            }

        system_prompt = await self.build_system_prompt()

        # Build messages list
        messages: list[dict] = []
        if history:
            for msg in history:
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })
        messages.append({"role": "user", "content": user_message})

        # Call Claude
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            api_response = client.messages.create(
                model=MODEL,
                max_tokens=1024,
                system=system_prompt,
                messages=messages,
            )
            assistant_text = api_response.content[0].text
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            return {
                "response": "Sorry, I encountered an error processing your request. Please try again.",
                "session_id": session_id,
            }

        # Persist both messages
        self._save_message(session_id, "user", user_message)
        self._save_message(session_id, "assistant", assistant_text)

        return {"response": assistant_text, "session_id": session_id}

    # ------------------------------------------------------------------
    # History helpers
    # ------------------------------------------------------------------

    async def get_history(self, session_id: str) -> list[dict]:
        """Get all conversation messages for a session ordered by created_at asc."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("conversations")
                .select("*")
                .eq("session_id", session_id)
                .order("created_at", desc=False)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Error fetching history for session {session_id}: {e}")
            return []

    async def get_recent_sessions(self, limit: int = 5) -> list[dict]:
        """Get distinct recent sessions with preview and message count."""
        if not supabase:
            return []
        try:
            # Fetch recent conversations ordered by newest first
            result = (
                supabase.table("conversations")
                .select("session_id, role, content, created_at")
                .order("created_at", desc=True)
                .execute()
            )
            rows = result.data or []
            if not rows:
                return []

            # Group by session_id preserving order of first appearance
            seen: dict[str, dict] = {}
            for row in rows:
                sid = row["session_id"]
                if sid not in seen:
                    seen[sid] = {
                        "session_id": sid,
                        "last_active": row["created_at"],
                        "preview": "",
                        "message_count": 0,
                    }
                seen[sid]["message_count"] += 1
                # Use the first user message as preview
                if not seen[sid]["preview"] and row.get("role") == "user":
                    seen[sid]["preview"] = (row.get("content") or "")[:120]

            sessions = list(seen.values())[:limit]
            return sessions
        except Exception as e:
            logger.error(f"Error fetching recent sessions: {e}")
            return []

    async def delete_session(self, session_id: str) -> dict:
        """Delete all conversation messages for a session."""
        if not supabase:
            return {}
        try:
            supabase.table("conversations").delete().eq(
                "session_id", session_id
            ).execute()
            return {"deleted": True, "session_id": session_id}
        except Exception as e:
            logger.error(f"Error deleting session {session_id}: {e}")
            return {}

    # ------------------------------------------------------------------
    # Debug / context
    # ------------------------------------------------------------------

    async def get_context_summary(self) -> dict:
        """Return the current system prompt context as a dict (for debug)."""
        prompt = await self.build_system_prompt()
        sections = prompt.split("\n\n")

        summary: dict = {}
        for section in sections:
            if section.startswith("You are a personal concierge"):
                summary["identity"] = section
            elif section.startswith("Address the user"):
                summary["greeting"] = section
            elif section.startswith("User profile:"):
                summary["user_profile"] = section
            elif section.startswith("Health summary"):
                summary["health"] = section
            elif section.startswith("Today's check-in"):
                summary["check_in"] = section
            elif section.startswith("Active goals"):
                summary["goals"] = section
            elif section.startswith("Active reminders"):
                summary["reminders"] = section
            elif section.startswith("Recent context signals"):
                summary["context_signals"] = section
            elif section.startswith("Coaching instructions"):
                summary["coaching_instructions"] = section
            else:
                summary.setdefault("other", []).append(section)

        summary["full_prompt_length"] = len(prompt)
        return summary

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _save_message(self, session_id: str, role: str, content: str) -> None:
        """Persist a single message to the conversations table."""
        if not supabase:
            return
        try:
            supabase.table("conversations").insert({
                "id": str(uuid.uuid4()),
                "session_id": session_id,
                "role": role,
                "content": content,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.error(f"Error saving message: {e}")


# ------------------------------------------------------------------
# Module-level helpers
# ------------------------------------------------------------------

def _safe_avg(values: list) -> float | None:
    """Return the rounded average of non-None numeric values, or None."""
    nums = [v for v in values if v is not None]
    if not nums:
        return None
    return round(sum(nums) / len(nums), 1)


conversation_service = ConversationService()
