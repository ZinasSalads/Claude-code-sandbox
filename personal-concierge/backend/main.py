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

app = FastAPI(title="Personal Concierge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Import and include routers ---
from routers import health, fitness, nutrition, sync

app.include_router(health.router, prefix="/checkin", tags=["Check-In"])
app.include_router(fitness.router, prefix="/fitness", tags=["Fitness"])
app.include_router(nutrition.router, prefix="/nutrition", tags=["Nutrition"])
app.include_router(sync.router, prefix="/sync", tags=["Sync"])


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
