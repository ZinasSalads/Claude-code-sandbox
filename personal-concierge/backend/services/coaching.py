"""Coaching Style Engine — four modes with drift detection.

Modes:
- drill_sergeant: Direct, no-nonsense, high accountability
- supportive_friend: Encouraging, empathetic, positive reinforcement
- data_scientist: Metrics-focused, analytical, evidence-based
- adaptive: Shifts between modes based on compliance and context (default)

Drift detection tracks compliance across domains and escalates coaching
when the user falls off track.
"""

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from config import supabase

logger = logging.getLogger("concierge.coaching")

MODES = {
    "drill_sergeant": {
        "name": "Drill Sergeant",
        "description": "Direct accountability. No excuses. Results-driven.",
        "tone_instructions": (
            "Be direct and commanding. Use short, punchy sentences. "
            "No sugarcoating. Call out inconsistencies. Push for higher standards. "
            "Use phrases like 'No excuses', 'You committed to this', 'Time to step up'. "
            "Acknowledge effort briefly but always push for more."
        ),
    },
    "supportive_friend": {
        "name": "Supportive Friend",
        "description": "Encouraging and empathetic. Celebrates wins.",
        "tone_instructions": (
            "Be warm, encouraging, and empathetic. Celebrate every win, no matter how small. "
            "Use phrases like 'Great job!', 'I'm proud of you', 'Progress, not perfection'. "
            "When they miss goals, be understanding and help them problem-solve. "
            "Focus on building confidence and sustainable habits."
        ),
    },
    "data_scientist": {
        "name": "Data Scientist",
        "description": "Metrics-driven. Evidence-based. Analytical.",
        "tone_instructions": (
            "Be analytical and precise. Reference specific numbers, trends, and data points. "
            "Use phrases like 'The data shows', 'Your 7-day trend indicates', 'Statistically'. "
            "Explain the reasoning behind every recommendation with evidence. "
            "Minimize emotional language — focus on what the numbers say."
        ),
    },
    "adaptive": {
        "name": "Adaptive",
        "description": "Shifts between modes based on your behavior and needs.",
        "tone_instructions": (
            "Adapt your coaching style based on the user's recent compliance and context. "
            "If compliance is high: be encouraging and push for growth. "
            "If compliance is dropping: be more direct and accountability-focused. "
            "If they seem stressed: be supportive and focus on what matters most. "
            "Always be authentic and caring."
        ),
    },
}


