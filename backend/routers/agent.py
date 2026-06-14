"""
Agent router — start/stop the agent, trigger manual runs, apply to individual jobs,
and stream live activity logs.
"""
import asyncio
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, AgentState, AgentLog, Job, JobStatus, UserProfile
from agents.scheduler import run_agent_cycle, start_scheduler, stop_scheduler

router = APIRouter(prefix="/api/agent", tags=["Agent"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class AgentStatus(BaseModel):
    is_running: bool
    phase: str
    last_run: Optional[str] = None
    jobs_found_today: int
    jobs_applied_today: int



# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status")
def get_status(db: Session = Depends(get_db)):
    state = db.query(AgentState).first()
    if not state:
        return {"is_running": False, "phase": "idle", "last_run": None,
                "jobs_found_today": 0, "jobs_applied_today": 0}
    return {
        "is_running": state.is_running,
        "phase": state.phase or "idle",
        "last_run": str(state.last_run) if state.last_run else None,
        "jobs_found_today": state.jobs_found_today or 0,
        "jobs_applied_today": state.jobs_applied_today or 0,
    }


@router.post("/start")
async def start_agent(db: Session = Depends(get_db)):
    """Manually trigger one agent cycle (search + score)."""
    state = db.query(AgentState).first()
    if state and state.is_running:
        return {"message": "Agent is already running"}
    # Run in background so API returns immediately
    asyncio.create_task(run_agent_cycle())
    start_scheduler()
    return {"message": "Agent cycle started"}


@router.post("/stop")
def stop_agent(db: Session = Depends(get_db)):
    stop_scheduler()
    state = db.query(AgentState).first()
    if state:
        state.is_running = False
        state.phase = "idle"
        db.commit()
    return {"message": "Agent stopped"}


@router.post("/apply/{job_id}")
async def apply_to_job(job_id: int, db: Session = Depends(get_db)):
    """Trigger application for a single approved job (semi-auto mode)."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == JobStatus.APPLIED:
        return {"message": "Already applied to this job"}

    profile = db.query(UserProfile).first()
    if not profile or not profile.name:
        raise HTTPException(status_code=400, detail="Please complete your profile before applying")

    # Run in background
    from agents.browser_apply import apply_to_job as do_apply
    asyncio.create_task(do_apply(db, job, profile))
    return {"message": f"Application started for: {job.title} @ {job.company}"}


@router.get("/logs")
def get_logs(limit: int = 50, db: Session = Depends(get_db)):
    """Return recent agent activity logs."""
    logs = (
        db.query(AgentLog)
        .order_by(AgentLog.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": l.id,
            "level": l.level,
            "message": l.message,
            "details": l.details or {},
            "created_at": str(l.created_at),
        }
        for l in reversed(logs)
    ]


@router.get("/logs/stream")
async def stream_logs(db: Session = Depends(get_db)):
    """Server-Sent Events stream for live log updates."""
    async def event_generator():
        last_id = 0
        while True:
            new_logs = (
                db.query(AgentLog)
                .filter(AgentLog.id > last_id)
                .order_by(AgentLog.created_at.asc())
                .limit(20)
                .all()
            )
            for log in new_logs:
                last_id = log.id
                data = f"data: {log.level}|{log.message}\n\n"
                yield data
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
