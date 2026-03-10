"""Research router — PubMed sweep, article management."""

import logging

from fastapi import APIRouter, HTTPException

from services.research import research_service
from services.memory import build_user_context

logger = logging.getLogger("concierge.research")
router = APIRouter()


@router.post("/sweep")
async def run_sweep():
    """Run a research sweep based on user profile."""
    context = await build_user_context()
    result = await research_service.sweep(context)
    return result


@router.get("/articles")
async def get_articles(limit: int = 20):
    """Get saved/relevant research articles."""
    return await research_service.get_saved_articles(limit)


@router.post("/articles/{pubmed_id}/save")
async def save_article(pubmed_id: str):
    """Bookmark an article."""
    result = await research_service.save_article(pubmed_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return {"status": "ok"}


@router.post("/articles/{pubmed_id}/dismiss")
async def dismiss_article(pubmed_id: str):
    """Dismiss an article from recommendations."""
    result = await research_service.dismiss_article(pubmed_id)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return {"status": "ok"}
