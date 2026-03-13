"""Relationship Coaching service.

Based on Gottman method and attachment theory principles.
Provides relationship health scoring, drift detection, and
personalized coaching insights for each relationship.

Relationship Health Score (0-100) per relationship:
  Connection Frequency:  Meeting cadence vs target (30%)
  Quality Score:         Rated interaction quality (25%)
  Reciprocity:           Support given vs received balance (20%)
  Growth Score:          Shared activities, deep conversations (15%)
  Energy Score:          Do interactions energize or drain (10%)
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.relationships")

MODEL = "claude-sonnet-4-20250514"


class RelationshipCoachingService:

    async def calculate_relationship_score(self, contact_id: str) -> dict:
        """Calculate relationship health score (0-100) with breakdown and trend."""
        if not supabase:
            return {"score": 0, "breakdown": {}, "trend": "stable", "coaching_note": "Database not configured."}

        try:
            # Fetch relationship record
            rel_result = (
                supabase.table("relationships")
                .select("*, social_contacts(name, importance_weight, target_contact_days)")
                .eq("contact_id", contact_id)
                .limit(1)
                .execute()
            )
            relationship = rel_result.data[0] if rel_result.data else None
            if not relationship:
                return {"score": 0, "breakdown": {}, "trend": "stable", "coaching_note": "No relationship record found."}

            target_days = relationship.get("social_contacts", {}).get("target_contact_days", 14)
            contact_name = relationship.get("social_contacts", {}).get("name", "this person")

            # Fetch recent social_log entries (last 30 days)
            thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
            logs_result = (
                supabase.table("social_log")
                .select("*")
                .eq("contact_id", contact_id)
                .gte("log_date", thirty_days_ago)
                .order("log_date", desc=True)
                .execute()
            )
            logs = logs_result.data or []

            # Fetch recent relationship_checkins (last 30 days)
            checkins_result = (
                supabase.table("relationship_checkins")
                .select("*")
                .eq("contact_id", contact_id)
                .gte("checkin_date", thirty_days_ago)
                .order("checkin_date", desc=True)
                .execute()
            )
            checkins = checkins_result.data or []

            # --- Connection Frequency (30%) ---
            if logs:
                days_in_period = 30
                expected_meetings = max(1, days_in_period / max(target_days, 1))
                actual_meetings = len(logs)
                connection_ratio = min(actual_meetings / expected_meetings, 1.5)
                connection_frequency = min(100, int(connection_ratio * 70))
            else:
                connection_frequency = 10

            # --- Quality Score (25%) ---
            quality_ratings = [c.get("interaction_quality") for c in checkins if c.get("interaction_quality")]
            if quality_ratings:
                avg_quality = sum(quality_ratings) / len(quality_ratings)
                quality_score = min(100, int(avg_quality * 10))
            else:
                quality_score = 50

            # --- Reciprocity (20%) ---
            given_count = sum(1 for c in checkins if c.get("interaction_type") in ("support_given", "helped", "gave_advice", "gave_gift"))
            received_count = sum(1 for c in checkins if c.get("interaction_type") in ("support_received", "was_helped", "got_advice", "got_gift"))
            total_directional = given_count + received_count
            if total_directional > 0:
                balance = 1 - abs(given_count - received_count) / total_directional
                reciprocity = int(balance * 100)
            else:
                reciprocity = 50

            # --- Growth Score (15%) ---
            growth_types = {"deep_conversation", "shared_activity", "new_experience", "learning_together", "adventure"}
            growth_interactions = sum(1 for c in checkins if c.get("interaction_type") in growth_types)
            growth_from_logs = sum(1 for l in logs if l.get("activity_type") in growth_types)
            total_growth = growth_interactions + growth_from_logs
            growth_score = min(100, total_growth * 25)

            # --- Energy Score (10%) ---
            energy_values = [c.get("energy_after") for c in checkins if c.get("energy_after") is not None]
            if energy_values:
                avg_energy = sum(energy_values) / len(energy_values)
                # energy_after is on a scale where positive = energizing, negative = draining
                # Normalize: assume range -5 to 5, map to 0-100
                energy_score = min(100, max(0, int((avg_energy + 5) * 10)))
            else:
                energy_score = 50

            # --- Overall Score ---
            overall = int(
                connection_frequency * 0.30
                + quality_score * 0.25
                + reciprocity * 0.20
                + growth_score * 0.15
                + energy_score * 0.10
            )

            breakdown = {
                "connection_frequency": connection_frequency,
                "quality_score": quality_score,
                "reciprocity": reciprocity,
                "growth_score": growth_score,
                "energy_score": energy_score,
            }

            # --- Trend: compare last 2 weeks ---
            fourteen_days_ago = (date.today() - timedelta(days=14)).isoformat()
            twenty_eight_days_ago = (date.today() - timedelta(days=28)).isoformat()

            recent_checkins = [c for c in checkins if c.get("checkin_date", "") >= fourteen_days_ago]
            older_checkins = [c for c in checkins if twenty_eight_days_ago <= c.get("checkin_date", "") < fourteen_days_ago]

            recent_avg = 0
            older_avg = 0
            if recent_checkins:
                recent_qualities = [c.get("interaction_quality", 5) for c in recent_checkins]
                recent_avg = sum(recent_qualities) / len(recent_qualities)
            if older_checkins:
                older_qualities = [c.get("interaction_quality", 5) for c in older_checkins]
                older_avg = sum(older_qualities) / len(older_qualities)

            if recent_avg > older_avg + 0.5:
                trend = "improving"
            elif recent_avg < older_avg - 0.5:
                trend = "declining"
            else:
                trend = "stable"

            # --- Coaching note ---
            if overall >= 80:
                coaching_note = f"Your relationship with {contact_name} is thriving. Keep up the meaningful connection."
            elif overall >= 60:
                coaching_note = f"Things are going well with {contact_name}. A little more intentional quality time could make it even stronger."
            elif overall >= 40:
                coaching_note = f"Your connection with {contact_name} could use some attention. Consider reaching out for a deeper conversation."
            else:
                coaching_note = f"It might be time to reconnect with {contact_name}. Even a small gesture can reignite a meaningful bond."

            if trend == "declining":
                coaching_note += " The trend has been dipping recently — a good time to invest a bit more."

            return {
                "score": overall,
                "breakdown": breakdown,
                "trend": trend,
                "coaching_note": coaching_note,
            }

        except Exception as e:
            logger.error(f"Failed to calculate relationship score for {contact_id}: {e}")
            return {"score": 0, "breakdown": {}, "trend": "stable", "coaching_note": "Unable to calculate score."}

    async def get_overall_health(self) -> dict:
        """Weighted average relationship health across all relationships."""
        if not supabase:
            return {"score": 0, "strongest": [], "needs_attention": [], "overdue": [], "positive_ratio": 0.0, "coach_insight": "Database not configured."}

        try:
            # Get all relationships with contact info
            rel_result = (
                supabase.table("relationships")
                .select("*, social_contacts(id, name, importance_weight, target_contact_days, last_contact_date, active)")
                .execute()
            )
            relationships = rel_result.data or []
            relationships = [r for r in relationships if r.get("social_contacts", {}).get("active", True)]

            if not relationships:
                return {"score": 0, "strongest": [], "needs_attention": [], "overdue": [], "positive_ratio": 0.0, "coach_insight": "No relationships tracked yet."}

            # Calculate score for each relationship
            scored = []
            total_weighted_score = 0
            total_weight = 0
            positive_count = 0

            for rel in relationships:
                contact_id = rel.get("contact_id")
                contact = rel.get("social_contacts", {})
                weight = contact.get("importance_weight", 5)
                score_data = await self.calculate_relationship_score(contact_id)
                score = score_data.get("score", 0)

                scored.append({
                    "contact_id": contact_id,
                    "name": contact.get("name", "Unknown"),
                    "score": score,
                    "trend": score_data.get("trend", "stable"),
                    "importance_weight": weight,
                })

                total_weighted_score += score * weight
                total_weight += weight
                if score >= 60:
                    positive_count += 1

            overall_score = int(total_weighted_score / max(total_weight, 1))

            # Sort by score
            scored.sort(key=lambda x: x["score"], reverse=True)

            # Strongest (top 2)
            strongest = scored[:2]

            # Needs attention: lowest scored among important relationships (weight >= 5)
            important = [s for s in scored if s["importance_weight"] >= 5]
            important.sort(key=lambda x: x["score"])
            needs_attention = important[:3]

            # Overdue contacts
            today = date.today()
            overdue = []
            for rel in relationships:
                contact = rel.get("social_contacts", {})
                last_contact = contact.get("last_contact_date")
                target_days = contact.get("target_contact_days", 14)
                if last_contact:
                    days_since = (today - date.fromisoformat(last_contact)).days
                    if days_since > target_days:
                        overdue.append({
                            "contact_id": contact.get("id"),
                            "name": contact.get("name", "Unknown"),
                            "days_overdue": days_since - target_days,
                            "days_since_contact": days_since,
                        })
                else:
                    overdue.append({
                        "contact_id": contact.get("id"),
                        "name": contact.get("name", "Unknown"),
                        "days_overdue": None,
                        "days_since_contact": None,
                    })
            overdue.sort(key=lambda x: -(x.get("days_overdue") or 999))

            positive_ratio = round(positive_count / max(len(scored), 1), 2)

            # Generate coach insight
            if overall_score >= 75:
                coach_insight = "Your social world is in great shape. You're nurturing the relationships that matter most."
            elif overall_score >= 50:
                coach_insight = "Your relationships are generally healthy, but a few could use more intentional attention."
            else:
                coach_insight = "Your relationship health has room to grow. Focus on one meaningful connection this week."

            if needs_attention:
                top_need = needs_attention[0]["name"]
                coach_insight += f" Consider prioritizing time with {top_need}."

            return {
                "score": overall_score,
                "strongest": strongest,
                "needs_attention": needs_attention,
                "overdue": overdue[:5],
                "positive_ratio": positive_ratio,
                "coach_insight": coach_insight,
            }

        except Exception as e:
            logger.error(f"Failed to calculate overall relationship health: {e}")
            return {"score": 0, "strongest": [], "needs_attention": [], "overdue": [], "positive_ratio": 0.0, "coach_insight": "Unable to assess health."}

    async def log_interaction(self, contact_id: str, data: dict) -> dict:
        """Log a relationship checkin and recalculate score."""
        if not supabase:
            return {"error": "Database not configured"}

        try:
            row = {
                "contact_id": contact_id,
                "checkin_date": data.get("checkin_date", date.today().isoformat()),
                "interaction_quality": data.get("interaction_quality"),
                "interaction_type": data.get("interaction_type"),
                "energy_after": data.get("energy_after"),
                "notes": data.get("notes"),
            }
            result = supabase.table("relationship_checkins").insert(row).execute()
            checkin = result.data[0] if result.data else row

            # Recalculate relationship score
            score_data = await self.calculate_relationship_score(contact_id)
            new_score = score_data.get("score", 0)

            # Update relationships table with new score
            supabase.table("relationships").update(
                {"health_score": new_score, "last_checkin_date": row["checkin_date"]}
            ).eq("contact_id", contact_id).execute()

            # Also update last_contact_date on social_contacts
            supabase.table("social_contacts").update(
                {"last_contact_date": row["checkin_date"]}
            ).eq("id", contact_id).execute()

            # Pattern detection: check for consecutive draining interactions
            coaching_note = None
            recent_checkins = (
                supabase.table("relationship_checkins")
                .select("energy_after")
                .eq("contact_id", contact_id)
                .order("checkin_date", desc=True)
                .limit(4)
                .execute()
            )
            recent = recent_checkins.data or []
            if len(recent) >= 4:
                all_drained = all(
                    (c.get("energy_after") or 0) < 0 for c in recent
                )
                if all_drained:
                    coaching_note = (
                        "I've noticed the last four interactions have left you feeling drained. "
                        "That's worth paying attention to. It might be helpful to reflect on what's "
                        "changed in this dynamic, or consider having an honest conversation about "
                        "what you need from this relationship."
                    )

            # Check for consistently low quality
            if not coaching_note and len(recent) >= 4:
                recent_qualities_result = (
                    supabase.table("relationship_checkins")
                    .select("interaction_quality")
                    .eq("contact_id", contact_id)
                    .order("checkin_date", desc=True)
                    .limit(4)
                    .execute()
                )
                recent_quals = recent_qualities_result.data or []
                if len(recent_quals) >= 4:
                    all_low = all(
                        (q.get("interaction_quality") or 5) <= 3 for q in recent_quals
                    )
                    if all_low:
                        coaching_note = (
                            "The quality of recent interactions has been consistently low. "
                            "This might be a phase, or it might signal something worth exploring. "
                            "What would a really great interaction with this person look like?"
                        )

            response = {
                "status": "ok",
                "checkin": checkin,
                "updated_score": score_data,
            }
            if coaching_note:
                response["coaching_note"] = coaching_note

            return response

        except Exception as e:
            logger.error(f"Failed to log interaction for {contact_id}: {e}")
            return {"error": str(e)}

    async def get_coaching_insight(self, contact_id: str) -> dict:
        """Claude generates specific, actionable coaching for this relationship."""
        if not supabase:
            return {"insight": "Unable to generate insight without data."}

        try:
            # Get contact info
            contact_result = (
                supabase.table("social_contacts")
                .select("*")
                .eq("id", contact_id)
                .limit(1)
                .execute()
            )
            contact = contact_result.data[0] if contact_result.data else None
            if not contact:
                return {"insight": "Contact not found."}

            # Get relationship record
            rel_result = (
                supabase.table("relationships")
                .select("*")
                .eq("contact_id", contact_id)
                .limit(1)
                .execute()
            )
            relationship = rel_result.data[0] if rel_result.data else {}

            # Get recent checkins
            thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
            checkins_result = (
                supabase.table("relationship_checkins")
                .select("*")
                .eq("contact_id", contact_id)
                .gte("checkin_date", thirty_days_ago)
                .order("checkin_date", desc=True)
                .limit(10)
                .execute()
            )
            checkins = checkins_result.data or []

            # Get recent social logs
            logs_result = (
                supabase.table("social_log")
                .select("*")
                .eq("contact_id", contact_id)
                .gte("log_date", thirty_days_ago)
                .order("log_date", desc=True)
                .limit(10)
                .execute()
            )
            logs = logs_result.data or []

            # Calculate current score
            score_data = await self.calculate_relationship_score(contact_id)

            if not ANTHROPIC_API_KEY:
                return {"insight": "Consider how you can strengthen your connection with intentional, quality time together."}

            context = json.dumps({
                "contact_name": contact.get("name"),
                "relationship_type": contact.get("relationship_type"),
                "importance_weight": contact.get("importance_weight"),
                "health_score": score_data.get("score"),
                "score_breakdown": score_data.get("breakdown"),
                "trend": score_data.get("trend"),
                "recent_checkins": [
                    {
                        "date": c.get("checkin_date"),
                        "quality": c.get("interaction_quality"),
                        "type": c.get("interaction_type"),
                        "energy": c.get("energy_after"),
                        "notes": c.get("notes"),
                    }
                    for c in checkins
                ],
                "recent_interactions": [
                    {
                        "date": l.get("log_date"),
                        "activity": l.get("activity_type"),
                        "duration": l.get("duration_minutes"),
                        "quality": l.get("quality_rating"),
                    }
                    for l in logs
                ],
                "relationship_notes": relationship.get("notes"),
            }, indent=2)

            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=300,
                system=(
                    "You are a warm, insightful relationship coach grounded in Gottman method "
                    "and attachment theory. You provide specific, actionable coaching based on "
                    "interaction data. Be encouraging and never judgmental. Focus on one or two "
                    "concrete suggestions. Keep your response to 2-4 sentences."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"Based on this relationship data, provide a specific coaching insight:\n\n{context}"
                    ),
                }],
            )
            insight = response.content[0].text.strip()

            return {
                "contact_id": contact_id,
                "contact_name": contact.get("name"),
                "health_score": score_data.get("score"),
                "trend": score_data.get("trend"),
                "insight": insight,
            }

        except Exception as e:
            logger.error(f"Failed to generate coaching insight for {contact_id}: {e}")
            return {"insight": "Focus on being present and curious in your next interaction."}

    async def detect_drift(self, contact_id: str) -> dict:
        """Check if health_score dropped >15 points in 30 days."""
        if not supabase:
            return {"drift_detected": False}

        try:
            # Get current score
            current = await self.calculate_relationship_score(contact_id)
            current_score = current.get("score", 0)

            # Get the score from ~30 days ago (stored in relationships table history or checkins)
            thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()

            # Check if there's a stored historical score
            rel_result = (
                supabase.table("relationships")
                .select("health_score, health_score_30d_ago, contact_id")
                .eq("contact_id", contact_id)
                .limit(1)
                .execute()
            )
            rel = rel_result.data[0] if rel_result.data else None

            if not rel:
                return {"drift_detected": False, "current_score": current_score}

            previous_score = rel.get("health_score_30d_ago")

            # Fallback: estimate previous score from older checkins
            if previous_score is None:
                sixty_days_ago = (date.today() - timedelta(days=60)).isoformat()
                older_checkins = (
                    supabase.table("relationship_checkins")
                    .select("interaction_quality, energy_after")
                    .eq("contact_id", contact_id)
                    .gte("checkin_date", sixty_days_ago)
                    .lt("checkin_date", thirty_days_ago)
                    .execute()
                )
                older = older_checkins.data or []
                if older:
                    avg_quality = sum(c.get("interaction_quality", 5) for c in older) / len(older)
                    previous_score = min(100, int(avg_quality * 10))
                else:
                    return {"drift_detected": False, "current_score": current_score}

            drop = previous_score - current_score

            # Get contact name
            contact_result = (
                supabase.table("social_contacts")
                .select("name")
                .eq("id", contact_id)
                .limit(1)
                .execute()
            )
            contact_name = contact_result.data[0]["name"] if contact_result.data else "this person"

            if drop > 15:
                observation = (
                    f"I've noticed your connection with {contact_name} has shifted over the past month "
                    f"(score moved from {previous_score} to {current_score}). This doesn't mean anything "
                    f"is wrong — relationships naturally ebb and flow. But if this person matters to you, "
                    f"it might be worth reaching out with something simple and genuine."
                )
                return {
                    "drift_detected": True,
                    "current_score": current_score,
                    "previous_score": previous_score,
                    "drop": drop,
                    "observation": observation,
                }

            return {
                "drift_detected": False,
                "current_score": current_score,
                "previous_score": previous_score,
                "drop": max(drop, 0),
            }

        except Exception as e:
            logger.error(f"Failed to detect drift for {contact_id}: {e}")
            return {"drift_detected": False}

    async def get_weekly_relationship_briefing(self) -> dict:
        """Weekly summary of relationship health."""
        if not supabase:
            return {"overall_score": 0, "score_trend": "stable", "top_priority": None, "positive_highlight": None, "coach_insight": "Database not configured."}

        try:
            health = await self.get_overall_health()
            overall_score = health.get("score", 0)

            # Determine score trend by comparing with last week
            # Use checkins from this week vs last week
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            last_week_start = week_start - timedelta(days=7)

            this_week_checkins = (
                supabase.table("relationship_checkins")
                .select("interaction_quality")
                .gte("checkin_date", week_start.isoformat())
                .execute()
            )
            last_week_checkins = (
                supabase.table("relationship_checkins")
                .select("interaction_quality")
                .gte("checkin_date", last_week_start.isoformat())
                .lt("checkin_date", week_start.isoformat())
                .execute()
            )

            this_week = this_week_checkins.data or []
            last_week = last_week_checkins.data or []

            this_avg = sum(c.get("interaction_quality", 5) for c in this_week) / max(len(this_week), 1) if this_week else 5
            last_avg = sum(c.get("interaction_quality", 5) for c in last_week) / max(len(last_week), 1) if last_week else 5

            if this_avg > last_avg + 0.5:
                score_trend = "improving"
            elif this_avg < last_avg - 0.5:
                score_trend = "declining"
            else:
                score_trend = "stable"

            # Top priority: the relationship most needing attention
            needs_attention = health.get("needs_attention", [])
            top_priority = needs_attention[0] if needs_attention else None

            # Positive highlight: strongest relationship or best recent interaction
            strongest = health.get("strongest", [])
            positive_highlight = None
            if strongest:
                top = strongest[0]
                positive_highlight = f"Your connection with {top['name']} continues to be a bright spot (score: {top['score']})."

            # Coach insight
            if score_trend == "improving":
                coach_insight = "Great week for your relationships! The investment you're making in your connections is paying off."
            elif score_trend == "declining":
                coach_insight = "Your relationship energy dipped a bit this week. That's normal — consider one intentional reconnection to shift the momentum."
            else:
                coach_insight = "Steady week. To keep things strong, try adding one unexpected positive gesture to a key relationship."

            if top_priority:
                coach_insight += f" {top_priority['name']} could especially use some of your attention."

            return {
                "overall_score": overall_score,
                "score_trend": score_trend,
                "top_priority": top_priority,
                "positive_highlight": positive_highlight,
                "coach_insight": coach_insight,
            }

        except Exception as e:
            logger.error(f"Failed to generate weekly relationship briefing: {e}")
            return {"overall_score": 0, "score_trend": "stable", "top_priority": None, "positive_highlight": None, "coach_insight": "Unable to generate briefing."}

    async def get_all_relationships(self) -> list[dict]:
        """Get all relationships joined with social_contacts data."""
        if not supabase:
            return []

        try:
            result = (
                supabase.table("relationships")
                .select("*, social_contacts(id, name, relationship_type, importance_weight, target_contact_days, last_contact_date, preferred_activities, active)")
                .execute()
            )
            relationships = result.data or []

            # Enrich with computed score for each
            enriched = []
            for rel in relationships:
                contact = rel.get("social_contacts", {})
                if not contact.get("active", True):
                    continue
                contact_id = rel.get("contact_id")
                score_data = await self.calculate_relationship_score(contact_id)
                enriched.append({
                    **rel,
                    "computed_score": score_data.get("score", 0),
                    "trend": score_data.get("trend", "stable"),
                    "coaching_note": score_data.get("coaching_note", ""),
                })

            enriched.sort(key=lambda r: r.get("computed_score", 0), reverse=True)
            return enriched

        except Exception as e:
            logger.error(f"Failed to fetch all relationships: {e}")
            return []

    async def get_relationship(self, contact_id: str) -> dict:
        """Get single relationship with full detail."""
        if not supabase:
            return {}

        try:
            result = (
                supabase.table("relationships")
                .select("*, social_contacts(id, name, relationship_type, importance_weight, target_contact_days, last_contact_date, preferred_activities, notes, active)")
                .eq("contact_id", contact_id)
                .limit(1)
                .execute()
            )
            relationship = result.data[0] if result.data else None
            if not relationship:
                return {}

            # Get score with breakdown
            score_data = await self.calculate_relationship_score(contact_id)

            # Get recent checkins
            thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
            checkins_result = (
                supabase.table("relationship_checkins")
                .select("*")
                .eq("contact_id", contact_id)
                .gte("checkin_date", thirty_days_ago)
                .order("checkin_date", desc=True)
                .limit(20)
                .execute()
            )
            recent_checkins = checkins_result.data or []

            # Detect drift
            drift_data = await self.detect_drift(contact_id)

            return {
                **relationship,
                "score": score_data,
                "recent_checkins": recent_checkins,
                "drift": drift_data,
            }

        except Exception as e:
            logger.error(f"Failed to fetch relationship for {contact_id}: {e}")
            return {}

    async def update_relationship(self, contact_id: str, data: dict) -> dict:
        """Update relationship profile fields."""
        if not supabase:
            return {"error": "Database not configured"}

        try:
            result = (
                supabase.table("relationships")
                .update(data)
                .eq("contact_id", contact_id)
                .execute()
            )
            return result.data[0] if result.data else data

        except Exception as e:
            logger.error(f"Failed to update relationship for {contact_id}: {e}")
            return {"error": str(e)}


relationship_coaching_service = RelationshipCoachingService()
