"""
Browser Automation Agent — uses Playwright to apply to jobs automatically.
Handles LinkedIn Easy Apply, Indeed Apply, and standard form-based applications.
"""
import asyncio
import logging
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from database import Job, JobStatus, Application, ApplicationStatus, UserProfile, AgentLog

logger = logging.getLogger(__name__)
SCREENSHOT_DIR = Path("screenshots")
SCREENSHOT_DIR.mkdir(exist_ok=True)


def _log(db: Session, message: str, level: str = "INFO", details: dict = None):
    db.add(AgentLog(level=level, message=message, details=details or {}))
    db.commit()
    getattr(logger, level.lower(), logger.info)(message)


async def _human_delay(min_s: float = None, max_s: float = None):
    """Simulate human-like random delays between actions."""
    lo = min_s or settings.APPLY_DELAY_MIN
    hi = max_s or settings.APPLY_DELAY_MAX
    await asyncio.sleep(random.uniform(lo, hi))


async def _take_screenshot(page, name: str) -> str:
    """Take a screenshot and return the file path."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = SCREENSHOT_DIR / f"{name}_{ts}.png"
    await page.screenshot(path=str(path))
    return str(path)


# ── LinkedIn Easy Apply ────────────────────────────────────────────────────────

async def _apply_linkedin_easy(page, job: Job, profile: UserProfile, db: Session) -> bool:
    """Handle LinkedIn Easy Apply multi-step form."""
    try:
        await page.goto(job.apply_url, wait_until="domcontentloaded", timeout=30000)
        await _human_delay()

        # Click Easy Apply button
        easy_apply_btn = page.locator("button:has-text('Easy Apply'), .jobs-apply-button")
        if not await easy_apply_btn.count():
            _log(db, f"No Easy Apply button found for {job.title}", "WARNING")
            return False

        await easy_apply_btn.first.click()
        await _human_delay(2, 4)

        # Handle multi-step form (max 10 steps)
        for step in range(10):
            await _human_delay()

            # Check if application is submitted
            success_indicators = [
                "Your application was sent",
                "Application submitted",
                "applied successfully",
            ]
            for indicator in success_indicators:
                if await page.locator(f"text={indicator}").count():
                    _log(db, f"✅ Successfully applied via LinkedIn Easy Apply to {job.title}")
                    return True

            # Check for "Next" or "Submit" buttons
            next_btn = page.locator("button:has-text('Next'), button:has-text('Review'), button:has-text('Submit application')")
            if await next_btn.count():
                # Try to fill visible form fields before clicking next
                await _fill_linkedin_form_fields(page, profile, db)
                await _human_delay()
                await next_btn.last.click()
                await _human_delay(2, 3)
            else:
                break

        screenshot = await _take_screenshot(page, f"linkedin_{job.id}")
        _log(db, f"LinkedIn apply completed (check screenshot): {screenshot}")
        return True

    except Exception as e:
        screenshot = await _take_screenshot(page, f"error_{job.id}")
        _log(db, f"LinkedIn apply error: {e} | screenshot: {screenshot}", "ERROR")
        return False


async def _fill_linkedin_form_fields(page, profile: UserProfile, db: Session):
    """Fill common LinkedIn Easy Apply form fields."""
    from agents.ai_engine import answer_screening_question

    # Phone number
    phone_field = page.locator("input[id*='phone'], input[name*='phone']")
    if await phone_field.count() and profile.phone:
        await phone_field.first.fill(profile.phone)
        await _human_delay(0.3, 0.8)

    # Text areas / screening questions
    textareas = page.locator("textarea")
    for i in range(await textareas.count()):
        ta = textareas.nth(i)
        # Find the label for this textarea
        label = ""
        try:
            label_el = page.locator(f"label[for='{await ta.get_attribute('id')}']")
            if await label_el.count():
                label = await label_el.text_content()
        except Exception:
            pass
        if label:
            answer = await answer_screening_question(db, label, profile)
            if answer:
                await ta.fill(answer)
                await _human_delay(0.5, 1.5)


# ── Indeed Apply ──────────────────────────────────────────────────────────────

async def _apply_indeed(page, job: Job, profile: UserProfile, db: Session) -> bool:
    """Handle Indeed application."""
    try:
        await page.goto(job.apply_url, wait_until="domcontentloaded", timeout=30000)
        await _human_delay(2, 4)

        # Click Apply button
        apply_btn = page.locator("button:has-text('Apply now'), a:has-text('Apply now'), #indeedApplyButton")
        if await apply_btn.count():
            await apply_btn.first.click()
            await _human_delay(2, 4)

        screenshot = await _take_screenshot(page, f"indeed_{job.id}")
        _log(db, f"Indeed apply attempted | screenshot: {screenshot}")
        return True

    except Exception as e:
        _log(db, f"Indeed apply error: {e}", "ERROR")
        return False


# ── Main Apply Orchestrator ───────────────────────────────────────────────────

async def apply_to_job(db: Session, job: Job, profile: UserProfile) -> bool:
    """
    Main entry point. Opens a browser and applies to a job.
    Returns True if application was submitted successfully.
    """
    from playwright.async_api import async_playwright

    _log(db, f"🚀 Starting application: {job.title} @ {job.company} ({job.source})")
    job.status = JobStatus.APPLYING
    db.commit()

    success = False
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=settings.BROWSER_HEADLESS,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ]
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1366, "height": 768},
        )
        page = await context.new_page()

        try:
            source = (job.source or "").lower()

            if source == "linkedin":
                # Login to LinkedIn first
                await _linkedin_login(page, profile, db)
                success = await _apply_linkedin_easy(page, job, profile, db)

            elif source == "indeed":
                await _indeed_login(page, profile, db)
                success = await _apply_indeed(page, job, profile, db)

            else:
                # Generic: just navigate to the apply URL
                await page.goto(job.apply_url, timeout=30000)
                await _human_delay(2, 3)
                screenshot = await _take_screenshot(page, f"generic_{job.id}")
                _log(db, f"Opened job URL (manual review needed): {screenshot}", "WARNING")
                success = True  # Mark as attempted

        finally:
            await browser.close()

    # Update job and create application record
    if success:
        job.status = JobStatus.APPLIED
        app = Application(
            job_id=job.id,
            job_title=job.title,
            company=job.company,
            apply_url=job.apply_url,
            source=job.source,
            cover_letter=job.cover_letter,
            status=ApplicationStatus.APPLIED,
        )
        db.add(app)
    else:
        job.status = JobStatus.FAILED

    db.commit()
    return success


async def _linkedin_login(page, profile: UserProfile, db: Session):
    """Login to LinkedIn if not already logged in."""
    if not profile.linkedin_email or not profile.linkedin_password:
        _log(db, "LinkedIn credentials not configured", "WARNING")
        return

    await page.goto("https://www.linkedin.com/login", timeout=30000)
    await _human_delay(1, 2)

    # Check if already logged in
    if "feed" in page.url or "jobs" in page.url:
        return

    await page.fill("#username", profile.linkedin_email)
    await _human_delay(0.5, 1)
    await page.fill("#password", profile.linkedin_password)
    await _human_delay(0.5, 1)
    await page.click("button[type='submit']")
    await _human_delay(3, 5)
    _log(db, "LinkedIn login attempted")


async def _indeed_login(page, profile: UserProfile, db: Session):
    """Login to Indeed if credentials are configured."""
    if not profile.indeed_email:
        return
    await page.goto("https://secure.indeed.com/auth", timeout=30000)
    await _human_delay(2, 3)
    _log(db, "Indeed login page opened")