class CoachingService:
    """Manages coaching style, drift detection, and compliance tracking."""

    async def get_settings(self) -> dict:
        """Get current coaching settings."""
        if not supabase:
            return {"mode": "adaptive", "drift_score": 0}
        try:
            result = (
                supabase.table("coaching_settings")
                .select("*")
                .limit(1)
                .execute()
            )
            if result.data:
                return result.data[0]
            # Create default settings
            default = {
                "mode": "adaptive",
                "drift_detection_enabled": True,
                "drift_threshold_days": 7,
                "escalation_enabled": True,
                "current_drift_score": 0,
                "days_in_current_mode": 0,
                "motivation_style": "balanced",
            }
            supabase.table("coaching_settings").insert(default).execute()
            return default
        except Exception as e:
            logger.error(f"Failed to get coaching settings: {e}")
            return {"mode": "adaptive", "drift_score": 0}

    async def set_mode(self, mode: str) -> dict:
        """Set coaching mode."""
        if mode not in MODES:
            return {"error": f"Invalid mode. Choose from: {', '.join(MODES.keys())}"}

        if not supabase:
            return {"mode": mode}

        try:
            settings = await self.get_settings()
            update = {
                "mode": mode,
                "last_mode_change": datetime.now(timezone.utc).isoformat(),
                "days_in_current_mode": 0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if settings.get("id"):
                supabase.table("coaching_settings").update(update).eq("id", settings["id"]).execute()
            return {"mode": mode, "name": MODES[mode]["name"], "description": MODES[mode]["description"]}
        except Exception as e:
            logger.error(f"Failed to set mode: {e}")
            return {"error": str(e)}

    def get_tone_instructions(self, mode: str) -> str:
        """Get tone instructions for a coaching mode."""
        return MODES.get(mode, MODES["adaptive"])["tone_instructions"]

    async def get_active_tone(self) -> str:
        """Get the active coaching tone instructions based on current settings."""
        settings = await self.get_settings()
        mode = settings.get("mode", "adaptive")

        if mode == "adaptive":
            # Determine effective mode from drift score
            drift = settings.get("current_drift_score", 0)
            if drift > 0.6:
                effective = "drill_sergeant"
            elif drift > 0.3:
                effective = "data_scientist"
            else:
                effective = "supportive_friend"
            return self.get_tone_instructions(effective)

        return self.get_tone_instructions(mode)

    async def log_compliance(self, domain: str, recommended: str, actual: str, complied: bool) -> dict:
        """Log a compliance event for drift tracking."""
        if not supabase:
            return {"status": "ok"}
        try:
            # Calculate drift contribution
            drift_contribution = 0.0 if complied else 0.1

            row = {
                "date": date.today().isoformat(),
                "domain": domain,
                "recommended": recommended,
                "actual": actual,
                "complied": complied,
                "drift_contribution": drift_contribution,
            }
            supabase.table("compliance_events").insert(row).execute()

            # Update drift score
            await self._update_drift_score()

            return {"status": "ok", "complied": complied}
        except Exception as e:
            logger.error(f"Failed to log compliance: {e}")
            return {"error": str(e)}

    async def _update_drift_score(self) -> None:
        """Recalculate drift score from recent compliance events."""
        if not supabase:
            return
        try:
            settings = await self.get_settings()
            window = settings.get("drift_threshold_days", 7)
            start = (date.today() - timedelta(days=window)).isoformat()

            result = (
                supabase.table("compliance_events")
                .select("complied")
                .gte("date", start)
                .execute()
            )
            events = result.data or []
            if not events:
                return

            non_compliant = sum(1 for e in events if not e.get("complied"))
            drift_score = round(non_compliant / len(events), 2)

            if settings.get("id"):
                supabase.table("coaching_settings").update({
                    "current_drift_score": drift_score,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", settings["id"]).execute()
        except Exception as e:
            logger.error(f"Drift score update error: {e}")

    async def get_drift_report(self) -> dict:
        """Get compliance drift analysis."""
        if not supabase:
            return {"drift_score": 0, "events": []}
        try:
            settings = await self.get_settings()
            window = settings.get("drift_threshold_days", 7)
            start = (date.today() - timedelta(days=window)).isoformat()

            result = (
                supabase.table("compliance_events")
                .select("*")
                .gte("date", start)
                .order("date", desc=True)
                .execute()
            )
            events = result.data or []

            # Domain breakdown
            domains: dict[str, dict] = {}
            for e in events:
                d = e.get("domain", "unknown")
                if d not in domains:
                    domains[d] = {"complied": 0, "total": 0}
                domains[d]["total"] += 1
                if e.get("complied"):
                    domains[d]["complied"] += 1

            domain_scores = {
                d: round((s["complied"] / s["total"]) * 100, 1) if s["total"] else 0
                for d, s in domains.items()
            }

            return {
                "drift_score": settings.get("current_drift_score", 0),
                "window_days": window,
                "total_events": len(events),
                "compliance_by_domain": domain_scores,
                "current_mode": settings.get("mode", "adaptive"),
                "effective_coaching_level": self._drift_to_level(settings.get("current_drift_score", 0)),
            }
        except Exception as e:
            logger.error(f"Drift report error: {e}")
            return {"error": str(e)}

    def _drift_to_level(self, drift: float) -> str:
        if drift > 0.6:
            return "high_accountability"
        elif drift > 0.3:
            return "moderate_guidance"
        return "encouraging"

    def get_available_modes(self) -> list[dict]:
        """List all available coaching modes."""
        return [
            {"id": k, "name": v["name"], "description": v["description"]}
            for k, v in MODES.items()
        ]


coaching_service = CoachingService()
