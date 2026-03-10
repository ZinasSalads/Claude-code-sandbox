import logging
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_service_status

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("concierge")

app = FastAPI(title="Personal Concierge", version="2.0.0")

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


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "services": get_service_status(),
    }


@app.on_event("startup")
async def startup():
    status = get_service_status()
    logger.info("=== Personal Concierge starting ===")
    for service, configured in status.items():
        icon = "✓" if configured else "✗"
        logger.info(f"  {icon} {service}: {'configured' if configured else 'MISSING'}")
    logger.info("===================================")
