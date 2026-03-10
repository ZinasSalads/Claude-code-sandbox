"""Longevity Dashboard — biological age estimation, composite scores.

Combines wearable data, biomarkers, fitness metrics, and lifestyle factors
to estimate biological age and track longevity-relevant metrics.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.longevity")

MODEL = "claude-sonnet-4-20250514"

INSIGHT_PROMPT = """You are a longevity science expert. Analyze this health data and provide actionable insights.

DATA:
{data}

Provide:
1. Key insights (3-5 bullet points) about the user's longevity trajectory
2. Top 3 recommendations for improvement, prioritized by impact
3. An overall assessment

Return ONLY valid JSON (no markdown fences):
{{
  "key_insights": ["insight1", "insight2", ...],
  "recommendations": ["rec1", "rec2", "rec3"],
  "overall_assessment": "Brief paragraph assessment",
  "trend_direction": "improving|stable|declining"
}}"""


class LongevityService:
    """Calculates and tracks longevity metrics."""

    async def calculate(self, chronological_age: Optional[int] = None) -> dict:
        """Calculate all longevity metrics and store snapshot."""
        # Gather data
        age = chronological_age or await self._get_age()
        wearable_avg = await self._get_wearable_averages(30)
        biomarkers = await self._get_latest_biomarkers()

        # Calculate component scores (0-100)
        hrv_score = self._score_hrv(wearable_avg.get("avg_hrv"), age)
        rhr_score = self._score_rhr(wearable_avg.get("avg_rhr"))
        sleep_score = self._score_sleep(wearable_avg.get("avg_sleep_score"))
        cardio_score = self._score_cardiovascular(biomarkers)
        metabolic_score = self._score_metabolic(biomarkers)
        recovery_score = self._score_recovery(wearable_avg)

        # Overall longevity score (weighted average)
        weights = {
            "hrv": 0.20,
            "rhr": 0.10,
            "sleep": 0.15,
            "cardiovascular": 0.25,
            "metabolic": 0.20,
            "recovery": 0.10,
        }
        scores = {
            "hrv": hrv_score,
            "rhr": rhr_score,
            "sleep": sleep_score,
            "cardiovascular": cardio_score,
            "metabolic": metabolic_score,
            "recovery": recovery_score,
        }
        overall = sum(scores[k] * weights[k] for k in weights if scores[k] is not None)
        valid_weight = sum(weights[k] for k in weights if scores[k] is not None)
        overall = round(overall / valid_weight, 1) if valid_weight > 0 else None

        # Biological age estimate
        bio_age = self._estimate_biological_age(age, overall, biomarkers, wearable_avg)
        bio_delta = round(bio_age - age, 1) if bio_age and age else None

        # Get AI insights
        insights = await self._get_insights({
            "chronological_age": age,
            "biological_age_estimate": bio_age,
            "scores": scores,
            "overall": overall,
            "wearable_averages": wearable_avg,
            "key_biomarkers": {k: v for k, v in biomarkers.items() if k in [
                "HbA1c", "hsCRP", "ApoB", "LDL", "HDL", "Triglycerides",
                "Fasting Glucose", "Vitamin D", "Testosterone (Total)",
            ]},
        })

        result = {
            "calculated_date": date.today().isoformat(),
            "chronological_age": age,
            "biological_age_estimate": bio_age,
            "biological_age_delta": bio_delta,
            "vo2_max_estimate": wearable_avg.get("vo2_max_estimate"),
            "hrv_score": hrv_score,
            "rhr_score": rhr_score,
            "sleep_quality_score": sleep_score,
            "cardiovascular_score": cardio_score,
            "metabolic_score": metabolic_score,
            "recovery_score": recovery_score,
            "overall_longevity_score": overall,
            "trend_direction": insights.get("trend_direction", "stable"),
            "key_insights": json.dumps(insights.get("key_insights", [])),
            "recommendations": json.dumps(insights.get("recommendations", [])),
            # Include biomarker snapshots
            "apob": biomarkers.get("ApoB"),
            "hba1c": biomarkers.get("HbA1c"),
            "fasting_glucose": biomarkers.get("Fasting Glucose"),
            "hscrp": biomarkers.get("hsCRP"),
        }

        # Store snapshot
        await self._store(result)

        # Parse JSON fields for response
        result["key_insights"] = insights.get("key_insights", [])
        result["recommendations"] = insights.get("recommendations", [])
        result["overall_assessment"] = insights.get("overall_assessment", "")

        return result

    async def _get_age(self) -> Optional[int]:
        """Get chronological age from profile."""
        if not supabase:
            return None
        try:
            result = (
                supabase.table("life_profile")
                .select("value")
                .eq("key", "age")
                .limit(1)
                .execute()
            )
            if result.data:
                val = result.data[0].get("value")
                if isinstance(val, (int, float)):
                    return int(val)
                if isinstance(val, dict):
                    return int(val.get("value", 0)) or None
        except Exception:
            pass
        return None

    async def _get_wearable_averages(self, days: int = 30) -> dict:
        """Get average wearable metrics over a period."""
        if not supabase:
            return {}
        try:
            start = (date.today() - timedelta(days=days)).isoformat()
            result = (
                supabase.table("health_data")
                .select("readiness_score, hrv, resting_heart_rate, sleep_score, sleep_duration, activity_score, steps")
                .gte("date", start)
                .execute()
            )
            rows = result.data or []
            if not rows:
                return {}

            def avg(key):
                vals = [r[key] for r in rows if r.get(key) is not None]
                return round(sum(vals) / len(vals), 1) if vals else None

            return {
                "avg_readiness": avg("readiness_score"),
                "avg_hrv": avg("hrv"),
                "avg_rhr": avg("resting_heart_rate"),
                "avg_sleep_score": avg("sleep_score"),
                "avg_sleep_hours": avg("sleep_duration"),
                "avg_activity": avg("activity_score"),
                "avg_steps": avg("steps"),
                "data_points": len(rows),
            }
        except Exception as e:
            logger.error(f"Wearable averages error: {e}")
            return {}

    async def _get_latest_biomarkers(self) -> dict:
        """Get latest biomarker values as a name->value dict."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("biomarkers")
                .select("name, value")
                .order("date", desc=True)
                .execute()
            )
            seen = {}
            for row in (result.data or []):
                name = row.get("name")
                if name and name not in seen:
                    seen[name] = row["value"]
            return seen
        except Exception as e:
            logger.error(f"Biomarker fetch error: {e}")
            return {}

    def _score_hrv(self, hrv: Optional[float], age: Optional[int]) -> Optional[float]:
        """Score HRV relative to age-adjusted norms."""
        if hrv is None:
            return None
        # Age-adjusted: higher HRV = better
        # Simplified: 20ms = 0, 100ms = 100 for middle-aged adult
        score = min(100, max(0, (hrv - 20) * (100 / 80)))
        return round(score, 1)

    def _score_rhr(self, rhr: Optional[float]) -> Optional[float]:
        """Score resting heart rate (lower = better)."""
        if rhr is None:
            return None
        # 40 bpm = 100, 80 bpm = 0
        score = min(100, max(0, (80 - rhr) * (100 / 40)))
        return round(score, 1)

    def _score_sleep(self, sleep_score: Optional[float]) -> Optional[float]:
        """Pass through Oura sleep score."""
        return sleep_score

    def _score_cardiovascular(self, biomarkers: dict) -> Optional[float]:
        """Score cardiovascular health from biomarkers."""
        scores = []
        # ApoB (optimal < 60)
        apob = biomarkers.get("ApoB")
        if apob is not None:
            scores.append(min(100, max(0, (120 - apob) * (100 / 60))))
        # LDL (optimal < 70)
        ldl = biomarkers.get("LDL")
        if ldl is not None:
            scores.append(min(100, max(0, (140 - ldl) * (100 / 70))))
        # HDL (optimal > 60)
        hdl = biomarkers.get("HDL")
        if hdl is not None:
            scores.append(min(100, max(0, (hdl - 30) * (100 / 40))))
        # hsCRP (optimal < 0.5)
        hscrp = biomarkers.get("hsCRP")
        if hscrp is not None:
            scores.append(min(100, max(0, (3 - hscrp) * (100 / 3))))

        return round(sum(scores) / len(scores), 1) if scores else None

    def _score_metabolic(self, biomarkers: dict) -> Optional[float]:
        """Score metabolic health from biomarkers."""
        scores = []
        hba1c = biomarkers.get("HbA1c")
        if hba1c is not None:
            scores.append(min(100, max(0, (6.5 - hba1c) * (100 / 1.5))))
        glucose = biomarkers.get("Fasting Glucose")
        if glucose is not None:
            scores.append(min(100, max(0, (110 - glucose) * (100 / 40))))
        trig = biomarkers.get("Triglycerides")
        if trig is not None:
            scores.append(min(100, max(0, (200 - trig) * (100 / 120))))

        return round(sum(scores) / len(scores), 1) if scores else None

    def _score_recovery(self, wearable: dict) -> Optional[float]:
        """Score recovery from wearable data."""
        readiness = wearable.get("avg_readiness")
        return readiness  # Oura readiness is already 0-100

    def _estimate_biological_age(
        self, age: Optional[int], overall_score: Optional[float],
        biomarkers: dict, wearable: dict
    ) -> Optional[float]:
        """Estimate biological age from composite data."""
        if age is None:
            return None
        if overall_score is None:
            return None

        # Simple model: biological age = chronological age adjusted by score
        # Score of 80 = 5 years younger, score of 50 = same age, score of 20 = 5 years older
        adjustment = (overall_score - 50) * 0.167  # ±5 years for full range
        return round(age - adjustment, 1)

    async def _get_insights(self, data: dict) -> dict:
        """Get AI-generated insights."""
        if not ANTHROPIC_API_KEY:
            return {
                "key_insights": ["Longevity insights require ANTHROPIC_API_KEY"],
                "recommendations": [],
                "overall_assessment": "Configure API key for personalized insights.",
                "trend_direction": "stable",
            }

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=1500,
                messages=[
                    {
                        "role": "user",
                        "content": INSIGHT_PROMPT.format(data=json.dumps(data, default=str)),
                    }
                ],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except Exception as e:
            logger.error(f"Insight generation error: {e}")
            return {"key_insights": [], "recommendations": [], "overall_assessment": "", "trend_direction": "stable"}

    async def _store(self, metrics: dict) -> None:
        """Store longevity metrics snapshot."""
        if not supabase:
            return
        try:
            supabase.table("longevity_metrics").upsert(
                metrics, on_conflict="calculated_date"
            ).execute()
        except Exception as e:
            logger.error(f"Failed to store longevity metrics: {e}")

    async def get_history(self, days: int = 90) -> list[dict]:
        """Get longevity metric history."""
        if not supabase:
            return []
        try:
            start = (date.today() - timedelta(days=days)).isoformat()
            result = (
                supabase.table("longevity_metrics")
                .select("*")
                .gte("calculated_date", start)
                .order("calculated_date", desc=True)
                .execute()
            )
            rows = result.data or []
            for row in rows:
                for field in ("key_insights", "recommendations"):
                    if isinstance(row.get(field), str):
                        try:
                            row[field] = json.loads(row[field])
                        except (json.JSONDecodeError, TypeError):
                            pass
            return rows
        except Exception as e:
            logger.error(f"Failed to fetch longevity history: {e}")
            return []

    async def get_latest(self) -> Optional[dict]:
        """Get most recent longevity calculation."""
        history = await self.get_history(days=30)
        return history[0] if history else None


longevity_service = LongevityService()
