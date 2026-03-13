"""Multi-agent council — parallel specialist agents with structured arbitration.

Architecture:
  10 specialist agents run in PARALLEL (asyncio.gather):
    FitnessAgent, NutritionAgent, SleepAgent, MentalHealthAgent,
    SocialAgent, CareerAgent, GPAgent, LifeBalanceAgent,
    EnvironmentAgent, LongevityAgent

  Each agent produces a position statement:
  {
    domain: str,
    recommendation: str,
    urgency: str,        # critical/high/medium/low
    non_negotiables: list,
    willing_to_yield: list,
    data_support: str
  }

  Arbitrator receives all 10 positions and runs structured negotiation:
  1. Identify conflicts between positions
  2. Apply user priority weights
  3. Resolve each conflict explicitly
  4. Produce unified daily plan
"""

import asyncio
import json
import logging
from datetime import date, timedelta

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.council")

MODEL = "claude-sonnet-4-20250514"

AGENT_SYSTEM_TEMPLATE = """You are the {domain} specialist agent in a 10-agent council for a personal AI concierge.

Your role: advocate strongly for {domain} priorities based on the user's data. You will be one of 10 voices — the arbitrator will negotiate between you.

Produce a position statement as JSON (no markdown fences):
{{
  "domain": "{domain}",
  "recommendation": "Your top recommendation for today (1-2 sentences, specific)",
  "urgency": "critical|high|medium|low",
  "non_negotiables": ["Things you will NOT yield on (safety, health risks)"],
  "willing_to_yield": ["Things you can compromise on if other agents need time"],
  "data_support": "Key data point backing your position"
}}

USER CONTEXT:
{context}

Be specific. Reference actual data. Advocate firmly but fairly."""

ARBITRATOR_SYSTEM = """You are the master arbitrator for a 10-agent personal concierge council.

You have received position statements from 10 specialist agents. Your job:
1. Identify conflicts between positions (e.g., fitness wants intense workout but sleep agent says recovery needed)
2. Apply the user's priority weights to resolve conflicts
3. Produce a unified daily plan that respects non-negotiables from all agents
4. Explain key conflict resolutions so the user understands trade-offs

Priority weights (user-configurable, higher = more important):
{priority_weights}

{coaching_tone}

Return ONLY valid JSON (no markdown fences):
{{
  "greeting": "Personalized morning greeting",
  "today_summary": "One paragraph synthesizing all 10 agent inputs",
  "priority_actions": ["Top 5 most important things today, in order"],
  "fitness_plan": "Today's fitness recommendation (resolved with sleep/recovery)",
  "nutrition_focus": "Key nutrition priorities",
  "supplement_reminders": "Which supplements matter most today",
  "environment_advisory": "Outdoor/UV/air quality guidance",
  "social_recommendation": "Social connection suggestion if relevant",
  "career_note": "Career/productivity note if relevant",
  "life_balance": "Balance observation or suggestion",
  "coaching_message": "Motivational message in chosen style",
  "alerts": ["Any urgent items from any agent"],
  "conflicts_resolved": ["Brief explanation of key trade-offs made"],
  "agent_positions_summary": "1-sentence summary of each agent's stance"
}}"""


