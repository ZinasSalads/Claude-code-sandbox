"""Voice interface router — Whisper STT, OpenAI TTS, command processing."""

import logging

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from services.voice import voice_service

logger = logging.getLogger("concierge.voice")
router = APIRouter()


class SynthesizeRequest(BaseModel):
    text: str
    voice: str = "onyx"


class CommandRequest(BaseModel):
    transcript: str
    session_type: str = "command"


class WorkoutCoachingRequest(BaseModel):
    exercise: str = ""
    set_number: int = 0
    reps_done: int = 0
    energy_level: int = 5


class LogSessionRequest(BaseModel):
    session_type: str
    transcript: str
    response_text: str
    duration_seconds: int = 0


@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Upload audio file, return transcription."""
    try:
        audio_bytes = await file.read()
        fmt = file.filename.rsplit(".", 1)[-1] if file.filename else "webm"
        transcript = await voice_service.transcribe(audio_bytes, format=fmt)
        return {"transcript": transcript}
    except Exception as e:
        logger.error(f"Transcription endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/synthesize")
async def synthesize_speech(req: SynthesizeRequest):
    """Convert text to speech, return mp3 audio."""
    try:
        audio = await voice_service.synthesize(req.text, voice=req.voice)
        if not audio:
            raise HTTPException(status_code=503, detail="TTS not available")
        return Response(content=audio, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Synthesis endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/command")
async def process_voice_command(req: CommandRequest):
    """Process a voice command transcript."""
    result = await voice_service.process_command(req.transcript, req.session_type)
    return result


@router.get("/morning-briefing")
async def get_morning_briefing():
    """Generate morning briefing text."""
    text = await voice_service.morning_briefing()
    return {"text": text}


@router.get("/evening-wind-down")
async def get_evening_wind_down():
    """Generate evening wind-down text."""
    text = await voice_service.evening_wind_down()
    return {"text": text}


@router.post("/workout-coaching")
async def get_workout_coaching(req: WorkoutCoachingRequest):
    """Get real-time workout coaching cue."""
    context = {
        "exercise": req.exercise,
        "set_number": req.set_number,
        "reps_done": req.reps_done,
        "energy_level": req.energy_level,
    }
    cue = await voice_service.workout_coaching(context)
    return {"coaching_cue": cue}


@router.post("/log-session")
async def log_voice_session(req: LogSessionRequest):
    """Save voice session to database."""
    result = await voice_service.log_session(
        session_type=req.session_type,
        transcript=req.transcript,
        response_text=req.response_text,
        duration=req.duration_seconds,
    )
    return result
