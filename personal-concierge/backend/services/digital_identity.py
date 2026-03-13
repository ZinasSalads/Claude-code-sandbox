"""Digital Identity & Personal Brand service.

Manages LinkedIn audit, personal brand positioning, and online presence
strategy — grounded in actual personality data and career context,
not generic influencer advice.

Features:
- Digital identity profile: platforms, goals, content preferences
- LinkedIn audit with actionable scoring
- Personal brand statement generation
- Content suggestions matched to personality and style
- Audit history tracking
"""

import json
import logging
from datetime import datetime

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.digital_identity")

MODEL = "claude-sonnet-4-20250514"


class DigitalIdentityService:

    async def get_profile(self) -> dict:
        """Get digital identity profile."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("digital_identity")
                .select("*")
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to get digital identity profile: {e}")
            return {}

    async def save_profile(self, data: dict) -> dict:
        """Upsert digital identity profile."""
        if not supabase:
            return data
        try:
            existing = await self.get_profile()
            if existing.get("id"):
                result = (
                    supabase.table("digital_identity")
                    .update(data)
                    .eq("id", existing["id"])
                    .execute()
                )
                return result.data[0] if result.data else data
            else:
                result = supabase.table("digital_identity").insert(data).execute()
                return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to save digital identity profile: {e}")
            return {"error": str(e)}

    async def _get_career_profile(self) -> dict:
        """Fetch career profile from career_profiles table."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("career_profile")
                .select("*")
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to fetch career profile: {e}")
            return {}

    async def _get_personality_profile(self) -> dict:
        """Fetch personality profile from personality_profiles table."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("personality_profile")
                .select("*")
                .order("assessed_at", desc=True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to fetch personality profile: {e}")
            return {}

    async def _get_legacy_profile(self) -> dict:
        """Fetch legacy profile from legacy_profile table."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("legacy_profile")
                .select("*")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to fetch legacy profile: {e}")
            return {}

    async def generate_linkedin_audit(self) -> dict:
        """Generate a LinkedIn profile audit based on career, personality, and digital identity data."""
        career = await self._get_career_profile()
        personality = await self._get_personality_profile()
        identity = await self.get_profile()

        if not ANTHROPIC_API_KEY:
            fallback = {
                "headline_suggestion": "Update your headline to lead with impact, not just job title.",
                "summary_suggestions": [
                    "Open with a hook that shows what you care about.",
                    "Include a specific accomplishment with a number.",
                    "End with what you're looking for or building toward.",
                ],
                "skills_to_add": ["Leadership", "Strategic Planning", "Cross-functional Collaboration"],
                "skills_to_remove": ["Microsoft Office"],
                "experience_gaps": ["Consider adding volunteer or side project experience."],
                "missing_sections": ["Featured", "Recommendations", "Publications"],
                "overall_score": 55,
                "priority_actions": [
                    "Rewrite your headline to lead with value, not title.",
                    "Add at least 3 recommendations from colleagues.",
                    "Create a Featured section with your best work.",
                ],
            }
            return fallback

        context = (
            f"Career profile: {json.dumps(career, default=str) if career else 'Not available'}\n"
            f"Personality profile: {json.dumps(personality, default=str) if personality else 'Not available'}\n"
            f"Digital identity data: {json.dumps(identity, default=str) if identity else 'Not available'}"
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                system=(
                    "You are a LinkedIn strategist and personal branding expert. "
                    "Given the user's career profile, personality data, and current digital identity, "
                    "generate a thorough LinkedIn audit.\n\n"
                    "Return ONLY valid JSON with these keys:\n"
                    "- headline_suggestion: string (a specific rewritten headline)\n"
                    "- summary_suggestions: array of 3 strings (specific summary improvements)\n"
                    "- skills_to_add: array of strings (skills they should add based on career data)\n"
                    "- skills_to_remove: array of strings (outdated or generic skills to drop)\n"
                    "- experience_gaps: array of strings (missing experience entries or improvements)\n"
                    "- missing_sections: array of strings (LinkedIn sections they should complete)\n"
                    "- overall_score: integer 0-100 (estimated LinkedIn profile strength)\n"
                    "- priority_actions: array of exactly 3 strings (top 3 things to do first)\n\n"
                    "Be specific to this person. No generic advice."
                ),
                messages=[{"role": "user", "content": context}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            audit = json.loads(raw)

            # Ensure all expected keys exist
            audit.setdefault("headline_suggestion", "")
            audit.setdefault("summary_suggestions", [])
            audit.setdefault("skills_to_add", [])
            audit.setdefault("skills_to_remove", [])
            audit.setdefault("experience_gaps", [])
            audit.setdefault("missing_sections", [])
            audit.setdefault("overall_score", 50)
            audit.setdefault("priority_actions", [])

            # Save audit to log
            await self._save_audit_log(audit)

            return audit

        except Exception as e:
            logger.error(f"LinkedIn audit generation failed: {e}")
            return {
                "headline_suggestion": "Unable to generate audit at this time.",
                "summary_suggestions": [],
                "skills_to_add": [],
                "skills_to_remove": [],
                "experience_gaps": [],
                "missing_sections": [],
                "overall_score": 0,
                "priority_actions": ["Try again later when the AI service is available."],
                "error": str(e),
            }

    async def _save_audit_log(self, audit: dict) -> None:
        """Save an audit result to digital_audit_log."""
        if not supabase:
            return
        try:
            row = {
                "audit_date": datetime.now().isoformat(),
                "audit_type": "linkedin",
                "overall_score": audit.get("overall_score", 0),
                "audit_data": audit,
            }
            supabase.table("digital_audit_log").insert(row).execute()
        except Exception as e:
            logger.error(f"Failed to save audit log: {e}")

    async def generate_personal_brand_statement(self) -> dict:
        """Generate a 2-3 sentence personal brand statement.

        Answers: what do I do, who for, and why it matters.
        Not corporate buzzword soup.
        """
        career = await self._get_career_profile()
        personality = await self._get_personality_profile()
        legacy = await self._get_legacy_profile()

        if not ANTHROPIC_API_KEY:
            return {
                "brand_statement": (
                    "Complete your career and personality profiles to generate "
                    "a personalized brand statement. In the meantime: lead with "
                    "what you solve, not what you do."
                ),
                "generated": False,
            }

        context = (
            f"Career profile: {json.dumps(career, default=str) if career else 'Not available'}\n"
            f"Personality profile: {json.dumps(personality, default=str) if personality else 'Not available'}\n"
            f"Legacy/vision profile: {json.dumps(legacy, default=str) if legacy else 'Not available'}"
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=300,
                system=(
                    "You write personal brand statements. 2-3 sentences max.\n\n"
                    "Rules:\n"
                    "- Answer three questions: What do I do? Who for? Why does it matter?\n"
                    "- Write like a human, not a brochure. No corporate buzzword soup.\n"
                    "- Ground it in real personality traits and career data.\n"
                    "- It should feel authentic to an introvert or extrovert, a data person "
                    "or a people person — whoever this actually is.\n"
                    "- If the person is early-career, own that. If they're a veteran, show depth.\n\n"
                    "Return ONLY the brand statement text, nothing else."
                ),
                messages=[{"role": "user", "content": context}],
            )
            statement = response.content[0].text.strip()
            return {
                "brand_statement": statement,
                "generated": True,
            }
        except Exception as e:
            logger.error(f"Brand statement generation failed: {e}")
            return {
                "brand_statement": "Unable to generate brand statement at this time.",
                "generated": False,
                "error": str(e),
            }

    async def get_content_suggestions(self) -> list[dict]:
        """Generate content suggestions matched to personality and content style.

        Maps content_style to format:
        - writer -> article
        - speaker -> talk
        - builder -> case study
        - curator -> thread
        """
        identity = await self.get_profile()

        if not identity.get("thought_leadership_goal"):
            return []

        career = await self._get_career_profile()
        personality = await self._get_personality_profile()

        content_style = identity.get("content_style", "writer")
        style_format_map = {
            "writer": "article",
            "speaker": "talk",
            "builder": "case study",
            "curator": "thread",
        }
        preferred_format = style_format_map.get(content_style, "article")

        if not ANTHROPIC_API_KEY:
            return [
                {
                    "format": preferred_format,
                    "topic": "Lessons from your current role",
                    "angle": "What you wish you knew when you started",
                    "why_now": "Timely for year-end reflection season",
                    "effort_level": "medium",
                },
                {
                    "format": preferred_format,
                    "topic": "A problem you solved recently",
                    "angle": "The counterintuitive approach that worked",
                    "why_now": "People love practical problem-solving content",
                    "effort_level": "low",
                },
                {
                    "format": preferred_format,
                    "topic": "An industry trend you have opinions on",
                    "angle": "The nuance most people are missing",
                    "why_now": "Establishes you as a thoughtful voice in your space",
                    "effort_level": "high",
                },
            ]

        context = (
            f"Career profile: {json.dumps(career, default=str) if career else 'Not available'}\n"
            f"Personality profile: {json.dumps(personality, default=str) if personality else 'Not available'}\n"
            f"Digital identity: {json.dumps(identity, default=str) if identity else 'Not available'}\n"
            f"Content style: {content_style}\n"
            f"Preferred format: {preferred_format}"
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=600,
                system=(
                    "You are a content strategist for personal branding. "
                    "Suggest exactly 3 content ideas tailored to this person's personality, "
                    "career context, and preferred content style.\n\n"
                    "Return ONLY a valid JSON array of 3 objects, each with:\n"
                    "- format: string (the content format — article, talk, case study, thread, etc.)\n"
                    "- topic: string (specific topic grounded in their career)\n"
                    "- angle: string (the unique angle or hook)\n"
                    "- why_now: string (why this is timely or relevant now)\n"
                    "- effort_level: string (low, medium, or high)\n\n"
                    "Make suggestions specific to this person. At least one should use their "
                    "preferred format. Vary effort levels."
                ),
                messages=[{"role": "user", "content": context}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            suggestions = json.loads(raw)

            if not isinstance(suggestions, list):
                suggestions = []

            # Ensure each suggestion has all required keys
            for s in suggestions:
                s.setdefault("format", preferred_format)
                s.setdefault("topic", "")
                s.setdefault("angle", "")
                s.setdefault("why_now", "")
                s.setdefault("effort_level", "medium")

            return suggestions[:3]

        except Exception as e:
            logger.error(f"Content suggestion generation failed: {e}")
            return []

    async def get_audit_history(self) -> list[dict]:
        """Get all records from digital_audit_log ordered by audit_date desc."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("digital_audit_log")
                .select("*")
                .order("audit_date", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch audit history: {e}")
            return []


digital_identity_service = DigitalIdentityService()
