"""Hobbies & Competing Priorities service.

Tracks hobbies, session logging, streaks, dormancy detection,
seasonal hobby awareness, hobby health scoring, and cross-domain
priority conflict detection and resolution.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.hobbies")

MODEL = "claude-sonnet-4-20250514"


class HobbiesService:

    async def get_hobbies(self, status: Optional[str] = None) -> list[dict]:
        """Get all hobbies. Optionally filter by status. Calculate weekly_hours_actual."""
        if not supabase:
            return []
        try:
            query = supabase.table("hobbies").select("*")
            if status:
                query = query.eq("status", status)
            result = query.order("created_at", desc=True).execute()
            hobbies = result.data or []

            # Calculate weekly_hours_actual from hobby_log for current week
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            for hobby in hobbies:
                try:
                    logs = (
                        supabase.table("hobby_log")
                        .select("duration_minutes")
                        .eq("hobby_id", hobby["id"])
                        .gte("session_date", week_start.isoformat())
                        .lte("session_date", today.isoformat())
                        .execute()
                    )
                    total_minutes = sum(
                        l.get("duration_minutes", 0) for l in (logs.data or [])
                    )
                    hobby["weekly_hours_actual"] = round(total_minutes / 60, 2)
                except Exception:
                    hobby["weekly_hours_actual"] = 0.0

            return hobbies
        except Exception as e:
            logger.error(f"Failed to fetch hobbies: {e}")
            return []

    async def add_hobby(self, data: dict) -> dict:
        """Insert a new hobby and return the created record."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = supabase.table("hobbies").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add hobby: {e}")
            return {"error": str(e)}

    async def update_hobby(self, hobby_id: str, data: dict) -> dict:
        """Update a hobby by id."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            result = (
                supabase.table("hobbies")
                .update(data)
                .eq("id", hobby_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update hobby: {e}")
            return {"error": str(e)}

    async def log_session(self, hobby_id: str, data: dict) -> dict:
        """Log a hobby session. Update last_session_date, increment session count,
        calculate streak continuity (session within 2x typical gap)."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            today = date.today()
            row = {
                "hobby_id": hobby_id,
                "session_date": data.get("session_date", today.isoformat()),
                "duration_minutes": data.get("duration_minutes", 0),
                "quality_rating": data.get("quality_rating"),
                "notes": data.get("notes"),
            }
            supabase.table("hobby_log").insert(row).execute()

            # Fetch hobby to update
            hobby_result = (
                supabase.table("hobbies")
                .select("*")
                .eq("id", hobby_id)
                .limit(1)
                .execute()
            )
            hobby = hobby_result.data[0] if hobby_result.data else {}

            # Calculate streak from session history
            logs = (
                supabase.table("hobby_log")
                .select("session_date")
                .eq("hobby_id", hobby_id)
                .order("session_date", desc=True)
                .execute()
            )
            session_dates = sorted(
                set(l["session_date"] for l in (logs.data or []) if l.get("session_date")),
                reverse=True,
            )

            # Determine typical gap: average days between sessions
            streak_continues = True
            typical_gap_days = 7  # default
            if len(session_dates) >= 2:
                gaps = []
                for i in range(len(session_dates) - 1):
                    d1 = date.fromisoformat(session_dates[i])
                    d2 = date.fromisoformat(session_dates[i + 1])
                    gaps.append((d1 - d2).days)
                typical_gap_days = max(1, sum(gaps) / len(gaps))

                # Check if this session continues the streak
                last_session = date.fromisoformat(session_dates[0])
                previous_session = date.fromisoformat(session_dates[1]) if len(session_dates) > 1 else None
                if previous_session:
                    days_since_previous = (last_session - previous_session).days
                    streak_continues = days_since_previous <= (2 * typical_gap_days)

            # Count current streak
            streak_count = 1
            if len(session_dates) >= 2:
                for i in range(len(session_dates) - 1):
                    d1 = date.fromisoformat(session_dates[i])
                    d2 = date.fromisoformat(session_dates[i + 1])
                    if (d1 - d2).days <= (2 * typical_gap_days):
                        streak_count += 1
                    else:
                        break

            # Update hobby record
            total_sessions = hobby.get("total_sessions", 0) + 1
            update_data = {
                "last_session_date": row["session_date"],
                "total_sessions": total_sessions,
                "current_streak": streak_count if streak_continues else 1,
            }
            supabase.table("hobbies").update(update_data).eq("id", hobby_id).execute()

            updated_hobby = {**hobby, **update_data}
            return {
                "hobby": updated_hobby,
                "streak_count": streak_count,
                "streak_continues": streak_continues,
                "typical_gap_days": round(typical_gap_days, 1),
                "session_logged": row,
            }
        except Exception as e:
            logger.error(f"Failed to log hobby session: {e}")
            return {"error": str(e)}

    async def get_dormant_hobbies(self) -> list[dict]:
        """Find active hobbies where last_session_date > 2 * typical gap.
        Sort by satisfaction_rating * dormancy_days descending."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("hobbies")
                .select("*")
                .eq("status", "active")
                .execute()
            )
            hobbies = result.data or []
            today = date.today()
            dormant = []

            for hobby in hobbies:
                if not hobby.get("last_session_date"):
                    # Never had a session — consider dormant
                    dormancy_days = 999
                    typical_gap = 7
                else:
                    last = date.fromisoformat(hobby["last_session_date"])
                    dormancy_days = (today - last).days

                    # Calculate typical gap from hobby_log
                    try:
                        logs = (
                            supabase.table("hobby_log")
                            .select("session_date")
                            .eq("hobby_id", hobby["id"])
                            .order("session_date", desc=True)
                            .execute()
                        )
                        session_dates = sorted(
                            set(l["session_date"] for l in (logs.data or []) if l.get("session_date")),
                            reverse=True,
                        )
                        if len(session_dates) >= 2:
                            gaps = []
                            for i in range(len(session_dates) - 1):
                                d1 = date.fromisoformat(session_dates[i])
                                d2 = date.fromisoformat(session_dates[i + 1])
                                gaps.append((d1 - d2).days)
                            typical_gap = max(1, sum(gaps) / len(gaps))
                        else:
                            typical_gap = 7
                    except Exception:
                        typical_gap = 7

                if dormancy_days > 2 * typical_gap:
                    satisfaction = hobby.get("satisfaction_rating", 0) or 0
                    hobby["dormancy_days"] = dormancy_days
                    hobby["typical_gap_days"] = round(typical_gap, 1)
                    hobby["revival_score"] = satisfaction * dormancy_days
                    dormant.append(hobby)

            dormant.sort(key=lambda h: h.get("revival_score", 0), reverse=True)
            return dormant
        except Exception as e:
            logger.error(f"Failed to get dormant hobbies: {e}")
            return []

    async def get_seasonal_upcoming(self) -> list[dict]:
        """Find seasonal hobbies whose active_months include a month
        within the next 30 days."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("hobbies")
                .select("*")
                .eq("seasonal", True)
                .execute()
            )
            hobbies = result.data or []
            today = date.today()
            upcoming_months = set()
            for day_offset in range(31):
                future = today + timedelta(days=day_offset)
                upcoming_months.add(future.month)

            seasonal_upcoming = []
            for hobby in hobbies:
                active_months = hobby.get("active_months") or []
                if isinstance(active_months, str):
                    try:
                        active_months = json.loads(active_months)
                    except (json.JSONDecodeError, TypeError):
                        active_months = []
                matching_months = [m for m in active_months if m in upcoming_months]
                if matching_months:
                    hobby["matching_months"] = matching_months
                    hobby["is_current_month"] = today.month in active_months
                    seasonal_upcoming.append(hobby)

            return seasonal_upcoming
        except Exception as e:
            logger.error(f"Failed to get seasonal hobbies: {e}")
            return []

    async def get_hobby_health_score(self) -> dict:
        """Score 0-100 based on active hobbies meeting weekly target,
        dormant high-satisfaction hobbies, category variety, seasonal awareness."""
        if not supabase:
            return {"score": 0, "active_count": 0, "dormant_count": 0, "top_insight": "Database not configured"}
        try:
            all_hobbies = await self.get_hobbies()
            active = [h for h in all_hobbies if h.get("status") == "active"]
            dormant = await self.get_dormant_hobbies()
            seasonal = await self.get_seasonal_upcoming()

            score = 0

            # Active hobbies meeting weekly target (+40 pts max)
            meeting_target = 0
            for h in active:
                target = h.get("weekly_hours_target", 0) or 0
                actual = h.get("weekly_hours_actual", 0) or 0
                if target > 0 and actual >= target:
                    meeting_target += 1
            if active:
                target_pct = meeting_target / len(active)
                score += int(target_pct * 40)
            else:
                score += 0

            # Dormant high-satisfaction hobbies penalty (-20 pts max)
            high_sat_dormant = [d for d in dormant if (d.get("satisfaction_rating", 0) or 0) >= 4]
            dormant_penalty = min(20, len(high_sat_dormant) * 5)
            score -= dormant_penalty

            # Category variety (+25 pts max)
            categories = set(h.get("category") for h in active if h.get("category"))
            variety_score = min(25, len(categories) * 5)
            score += variety_score

            # Seasonal hobby in-season and active (+15 pts max)
            seasonal_active = [s for s in seasonal if s.get("status") == "active" and s.get("is_current_month")]
            seasonal_bonus = min(15, len(seasonal_active) * 5)
            score += seasonal_bonus

            score = max(0, min(100, score))

            # Generate top insight
            if high_sat_dormant:
                top_insight = (
                    f"You have {len(high_sat_dormant)} high-satisfaction "
                    f"hobbies going dormant — consider reviving {high_sat_dormant[0].get('name', 'one')}."
                )
            elif meeting_target == len(active) and active:
                top_insight = "Great work — all active hobbies are meeting weekly targets!"
            elif not active:
                top_insight = "No active hobbies tracked. Add some to start building your hobby health."
            else:
                behind = [h for h in active if (h.get("weekly_hours_actual", 0) or 0) < (h.get("weekly_hours_target", 0) or 0)]
                if behind:
                    top_insight = f"{len(behind)} hobbies are below weekly target. Focus on {behind[0].get('name', 'one')}."
                else:
                    top_insight = "Your hobby engagement is balanced. Keep it up!"

            return {
                "score": score,
                "active_count": len(active),
                "dormant_count": len(dormant),
                "meeting_target_count": meeting_target,
                "category_count": len(categories),
                "seasonal_active_count": len(seasonal_active),
                "top_insight": top_insight,
            }
        except Exception as e:
            logger.error(f"Failed to calculate hobby health score: {e}")
            return {"score": 0, "active_count": 0, "dormant_count": 0, "top_insight": str(e)}

    async def detect_priority_conflict(self, target_date: date) -> Optional[dict]:
        """Check if target_date has competing high-priority demands from
        multiple sources. If 3+ compete, use Claude to frame the conflict."""
        if not supabase:
            return None
        try:
            date_str = target_date.isoformat()
            competing_items = []

            # Calendar events (optional table)
            try:
                cal_result = (
                    supabase.table("calendar_events")
                    .select("id, title, start_time, priority")
                    .eq("event_date", date_str)
                    .execute()
                )
                for ev in (cal_result.data or []):
                    if (ev.get("priority") or "").lower() in ("high", "critical"):
                        competing_items.append({
                            "source": "calendar",
                            "title": ev.get("title"),
                            "priority": ev.get("priority"),
                        })
            except Exception:
                pass  # calendar_events table may not exist

            # Growth habits due
            try:
                habits = (
                    supabase.table("growth_habits")
                    .select("id, name, priority")
                    .eq("next_due_date", date_str)
                    .execute()
                )
                for h in (habits.data or []):
                    if (h.get("priority") or "").lower() in ("high", "critical"):
                        competing_items.append({
                            "source": "growth_habit",
                            "title": h.get("name"),
                            "priority": h.get("priority"),
                        })
            except Exception:
                pass

            # Social contacts overdue
            try:
                contacts = (
                    supabase.table("social_contacts")
                    .select("id, name, importance_weight, last_contact_date, target_contact_days")
                    .eq("active", True)
                    .execute()
                )
                for c in (contacts.data or []):
                    if c.get("last_contact_date") and c.get("target_contact_days"):
                        last = date.fromisoformat(c["last_contact_date"])
                        overdue_by = (target_date - last).days - c["target_contact_days"]
                        if overdue_by > 0 and (c.get("importance_weight", 0) or 0) >= 7:
                            competing_items.append({
                                "source": "social",
                                "title": f"Reconnect with {c.get('name')}",
                                "priority": "high",
                                "overdue_by_days": overdue_by,
                            })
            except Exception:
                pass

            # Fitness plans
            try:
                fitness = (
                    supabase.table("fitness_plans")
                    .select("id, name, priority, scheduled_date")
                    .eq("scheduled_date", date_str)
                    .execute()
                )
                for f in (fitness.data or []):
                    if (f.get("priority") or "").lower() in ("high", "critical"):
                        competing_items.append({
                            "source": "fitness",
                            "title": f.get("name"),
                            "priority": f.get("priority"),
                        })
            except Exception:
                pass

            # Hobby targets (active hobbies behind schedule)
            try:
                active_hobbies = await self.get_hobbies(status="active")
                for h in active_hobbies:
                    target = h.get("weekly_hours_target", 0) or 0
                    actual = h.get("weekly_hours_actual", 0) or 0
                    if target > 0 and actual < target * 0.5:
                        competing_items.append({
                            "source": "hobby",
                            "title": f"Catch up on {h.get('name')}",
                            "priority": "medium",
                            "hours_behind": round(target - actual, 1),
                        })
            except Exception:
                pass

            if len(competing_items) < 3:
                return None

            # Use Claude to frame the conflict
            values_frame = ""
            options = []
            if ANTHROPIC_API_KEY:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    response = client.messages.create(
                        model=MODEL,
                        max_tokens=300,
                        system=(
                            "You help someone navigate competing priorities. "
                            "Frame the conflict using personal values (health, relationships, growth, joy). "
                            "Suggest 2-3 concrete options for the day. Be concise."
                        ),
                        messages=[{
                            "role": "user",
                            "content": (
                                f"On {date_str}, I have these competing demands:\n"
                                + json.dumps(competing_items, indent=2)
                                + "\nFrame this conflict and suggest options."
                            ),
                        }],
                    )
                    ai_text = response.content[0].text.strip()
                    # Split into frame and options
                    parts = ai_text.split("\n\n", 1)
                    values_frame = parts[0]
                    if len(parts) > 1:
                        options = [
                            line.lstrip("- •0123456789.) ")
                            for line in parts[1].split("\n")
                            if line.strip()
                        ]
                except Exception as e:
                    logger.error(f"Claude conflict framing failed: {e}")
                    values_frame = "Multiple high-priority items are competing for your time."
                    options = [
                        "Prioritize the time-sensitive item",
                        "Combine compatible activities",
                        "Reschedule the most flexible item",
                    ]
            else:
                values_frame = "Multiple high-priority items are competing for your time."
                options = [
                    "Prioritize the time-sensitive item",
                    "Combine compatible activities",
                    "Reschedule the most flexible item",
                ]

            return {
                "date": date_str,
                "competing_items": competing_items,
                "values_frame": values_frame,
                "options": options,
            }
        except Exception as e:
            logger.error(f"Failed to detect priority conflict: {e}")
            return None

    async def resolve_conflict(self, conflict_data: dict, chosen_option: str) -> dict:
        """Log a conflict resolution to the priority_conflicts table."""
        if not supabase:
            return {"error": "Database not configured"}
        try:
            row = {
                "conflict_date": conflict_data.get("conflict_date") or conflict_data.get("date"),
                "competing_items": json.dumps(conflict_data.get("competing_items", [])),
                "resolution": conflict_data.get("resolution", ""),
                "chosen_option": chosen_option,
            }
            result = supabase.table("priority_conflicts").insert(row).execute()
            return result.data[0] if result.data else row
        except Exception as e:
            logger.error(f"Failed to resolve conflict: {e}")
            return {"error": str(e)}

    async def get_weekly_hobby_briefing(self) -> dict:
        """Weekly summary: active this week, dormant alerts, seasonal upcoming,
        hobby health score, and a nudge."""
        if not supabase:
            return {}
        try:
            all_hobbies = await self.get_hobbies()
            active_this_week = [
                h for h in all_hobbies
                if h.get("status") == "active" and (h.get("weekly_hours_actual", 0) or 0) > 0
            ]
            dormant_alerts = await self.get_dormant_hobbies()
            seasonal_upcoming = await self.get_seasonal_upcoming()
            health = await self.get_hobby_health_score()

            # Generate a specific nudge
            nudge = None
            if dormant_alerts:
                top = dormant_alerts[0]
                nudge = (
                    f"You haven't done {top.get('name')} in {top.get('dormancy_days', '?')} days. "
                    f"Even 15 minutes would restart the habit."
                )
            elif seasonal_upcoming:
                s = seasonal_upcoming[0]
                nudge = f"{s.get('name')} season is coming up — time to dust off the gear!"
            else:
                behind = [
                    h for h in all_hobbies
                    if h.get("status") == "active"
                    and (h.get("weekly_hours_actual", 0) or 0) < (h.get("weekly_hours_target", 0) or 0)
                ]
                if behind:
                    nudge = f"You're behind on {behind[0].get('name')} — schedule a session this week."
                else:
                    nudge = "All hobbies on track. Nice work!"

            return {
                "active_this_week": [
                    {
                        "name": h.get("name"),
                        "hours": h.get("weekly_hours_actual", 0),
                        "target": h.get("weekly_hours_target", 0),
                    }
                    for h in active_this_week
                ],
                "dormant_alerts": [
                    {
                        "name": d.get("name"),
                        "dormancy_days": d.get("dormancy_days"),
                        "satisfaction_rating": d.get("satisfaction_rating"),
                    }
                    for d in dormant_alerts[:5]
                ],
                "seasonal_upcoming": [
                    {
                        "name": s.get("name"),
                        "matching_months": s.get("matching_months"),
                    }
                    for s in seasonal_upcoming
                ],
                "hobby_health_score": health,
                "nudge": nudge,
            }
        except Exception as e:
            logger.error(f"Failed to generate hobby briefing: {e}")
            return {}


hobbies_service = HobbiesService()
