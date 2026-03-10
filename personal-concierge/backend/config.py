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
    }
