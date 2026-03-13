"""Conversation router — AI concierge chat endpoints."""

import logging
import uuid
from typing import Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from services.conversation import conversation_service

logger = logging.getLogger("concierge.conversation")
router = APIRouter()


# ------------------------------------------------------------------
# Request / response models
# ------------------------------------------------------------------

class HistoryMessage(BaseModel):
    role: str
    content: str


class MessageInput(BaseModel):
    session_id: Optional[str] = None
    message: str
    history: Optional[list[HistoryMessage]] = None


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.post("/message")
async def send_message(body: MessageInput):
    """Send a message to the concierge and get a response."""
    session_id = body.session_id or str(uuid.uuid4())
    history = None
    if body.history:
        history = [h.model_dump() for h in body.history]
    return await conversation_service.send_message(
        session_id=session_id,
        user_message=body.message,
        history=history,
    )


@router.get("/sessions")
async def list_sessions(limit: int = Query(default=5, ge=1, le=50)):
    """List recent conversation sessions."""
    return await conversation_service.get_recent_sessions(limit=limit)


@router.get("/sessions/{session_id}")
async def get_session_history(session_id: str):
    """Get full message history for a session."""
    return await conversation_service.get_history(session_id)


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete all messages in a session."""
    result = await conversation_service.delete_session(session_id)
    if not result:
        return {"deleted": False, "session_id": session_id}
    return result


@router.get("/context")
async def get_context():
    """Debug endpoint — view the current system prompt context."""
    return await conversation_service.get_context_summary()
