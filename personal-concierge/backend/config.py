import os
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("concierge")

# --- Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# --- Anthropic ---
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# --- Oura ---
OURA_TOKEN = os.getenv("OURA_PERSONAL_ACCESS_TOKEN")

# --- Mem0 ---
MEM0_API_KEY = os.getenv("MEM0_API_KEY")

# --- Session 2: Environmental ---
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
AMBEE_API_KEY = os.getenv("AMBEE_API_KEY")

# --- Session 2: Research ---
PUBMED_EMAIL = os.getenv("PUBMED_EMAIL")

# --- Session 4: Voice ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")

# --- Session 5: Google Calendar ---
GOOGLE_CALENDAR_CLIENT_ID = os.getenv("GOOGLE_CALENDAR_CLIENT_ID")
GOOGLE_CALENDAR_CLIENT_SECRET = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET")
GOOGLE_CALENDAR_REDIRECT_URI = os.getenv("GOOGLE_CALENDAR_REDIRECT_URI")

# --- Init Supabase client ---
supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_SERVICE_KEY:
        missing.append("SUPABASE_SERVICE_KEY")
    logger.warning(
        f"Supabase not configured — missing: {', '.join(missing)}. "
        "Database features will be unavailable."
    )


def get_service_status() -> dict:
    """Return a dict showing which services are configured vs missing."""
    return {
        "supabase": bool(SUPABASE_URL and SUPABASE_SERVICE_KEY),
        "anthropic": bool(ANTHROPIC_API_KEY),
        "oura": bool(OURA_TOKEN),
        "mem0": bool(MEM0_API_KEY),
        "openweather": bool(OPENWEATHER_API_KEY),
        "ambee": bool(AMBEE_API_KEY),
        "pubmed": bool(PUBMED_EMAIL),
        "openai": bool(OPENAI_API_KEY),
        "voice": bool(OPENAI_API_KEY),
        "travel": True,
        "social": True,
        "financial": True,
        "growth": True,
        "career": True,
        "wardrobe": True,
        "notifications": True,
        "personality": True,
        "onboarding": True,
        "feedback": True,
        "legacy": True,
        "home_environment": True,
        "learning": True,
        "privacy": True,
        "google_calendar": bool(GOOGLE_CALENDAR_CLIENT_ID),
        "skincare": True,
        "relationship_coaching": True,
        "digital_identity": True,
        "financial_planning": True,
        "hobbies": True,
        "contextual_intelligence": True,
        "conversation": bool(ANTHROPIC_API_KEY),
        "reviews": True,
        "agent_council": True,
    }
