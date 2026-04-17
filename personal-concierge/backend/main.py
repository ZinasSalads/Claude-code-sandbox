import logging
import os
from datetime import datetime, date, timezone, timedelta

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import get_service_status, supabase

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("concierge")

app = FastAPI(title="Personal Concierge", version="6.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Import and include routers ---
from routers import health, fitness, nutrition, sync
from routers import bloodwork, supplements, environment, research
from routers import longevity, coaching, daily, reminders
from routers import voice, travel, social, financial, growth, career, wardrobe, notifications
from routers import personality, onboarding, feedback, legacy, home_environment, learning, privacy
from routers import calendar as calendar_router
# Session 6 routers
from routers import skincare, relationships, digital_identity, financial_planning
from routers import hobbies, contextual, conversation, reviews

# Session 1 routers
app.include_router(health.router, prefix="/checkin", tags=["Check-In"])
app.include_router(fitness.router, prefix="/fitness", tags=["Fitness"])
app.include_router(nutrition.router, prefix="/nutrition", tags=["Nutrition"])
app.include_router(sync.router, prefix="/sync", tags=["Sync"])

# Session 2 routers
app.include_router(bloodwork.router, prefix="/bloodwork", tags=["Blood Work"])
app.include_router(supplements.router, prefix="/supplements", tags=["Supplements"])
app.include_router(environment.router, prefix="/environment", tags=["Environment"])
app.include_router(research.router, prefix="/research", tags=["Research"])
app.include_router(longevity.router, prefix="/longevity", tags=["Longevity"])
app.include_router(coaching.router, prefix="/coaching", tags=["Coaching"])
app.include_router(daily.router, prefix="/daily", tags=["Daily Plan"])
app.include_router(reminders.router, prefix="/reminders", tags=["Reminders"])

# Session 4 routers
app.include_router(voice.router, prefix="/voice", tags=["Voice"])
app.include_router(travel.router, prefix="/travel", tags=["Travel"])
app.include_router(social.router, prefix="/social", tags=["Social"])
app.include_router(financial.router, prefix="/financial", tags=["Financial"])
app.include_router(growth.router, prefix="/growth", tags=["Growth"])
app.include_router(career.router, prefix="/career", tags=["Career"])
app.include_router(wardrobe.router, prefix="/wardrobe", tags=["Wardrobe"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

# Session 5 routers
app.include_router(personality.router, prefix="/personality", tags=["Personality"])
app.include_router(onboarding.router, prefix="/onboarding", tags=["Onboarding"])
app.include_router(feedback.router, prefix="/feedback", tags=["Feedback"])
app.include_router(legacy.router, prefix="/legacy", tags=["Legacy"])
app.include_router(home_environment.router, prefix="/home", tags=["Home Environment"])
app.include_router(learning.router, prefix="/learning", tags=["Learning"])
app.include_router(privacy.router, prefix="/privacy", tags=["Privacy"])
app.include_router(calendar_router.router, prefix="/calendar", tags=["Calendar"])

# Session 6 routers
app.include_router(skincare.router, prefix="/skincare", tags=["Skincare"])
app.include_router(relationships.router, prefix="/relationships", tags=["Relationships"])
app.include_router(digital_identity.router, prefix="/digital", tags=["Digital Identity"])
app.include_router(financial_planning.router, prefix="/financial-planning", tags=["Financial Planning"])
app.include_router(hobbies.router, prefix="/hobbies", tags=["Hobbies"])
app.include_router(contextual.router, prefix="/context", tags=["Contextual Intelligence"])
app.include_router(conversation.router, prefix="/conversation", tags=["Conversation"])
app.include_router(reviews.router, prefix="/reviews", tags=["Reviews"])


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": get_service_status(),
    }


@app.get("/dashboard/summary")
def dashboard_summary():
    """Return today's health data + 7-day history for the web dashboard."""
    if not supabase:
        return {"today": None, "history": []}

    today = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()

    try:
        today_resp = (
            supabase.table("health_data")
            .select("*")
            .eq("date", today)
            .execute()
        )
        today_data = today_resp.data[0] if today_resp.data else None

        if not today_data:
            latest_resp = (
                supabase.table("health_data")
                .select("*")
                .order("date", desc=True)
                .limit(1)
                .execute()
            )
            today_data = latest_resp.data[0] if latest_resp.data else None

        history_resp = (
            supabase.table("health_data")
            .select("date,readiness_score,sleep_score,hrv,resting_heart_rate,steps")
            .gte("date", week_ago)
            .order("date")
            .execute()
        )

        return {
            "today": today_data,
            "history": history_resp.data or [],
        }
    except Exception as e:
        logger.error(f"dashboard/summary error: {e}")
        return {"today": None, "history": []}


# --- Serve web dashboard ---
@app.get("/")
def serve_dashboard():
    return FileResponse(
        os.path.join(os.path.dirname(__file__), "static", "index.html")
    )


app.mount("/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")


@app.on_event("startup")
async def startup():
    status = get_service_status()
    logger.info("=== Personal Concierge v6.0 starting ===")
    for service, configured in status.items():
        icon = "✓" if configured else "✗"
        logger.info(f"  {icon} {service}: {'configured' if configured else 'MISSING'}")
    logger.info("=========================================")

    # Auto-create daily_plans cache table if missing
    if supabase:
        try:
            supabase.table("daily_plans").select("id").limit(1).execute()
            logger.info("  ✓ daily_plans table exists")
        except Exception:
            logger.info("  Creating daily_plans cache table...")
            import httpx
            from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
            ddl = """
            CREATE TABLE IF NOT EXISTS daily_plans (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                date DATE NOT NULL UNIQUE,
                plan JSONB NOT NULL,
                generated_at TIMESTAMPTZ DEFAULT NOW(),
                invalidated BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(date);
            """
            try:
                resp = httpx.post(
                    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
                    headers={
                        "apikey": SUPABASE_SERVICE_KEY,
                        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={"query": ddl},
                    timeout=15,
                )
                if resp.status_code < 400:
                    logger.info("  ✓ daily_plans table created via rpc")
                else:
                    # rpc not available — try direct query endpoint
                    resp2 = httpx.post(
                        f"{SUPABASE_URL}/pg/query",
                        headers={
                            "apikey": SUPABASE_SERVICE_KEY,
                            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                            "Content-Type": "application/json",
                        },
                        json={"query": ddl},
                        timeout=15,
                    )
                    if resp2.status_code < 400:
                        logger.info("  ✓ daily_plans table created via pg/query")
                    else:
                        logger.warning("  ✗ Could not auto-create daily_plans table — run migration 006 manually")
            except Exception as e:
                logger.warning(f"  daily_plans auto-create failed: {e}")

    # Seed skincare ingredient conflicts on startup
    try:
        from services.skincare import skincare_service
        await skincare_service.seed_conflicts()
    except Exception as e:
        logger.warning(f"Skincare conflict seeding skipped: {e}")
