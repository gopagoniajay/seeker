"""
AI Engine — uses Google Gemini to score jobs, tailor resumes, and generate cover letters.
"""
import json
import logging
import re
from typing import Optional

import google.generativeai as genai
from sqlalchemy.orm import Session

from config import settings
from database import Job, JobStatus, UserProfile, AgentLog

logger = logging.getLogger(__name__)


def _configure_gemini():
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set in your .env file")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel(settings.GEMINI_MODEL)


def _log(db: Session, message: str, level: str = "INFO", details: dict = None):
    db.add(AgentLog(level=level, message=message, details=details or {}))
    db.commit()
    getattr(logger, level.lower(), logger.info)(message)


def _ask_gemini(model, prompt: str) -> str:
    """Send a prompt to Gemini and return the text response."""
    response = model.generate_content(prompt)
    return response.text.strip()


# ── Job Scoring ───────────────────────────────────────────────────────────────

SCORE_PROMPT = """
You are a professional career advisor and expert job matcher.

CANDIDATE RESUME / PROFILE:
{resume}

SKILLS: {skills}

JOB POSTING:
Title: {title}
Company: {company}
Description:
{description}

TASK:
1. Analyze how well the candidate matches this job.
2. Consider skills overlap, experience level, job requirements.
3. Return a JSON object ONLY with these exact keys:
   - "score": integer 0-100 (how well candidate fits)
   - "summary": string (2-3 sentence explanation of the score)
   - "matched_skills": list of strings (skills that match)
   - "missing_skills": list of strings (skills candidate lacks)

Return ONLY valid JSON, no markdown, no explanation outside JSON.
"""

async def score_job(db: Session, job: Job, profile: UserProfile) -> Optional[float]:
    """Score a job against the user's profile using Gemini. Returns fit score 0-100."""
    try:
        model = _configure_gemini()
        prompt = SCORE_PROMPT.format(
            resume=profile.resume_text[:3000] if profile.resume_text else "(No resume uploaded yet)",
            skills=", ".join(profile.skills) if profile.skills else "Not specified",
            title=job.title,
            company=job.company,
            description=(job.description or "")[:2000],
        )
        raw = _ask_gemini(model, prompt)

        # Extract JSON from response
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if not json_match:
            raise ValueError(f"No JSON found in Gemini response: {raw[:200]}")

        data = json.loads(json_match.group())
        score = float(data.get("score", 0))
        summary = data.get("summary", "")

        job.fit_score = score
        job.fit_summary = summary
        job.status = JobStatus.QUEUED
        db.commit()

        _log(db, f"📊 Scored '{job.title}' @ {job.company}: {score}/100", details={
            "job_id": job.id,
            "matched_skills": data.get("matched_skills", []),
            "missing_skills": data.get("missing_skills", []),
        })
        return score

    except Exception as e:
        _log(db, f"❌ Scoring failed for job {job.id}: {e}", "ERROR")
        job.status = JobStatus.DISCOVERED  # Keep as discovered if scoring fails
        db.commit()
        return None


# ── Cover Letter Generation ───────────────────────────────────────────────────

COVER_LETTER_PROMPT = """
You are an expert career coach writing a compelling cover letter.

CANDIDATE PROFILE:
Name: {name}
Skills: {skills}
Background:
{resume}

JOB POSTING:
Title: {title}
Company: {company}
Description:
{description}

Write a professional, engaging cover letter that:
- Opens with a strong hook (NOT "I am writing to apply for...")
- Highlights 2-3 specific skills/experiences matching this role
- Shows genuine enthusiasm for the company/role
- Closes with a clear call to action
- Is 3-4 paragraphs, 250-350 words
- Sounds natural and human, NOT robotic

Write ONLY the cover letter body text, no subject line or date.
"""

async def generate_cover_letter(db: Session, job: Job, profile: UserProfile) -> str:
    """Generate a tailored cover letter for a specific job."""
    try:
        model = _configure_gemini()
        prompt = COVER_LETTER_PROMPT.format(
            name=profile.name or "Candidate",
            skills=", ".join(profile.skills) if profile.skills else "Not specified",
            resume=profile.resume_text[:2500] if profile.resume_text else "",
            title=job.title,
            company=job.company,
            description=(job.description or "")[:2000],
        )
        letter = _ask_gemini(model, prompt)
        job.cover_letter = letter
        db.commit()
        return letter
    except Exception as e:
        _log(db, f"❌ Cover letter generation failed for job {job.id}: {e}", "ERROR")
        return ""


# ── Screening Question Answerer ────────────────────────────────────────────────

QUESTION_PROMPT = """
You are filling out a job application form on behalf of a candidate.

CANDIDATE PROFILE:
Name: {name}
Email: {email}
Phone: {phone}
Location: {location}
Skills: {skills}
Background: {resume}

QUESTION FROM FORM: "{question}"

Provide a concise, honest, professional answer to this question based on the candidate's profile.
- Keep answers under 100 words unless it's a multi-paragraph essay question
- Be specific when possible
- Do NOT make up information not in the profile
- For years-of-experience questions, estimate conservatively from the resume
- For Yes/No questions, reply with just "Yes" or "No"
- For numeric fields, reply with just the number

Reply with ONLY the answer, no explanation.
"""

async def answer_screening_question(
    db: Session, question: str, profile: UserProfile
) -> str:
    """Use Gemini to answer a screening question on an application form."""
    try:
        model = _configure_gemini()
        prompt = QUESTION_PROMPT.format(
            name=profile.name or "",
            email=profile.email or "",
            phone=profile.phone or "",
            location=profile.location or "",
            skills=", ".join(profile.skills) if profile.skills else "",
            resume=profile.resume_text[:1500] if profile.resume_text else "",
            question=question,
        )
        return _ask_gemini(model, prompt)
    except Exception as e:
        logger.error(f"Question answering failed: {e}")
        return ""


# ── Batch Scoring ─────────────────────────────────────────────────────────────

async def score_all_unscored_jobs(db: Session, min_score: int = 60) -> int:
    """Score all DISCOVERED jobs and move qualifying ones to QUEUED."""
    from database import JobStatus

    profile = db.query(UserProfile).first()
    if not profile:
        _log(db, "No user profile found. Please set up your profile first.", "WARNING")
        return 0

    unscored = db.query(Job).filter(Job.status == JobStatus.DISCOVERED).all()
    _log(db, f"🤖 Scoring {len(unscored)} unscored jobs...")

    queued = 0
    for job in unscored:
        job.status = JobStatus.SCORING
        db.commit()

        score = await score_job(db, job, profile)
        if score is not None and score >= min_score:
            # Also generate cover letter for qualifying jobs
            await generate_cover_letter(db, job, profile)
            queued += 1
        elif score is not None and score < min_score:
            job.status = JobStatus.SKIPPED
            db.commit()

    _log(db, f"✅ Scoring complete. {queued} jobs queued for review.")
    return queued
