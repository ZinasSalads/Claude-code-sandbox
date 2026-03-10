"""Blood Work Service — PDF upload, Claude extraction, biomarker storage & trends.

Handles:
- PDF text extraction via PyPDF2
- Claude-powered biomarker extraction from lab report text
- Biomarker storage with optimal ranges (not just reference ranges)
- Trend analysis across multiple uploads
- Delta reports between two lab dates
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.bloodwork")

MODEL = "claude-sonnet-4-20250514"

# Optimal ranges for longevity (stricter than standard lab reference ranges)
OPTIMAL_RANGES = {
    "Total Cholesterol": {"min": 150, "max": 200, "unit": "mg/dL"},
    "LDL": {"min": 0, "max": 100, "unit": "mg/dL", "optimal_max": 70},
    "HDL": {"min": 50, "max": 100, "unit": "mg/dL", "optimal_min": 60},
    "Triglycerides": {"min": 0, "max": 150, "unit": "mg/dL", "optimal_max": 80},
    "ApoB": {"min": 0, "max": 90, "unit": "mg/dL", "optimal_max": 60},
    "Lp(a)": {"min": 0, "max": 30, "unit": "nmol/L"},
    "HbA1c": {"min": 4.0, "max": 5.6, "unit": "%", "optimal_max": 5.2},
    "Fasting Glucose": {"min": 70, "max": 100, "unit": "mg/dL", "optimal_max": 90},
    "Fasting Insulin": {"min": 2, "max": 15, "unit": "uIU/mL", "optimal_max": 6},
    "HOMA-IR": {"min": 0, "max": 2.0, "unit": "", "optimal_max": 1.0},
    "hsCRP": {"min": 0, "max": 3.0, "unit": "mg/L", "optimal_max": 0.5},
    "Homocysteine": {"min": 5, "max": 15, "unit": "umol/L", "optimal_max": 8},
    "Vitamin D": {"min": 30, "max": 100, "unit": "ng/mL", "optimal_min": 50},
    "Vitamin B12": {"min": 200, "max": 900, "unit": "pg/mL", "optimal_min": 500},
    "Ferritin": {"min": 20, "max": 300, "unit": "ng/mL", "optimal_range": [50, 150]},
    "Iron": {"min": 60, "max": 170, "unit": "ug/dL"},
    "TSH": {"min": 0.4, "max": 4.0, "unit": "mIU/L", "optimal_range": [1.0, 2.5]},
    "Free T4": {"min": 0.8, "max": 1.8, "unit": "ng/dL"},
    "Free T3": {"min": 2.3, "max": 4.2, "unit": "pg/mL"},
    "Testosterone (Total)": {"min": 300, "max": 1000, "unit": "ng/dL"},
    "SHBG": {"min": 20, "max": 60, "unit": "nmol/L"},
    "Cortisol (AM)": {"min": 6, "max": 23, "unit": "ug/dL"},
    "DHEA-S": {"min": 100, "max": 500, "unit": "ug/dL"},
    "ALT": {"min": 0, "max": 40, "unit": "U/L", "optimal_max": 25},
    "AST": {"min": 0, "max": 40, "unit": "U/L", "optimal_max": 25},
    "GGT": {"min": 0, "max": 60, "unit": "U/L", "optimal_max": 25},
    "Creatinine": {"min": 0.7, "max": 1.3, "unit": "mg/dL"},
    "eGFR": {"min": 90, "max": 120, "unit": "mL/min"},
    "Uric Acid": {"min": 3.0, "max": 7.0, "unit": "mg/dL", "optimal_max": 5.5},
    "WBC": {"min": 4.0, "max": 11.0, "unit": "K/uL", "optimal_range": [4.5, 7.5]},
    "RBC": {"min": 4.0, "max": 5.5, "unit": "M/uL"},
    "Hemoglobin": {"min": 12.0, "max": 17.0, "unit": "g/dL"},
    "Hematocrit": {"min": 36, "max": 50, "unit": "%"},
    "Platelets": {"min": 150, "max": 400, "unit": "K/uL"},
    "Omega-3 Index": {"min": 4, "max": 12, "unit": "%", "optimal_min": 8},
}

EXTRACTION_PROMPT = """You are a medical lab report parser. Extract every biomarker from the lab report text below.

For each biomarker found, return:
- name: standardized name (match common names like "HbA1c", "LDL", "TSH", etc.)
- value: the numeric result
- unit: the unit of measurement
- reference_min: low end of the lab's reference range (if provided)
- reference_max: high end of the lab's reference range (if provided)
- flag: "H" for high, "L" for low, "N" for normal, based on the lab's reference range

