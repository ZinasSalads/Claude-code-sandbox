"""Blood work router — upload PDFs, view biomarkers, trends, deltas."""

import logging
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.bloodwork import bloodwork_service

logger = logging.getLogger("concierge.bloodwork")
router = APIRouter()


@router.post("/upload")
async def upload_blood_work(file: UploadFile = File(...)):
    """Upload a blood work PDF for AI extraction."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    result = await bloodwork_service.process_upload(contents, file.filename)
    if result.get("error"):
        raise HTTPException(status_code=422, detail=result["error"])
    return result


@router.get("/biomarkers")
async def get_biomarkers():
    """Get latest value for each biomarker with optimal range annotations."""
    return await bloodwork_service.get_latest_biomarkers()


@router.get("/biomarkers/{name}/trend")
async def get_biomarker_trend(name: str, days: int = 365):
    """Get historical values for a specific biomarker."""
    trend = await bloodwork_service.get_biomarker_trend(name, days)
    if not trend:
        return {"name": name, "data": [], "message": "No data found"}
    return {"name": name, "data": trend}


@router.get("/delta")
async def get_delta_report(date1: Optional[str] = None, date2: Optional[str] = None):
    """Compare biomarkers between two lab dates."""
    return await bloodwork_service.get_delta_report(date1, date2)


@router.get("/uploads")
async def get_uploads():
    """Get all blood work upload records."""
    return await bloodwork_service.get_uploads()


@router.get("/flagged")
async def get_flagged():
    """Get biomarkers outside optimal ranges."""
    return await bloodwork_service.get_flagged_biomarkers()
