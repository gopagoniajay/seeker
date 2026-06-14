"""
Jobs router — browse discovered/queued jobs, view AI scores and cover letters.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Job, JobStatus

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class JobResponse(BaseModel):
    id: int
    title: str
    company: str
    location: str
    job_type: str
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_currency: str
    source: str
    is_easy_apply: bool
    date_posted: str
    apply_url: str
    fit_score: Optional[float]
    fit_summary: str
    cover_letter: str
    status: str
    description: str

    class Config:
        from_attributes = True


class JobSummary(BaseModel):
    id: int
    title: str
    company: str
    location: str
    source: str
    is_easy_apply: bool
    fit_score: Optional[float]
    fit_summary: str
    status: str
    date_posted: str
    salary_min: Optional[float]
    salary_max: Optional[float]

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[JobSummary])
def list_jobs(
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Job)
    if status:
        q = q.filter(Job.status == status)
    if source:
        q = q.filter(Job.source == source)
    if min_score is not None:
        q = q.filter(Job.fit_score >= min_score)
    q = q.order_by(Job.fit_score.desc().nullslast(), Job.created_at.desc())
    return q.offset(offset).limit(limit).all()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    total      = db.query(Job).count()
    queued     = db.query(Job).filter(Job.status == JobStatus.QUEUED).count()
    applied    = db.query(Job).filter(Job.status == JobStatus.APPLIED).count()
    skipped    = db.query(Job).filter(Job.status == JobStatus.SKIPPED).count()
    discovered = db.query(Job).filter(Job.status == JobStatus.DISCOVERED).count()
    failed     = db.query(Job).filter(Job.status == JobStatus.FAILED).count()
    return {
        "total": total,
        "discovered": discovered,
        "queued": queued,
        "applied": applied,
        "skipped": skipped,
        "failed": failed,
    }


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.post("/{job_id}/skip")
def skip_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.status = JobStatus.SKIPPED
    db.commit()
    return {"message": "Job skipped"}


@router.post("/{job_id}/regenerate-cover-letter")
async def regenerate_cover_letter(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    from database import UserProfile
    profile = db.query(UserProfile).first()
    from agents.ai_engine import generate_cover_letter
    letter = await generate_cover_letter(db, job, profile)
    return {"cover_letter": letter}
