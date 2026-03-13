"""Learning & Education router."""

import logging

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from services.learning import learning_service

logger = logging.getLogger("concierge.learning")
router = APIRouter()


class LearningProfileUpdate(BaseModel):
    learning_style: Optional[str] = None
    daily_minutes_target: Optional[int] = None
    languages_learning: Optional[list[str]] = None
    language_levels: Optional[dict] = None
    intellectual_interests: Optional[list[str]] = None
    skill_goals: Optional[list[str]] = None
    notes: Optional[str] = None


class LearningLogEntry(BaseModel):
    minutes_spent: int
    activity_type: Optional[str] = "reading"
    resource_id: Optional[str] = None
    topic: Optional[str] = None
    notes: Optional[str] = None
    date: Optional[str] = None


class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    category: Optional[str] = None
    total_pages: Optional[int] = None
    linked_goal: Optional[str] = None


class BookUpdate(BaseModel):
    status: Optional[str] = None
    current_page: Optional[int] = None
    rating: Optional[int] = None
    key_insights: Optional[list[str]] = None


class CourseCreate(BaseModel):
    title: str
    provider: Optional[str] = None
    category: Optional[str] = None
    total_hours: Optional[float] = None
    target_completion: Optional[str] = None
    linked_goal: Optional[str] = None


class CourseUpdate(BaseModel):
    status: Optional[str] = None
    completion_percent: Optional[int] = None
    hours_completed: Optional[float] = None
    certificate_earned: Optional[bool] = None
    notes: Optional[str] = None


@router.get("/profile")
async def get_profile():
    """Get learning profile."""
    return await learning_service.get_profile()


@router.put("/profile")
async def update_profile(data: LearningProfileUpdate):
    """Update learning profile."""
    return await learning_service.update_profile(data.model_dump(exclude_none=True))


@router.post("/log")
async def log_session(data: LearningLogEntry):
    """Log a learning session."""
    return await learning_service.log_session(data.model_dump(exclude_none=True))


@router.get("/today")
async def get_today():
    """Today's learning recommendation."""
    return await learning_service.get_today_recommendation()


@router.get("/books")
async def list_books(status: str = None):
    """List books."""
    return await learning_service.get_books(status)


@router.post("/books")
async def add_book(data: BookCreate):
    """Add a book."""
    return await learning_service.add_book(data.model_dump(exclude_none=True))


@router.put("/books/{book_id}")
async def update_book(book_id: str, data: BookUpdate):
    """Update a book."""
    return await learning_service.update_book(book_id, data.model_dump(exclude_none=True))


@router.get("/courses")
async def list_courses(status: str = None):
    """List courses."""
    return await learning_service.get_courses(status)


@router.post("/courses")
async def add_course(data: CourseCreate):
    """Add a course."""
    return await learning_service.add_course(data.model_dump(exclude_none=True))


@router.put("/courses/{course_id}")
async def update_course(course_id: str, data: CourseUpdate):
    """Update a course."""
    return await learning_service.update_course(course_id, data.model_dump(exclude_none=True))


@router.get("/language/{lang}")
async def get_language_plan(lang: str):
    """Get language learning plan."""
    return await learning_service.get_language_plan(lang)


@router.get("/weekly")
async def get_weekly_summary():
    """Weekly learning summary."""
    return await learning_service.get_weekly_summary()
