"""
Configuration settings for the AI Job Agent.
Reads from environment variables / .env file.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────
    APP_NAME: str = "AI Job Agent"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = "sqlite:///./job_agent.db"

    # ── Google Gemini ─────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"

    # ── Job Search Defaults ───────────────────────────────────────────────
    DEFAULT_JOB_TITLES: List[str] = ["Software Engineer", "Python Developer"]
    DEFAULT_LOCATION: str = "Remote"
    DEFAULT_RESULTS_WANTED: int = 20
    DEFAULT_DISTANCE_MILES: int = 50
    MIN_FIT_SCORE: int = 60          # Only queue jobs above this score

    # ── Browser Automation ────────────────────────────────────────────────
    BROWSER_HEADLESS: bool = False   # False = visible browser (safer)
    APPLY_DELAY_MIN: float = 1.5     # Min seconds between actions
    APPLY_DELAY_MAX: float = 4.0     # Max seconds between actions

    # ── Scheduler ────────────────────────────────────────────────────────
    SEARCH_INTERVAL_HOURS: int = 6   # Auto-search every N hours

    # ── CORS ─────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
