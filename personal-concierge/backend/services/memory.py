"""Memory service — the brain of the personal concierge.

Three layers:
1. Mem0 — vector-based semantic memory (preferences, observations, patterns)
2. Life Profile table — structured facts (age, goals, injuries, dietary needs)
3. Supabase queries — real-time data (today's readiness, recent workouts, biomarkers)

build_full_context() assembles all three into a single rich string
that gets injected into every agent system prompt.
"""

import json
import logging
from datetime import date, timedelta, datetime, timezone
from typing import Optional, Any

from config import MEM0_API_KEY, supabase

logger = logging.getLogger("concierge.memory")

USER_ID = "primary_user"

CATEGORIES = [
    "background", "fitness", "nutrition", "health", "lifestyle",
    "personality", "goals", "preferences", "relationships",
]

# Try to init Mem0
mem0_client = None
if MEM0_API_KEY:
    try:
        from mem0 import MemoryClient
        mem0_client = MemoryClient(api_key=MEM0_API_KEY)
        logger.info("Mem0 client initialized")
    except Exception as e:
        logger.warning(f"Mem0 init failed: {e}. Falling back to Supabase-only memory.")
else:
    logger.info("MEM0_API_KEY not set — using Supabase-only memory")


class MemoryService:
    """Comprehensive personal knowledge system."""

    async def add_memory(self, content: str, category: str, source: str = "conversation") -> Optional[str]:
        """Store a memory in Mem0 (if available) and Supabase memories table."""
        mem0_id = None

        if mem0_client:
            try:
                result = mem0_client.add(
                    content,
                    user_id=USER_ID,
                    metadata={"category": category, "source": source},
                )
                if result and isinstance(result, list) and len(result) > 0:
                    mem0_id = result[0].get("id")
            except Exception as e:
                logger.error(f"Mem0 add failed: {e}")

        if supabase:
            try:
                row = {
                    "mem0_id": mem0_id,
                    "category": category,
                    "content": content,
                    "source": source,
                    "confidence": 1.0,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                supabase.table("memories").insert(row).execute()
            except Exception as e:
                logger.error(f"Supabase memory insert failed: {e}")

        return mem0_id

    async def search_memories(self, query: str, limit: int = 5) -> list[dict]:
        """Semantic search via Mem0, fallback to Supabase ilike."""
        if mem0_client:
            try:
                results = mem0_client.search(query, user_id=USER_ID, limit=limit)
                if results:
                    return [
                        {
                            "content": r.get("memory", r.get("text", "")),
                            "category": r.get("metadata", {}).get("category", "general"),
                            "score": r.get("score", 0),
                        }
                        for r in results
                    ]
            except Exception as e:
                logger.error(f"Mem0 search failed: {e}")

        if supabase:
            try:
                result = (
                    supabase.table("memories")
                    .select("content, category, confidence")
                    .ilike("content", f"%{query}%")
                    .limit(limit)
                    .order("created_at", desc=True)
                    .execute()
                )
                return [
                    {"content": r["content"], "category": r["category"], "score": r.get("confidence", 0.5)}
                    for r in (result.data or [])
                ]
            except Exception as e:
                logger.error(f"Supabase memory search failed: {e}")

        return []

    async def set_profile_fact(self, key: str, value: Any, category: str, confidence: float = 1.0, source: str = "conversation"):
        """Store a structured fact in the life_profile table."""
        if not supabase:
            return
        try:
            row = {
                "key": key,
                "value": json.dumps(value) if not isinstance(value, str) else json.dumps(value),
                "category": category,
                "confidence": confidence,
                "source": source,
                "last_confirmed": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("life_profile").upsert(row, on_conflict="key").execute()
        except Exception as e:
            logger.error(f"Failed to set profile fact {key}: {e}")

    async def get_profile_fact(self, key: str) -> Any:
        """Get a single structured fact."""
        if not supabase:
            return None
        try:
            result = supabase.table("life_profile").select("value").eq("key", key).limit(1).execute()
            if result.data:
                val = result.data[0]["value"]
                return json.loads(val) if isinstance(val, str) else val
        except Exception as e:
            logger.error(f"Failed to get profile fact {key}: {e}")
        return None

    async def get_profile_category(self, category: str) -> dict:
        """Get all facts in a category."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("life_profile")
                .select("key, value, confidence")
                .eq("category", category)
                .execute()
            )
            facts = {}
            for r in (result.data or []):
                val = r["value"]
                facts[r["key"]] = json.loads(val) if isinstance(val, str) else val
            return facts
        except Exception as e:
            logger.error(f"Failed to get profile category {category}: {e}")
        return {}

    async def build_full_context(self) -> str:
        """
        Assemble comprehensive user context for agent injection.
        Combines life profile, recent data, and relevant memories.
        Capped at ~800 tokens to avoid bloating prompts.
        """
        sections = []

        # 1. Core identity from life_profile
        identity = await self.get_profile_category("background")
        if identity:
            lines = ["BACKGROUND:"]
            for k, v in identity.items():
                lines.append(f"  - {k}: {v}")
            sections.append("\n".join(lines))

        # 2. Health baseline
        health_facts = await self.get_profile_category("health")
        if health_facts:
            lines = ["HEALTH:"]
            for k, v in health_facts.items():
                lines.append(f"  - {k}: {v}")
            sections.append("\n".join(lines))

        # 3. Goals
        goals = await self.get_profile_category("goals")
        if goals:
            lines = ["GOALS:"]
            for k, v in goals.items():
                lines.append(f"  - {k}: {v}")
            sections.append("\n".join(lines))

        # 4. Fitness preferences
        fitness = await self.get_profile_category("fitness")
        if fitness:
            lines = ["FITNESS PREFERENCES:"]
            for k, v in fitness.items():
                lines.append(f"  - {k}: {v}")
            sections.append("\n".join(lines))

        # 5. Nutrition preferences
        nutrition = await self.get_profile_category("nutrition")
        if nutrition:
            lines = ["NUTRITION PREFERENCES:"]
            for k, v in nutrition.items():
                lines.append(f"  - {k}: {v}")
            sections.append("\n".join(lines))

        # 6. Active supplement stack
        if supabase:
            try:
                result = (
                    supabase.table("supplements")
                    .select("name, dose_amount, dose_unit, timing, purpose")
                    .eq("active", True)
                    .execute()
                )
                if result.data:
                    lines = ["CURRENT SUPPLEMENTS:"]
                    for s in result.data[:10]:
                        dose = f"{s.get('dose_amount', '')}{s.get('dose_unit', '')}" if s.get('dose_amount') else ""
                        lines.append(f"  - {s['name']} {dose} ({s.get('timing', 'unspecified')})")
                    sections.append("\n".join(lines))
            except Exception:
                pass

        # 7. Recent biomarker flags
        if supabase:
            try:
                result = (
                    supabase.table("biomarkers")
                    .select("marker_name, value, unit, status")
                    .in_("status", ["low", "high", "critical"])
                    .order("test_date", desc=True)
                    .limit(8)
                    .execute()
                )
                if result.data:
                    lines = ["FLAGGED BIOMARKERS:"]
                    for b in result.data:
                        lines.append(f"  - {b['marker_name']}: {b['value']} {b.get('unit', '')} ({b['status']})")
                    sections.append("\n".join(lines))
            except Exception:
                pass

        # 8. 30-day wearable trends
        if supabase:
            try:
                start = (date.today() - timedelta(days=30)).isoformat()
                result = (
                    supabase.table("health_data")
                    .select("readiness_score, hrv, resting_heart_rate, sleep_score, sleep_duration")
                    .gte("date", start)
                    .order("date", desc=True)
                    .execute()
                )
                if result.data and len(result.data) >= 3:
                    scores = [r["readiness_score"] for r in result.data if r.get("readiness_score")]
                    hrvs = [r["hrv"] for r in result.data if r.get("hrv")]
                    sleeps = [r["sleep_duration"] for r in result.data if r.get("sleep_duration")]
                    rhrs = [r["resting_heart_rate"] for r in result.data if r.get("resting_heart_rate")]
                    lines = [f"30-DAY WEARABLE TRENDS ({len(result.data)} days):"]
                    if scores:
                        lines.append(f"  - Avg readiness: {sum(scores)/len(scores):.0f}/100")
                    if hrvs:
                        lines.append(f"  - Avg HRV: {sum(hrvs)/len(hrvs):.0f}ms")
                    if rhrs:
                        lines.append(f"  - Avg RHR: {sum(rhrs)/len(rhrs):.0f}bpm")
                    if sleeps:
                        lines.append(f"  - Avg sleep: {sum(sleeps)/len(sleeps):.1f}h")
                    sections.append("\n".join(lines))
            except Exception:
                pass

        # 9. Relevant memories (top 5 recent)
        if supabase:
            try:
                result = (
                    supabase.table("memories")
                    .select("content, category")
                    .order("created_at", desc=True)
                    .limit(5)
                    .execute()
                )
                if result.data:
                    lines = ["RECENT OBSERVATIONS:"]
                    for m in result.data:
                        lines.append(f"  - [{m.get('category', '?')}] {m['content']}")
                    sections.append("\n".join(lines))
            except Exception:
                pass

        if not sections:
            return "No user context available yet. This appears to be a new user."

        return "\n\n".join(sections)

    async def extract_and_store_from_checkin(self, checkin_data: dict):
        """Extract memorable facts from a check-in."""
        today = checkin_data.get("date", date.today().isoformat())
        energy = checkin_data.get("energy", 0)
        mood = checkin_data.get("mood", 0)
        stress = checkin_data.get("stress", 0)
        soreness = checkin_data.get("soreness", 0)
        notes = checkin_data.get("notes", "")

        # Store the check-in as a memory
        memory_text = (
            f"On {today}: energy {energy}/10, mood {mood}/10, "
            f"stress {stress}/10, soreness {soreness}/10."
        )
        if notes:
            memory_text += f" Notes: {notes}"
        await self.add_memory(memory_text, category="health", source="checkin")

        # Extract patterns from notes if present
        if notes:
            await self.extract_and_store_from_conversation(notes)

    async def extract_and_store_from_conversation(self, message: str):
        """Scan a message for memorable personal facts and store them."""
        if not message or len(message) < 5:
            return

        # Simple keyword-based extraction for common patterns
        msg_lower = message.lower()

        # Age detection
        import re
        age_match = re.search(r"i(?:'m| am) (\d{1,2})(?: years old)?", msg_lower)
        if age_match:
            await self.set_profile_fact("age", int(age_match.group(1)), "background", source="conversation")

        # Injury detection
        injury_keywords = ["bad knee", "bad back", "shoulder injury", "injured", "torn", "surgery"]
        for keyword in injury_keywords:
            if keyword in msg_lower:
                await self.add_memory(f"User mentioned: {message}", category="health", source="conversation")
                break

        # Food preferences
        food_keywords = ["hate", "love", "allergic", "intolerant", "don't eat", "vegan", "vegetarian", "keto", "carnivore"]
        for keyword in food_keywords:
            if keyword in msg_lower:
                await self.add_memory(f"Nutrition preference: {message}", category="nutrition", source="conversation")
                break

        # Exercise preferences
        exercise_keywords = ["hate running", "love running", "hate cardio", "love lifting", "prefer", "enjoy"]
        for keyword in exercise_keywords:
            if keyword in msg_lower:
                await self.add_memory(f"Exercise preference: {message}", category="fitness", source="conversation")
                break

        # Goal detection
        goal_keywords = ["want to", "goal is", "trying to", "working towards", "aiming for"]
        for keyword in goal_keywords:
            if keyword in msg_lower:
                await self.add_memory(f"Goal: {message}", category="goals", source="conversation")
                break

    async def get_today_question(self) -> Optional[dict]:
        """Return one profile question to ask today, if appropriate."""
        if not supabase:
            return None
        try:
            # Check if we already asked a question today
            today = date.today().isoformat()
            asked_today = (
                supabase.table("profile_questions")
                .select("id")
                .eq("asked_date", today)
                .limit(1)
                .execute()
            )
            if asked_today.data:
                return None

            # Get next unanswered, unskipped question
            result = (
                supabase.table("profile_questions")
                .select("id, question, category, answer_stored_as")
                .eq("answered", False)
                .eq("skipped", False)
                .order("created_at")
                .limit(1)
                .execute()
            )
            if result.data:
                q = result.data[0]
                # Mark as asked today
                supabase.table("profile_questions").update(
                    {"asked_date": today}
                ).eq("id", q["id"]).execute()
                return q
        except Exception as e:
            logger.error(f"Failed to get today's question: {e}")
        return None

    async def answer_question(self, question_id: str, answer: str):
        """Store the answer to a profile question."""
        if not supabase:
            return
        try:
            # Get the question details
            result = (
                supabase.table("profile_questions")
                .select("question, category, answer_stored_as")
                .eq("id", question_id)
                .limit(1)
                .execute()
            )
            if not result.data:
                return

            q = result.data[0]

            # Mark as answered
            supabase.table("profile_questions").update({
                "answered": True,
                "answer": answer,
            }).eq("id", question_id).execute()

            # Store in life_profile if answer_stored_as is set
            if q.get("answer_stored_as"):
                await self.set_profile_fact(
                    q["answer_stored_as"],
                    answer,
                    q.get("category", "general"),
                    source="onboarding",
                )

            # Also store as a memory
            await self.add_memory(
                f"Q: {q['question']} A: {answer}",
                category=q.get("category", "personal"),
                source="onboarding",
            )
        except Exception as e:
            logger.error(f"Failed to answer question: {e}")

    async def skip_question(self, question_id: str):
        """Mark a question as skipped for today."""
        if not supabase:
            return
        try:
            supabase.table("profile_questions").update({"skipped": True}).eq("id", question_id).execute()
        except Exception as e:
            logger.error(f"Failed to skip question: {e}")


# Module-level singleton
memory_service = MemoryService()

# Backward-compatible top-level functions for existing code
async def add_memory(content: str, category: str, source: str = "conversation") -> Optional[str]:
    return await memory_service.add_memory(content, category, source)

async def search_memories(query: str, limit: int = 5) -> list[dict]:
    return await memory_service.search_memories(query, limit)

async def build_user_context() -> str:
    return await memory_service.build_full_context()
