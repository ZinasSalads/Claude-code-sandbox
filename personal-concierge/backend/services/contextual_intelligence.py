"""Contextual Intelligence Engine.

The most powerful reasoning layer in the concierge — takes ANY signal
(calendar event, mood shift, manual mention) and extrapolates implications
across all modules. Connects dots between health, career, social, travel,
wardrobe, and everything else to produce proactive, cross-domain insights.
"""

import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.contextual")

MODEL = "claude-sonnet-4-20250514"


class ContextualIntelligenceEngine:

    async def _build_user_context(self) -> str:
        """Gather user context from multiple tables into a formatted string.

        Each table is fetched independently so a missing table never
        breaks the whole context build.
        """
        if not supabase:
            return "No database connected — limited context available."

        sections: list[str] = []

        # Recent health data
        try:
            result = (
                supabase.table("health_data")
                .select("*")
                .order("recorded_date", desc=True)
                .limit(7)
                .execute()
            )
            if result.data:
                sections.append(f"Recent health data (last 7 entries): {json.dumps(result.data)}")
        except Exception as e:
            logger.debug(f"Could not fetch health_data for context: {e}")

        # Recent check-ins
        try:
            result = (
                supabase.table("check_ins")
                .select("*")
                .order("created_at", desc=True)
                .limit(7)
                .execute()
            )
            if result.data:
                sections.append(f"Recent check-ins: {json.dumps(result.data)}")
        except Exception as e:
            logger.debug(f"Could not fetch check_ins for context: {e}")

        # Career profile
        try:
            result = (
                supabase.table("career_profiles")
                .select("*")
                .limit(1)
                .execute()
            )
            if result.data:
                sections.append(f"Career profile: {json.dumps(result.data[0])}")
        except Exception as e:
            logger.debug(f"Could not fetch career_profiles for context: {e}")

        # Personality profile
        try:
            result = (
                supabase.table("personality_profiles")
                .select("*")
                .limit(1)
                .execute()
            )
            if result.data:
                sections.append(f"Personality profile: {json.dumps(result.data[0])}")
        except Exception as e:
            logger.debug(f"Could not fetch personality_profiles for context: {e}")

        # Legacy profile
        try:
            result = (
                supabase.table("legacy_profile")
                .select("*")
                .limit(1)
                .execute()
            )
            if result.data:
                sections.append(f"Legacy profile: {json.dumps(result.data[0])}")
        except Exception as e:
            logger.debug(f"Could not fetch legacy_profile for context: {e}")

        # Upcoming trips
        try:
            today_iso = date.today().isoformat()
            result = (
                supabase.table("trips")
                .select("*")
                .gte("start_date", today_iso)
                .order("start_date", desc=False)
                .limit(5)
                .execute()
            )
            if result.data:
                sections.append(f"Upcoming trips: {json.dumps(result.data)}")
        except Exception as e:
            logger.debug(f"Could not fetch trips for context: {e}")

        if not sections:
            return "No user data available yet."

        return "\n\n".join(sections)

    async def expand_signal(self, signal: str, signal_type: str) -> dict:
        """Take a raw signal and expand it to full cross-domain implications using Claude."""
        if not ANTHROPIC_API_KEY:
            return {
                "signal_summary": signal,
                "implications": [],
                "modules_to_notify": [],
                "proactive_suggestions": [],
            }

        context = await self._build_user_context()

        prompt = (
            f"You are the contextual intelligence engine for a personal AI concierge.\n\n"
            f"User context:\n{context}\n\n"
            f"Signal ({signal_type}): {signal}\n\n"
            f"Reason about what this means across ALL relevant life domains. "
            f"Be specific — reference actual data from the user context above.\n\n"
            f"Return JSON with exactly this structure:\n"
            f'{{"signal_summary": "<one-line summary>",'
            f' "implications": ['
            f'{{"module": "<module name>", "insight": "<specific insight>", '
            f'"action": "<recommended action>", "priority": "high|medium|low", '
            f'"timing": "now|this_week|before_event"}}], '
            f'"modules_to_notify": ["<module_name>", ...], '
            f'"proactive_suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]}}'
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                system="You are a contextual intelligence engine. Always respond with valid JSON only, no markdown.",
                messages=[{"role": "user", "content": prompt}],
            )
            raw = response.content[0].text.strip()
            expansion = json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Claude returned non-JSON response for signal expansion")
            expansion = {
                "signal_summary": signal,
                "implications": [],
                "modules_to_notify": [],
                "proactive_suggestions": [],
            }
        except Exception as e:
            logger.error(f"Signal expansion failed: {e}")
            expansion = {
                "signal_summary": signal,
                "implications": [],
                "modules_to_notify": [],
                "proactive_suggestions": [],
            }

        # Persist to context_signals table
        if supabase:
            try:
                supabase.table("context_signals").insert({
                    "signal_text": signal,
                    "signal_type": signal_type,
                    "expansion": json.dumps(expansion),
                    "created_at": datetime.utcnow().isoformat(),
                }).execute()
            except Exception as e:
                logger.error(f"Failed to save context signal: {e}")

        return expansion

    async def process_calendar_event(self, event: dict) -> dict:
        """Auto-process a calendar event if it is relevant enough to expand.

        Only expands events within 14 days that are classified as
        travel, formal, or social.
        """
        event_date_str = event.get("event_date")
        event_type = (event.get("event_type") or "").lower()
        event_title = event.get("event_title", "Untitled event")

        # Only expand travel / formal / social events within 14 days
        dominated_types = {"travel", "formal", "social"}
        if event_type not in dominated_types:
            return {"skipped": True, "reason": f"Event type '{event_type}' not in {dominated_types}"}

        if event_date_str:
            try:
                event_date = date.fromisoformat(event_date_str)
                days_until = (event_date - date.today()).days
                if days_until > 14 or days_until < 0:
                    return {"skipped": True, "reason": f"Event is {days_until} days away (threshold: 14)"}
            except ValueError:
                pass

        signal = f"Calendar event: '{event_title}' on {event_date_str or 'unknown date'} (type: {event_type})"
        return await self.expand_signal(signal, signal_type="calendar_event")

    async def monitor_anomalies(self) -> list[dict]:
        """Detect data anomalies across all modules and generate contextual insights."""
        if not supabase:
            return []

        anomalies: list[dict] = []
        today = date.today()

        # 1. Mood score < 4 for 3+ consecutive days
        try:
            three_weeks_ago = (today - timedelta(days=21)).isoformat()
            result = (
                supabase.table("check_ins")
                .select("mood_score, created_at")
                .gte("created_at", three_weeks_ago)
                .order("created_at", desc=True)
                .execute()
            )
            rows = result.data or []
            consecutive_low = 0
            for row in rows:
                if (row.get("mood_score") or 5) < 4:
                    consecutive_low += 1
                else:
                    break
            if consecutive_low >= 3:
                anomalies.append({
                    "type": "low_mood_streak",
                    "description": f"Mood score below 4 for {consecutive_low} consecutive days",
                    "severity": "high",
                    "module": "daily_check_in",
                })
        except Exception as e:
            logger.error(f"Anomaly check failed (mood): {e}")

        # 2. Sleep score < 65 for 5+ days
        try:
            two_weeks_ago = (today - timedelta(days=14)).isoformat()
            result = (
                supabase.table("health_data")
                .select("sleep_score, recorded_date")
                .gte("recorded_date", two_weeks_ago)
                .order("recorded_date", desc=True)
                .execute()
            )
            rows = result.data or []
            consecutive_poor_sleep = 0
            for row in rows:
                if (row.get("sleep_score") or 70) < 65:
                    consecutive_poor_sleep += 1
                else:
                    break
            if consecutive_poor_sleep >= 5:
                anomalies.append({
                    "type": "poor_sleep_streak",
                    "description": f"Sleep score below 65 for {consecutive_poor_sleep} consecutive days",
                    "severity": "high",
                    "module": "health",
                })
        except Exception as e:
            logger.error(f"Anomaly check failed (sleep): {e}")

        # 3. No workouts completed in 7+ days
        try:
            week_ago = (today - timedelta(days=7)).isoformat()
            result = (
                supabase.table("workouts")
                .select("id")
                .gte("completed_at", week_ago)
                .execute()
            )
            if not (result.data or []):
                anomalies.append({
                    "type": "no_workouts",
                    "description": "No workouts completed in the last 7 days",
                    "severity": "medium",
                    "module": "fitness",
                })
        except Exception as e:
            logger.error(f"Anomaly check failed (workouts): {e}")

        # 4. No social interactions in 14 days
        try:
            two_weeks_ago = (today - timedelta(days=14)).isoformat()
            result = (
                supabase.table("social_log")
                .select("id")
                .gte("log_date", two_weeks_ago)
                .execute()
            )
            if not (result.data or []):
                anomalies.append({
                    "type": "social_isolation",
                    "description": "No social interactions logged in the last 14 days",
                    "severity": "medium",
                    "module": "social",
                })
        except Exception as e:
            logger.error(f"Anomaly check failed (social): {e}")

        # Generate gentle contextual insights via Claude for each anomaly
        if anomalies and ANTHROPIC_API_KEY:
            try:
                context = await self._build_user_context()
                anomaly_summary = json.dumps(anomalies)
                client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=800,
                    system=(
                        "You are a caring personal concierge. Given detected anomalies in the user's data, "
                        "provide a gentle, empathetic insight for each one. Be specific and reference the "
                        "user's context. Return a JSON array of objects with keys: type, insight."
                    ),
                    messages=[{
                        "role": "user",
                        "content": (
                            f"User context:\n{context}\n\n"
                            f"Detected anomalies:\n{anomaly_summary}\n\n"
                            f"Provide a gentle contextual insight for each anomaly."
                        ),
                    }],
                )
                raw = response.content[0].text.strip()
                insights = json.loads(raw)
                insight_map = {i["type"]: i["insight"] for i in insights if "type" in i}
                for anomaly in anomalies:
                    anomaly["insight"] = insight_map.get(anomaly["type"], "")
            except Exception as e:
                logger.error(f"Failed to generate anomaly insights: {e}")

        return anomalies

    async def get_recent_signals(self, days: int = 7) -> list[dict]:
        """Get context_signals from the last N days, ordered by created_at desc."""
        if not supabase:
            return []
        try:
            since = (datetime.utcnow() - timedelta(days=days)).isoformat()
            result = (
                supabase.table("context_signals")
                .select("*")
                .gte("created_at", since)
                .order("created_at", desc=True)
                .execute()
            )
            signals = result.data or []
            # Parse expansion JSON strings back to dicts
            for s in signals:
                if isinstance(s.get("expansion"), str):
                    try:
                        s["expansion"] = json.loads(s["expansion"])
                    except json.JSONDecodeError:
                        pass
            return signals
        except Exception as e:
            logger.error(f"Failed to fetch recent signals: {e}")
            return []

    async def manual_signal(self, signal_text: str) -> dict:
        """User manually inputs a signal. Expand and return implications immediately."""
        return await self.expand_signal(signal_text, signal_type="manual_mention")


contextual_engine = ContextualIntelligenceEngine()
