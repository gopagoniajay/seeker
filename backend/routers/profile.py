"""
Profile router — manage user resume, skills, and job preferences.
"""
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db, UserProfile

router = APIRouter(prefix="/api/profile", tags=["Profile"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    skills: Optional[List[str]] = None
    job_titles: Optional[List[str]] = None
    target_location: Optional[str] = None
    min_salary: Optional[int] = None
    blacklist: Optional[List[str]] = None
    linkedin_email: Optional[str] = None
    linkedin_password: Optional[str] = None
    indeed_email: Optional[str] = None
    indeed_password: Optional[str] = None


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    location: str
    resume_filename: str
    skills: List[str]
    job_titles: List[str]
    target_location: str
    min_salary: int
    blacklist: List[str]
    linkedin_email: str
    indeed_email: str
    has_resume: bool

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _to_response(profile)


@router.put("", response_model=ProfileResponse)
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile()
        db.add(profile)

    for field, value in data.dict(exclude_none=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return _to_response(profile)


@router.post("/resume", response_model=ProfileResponse)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload a PDF resume and extract its text content."""
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    content = await file.read()
    text = _extract_pdf_text(content)

    profile = db.query(UserProfile).first()
    if not profile:
        profile = UserProfile()
        db.add(profile)

    profile.resume_text = text
    profile.resume_filename = file.filename
    db.commit()
    db.refresh(profile)
    return _to_response(profile)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_pdf_text(content: bytes) -> str:
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=content, filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except Exception as e:
        return f"[PDF extraction failed: {e}]"


def _to_response(p: UserProfile) -> dict:
    return {
        "id": p.id,
        "name": p.name or "",
        "email": p.email or "",
        "phone": p.phone or "",
        "location": p.location or "",
        "resume_filename": p.resume_filename or "",
        "skills": p.skills or [],
        "job_titles": p.job_titles or [],
        "target_location": p.target_location or "Remote",
        "min_salary": p.min_salary or 0,
        "blacklist": p.blacklist or [],
        "linkedin_email": p.linkedin_email or "",
        "indeed_email": p.indeed_email or "",
        "has_resume": bool(p.resume_text),
    }
