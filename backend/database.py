"""
SQLAlchemy database models and session management.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    Text, DateTime, Boolean, JSON, Enum as SAEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import enum

from config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False}  # Required for SQLite
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Enums ─────────────────────────────────────────────────────────────────────

class JobStatus(str, enum.Enum):
    DISCOVERED = "discovered"
    SCORING    = "scoring"
    QUEUED     = "queued"        # Awaiting user review
    SKIPPED    = "skipped"       # User skipped
    APPLYING   = "applying"
    APPLIED    = "applied"
    FAILED     = "failed"


class ApplicationStatus(str, enum.Enum):
    APPLIED    = "applied"
    INTERVIEW  = "interview"
    REJECTED   = "rejected"
    OFFER      = "offer"
    WITHDRAWN  = "withdrawn"
    NO_RESPONSE = "no_response"


# ── Models ────────────────────────────────────────────────────────────────────

class UserProfile(Base):
    __tablename__ = "user_profile"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(255), nullable=False, default="")
    email           = Column(String(255), nullable=False, default="")
    phone           = Column(String(50), default="")
    location        = Column(String(255), default="")
    resume_text     = Column(Text, default="")         # Extracted resume text
    resume_filename = Column(String(255), default="")
    skills          = Column(JSON, default=list)       # ["Python", "React", ...]
    job_titles      = Column(JSON, default=list)       # Target job titles
    target_location = Column(String(255), default="Remote")
    min_salary      = Column(Integer, default=0)
    blacklist       = Column(JSON, default=list)       # Blacklisted companies
    linkedin_email  = Column(String(255), default="")
    linkedin_password = Column(String(255), default="") # Stored locally only
    indeed_email    = Column(String(255), default="")
    indeed_password = Column(String(255), default="")
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id              = Column(Integer, primary_key=True, index=True)
    external_id     = Column(String(512), unique=True, index=True)  # Source job ID
    title           = Column(String(512), nullable=False)
    company         = Column(String(255))
    location        = Column(String(255))
    job_type        = Column(String(100))
    salary_min      = Column(Float, nullable=True)
    salary_max      = Column(Float, nullable=True)
    salary_currency = Column(String(10), default="USD")
    description     = Column(Text)
    requirements    = Column(Text)
    apply_url       = Column(String(1024))
    source          = Column(String(50))             # "linkedin", "indeed", "glassdoor"
    is_easy_apply   = Column(Boolean, default=False)
    date_posted     = Column(String(100))

    # AI-generated fields
    fit_score       = Column(Float, nullable=True)
    fit_summary     = Column(Text, default="")
    cover_letter    = Column(Text, default="")
    tailored_resume = Column(Text, default="")

    status          = Column(SAEnum(JobStatus), default=JobStatus.DISCOVERED)
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Application(Base):
    __tablename__ = "applications"

    id              = Column(Integer, primary_key=True, index=True)
    job_id          = Column(Integer, index=True)
    job_title       = Column(String(512))
    company         = Column(String(255))
    apply_url       = Column(String(1024))
    source          = Column(String(50))
    cover_letter    = Column(Text)
    status          = Column(SAEnum(ApplicationStatus), default=ApplicationStatus.APPLIED)
    notes           = Column(Text, default="")
    applied_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    screenshot_path = Column(String(512), default="")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id          = Column(Integer, primary_key=True, index=True)
    level       = Column(String(20), default="INFO")   # INFO, WARNING, ERROR
    message     = Column(Text)
    details     = Column(JSON, default=dict)
    created_at  = Column(DateTime, default=datetime.utcnow)


class AgentState(Base):
    __tablename__ = "agent_state"

    id          = Column(Integer, primary_key=True, index=True)
    is_running  = Column(Boolean, default=False)
    phase       = Column(String(100), default="idle")  # idle, searching, scoring, applying
    last_run    = Column(DateTime, nullable=True)
    jobs_found_today  = Column(Integer, default=0)
    jobs_applied_today = Column(Integer, default=0)


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables and seed default state."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed agent state if not present
        if not db.query(AgentState).first():
            db.add(AgentState())
            db.commit()
        # Seed empty profile if not present
        if not db.query(UserProfile).first():
            db.add(UserProfile())
            db.commit()
    finally:
        db.close()