class AgentCouncil:
    """Multi-agent council with parallel execution and structured arbitration."""

    async def run_full_council(self, context: dict = None) -> dict:
        """Full council run: gather context, run agents, arbitrate."""
        if not context:
            context = await self._gather_full_context()

        # Run all 10 agents in parallel
        positions = await self.run_parallel_agents(context)

        # Run arbitration
        plan = await self.run_arbitration(positions, context)
        plan["generated_date"] = date.today().isoformat()
        plan["council_size"] = len(positions)
        plan["data_sources"] = context.get("available_sources", [])

        return plan

    async def run_parallel_agents(self, context: dict) -> list[dict]:
        """Run all specialist agents in parallel."""
        context_str = self._format_context(context)

        tasks = [
            self._run_agent("Fitness", context_str),
            self._run_agent("Nutrition", context_str),
            self._run_agent("Sleep & Recovery", context_str),
            self._run_agent("Mental Health", context_str),
            self._run_agent("Social & Relationships", context_str),
            self._run_agent("Career & Productivity", context_str),
            self._run_agent("General Health (GP)", context_str),
            self._run_agent("Life Balance", context_str),
            self._run_agent("Environment", context_str),
            self._run_agent("Longevity", context_str),
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        positions = []
        for r in results:
            if isinstance(r, Exception):
                logger.error(f"Agent error: {r}")
            elif r:
                positions.append(r)

        return positions

    async def _run_agent(self, domain: str, context_str: str) -> dict | None:
        """Run a single specialist agent."""
        if not ANTHROPIC_API_KEY:
            return self._fallback_position(domain)

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            system = AGENT_SYSTEM_TEMPLATE.format(domain=domain, context=context_str)

            response = client.messages.create(
                model=MODEL,
                max_tokens=500,
                system=system,
                messages=[{"role": "user", "content": f"Produce your {domain} position statement for today."}],
            )

            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error(f"{domain} agent returned invalid JSON")
            return self._fallback_position(domain)
        except Exception as e:
            logger.error(f"{domain} agent error: {e}")
            return self._fallback_position(domain)

    async def run_arbitration(self, positions: list[dict], context: dict) -> dict:
        """Arbitrate between all agent positions."""
        if not ANTHROPIC_API_KEY or not positions:
            return self._fallback_plan(context)

        # Get priority weights
        priority_weights = await self._get_priority_weights()

        # Get coaching tone
        coaching_tone = ""
        try:
            from services.coaching import coaching_service
            coaching_tone = f"COACHING STYLE: {await coaching_service.get_active_tone()}"
        except Exception:
            pass

        positions_text = "\n\n".join(
            f"=== {p.get('domain', 'Unknown')} Agent ===\n{json.dumps(p, indent=2)}"
            for p in positions
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            system = ARBITRATOR_SYSTEM.format(
                priority_weights=json.dumps(priority_weights, indent=2),
                coaching_tone=coaching_tone,
            )

            response = client.messages.create(
                model=MODEL,
                max_tokens=2000,
                system=system,
                messages=[{
                    "role": "user",
                    "content": f"Here are the 10 agent positions. Arbitrate and produce today's unified plan.\n\n{positions_text}",
                }],
            )

            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            return json.loads(raw)
        except Exception as e:
            logger.error(f"Arbitration error: {e}")
            return self._fallback_plan(context)

    async def get_debug_positions(self) -> dict:
        """Return all agent positions + conflicts for debugging."""
        context = await self._gather_full_context()
        positions = await self.run_parallel_agents(context)

        # Identify conflicts
        conflicts = self._find_conflicts(positions)

        return {
            "positions": positions,
            "conflicts": conflicts,
            "agent_count": len(positions),
            "context_sources": context.get("available_sources", []),
        }

    def _find_conflicts(self, positions: list[dict]) -> list[dict]:
        """Identify conflicts between agent positions."""
        conflicts = []
        for i, p1 in enumerate(positions):
            for p2 in positions[i + 1:]:
                # Check for urgency conflicts
                if p1.get("urgency") == "critical" and p2.get("urgency") == "critical":
                    conflicts.append({
                        "agents": [p1.get("domain"), p2.get("domain")],
                        "type": "dual_critical",
                        "description": f"Both {p1.get('domain')} and {p2.get('domain')} have critical urgency",
                    })

                # Check for non-negotiable overlaps
                p1_nn = set(p1.get("non_negotiables", []))
                p2_yield = set(p2.get("willing_to_yield", []))
                if p1_nn and p2_yield and p1_nn & p2_yield:
                    conflicts.append({
                        "agents": [p1.get("domain"), p2.get("domain")],
                        "type": "negotiable_conflict",
                        "description": f"{p1.get('domain')} won't yield on items {p2.get('domain')} offers to yield",
                    })

        return conflicts

    async def _gather_full_context(self) -> dict:
        """Gather data from all modules for the council."""
        available_sources = []
        context = {}

        # Health data
        if supabase:
            try:
                result = (
                    supabase.table("health_data")
                    .select("*")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    context["health_today"] = result.data[0]
                    available_sources.append("wearable")
            except Exception as e:
                logger.error(f"Health data error: {e}")

            # 7-day health trend
            try:
                week_ago = (date.today() - timedelta(days=7)).isoformat()
                result = (
                    supabase.table("health_data")
                    .select("date,readiness_score,sleep_score,hrv,resting_heart_rate")
                    .gte("date", week_ago)
                    .order("date")
                    .execute()
                )
                if result.data:
                    context["health_trend"] = result.data
                    available_sources.append("health_trend")
            except Exception:
                pass

            # Check-in
            try:
                result = (
                    supabase.table("check_ins")
                    .select("*")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if result.data:
                    context["checkin"] = result.data[0]
                    available_sources.append("checkin")
            except Exception:
                pass

            # Social - overdue contacts
            try:
                result = (
                    supabase.table("social_contacts")
                    .select("name,last_contact_date,target_contact_days,importance_weight")
                    .eq("active", True)
                    .order("importance_weight", desc=True)
                    .limit(5)
                    .execute()
                )
                if result.data:
                    context["social_contacts"] = result.data
                    available_sources.append("social")
            except Exception:
                pass

            # Career
            try:
                result = (
                    supabase.table("career_profiles")
                    .select("*")
                    .limit(1)
                    .execute()
                )
                if result.data:
                    context["career"] = result.data[0]
                    available_sources.append("career")
            except Exception:
                pass

            # Active supplements
            try:
                result = (
                    supabase.table("supplements")
                    .select("name,dose_amount,dose_unit,timing")
                    .eq("active", True)
                    .execute()
                )
                if result.data:
                    context["supplements"] = result.data
                    available_sources.append("supplements")
            except Exception:
                pass

            # Flagged biomarkers
            try:
                from services.bloodwork import bloodwork_service
                flagged = await bloodwork_service.get_flagged_biomarkers()
                if flagged:
                    context["flagged_biomarkers"] = flagged[:5]
                    available_sources.append("biomarkers")
            except Exception:
                pass

            # Environment
            try:
                from services.environment import environment_service
                env = await environment_service.get_today()
                if env and not env.get("error"):
                    context["environment"] = env
                    available_sources.append("environment")
            except Exception:
                pass

            # Growth habits
            try:
                result = (
                    supabase.table("growth_habits")
                    .select("name,current_streak,completed_today")
                    .eq("active", True)
                    .limit(5)
                    .execute()
                )
                if result.data:
                    context["habits"] = result.data
                    available_sources.append("habits")
            except Exception:
                pass

            # Skin data
            try:
                result = (
                    supabase.table("skin_log")
                    .select("*")
                    .order("log_date", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    context["skin_latest"] = result.data[0]
                    available_sources.append("skin")
            except Exception:
                pass

            # Financial stress flag
            try:
                two_weeks_ago = (date.today() - timedelta(days=14)).isoformat()
                result = (
                    supabase.table("financial_stress_log")
                    .select("stress_level")
                    .gte("week_start", two_weeks_ago)
                    .order("week_start", desc=True)
                    .limit(1)
                    .execute()
                )
                if result.data and result.data[0].get("stress_level", 0) >= 7:
                    context["financial_stress"] = True
                    available_sources.append("financial_stress")
            except Exception:
                pass

        # User context from memory
        try:
            from services.memory import build_user_context
            user_ctx = await build_user_context()
            if user_ctx:
                context["user_profile"] = user_ctx
                available_sources.append("memory")
        except Exception:
            pass

        context["available_sources"] = available_sources
        return context

    def _format_context(self, context: dict) -> str:
        """Format context dict into readable string for agents."""
        parts = []

        if context.get("health_today"):
            h = context["health_today"]
            parts.append(
                f"TODAY'S HEALTH: Readiness {h.get('readiness_score', 'N/A')}/100, "
                f"HRV {h.get('hrv', 'N/A')}ms, RHR {h.get('resting_heart_rate', 'N/A')}bpm, "
                f"Sleep {h.get('sleep_duration', 'N/A')}h (score {h.get('sleep_score', 'N/A')}/100)"
            )

        if context.get("checkin"):
            c = context["checkin"]
            parts.append(
                f"CHECK-IN: Energy {c.get('energy', 'N/A')}/10, Mood {c.get('mood', 'N/A')}/10, "
                f"Stress {c.get('stress', 'N/A')}/10, Soreness {c.get('soreness', 'N/A')}/10"
            )

        if context.get("health_trend"):
            trend = context["health_trend"]
            if len(trend) >= 2:
                first = trend[0].get("readiness_score") or 0
                last = trend[-1].get("readiness_score") or 0
                direction = "up" if last > first else "down" if last < first else "stable"
                parts.append(f"7-DAY READINESS TREND: {direction} ({first} → {last})")

        if context.get("social_contacts"):
            contacts = context["social_contacts"]
            overdue = []
            for c in contacts:
                if c.get("last_contact_date"):
                    days = (date.today() - date.fromisoformat(c["last_contact_date"])).days
                    if days > (c.get("target_contact_days") or 14):
                        overdue.append(f"{c['name']} ({days}d)")
            if overdue:
                parts.append(f"OVERDUE CONNECTIONS: {', '.join(overdue[:3])}")

        if context.get("career"):
            career = context["career"]
            parts.append(f"CAREER: {career.get('role_title', 'N/A')} — satisfaction {career.get('satisfaction_score', 'N/A')}/10")

        if context.get("supplements"):
            supps = [s["name"] for s in context["supplements"][:5]]
            parts.append(f"ACTIVE SUPPLEMENTS: {', '.join(supps)}")

        if context.get("flagged_biomarkers"):
            flags = [f"{b['name']}: {b.get('optimal_status', 'flagged')}" for b in context["flagged_biomarkers"][:3]]
            parts.append(f"FLAGGED BIOMARKERS: {', '.join(flags)}")

        if context.get("environment"):
            env = context["environment"]
            env_parts = []
            if env.get("temp_c") is not None:
                env_parts.append(f"Temp {env['temp_c']}°C")
            if env.get("uv_index_max") is not None:
                env_parts.append(f"UV {env['uv_index_max']}")
            if env.get("aqi") is not None:
                env_parts.append(f"AQI {env['aqi']}")
            if env_parts:
                parts.append(f"ENVIRONMENT: {', '.join(env_parts)}")

        if context.get("habits"):
            completed = sum(1 for h in context["habits"] if h.get("completed_today"))
            total = len(context["habits"])
            parts.append(f"HABITS: {completed}/{total} completed today")

        if context.get("skin_latest"):
            skin = context["skin_latest"]
            parts.append(f"SKIN: condition {skin.get('overall_condition', 'N/A')}/10, breakouts {skin.get('breakouts', 0)}")

        if context.get("financial_stress"):
            parts.append("FINANCIAL STRESS: Active — prefer budget-conscious recommendations")

        if context.get("user_profile"):
            parts.append(f"USER PROFILE:\n{context['user_profile']}")

        return "\n\n".join(parts) if parts else "Limited data available. Make general recommendations."

    async def _get_priority_weights(self) -> dict:
        """Get user priority weights. Defaults if not configured."""
        defaults = {
            "health": 1.0,
            "fitness": 0.8,
            "career": 0.7,
            "social": 0.7,
            "personal_growth": 0.6,
            "longevity": 0.6,
            "life_balance": 0.5,
        }

        if not supabase:
            return defaults

        try:
            result = (
                supabase.table("legacy_profile")
                .select("priority_weights")
                .limit(1)
                .execute()
            )
            if result.data and result.data[0].get("priority_weights"):
                weights = result.data[0]["priority_weights"]
                if isinstance(weights, str):
                    weights = json.loads(weights)
                return {**defaults, **weights}
        except Exception:
            pass

        return defaults

    def _fallback_position(self, domain: str) -> dict:
        """Fallback position when AI is unavailable."""
        return {
            "domain": domain,
            "recommendation": f"Review your {domain.lower()} data and follow your established routine.",
            "urgency": "medium",
            "non_negotiables": ["Maintain consistency"],
            "willing_to_yield": ["Timing can be flexible"],
            "data_support": "AI unavailable — using general guidance",
        }

    def _fallback_plan(self, context: dict) -> dict:
        """Fallback plan when AI is unavailable."""
        return {
            "greeting": "Good morning! Here's your daily council summary.",
            "today_summary": "Configure ANTHROPIC_API_KEY for AI-powered council plans.",
            "priority_actions": [
                "Complete your morning check-in",
                "Follow today's workout recommendation",
                "Take your supplements on schedule",
                "Connect with one person today",
                "Review your goals",
            ],
            "fitness_plan": "Check your wearable data for recovery status.",
            "nutrition_focus": "Focus on hitting your protein target.",
            "supplement_reminders": "Take all supplements as scheduled.",
            "environment_advisory": "Check local conditions before outdoor activity.",
            "social_recommendation": "Reach out to someone you haven't spoken to recently.",
            "career_note": "Review your top career priority for the day.",
            "life_balance": "Check in with your energy levels throughout the day.",
            "coaching_message": "Consistency across all domains is what builds a great life.",
            "alerts": [],
            "conflicts_resolved": [],
            "agent_positions_summary": "AI unavailable — general recommendations provided.",
            "data_sources": context.get("available_sources", []),
        }


agent_council = AgentCouncil()
