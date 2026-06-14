# 🤖 JobAgent AI — Automated Job Application Agent

An end-to-end AI agent that **searches, scores, and applies** to jobs from LinkedIn, Indeed, and Glassdoor — all controlled from a beautiful dashboard.

---

## ✨ Features

- 🔍 **Multi-Platform Search** — LinkedIn, Indeed & Glassdoor via JobSpy
- 🤖 **AI Job Scoring** — Google Gemini rates each job 0-100 against your resume
- 📄 **Cover Letter Generation** — Unique, tailored letters per job
- 💡 **Screening Q&A** — AI answers application form questions automatically
- 🌐 **Browser Automation** — Playwright handles LinkedIn Easy Apply forms
- 📊 **Beautiful Dashboard** — Real-time stats, job queue, application tracker
- ⏰ **Auto Scheduler** — Runs searches every 6 hours automatically
- 🛡️ **Semi-Auto Mode** — You review and approve before applying (safest)

---

## 🚀 Quick Start

### Step 1 — Get Your Gemini API Key (Free)
1. Go to [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Click **"Create API Key"**
3. Copy the key

### Step 2 — Set Up Backend
```powershell
cd backend

# Copy environment file and add your key
copy .env.example .env
# Edit .env and paste your GEMINI_API_KEY

# Create virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browsers
playwright install chromium

# Start the backend
uvicorn main:app --reload --port 8000
```

### Step 3 — Set Up Frontend
```powershell
cd frontend
npm install
npm run dev
```

### Step 4 — Open Dashboard
Navigate to **http://localhost:5173** in your browser.

---

## 📋 Usage Guide

### First-Time Setup
1. **Profile** tab → Enter your name, email, skills, target job titles
2. **Profile → Resume** → Upload your PDF resume
3. **Profile → Login Credentials** → Add LinkedIn/Indeed credentials
4. **Profile → Preferences** → Set target location and minimum salary

### Running the Agent
1. Go to **Dashboard** → Click **"▶ Run Agent Now"**
2. The agent will:
   - Search all 3 platforms for matching jobs
   - Score each job with AI (removes poor fits automatically)
   - Generate cover letters for top matches
3. Watch the **Live Activity Log** for real-time updates

### Reviewing & Applying
1. Go to **Job Queue** tab — queued jobs appear here sorted by fit score
2. Click any job to see the full description + AI assessment + cover letter
3. Click **"🚀 Apply Now"** — Playwright opens a browser and applies

### Tracking Results
- **Applications** tab shows all submitted applications
- Update status as you hear back (Interview, Offer, Rejected)

---

## ⚙️ Configuration

Edit `backend/.env` to customize:

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | **Required** — your Google AI key |
| `MIN_FIT_SCORE` | 60 | Minimum score to queue a job |
| `SEARCH_INTERVAL_HOURS` | 6 | How often the agent auto-searches |
| `BROWSER_HEADLESS` | false | Set to `true` for invisible browser |
| `DEFAULT_LOCATION` | Remote | Default job location |

---

## 🏗️ Architecture

```
backend/
├── main.py              # FastAPI app
├── config.py            # Settings
├── database.py          # SQLite models
├── agents/
│   ├── job_scraper.py   # JobSpy integration
│   ├── ai_engine.py     # Gemini AI scoring/cover letters
│   ├── browser_apply.py # Playwright automation
│   └── scheduler.py     # APScheduler
└── routers/
    ├── profile.py       # /api/profile
    ├── jobs.py          # /api/jobs
    ├── applications.py  # /api/applications
    └── agent.py         # /api/agent

frontend/src/
├── App.jsx              # Routing + sidebar
├── api.js               # API client
└── pages/
    ├── Dashboard.jsx    # Live stats + logs
    ├── JobQueue.jsx     # Review & apply
    ├── Applications.jsx # Track outcomes
    └── Profile.jsx      # Setup wizard
```

---

## ⚠️ Important Notes

- **Semi-auto mode is default** — you approve every application before it fires
- Automating LinkedIn may violate their ToS — use a secondary account if concerned
- The agent uses human-like delays (1–4s random) between browser actions
- Screenshots are saved to `backend/screenshots/` for every application attempt
- API docs available at: **http://localhost:8000/docs**

---

## 🔧 API Reference

The FastAPI backend auto-generates Swagger docs at `http://localhost:8000/docs`.

Key endpoints:
- `POST /api/agent/start` — Trigger a search + score cycle
- `GET  /api/jobs?status=queued` — Get jobs awaiting review
- `POST /api/agent/apply/{job_id}` — Apply to a specific job
- `GET  /api/agent/logs` — Recent activity logs
- `PUT  /api/profile` — Update your profile