Also extract:
- lab_name: name of the laboratory (if visible)
- test_date: date of the lab test (in YYYY-MM-DD format if possible)
- patient_name: redact this — return "REDACTED"

Return ONLY valid JSON (no markdown fences):
{{
  "lab_name": "",
  "test_date": "",
  "biomarkers": [
    {{"name": "", "value": 0.0, "unit": "", "reference_min": null, "reference_max": null, "flag": "N"}}
  ]
}}

LAB REPORT TEXT:
{text}"""


class BloodWorkService:
    """Handles blood work PDF processing, extraction, and analysis."""

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Extract text from PDF bytes using PyPDF2."""
        try:
            import io
            from PyPDF2 import PdfReader

            reader = PdfReader(io.BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF extraction failed: {e}")
            return ""

    async def extract_biomarkers_with_ai(self, raw_text: str) -> dict:
        """Use Claude to extract structured biomarker data from lab report text."""
        if not ANTHROPIC_API_KEY:
            return {"error": "ANTHROPIC_API_KEY not configured", "biomarkers": []}

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=4000,
                messages=[
                    {
                        "role": "user",
                        "content": EXTRACTION_PROMPT.format(text=raw_text[:8000]),
                    }
                ],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse biomarker extraction: {e}")
            return {"error": "Parse error", "biomarkers": []}
        except Exception as e:
            logger.error(f"Claude extraction error: {e}")
            return {"error": str(e), "biomarkers": []}

    async def process_upload(self, pdf_bytes: bytes, filename: str) -> dict:
        """Full pipeline: extract text → AI extraction → store."""
        raw_text = self.extract_text_from_pdf(pdf_bytes)
        if not raw_text:
            return {"error": "Could not extract text from PDF", "biomarkers": []}

        extracted = await self.extract_biomarkers_with_ai(raw_text)
        if extracted.get("error"):
            return extracted

        biomarkers = extracted.get("biomarkers", [])
        lab_name = extracted.get("lab_name", "")
        test_date = extracted.get("test_date", date.today().isoformat())

        # Save upload record
        upload_id = None
        if supabase:
            try:
                upload_row = {
                    "upload_date": date.today().isoformat(),
                    "lab_name": lab_name,
                    "test_date": test_date,
                    "pdf_filename": filename,
                    "raw_text": raw_text[:10000],
                    "processing_status": "completed",
                    "biomarker_count": len(biomarkers),
                }
                result = supabase.table("blood_work_uploads").insert(upload_row).execute()
                if result.data:
                    upload_id = result.data[0].get("id")
            except Exception as e:
                logger.error(f"Failed to save upload record: {e}")

        # Save individual biomarkers
        saved_count = 0
        for bm in biomarkers:
            if await self._save_biomarker(bm, test_date, upload_id):
                saved_count += 1

        return {
            "upload_id": upload_id,
            "lab_name": lab_name,
            "test_date": test_date,
            "biomarkers_found": len(biomarkers),
            "biomarkers_saved": saved_count,
            "biomarkers": self._annotate_biomarkers(biomarkers),
        }

    async def _save_biomarker(self, bm: dict, test_date: str, upload_id: Optional[str]) -> bool:
        """Save a single biomarker to the biomarkers table."""
        if not supabase:
            return False
        try:
            row = {
                "name": bm["name"],
                "value": bm["value"],
                "unit": bm.get("unit", ""),
                "date": test_date,
                "reference_min": bm.get("reference_min"),
                "reference_max": bm.get("reference_max"),
                "flag": bm.get("flag", "N"),
                "source": "lab_upload",
            }
            supabase.table("biomarkers").insert(row).execute()
            return True
        except Exception as e:
            logger.error(f"Failed to save biomarker {bm.get('name')}: {e}")
            return False

    def _annotate_biomarkers(self, biomarkers: list[dict]) -> list[dict]:
        """Add optimal range annotations to biomarkers."""
        annotated = []
        for bm in biomarkers:
            entry = {**bm}
            optimal = OPTIMAL_RANGES.get(bm.get("name", ""))
            if optimal:
                entry["optimal_min"] = optimal.get("optimal_min", optimal.get("min"))
                entry["optimal_max"] = optimal.get("optimal_max", optimal.get("max"))
                if optimal.get("optimal_range"):
                    entry["optimal_min"] = optimal["optimal_range"][0]
                    entry["optimal_max"] = optimal["optimal_range"][1]
                val = bm.get("value")
                if val is not None:
                    opt_min = entry.get("optimal_min", 0)
                    opt_max = entry.get("optimal_max", float("inf"))
                    if opt_min <= val <= opt_max:
                        entry["optimal_status"] = "optimal"
                    elif bm.get("reference_min") and val < bm["reference_min"]:
                        entry["optimal_status"] = "low"
                    elif bm.get("reference_max") and val > bm["reference_max"]:
                        entry["optimal_status"] = "high"
                    else:
                        entry["optimal_status"] = "suboptimal"
            annotated.append(entry)
        return annotated

    async def get_latest_biomarkers(self) -> list[dict]:
        """Get the most recent value for each biomarker."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("biomarkers")
                .select("*")
                .order("date", desc=True)
                .execute()
            )
            if not result.data:
                return []
            # Keep only the most recent per biomarker name
            seen = {}
            for row in result.data:
                name = row.get("name")
                if name and name not in seen:
                    seen[name] = row
            return self._annotate_biomarkers(list(seen.values()))
        except Exception as e:
            logger.error(f"Failed to fetch biomarkers: {e}")
            return []

    async def get_biomarker_trend(self, name: str, days: int = 365) -> list[dict]:
        """Get historical values for a specific biomarker."""
        if not supabase:
            return []
        try:
            start = (date.today() - timedelta(days=days)).isoformat()
            result = (
                supabase.table("biomarkers")
                .select("name, value, unit, date, flag")
                .eq("name", name)
                .gte("date", start)
                .order("date")
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch trend for {name}: {e}")
            return []

    async def get_delta_report(self, date1: Optional[str] = None, date2: Optional[str] = None) -> dict:
        """Compare biomarkers between two lab dates."""
        if not supabase:
            return {"error": "Supabase not configured"}

        try:
            # Get all uploads ordered by test date
            uploads = (
                supabase.table("blood_work_uploads")
                .select("test_date")
                .eq("processing_status", "completed")
                .order("test_date", desc=True)
                .execute()
            )
            dates = list({u["test_date"] for u in (uploads.data or [])})
            dates.sort(reverse=True)

            if len(dates) < 2:
                return {"error": "Need at least two lab dates for comparison", "dates_available": dates}

            d2 = date2 or dates[0]
            d1 = date1 or dates[1]

            # Fetch biomarkers for both dates
            r1 = supabase.table("biomarkers").select("*").eq("date", d1).execute()
            r2 = supabase.table("biomarkers").select("*").eq("date", d2).execute()

            bm1 = {b["name"]: b for b in (r1.data or [])}
            bm2 = {b["name"]: b for b in (r2.data or [])}

            all_names = sorted(set(list(bm1.keys()) + list(bm2.keys())))
            deltas = []
            for name in all_names:
                old = bm1.get(name)
                new = bm2.get(name)
                entry = {"name": name}
                if old:
                    entry["old_value"] = old["value"]
                    entry["old_date"] = d1
                if new:
                    entry["new_value"] = new["value"]
                    entry["new_date"] = d2
                    entry["unit"] = new.get("unit", "")
                if old and new and old["value"] and new["value"]:
                    entry["change"] = round(new["value"] - old["value"], 2)
                    if old["value"] != 0:
                        entry["change_pct"] = round(
                            ((new["value"] - old["value"]) / abs(old["value"])) * 100, 1
                        )
                    # Determine if change is improvement
                    optimal = OPTIMAL_RANGES.get(name)
                    if optimal:
                        opt_max = optimal.get("optimal_max", optimal.get("max", float("inf")))
                        if new["value"] <= opt_max and old["value"] > opt_max:
                            entry["direction"] = "improved"
                        elif new["value"] > opt_max and old["value"] <= opt_max:
                            entry["direction"] = "worsened"
                        elif abs(new["value"] - old["value"]) < 0.01:
                            entry["direction"] = "stable"
                        else:
                            entry["direction"] = "changed"
                deltas.append(entry)

            return {
                "date_old": d1,
                "date_new": d2,
                "deltas": deltas,
                "total_markers": len(deltas),
            }
        except Exception as e:
            logger.error(f"Delta report error: {e}")
            return {"error": str(e)}

    async def get_uploads(self) -> list[dict]:
        """Get all blood work upload records."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("blood_work_uploads")
                .select("*")
                .order("test_date", desc=True)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch uploads: {e}")
            return []

    async def get_flagged_biomarkers(self) -> list[dict]:
        """Get biomarkers that are outside optimal ranges."""
        latest = await self.get_latest_biomarkers()
        return [b for b in latest if b.get("optimal_status") in ("high", "low", "suboptimal")]


bloodwork_service = BloodWorkService()
