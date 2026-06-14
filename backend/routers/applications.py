"""
Applications router — track submitted job applications and update their status.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, Application, ApplicationStatus

router = APIRouter(prefix="/api/applications", tags=["Applications"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    job_title: str
    company: str
    apply_url: str
    source: str
    status: str
    notes: str
    applied_at: str
    updated_at: str

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: ApplicationStatus
    notes: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[dict])
def list_applications(
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(Application)
    if status:
        q = q.filter(Application.status == status)
    q = q.order_by(Application.applied_at.desc())
    apps = q.limit(limit).all()
    return [
        {
            "id": a.id,
            "job_id": a.job_id,
            "job_title": a.job_title,
            "company": a.company,
            "apply_url": a.apply_url,
            "source": a.source,
            "status": a.status,
            "notes": a.notes or "",
            "applied_at": str(a.applied_at),
            "updated_at": str(a.updated_at),
        }
        for a in apps
    ]


@router.get("/stats")
def application_stats(db: Session = Depends(get_db)):
    total     = db.query(Application).count()
    applied   = db.query(Application).filter(Application.status == ApplicationStatus.APPLIED).count()
    interview = db.query(Application).filter(Application.status == ApplicationStatus.INTERVIEW).count()
    offer     = db.query(Application).filter(Application.status == ApplicationStatus.OFFER).count()
    rejected  = db.query(Application).filter(Application.status == ApplicationStatus.REJECTED).count()
    return {
        "total": total,
        "applied": applied,
        "interview": interview,
        "offer": offer,
        "rejected": rejected,
        "success_rate": round((interview + offer) / total * 100, 1) if total else 0,
    }


@router.patch("/{app_id}")
def update_status(app_id: int, data: StatusUpdate, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    app.status = data.status
    if data.notes is not None:
        app.notes = data.notes
    db.commit()
    return {"message": "Updated successfully"}


@router.delete("/{app_id}")
def delete_application(app_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == app_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(app)
    db.commit()
    return {"message": "Deleted"}
