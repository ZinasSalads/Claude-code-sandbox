"""Voice interface service.

STT: OpenAI Whisper API (whisper-1)
TTS: OpenAI TTS API (tts-1, voice: onyx for calm/masculine or nova for warm)
     Falls back gracefully if OPENAI_API_KEY not set.

Session types:
  morning_briefing  — speaks today's full daily plan
  workout_mode      — hands-free during exercise
  evening_wind_down — reflection and tomorrow preview
  command           — quick one-off commands
"""

import io
import json
import logging
from datetime import date, datetime, timezone

import anthropic
import httpx

from config import OPENAI_API_KEY, ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.voice")

MODEL = "claude-sonnet-4-20250514"

COMMAND_SYSTEM_PROMPT = """You are a personal health & life concierge voice assistant.
You speak in short, natural sentences — this will be read aloud, not displayed on screen.
Keep responses under 3 sentences for commands, under 90 seconds of speech for briefings.

Current date: {date}
Time: {time}

Available commands you can interpret:
- Skip/cancel workout → action: "skip_workout"
- Log meal/food → action: "log_meal", extract food description
- Check HRV/sleep/readiness → action: "query_health", extract metric name
- How am I doing / daily summary → action: "daily_summary"
- Give me motivation / push me → action: "motivate"
- Any other request → action: "general", respond conversationally

Respond with JSON:
{{"response_text": "what to say back", "action": "action_name", "action_data": {{}}}}
"""


