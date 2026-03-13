"""Personality & Values Assessment service.

MBTI dimensions (continuous scores 0-1, not binary):
  E/I — Extraversion vs Introversion
  S/N — Sensing vs Intuition
  T/F — Thinking vs Feeling
  J/P — Judging vs Perceiving

Values orientation (5 continuous dimensions 0-1):
  urban_nature, secular_spiritual, individualist_communal,
  competitive_collaborative, risk_seeking

Results feed into coaching style, social suggestions, leisure filtering,
career coaching approach, and wardrobe style recommendations.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.personality")

MODEL = "claude-sonnet-4-20250514"

MBTI_QUESTIONS = [
    {
        "id": 1,
        "text": "You arrive at a party where you know only the host. What do you do?",
        "options": [
            "Introduce yourself to several groups and work the room",
            "Find one person who seems interesting and have a deep conversation",
            "Help the host with tasks while chatting with whoever's nearby",
            "Observe the dynamics for a while before joining a small group",
        ],
    },
    {
        "id": 2,
        "text": "Your team is brainstorming solutions to a complex problem. How do you contribute?",
        "options": [
            "Suggest creative, unconventional approaches others haven't considered",
            "Point out practical constraints and what's worked before",
            "Build on others' ideas and synthesize different viewpoints",
            "Ask probing questions to clarify the real problem first",
        ],
    },
    {
        "id": 3,
        "text": "A close friend makes a decision you think is objectively bad. What's your approach?",
        "options": [
            "Lay out the logical reasons why it's risky and suggest alternatives",
            "Listen to their reasoning, then gently share your concerns",
            "Support their right to choose while privately worrying",
            "Present data and evidence to help them see the full picture",
        ],
    },
    {
        "id": 4,
        "text": "You have a free Saturday with no obligations. How does it unfold?",
        "options": [
            "Wake up with a plan: gym, errands, meet friends, cook dinner",
            "See how you feel and let the day evolve organically",
            "Alternate between productive tasks and relaxation as mood shifts",
            "Commit to one big activity and fully immerse in it",
        ],
    },
    {
        "id": 5,
        "text": "You're learning a new skill. What approach works best for you?",
        "options": [
            "Dive in and learn by doing — figure it out as you go",
            "Study the theory and fundamentals before attempting anything",
            "Watch someone skilled do it, then try to replicate",
            "Follow a structured curriculum step by step",
        ],
    },
    {
        "id": 6,
        "text": "After a long, draining week, what recharges you most?",
        "options": [
            "Going out with friends — social energy refuels you",
            "Solo time: reading, walking, or a quiet hobby",
            "A mix — one social plan and one quiet evening",
            "A small gathering with close friends at home",
        ],
    },
    {
        "id": 7,
        "text": "When reading a book or watching a film, what draws you in?",
        "options": [
            "Rich world-building, symbolism, and hidden meanings",
            "Realistic characters and situations you can relate to",
            "Emotional depth and complex relationships",
            "Clever plot mechanics and logical puzzles",
        ],
    },
    {
        "id": 8,
        "text": "A colleague presents a proposal with an obvious emotional appeal but weak data. Your reaction?",
        "options": [
            "Appreciate the passion but ask for supporting evidence",
            "Feel moved by their conviction and want to help strengthen it",
            "Objectively analyze the proposal regardless of delivery",
            "Consider both the emotional merit and the practical gaps",
        ],
    },
    {
        "id": 9,
        "text": "You're planning a two-week trip. How much do you plan in advance?",
        "options": [
            "Detailed itinerary: flights, hotels, activities booked",
            "Flights and first-night hotel; the rest is spontaneous",
            "Key highlights planned, flexible time between them",
            "A rough list of what you want to see, planned day-by-day on the go",
        ],
    },
    {
        "id": 10,
        "text": "In a heated group discussion, you tend to:",
        "options": [
            "Mediate and find common ground between opposing views",
            "Champion the position you believe is logically correct",
            "Listen carefully and speak only when you have something crucial to add",
            "Energize the debate with new angles and provocative questions",
        ],
    },
    {
        "id": 11,
        "text": "When facing a major life decision, you primarily rely on:",
        "options": [
            "Pros and cons lists, research, and logical analysis",
            "Your gut feeling and what aligns with your values",
            "Advice from trusted people combined with your own reflection",
            "Past experience and proven patterns",
        ],
    },
    {
        "id": 12,
        "text": "Your workspace looks like:",
        "options": [
            "Organized with systems — everything has its place",
            "Creative chaos — you know where things are in the piles",
            "Clean surface with a few personal items",
            "Changes constantly depending on your current project",
        ],
    },
    {
        "id": 13,
        "text": "When someone shares a problem, your instinct is to:",
        "options": [
            "Offer solutions and actionable next steps",
            "Listen empathetically and validate their feelings",
            "Ask questions to understand the root cause",
            "Share a similar experience to show you understand",
        ],
    },
    {
        "id": 14,
        "text": "You're most energized by conversations that are:",
        "options": [
            "Abstract and theoretical — big ideas and possibilities",
            "Practical and grounded — real problems and real solutions",
            "Personal and emotional — deep human connections",
            "Stimulating and wide-ranging — jumping between topics",
        ],
    },
    {
        "id": 15,
        "text": "When starting a new project at work, you prefer to:",
        "options": [
            "Define clear milestones and timelines upfront",
            "Start with the most interesting part and build outward",
            "Understand the big picture before diving into details",
            "Gather all requirements, then create a systematic plan",
        ],
    },
    {
        "id": 16,
        "text": "At the end of a social event, you typically feel:",
        "options": [
            "Energized and wish it lasted longer",
            "Satisfied but ready for quiet time",
            "It depends entirely on the people and the vibe",
            "Glad you went but need solo time to decompress",
        ],
    },
    {
        "id": 17,
        "text": "When giving feedback to someone, you prioritize:",
        "options": [
            "Being honest and direct — they need the truth",
            "Being kind and constructive — delivery matters",
            "Being specific with examples and suggestions",
            "Balancing honesty with sensitivity to their feelings",
        ],
    },
    {
        "id": 18,
        "text": "Your ideal vacation destination is:",
        "options": [
            "A bustling city with culture, food, and nightlife",
            "A remote nature retreat — mountains, forest, or beach",
            "A mix of cultural exploration and relaxation",
            "Somewhere completely new where everything is unfamiliar",
        ],
    },
    {
        "id": 19,
        "text": "When a plan changes unexpectedly, your first reaction is:",
        "options": [
            "Frustration — you'd already mentally committed to the original",
            "Excitement — new possibilities just opened up",
            "Mild annoyance but quick adaptation",
            "Depends on whether the change is an upgrade or downgrade",
        ],
    },
    {
        "id": 20,
        "text": "What motivates you most in your daily life?",
        "options": [
            "Making progress toward clearly defined goals",
            "Exploring new ideas, experiences, and possibilities",
            "Building meaningful connections with people",
            "Mastering skills and understanding complex systems",
        ],
    },
]

VALUES_QUESTIONS = [
    {
        "id": 101,
        "text": "Your ideal living environment:",
        "dimension": "urban_nature",
        "options": [
            {"text": "Heart of a major city — walking distance to everything", "score": 0.0},
            {"text": "Urban neighborhood with parks and green spaces", "score": 0.3},
            {"text": "Suburbs or small town with easy nature access", "score": 0.7},
            {"text": "Rural or surrounded by nature", "score": 1.0},
        ],
    },
    {
        "id": 102,
        "text": "When facing hardship, you draw strength from:",
        "dimension": "secular_spiritual",
        "options": [
            {"text": "Logic, evidence, and your own resilience", "score": 0.0},
            {"text": "Philosophy, stoicism, or personal principles", "score": 0.3},
            {"text": "Meditation, mindfulness, or spiritual practice", "score": 0.7},
            {"text": "Faith, prayer, or religious community", "score": 1.0},
        ],
    },
    {
        "id": 103,
        "text": "Your greatest achievements have come from:",
        "dimension": "individualist_communal",
        "options": [
            {"text": "Solo effort — you work best independently", "score": 0.0},
            {"text": "Leading a team toward a shared vision", "score": 0.35},
            {"text": "Contributing your unique skills to a group effort", "score": 0.65},
            {"text": "Community collaboration where everyone shares credit", "score": 1.0},
        ],
    },
    {
        "id": 104,
        "text": "When it comes to professional growth, you prefer:",
        "dimension": "competitive_collaborative",
        "options": [
            {"text": "Clear rankings and competing to be the best", "score": 0.0},
            {"text": "Healthy competition with mutual respect", "score": 0.35},
            {"text": "Collaborative environments where everyone grows together", "score": 0.7},
            {"text": "Mentorship-focused — helping others succeed", "score": 1.0},
        ],
    },
    {
        "id": 105,
        "text": "If offered a dream opportunity with 50% chance of failure, you:",
        "dimension": "risk_seeking",
        "options": [
            {"text": "Pass — not worth the risk to stability", "score": 0.0},
            {"text": "Consider carefully and probably pass unless the timing is perfect", "score": 0.3},
            {"text": "Probably go for it — regret is worse than failure", "score": 0.7},
            {"text": "Absolutely go for it — that's what life is for", "score": 1.0},
        ],
    },
    {
        "id": 106,
        "text": "Your approach to personal style and appearance:",
        "dimension": "style_orientation",
        "options": [
            {"text": "Minimalist — simple, functional, quality basics", "score_label": "minimalist"},
            {"text": "Classic — timeless pieces, well-fitted, polished", "score_label": "classic"},
            {"text": "Casual — comfortable above all, relaxed fits", "score_label": "casual"},
            {"text": "Expressive — bold choices, trends, statement pieces", "score_label": "expressive"},
        ],
    },
    {
        "id": 107,
        "text": "When getting dressed, you prioritize:",
        "dimension": "comfort_appearance",
        "options": [
            {"text": "100% comfort — if it's not comfortable, I won't wear it", "score": 0.0},
            {"text": "Comfort first, but I want to look put-together", "score": 0.3},
            {"text": "Appearance first, but nothing truly uncomfortable", "score": 0.7},
            {"text": "Looking sharp — I'll endure some discomfort for the right look", "score": 1.0},
        ],
    },
    {
        "id": 108,
        "text": "Your ideal weekend balance:",
        "dimension": "urban_nature",
        "options": [
            {"text": "Brunch, museums, shopping, dinner out", "score": 0.1},
            {"text": "Morning hike, afternoon in town", "score": 0.5},
            {"text": "Full day outdoors — trail, bike, or water", "score": 0.8},
            {"text": "Quiet cabin or countryside retreat", "score": 1.0},
        ],
    },
    {
        "id": 109,
        "text": "How do you think about your impact on the world?",
        "dimension": "individualist_communal",
        "options": [
            {"text": "Through personal excellence and leading by example", "score": 0.1},
            {"text": "Through my work and professional contributions", "score": 0.35},
            {"text": "Through family and close relationships", "score": 0.65},
            {"text": "Through community involvement and service", "score": 0.9},
        ],
    },
    {
        "id": 110,
        "text": "Your relationship with risk and change:",
        "dimension": "risk_seeking",
        "options": [
            {"text": "I value stability and predictability highly", "score": 0.1},
            {"text": "Calculated risks with strong safety nets", "score": 0.35},
            {"text": "Comfortable with uncertainty — it keeps life interesting", "score": 0.65},
            {"text": "I actively seek disruption and reinvention", "score": 0.95},
        ],
    },
]


MBTI_TYPES = {
    "INTJ": "The Architect",
    "INTP": "The Logician",
    "ENTJ": "The Commander",
    "ENTP": "The Debater",
    "INFJ": "The Advocate",
    "INFP": "The Mediator",
    "ENFJ": "The Protagonist",
    "ENFP": "The Campaigner",
    "ISTJ": "The Logistician",
    "ISFJ": "The Defender",
    "ESTJ": "The Executive",
    "ESFJ": "The Consul",
    "ISTP": "The Virtuoso",
    "ISFP": "The Adventurer",
    "ESTP": "The Entrepreneur",
    "ESFP": "The Entertainer",
}


class PersonalityService:

    async def get_questions(self) -> dict:
        """Get all assessment questions."""
        return {
            "mbti_questions": MBTI_QUESTIONS,
            "values_questions": VALUES_QUESTIONS,
            "total_questions": len(MBTI_QUESTIONS) + len(VALUES_QUESTIONS),
            "estimated_minutes": 10,
        }

    async def score_assessment(self, responses: list[dict]) -> dict:
        """Score assessment responses using Claude."""
        if not ANTHROPIC_API_KEY:
            return self._fallback_scoring(responses)

        mbti_responses = [r for r in responses if r.get("question_id", 0) < 100]
        values_responses = [r for r in responses if r.get("question_id", 0) >= 100]

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

            # Score MBTI
            questions_with_answers = []
            for resp in mbti_responses:
                q = next((q for q in MBTI_QUESTIONS if q["id"] == resp["question_id"]), None)
                if q:
                    questions_with_answers.append({
                        "question": q["text"],
                        "answer": resp.get("selected_option", resp.get("answer", "")),
                    })

            response = client.messages.create(
                model=MODEL,
                max_tokens=500,
                system=(
                    "You are scoring a personality assessment. Given the situational "
                    "responses, score each MBTI dimension from 0 to 1:\n"
                    "  EI: 0=strong Extravert, 1=strong Introvert\n"
                    "  SN: 0=strong Sensing, 1=strong Intuition\n"
                    "  TF: 0=strong Thinking, 1=strong Feeling\n"
                    "  JP: 0=strong Judging, 1=strong Perceiving\n"
                    "Be nuanced — most people are 0.3-0.7, not at extremes.\n"
                    "Also determine energy_source (introvert/extrovert/ambivert), "
                    "decision_style (analytical/intuitive/balanced), "
                    "structure_preference (structured/flexible/mixed), "
                    "and stress_response (1 sentence).\n"
                    "Return ONLY valid JSON: {EI, SN, TF, JP, energy_source, "
                    "decision_style, structure_preference, stress_response}"
                ),
                messages=[{
                    "role": "user",
                    "content": json.dumps(questions_with_answers),
                }],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            mbti_scores = json.loads(raw)

            # Derive MBTI type
            ei = mbti_scores.get("EI", 0.5)
            sn = mbti_scores.get("SN", 0.5)
            tf = mbti_scores.get("TF", 0.5)
            jp = mbti_scores.get("JP", 0.5)

            mbti_type = (
                ("I" if ei > 0.5 else "E")
                + ("N" if sn > 0.5 else "S")
                + ("F" if tf > 0.5 else "T")
                + ("P" if jp > 0.5 else "J")
            )

            # Score values
            values_scores = self._score_values(values_responses)

            profile = {
                "mbti_type": mbti_type,
                "mbti_label": MBTI_TYPES.get(mbti_type, ""),
                "mbti_dimensions": {"EI": ei, "SN": sn, "TF": tf, "JP": jp},
                "energy_source": mbti_scores.get("energy_source", "ambivert"),
                "decision_style": mbti_scores.get("decision_style", "balanced"),
                "structure_preference": mbti_scores.get("structure_preference", "mixed"),
                "stress_response": mbti_scores.get("stress_response", ""),
                **values_scores,
            }

            # Save to DB
            saved = await self.save_profile(profile)
            return saved

        except Exception as e:
            logger.error(f"Assessment scoring failed: {e}")
            return self._fallback_scoring(responses)

    def _score_values(self, values_responses: list[dict]) -> dict:
        """Score values questions using option scores."""
        dimension_scores: dict[str, list[float]] = {}

        for resp in values_responses:
            q = next((q for q in VALUES_QUESTIONS if q["id"] == resp["question_id"]), None)
            if not q:
                continue

            answer_idx = resp.get("selected_index", 0)
            options = q["options"]
            if answer_idx >= len(options):
                answer_idx = 0

            opt = options[answer_idx]

            if "score" in opt:
                dim = q["dimension"]
                dimension_scores.setdefault(dim, []).append(opt["score"])
            elif "score_label" in opt:
                # style_orientation is a label, not a score
                return_val = opt["score_label"]
                dimension_scores["style_orientation"] = [return_val]

        result = {}
        for dim, values in dimension_scores.items():
            if dim == "style_orientation":
                result["style_orientation"] = values[0] if values else "casual"
            elif dim == "comfort_appearance":
                result["comfort_appearance_balance"] = sum(values) / len(values) if values else 0.5
            else:
                result[f"{dim}_score"] = sum(values) / len(values) if values else 0.5

        return result

    def _fallback_scoring(self, responses: list[dict]) -> dict:
        """Fallback scoring when Claude is unavailable."""
        return {
            "mbti_type": "INTJ",
            "mbti_label": "The Architect",
            "mbti_dimensions": {"EI": 0.65, "SN": 0.6, "TF": 0.4, "JP": 0.35},
            "energy_source": "introvert",
            "decision_style": "analytical",
            "structure_preference": "structured",
            "stress_response": "Tends to retreat and analyze before responding.",
            "urban_nature_score": 0.4,
            "secular_spiritual_score": 0.2,
            "individualist_communal_score": 0.3,
            "competitive_collaborative_score": 0.4,
            "risk_seeking_score": 0.5,
            "style_orientation": "minimalist",
            "comfort_appearance_balance": 0.4,
        }

    async def get_profile(self) -> dict:
        """Get stored personality profile."""
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
            if result.data:
                profile = result.data[0]
                profile["mbti_label"] = MBTI_TYPES.get(profile.get("mbti_type", ""), "")
                return profile
            return {}
        except Exception as e:
            logger.error(f"Failed to get personality profile: {e}")
            return {}

    async def save_profile(self, scores: dict) -> dict:
        """Save scored profile. Set reassess_due = now + 6 months."""
        if not supabase:
            return scores

        try:
            row = {
                "mbti_type": scores.get("mbti_type"),
                "mbti_dimensions": scores.get("mbti_dimensions"),
                "energy_source": scores.get("energy_source"),
                "decision_style": scores.get("decision_style"),
                "structure_preference": scores.get("structure_preference"),
                "stress_response": scores.get("stress_response"),
                "urban_nature_score": scores.get("urban_nature_score"),
                "secular_spiritual_score": scores.get("secular_spiritual_score"),
                "individualist_communal_score": scores.get("individualist_communal_score"),
                "competitive_collaborative_score": scores.get("competitive_collaborative_score"),
                "risk_seeking_score": scores.get("risk_seeking_score"),
                "style_orientation": scores.get("style_orientation"),
                "comfort_appearance_balance": scores.get("comfort_appearance_balance"),
                "reassess_due": (date.today() + timedelta(days=180)).isoformat(),
            }
            result = supabase.table("personality_profile").insert(row).execute()
            saved = result.data[0] if result.data else row
            saved["mbti_label"] = MBTI_TYPES.get(saved.get("mbti_type", ""), "")
            return saved
        except Exception as e:
            logger.error(f"Failed to save personality profile: {e}")
            return scores

    async def generate_insight(self) -> dict:
        """Claude generates a personal insight paragraph."""
        profile = await self.get_profile()
        if not profile or not profile.get("mbti_type"):
            return {"insight": "Complete the personality assessment to get your personal insight."}

        mbti_type = profile["mbti_type"]
        label = MBTI_TYPES.get(mbti_type, "")

        if not ANTHROPIC_API_KEY:
            return {
                "insight": (
                    f"As an {mbti_type} ({label}), you bring a unique combination of "
                    "analytical thinking and strategic vision to your health and life decisions."
                )
            }

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=300,
                system=(
                    "You are a personality insight generator for a health & life concierge app. "
                    "Write 2-3 sentences about how this personality type typically approaches "
                    "health, habits, and life optimization. Be warm, specific, and practical. "
                    "Never generic horoscope-style. Reference how their type shows up in daily decisions."
                ),
                messages=[{
                    "role": "user",
                    "content": (
                        f"MBTI: {mbti_type} ({label})\n"
                        f"Dimensions: {json.dumps(profile.get('mbti_dimensions', {}))}\n"
                        f"Energy: {profile.get('energy_source')}\n"
                        f"Decision style: {profile.get('decision_style')}\n"
                        f"Structure: {profile.get('structure_preference')}"
                    ),
                }],
            )
            return {"insight": response.content[0].text.strip()}
        except Exception as e:
            logger.error(f"Insight generation failed: {e}")
            return {"insight": f"As an {mbti_type} ({label}), you bring strategic depth to every decision."}

    async def get_coaching_instructions(self) -> dict:
        """Returns coaching tone modifiers based on personality."""
        profile = await self.get_profile()
        if not profile or not profile.get("mbti_dimensions"):
            return {
                "communication_style": "balanced",
                "motivation_frame": "achievement",
                "feedback_preference": "direct",
                "structure_preference": "mixed",
                "surprise_tolerance": 0.5,
            }

        dims = profile.get("mbti_dimensions", {})
        tf = dims.get("TF", 0.5)
        jp = dims.get("JP", 0.5)
        ei = dims.get("EI", 0.5)
        sn = dims.get("SN", 0.5)

        # T-types → data-forward, F-types → empathy-forward
        if tf < 0.35:
            comm_style = "data_forward"
            feedback = "direct"
        elif tf > 0.65:
            comm_style = "empathy_forward"
            feedback = "gentle"
        else:
            comm_style = "balanced"
            feedback = "analytical"

        # Motivation frame
        if ei < 0.4 and tf < 0.5:
            motivation = "achievement"
        elif sn > 0.6:
            motivation = "mastery"
        elif tf > 0.6:
            motivation = "connection"
        else:
            motivation = "freedom"

        # Structure
        if jp < 0.4:
            structure = "detailed_plans"
        elif jp > 0.6:
            structure = "flexible_options"
        else:
            structure = "mixed"

        # Surprise tolerance based on SN and JP
        surprise = min(1.0, (sn * 0.6 + jp * 0.4))

        return {
            "communication_style": comm_style,
            "motivation_frame": motivation,
            "feedback_preference": feedback,
            "structure_preference": structure,
            "surprise_tolerance": round(surprise, 2),
        }

    async def detect_drift(self) -> dict | None:
        """Detect mismatch between personality and recent behavior."""
        profile = await self.get_profile()
        if not profile or not profile.get("mbti_type"):
            return None

        if not supabase:
            return None

        try:
            # Check social log for introverts overloading
            ei = profile.get("mbti_dimensions", {}).get("EI", 0.5)
            if ei > 0.6:
                # Introvert — check if they've been socializing excessively
                from datetime import datetime, timedelta as td
                week_ago = (date.today() - td(days=7)).isoformat()
                social = (
                    supabase.table("social_log")
                    .select("id", count="exact")
                    .gte("interaction_date", week_ago)
                    .execute()
                )
                count = social.count or 0
                if count > 7:
                    return {
                        "detected": True,
                        "observation": (
                            f"You've logged {count} social interactions this week. "
                            "As someone who recharges with alone time, you might benefit "
                            "from scheduling a quiet evening soon."
                        ),
                        "dimension": "EI",
                        "type": "overextension",
                    }
            return None
        except Exception as e:
            logger.error(f"Drift detection failed: {e}")
            return None

    async def update_profile(self, data: dict) -> dict:
        """Manually update personality profile."""
        if not supabase:
            return {"error": "Database not configured"}

        profile = await self.get_profile()
        if not profile or not profile.get("id"):
            return await self.save_profile(data)

        try:
            result = (
                supabase.table("personality_profile")
                .update(data)
                .eq("id", profile["id"])
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update personality profile: {e}")
            return {"error": str(e)}


personality_service = PersonalityService()
