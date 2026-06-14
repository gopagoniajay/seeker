"""
Scheduler — runs job search + scoring on a timer using APScheduler.
"""
import asyncio
import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal, AgentState, UserProfile, AgentLog

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def _get_db() -> Session:
    return SessionLocal()


async def run_agent_cycle():
    """
    Full agent cycle:
    1. Scrape new jobs
    2. Score them with AI
    3. Log results (user reviews in dashboard before apply)
    """
    db = _get_db()
    try:
        state = db.query(AgentState).first()
        if state and state.is_running:
            logger.info("Agent already running, skipping cycle.")
            return

        if state:
            state.is_running = True
            state.phase = "searching"
            state.last_run = datetime.utcnow()
            db.commit()

        db.add(AgentLog(level="INFO", message="🤖 Agent cycle started"))
        db.commit()

        # ── Step 1: Scrape jobs ─────────────────────────────────────────
        profile = db.query(UserProfile).first()
        search_terms = profile.job_titles if (profile and profile.job_titles) else settings.DEFAULT_JOB_TITLES
        location = profile.target_location if (profile and profile.target_location) else settings.DEFAULT_LOCATION

        from agents.job_scraper import scrape_jobs
        new_jobs = await scrape_jobs(db, search_terms, location)

        if state:
            state.jobs_found_today = (state.jobs_found_today or 0) + new_jobs
            state.phase = "scoring"
            db.commit()

        # ── Step 2: AI scoring ──────────────────────────────────────────
        from agents.ai_engine import score_all_unscored_jobs
        queued = await score_all_unscored_jobs(db, min_score=settings.MIN_FIT_SCORE)

        db.add(AgentLog(
            level="INFO",
            message=f"✅ Cycle complete: {new_jobs} new jobs found, {queued} queued for your review",
        ))
        db.commit()

    except Exception as e:
        logger.exception(f"Agent cycle error: {e}")
        db.add(AgentLog(level="ERROR", message=f"Agent cycle error: {e}"))
        db.commit()
    finally:
        if state:
            state.is_running = False
            state.phase = "idle"
            db.commit()
        db.close()


def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(
            run_agent_cycle,
            trigger=IntervalTrigger(hours=settings.SEARCH_INTERVAL_HOURS),
            id="agent_cycle",
            name="Job Search & Score Cycle",
            replace_existing=True,
        )
        scheduler.start()
        logger.info(f"Scheduler started (every {settings.SEARCH_INTERVAL_HOURS}h)")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