class VoiceService:

    async def transcribe(self, audio_bytes: bytes, format: str = "webm") -> str:
        """Send audio to Whisper, return transcription text."""
        if not OPENAI_API_KEY:
            return "[Transcription unavailable — OPENAI_API_KEY not set]"

        try:
            async with httpx.AsyncClient() as client:
                files = {
                    "file": (f"audio.{format}", audio_bytes, f"audio/{format}"),
                    "model": (None, "whisper-1"),
                }
                resp = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
                    files=files,
                    timeout=30.0,
                )
                resp.raise_for_status()
                return resp.json().get("text", "")
        except Exception as e:
            logger.error(f"Whisper transcription failed: {e}")
            return f"[Transcription error: {e}]"

    async def synthesize(self, text: str, voice: str = "onyx") -> bytes:
        """Convert text to speech, return mp3 bytes."""
        if not OPENAI_API_KEY:
            return b""

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={
                        "Authorization": f"Bearer {OPENAI_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "tts-1",
                        "input": text,
                        "voice": voice,
                        "response_format": "mp3",
                    },
                    timeout=30.0,
                )
                resp.raise_for_status()
                return resp.content
        except Exception as e:
            logger.error(f"TTS synthesis failed: {e}")
            return b""

    async def process_command(self, transcript: str, session_type: str) -> dict:
        """Parse intent from transcript using Claude. Execute relevant backend calls."""
        if not ANTHROPIC_API_KEY:
            return {"response_text": "AI not configured.", "action": None}

        now = datetime.now()
        system = COMMAND_SYSTEM_PROMPT.format(
            date=now.strftime("%A, %B %d, %Y"),
            time=now.strftime("%I:%M %p"),
        )

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=500,
                system=system,
                messages=[{"role": "user", "content": f"[{session_type}] {transcript}"}],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            return {
                "response_text": result.get("response_text", ""),
                "action": result.get("action"),
                "action_data": result.get("action_data", {}),
            }
        except Exception as e:
            logger.error(f"Voice command processing failed: {e}")
            return {"response_text": "Sorry, I couldn't process that.", "action": None}

    async def morning_briefing(self) -> str:
        """Generate full spoken morning briefing text."""
        if not ANTHROPIC_API_KEY:
            return "Good morning. AI briefing is not configured yet."

        # Gather context
        context_parts = []
        now = datetime.now()
        context_parts.append(f"Date: {now.strftime('%A, %B %d, %Y')}")

        if supabase:
            try:
                health = (
                    supabase.table("health_data")
                    .select("*")
                    .order("date", desc=True)
                    .limit(1)
                    .execute()
                )
                if health.data:
                    h = health.data[0]
                    context_parts.append(
                        f"Latest biometrics ({h['date']}): "
                        f"Readiness {h.get('readiness_score', 'N/A')}, "
                        f"HRV {h.get('hrv', 'N/A')}ms, "
                        f"Sleep score {h.get('sleep_score', 'N/A')}, "
                        f"RHR {h.get('resting_heart_rate', 'N/A')}bpm"
                    )
            except Exception as e:
                logger.warning(f"Failed to get health data for briefing: {e}")

            try:
                habits = (
                    supabase.table("growth_habits")
                    .select("name, current_streak")
                    .eq("active", True)
                    .execute()
                )
                if habits.data:
                    habit_strs = [h["name"] + " (streak: " + str(h.get("current_streak", 0)) + ")" for h in habits.data[:5]]
                    context_parts.append(f"Active habits: {', '.join(habit_strs)}")
            except Exception:
                pass

            try:
                overdue = (
                    supabase.table("social_contacts")
                    .select("name, last_contact_date, target_contact_days")
                    .eq("active", True)
                    .order("last_contact_date", nullsfirst=True)
                    .limit(3)
                    .execute()
                )
                if overdue.data:
                    names = [c["name"] for c in overdue.data if c.get("last_contact_date")]
                    if names:
                        context_parts.append(f"People to connect with: {', '.join(names)}")
            except Exception:
                pass

        context = "\n".join(context_parts)

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                system=(
                    "You are a personal health & life concierge delivering a morning voice briefing. "
                    "Speak naturally — this will be read aloud. No bullet points, no headers, no markdown. "
                    "Warm, conversational, under 90 seconds when spoken at normal pace. "
                    "Structure: greeting → readiness/sleep recap → today's focus → one actionable nudge → sign off."
                ),
                messages=[{"role": "user", "content": f"Generate my morning briefing.\n\n{context}"}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Morning briefing generation failed: {e}")
            return "Good morning. I wasn't able to generate your full briefing today."

    async def workout_coaching(self, context: dict) -> str:
        """Real-time coaching during workout. Returns 1-2 sentence spoken cue."""
        if not ANTHROPIC_API_KEY:
            return "Keep going, you've got this."

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=100,
                system=(
                    "You are a workout coach giving real-time voice cues. "
                    "Keep it to 1-2 short sentences. Be encouraging but specific."
                ),
                messages=[{"role": "user", "content": json.dumps(context)}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Workout coaching failed: {e}")
            return "Stay focused. One rep at a time."

    async def evening_wind_down(self) -> str:
        """Evening reflection and tomorrow preview."""
        if not ANTHROPIC_API_KEY:
            return "Good evening. Take a moment to reflect on your day."

        context_parts = []
        if supabase:
            try:
                checkin = (
                    supabase.table("check_ins")
                    .select("*")
                    .eq("date", date.today().isoformat())
                    .limit(1)
                    .execute()
                )
                if checkin.data:
                    c = checkin.data[0]
                    context_parts.append(
                        f"Today's check-in: energy {c.get('energy')}, mood {c.get('mood')}, "
                        f"stress {c.get('stress')}, soreness {c.get('soreness')}"
                    )
            except Exception:
                pass

            try:
                habits = (
                    supabase.table("growth_log")
                    .select("*, growth_habits(name)")
                    .eq("log_date", date.today().isoformat())
                    .execute()
                )
                if habits.data:
                    done = sum(1 for h in habits.data if h.get("completed"))
                    context_parts.append(f"Habits completed today: {done}/{len(habits.data)}")
            except Exception:
                pass

        context = "\n".join(context_parts) or "No data available for today."

        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            response = client.messages.create(
                model=MODEL,
                max_tokens=500,
                system=(
                    "You are a personal concierge giving an evening wind-down reflection. "
                    "Speak naturally — this will be read aloud. No bullet points or headers. "
                    "Warm, calming tone. Under 60 seconds when spoken. "
                    "Structure: acknowledge the day → highlight a win → gentle reflection prompt → goodnight."
                ),
                messages=[{"role": "user", "content": f"Generate my evening wind-down.\n\n{context}"}],
            )
            return response.content[0].text.strip()
        except Exception as e:
            logger.error(f"Evening wind-down generation failed: {e}")
            return "Good evening. Rest well tonight."

    async def log_session(self, session_type: str, transcript: str, response_text: str, duration: int = 0) -> dict:
        """Save voice session to database."""
        if not supabase:
            return {"status": "skipped", "reason": "no database"}

        try:
            row = {
                "session_date": date.today().isoformat(),
                "session_type": session_type,
                "transcript": transcript,
                "response_text": response_text,
                "duration_seconds": duration,
            }
            result = supabase.table("voice_sessions").insert(row).execute()
            return {"status": "ok", "data": result.data[0] if result.data else row}
        except Exception as e:
            logger.error(f"Failed to log voice session: {e}")
            return {"status": "error", "error": str(e)}


voice_service = VoiceService()
