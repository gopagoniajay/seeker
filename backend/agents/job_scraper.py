"""
Job Scraper Agent — uses python-jobspy to search LinkedIn, Indeed, and Glassdoor.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from database import Job, JobStatus, AgentLog, get_db

logger = logging.getLogger(__name__)


def _log(db: Session, message: str, level: str = "INFO", details: dict = None):
    db.add(AgentLog(level=level, message=message, details=details or {}))
    db.commit()
    getattr(logger, level.lower(), logger.info)(message)


async def scrape_jobs(
    db: Session,
    search_terms: List[str],
    location: str,
    results_per_site: int = 15,
    hours_old: int = 72,
) -> int:
    """
    Scrape jobs from LinkedIn, Indeed, and Glassdoor using python-jobspy.
    Returns the count of NEW jobs added to the database.
    """
    try:
        from jobspy import scrape_jobs as jobspy_scrape
    except ImportError:
        _log(db, "python-jobspy not installed. Run: pip install python-jobspy", "ERROR")
        return 0

    _log(db, f"🔍 Starting job search: {search_terms} @ {location}")

    sites = ["linkedin", "indeed", "glassdoor"]
    new_count = 0

    for term in search_terms:
        _log(db, f"  Searching: '{term}'")
        try:
            jobs_df = jobspy_scrape(
                site_name=sites,
                search_term=term,
                location=location,
                results_wanted=results_per_site,
                hours_old=hours_old,
                country_indeed="USA",
                linkedin_fetch_description=True,
            )
        except Exception as e:
            _log(db, f"  ⚠️ Scrape failed for '{term}': {e}", "WARNING")
            continue

        if jobs_df is None or jobs_df.empty:
            _log(db, f"  No results for '{term}'")
            continue

        _log(db, f"  Found {len(jobs_df)} raw listings for '{term}'")

        for _, row in jobs_df.iterrows():
            job_url = str(row.get("job_url", "") or "")
            if not job_url:
                continue

            # Dedup by URL
            existing = db.query(Job).filter(Job.external_id == job_url).first()
            if existing:
                continue

            # Extract salary range
            salary_min = salary_max = None
            min_amount = row.get("min_amount")
            max_amount = row.get("max_amount")
            if min_amount and not _is_nan(min_amount):
                salary_min = float(min_amount)
            if max_amount and not _is_nan(max_amount):
                salary_max = float(max_amount)

            site = str(row.get("site", "unknown")).lower()
            is_easy = site == "linkedin" and bool(row.get("is_easy_apply", False))

            job = Job(
                external_id=job_url,
                title=str(row.get("title", "Unknown Title")),
                company=str(row.get("company", "Unknown Company")),
                location=str(row.get("location", "")),
                job_type=str(row.get("job_type", "")),
                salary_min=salary_min,
                salary_max=salary_max,
                salary_currency=str(row.get("currency", "USD") or "USD"),
                description=str(row.get("description", "") or ""),
                apply_url=job_url,
                source=site,
                is_easy_apply=is_easy,
                date_posted=str(row.get("date_posted", "") or ""),
                status=JobStatus.DISCOVERED,
            )
            db.add(job)
            new_count += 1

        db.commit()

    _log(db, f"✅ Scraped {new_count} new unique jobs total")
    return new_count


def _is_nan(val) -> bool:
    try:
        import math
        return math.isnan(float(val))
    except Exception:
        return False
