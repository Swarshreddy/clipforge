# ClipForge Desktop App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build ClipForge — a local-first, AI-powered short-form video clip studio desktop app (Python + Flask + pywebview + React/Vite).

**Architecture:** Flask backend (Python) serves SQLite-backed REST API + React frontend (Vite/TS) rendered inside a pywebview desktop window. FFmpeg handles all video processing; LLM APIs power viral moment detection.

**Tech Stack:** Python 3.11, Flask, SQLite, FFmpeg, React+Vite+TS, pywebview, Lucide icons

## Global Constraints
- No Tauri/Rust/Electron — pure Python + React via pywebview
- Dark theme: --bg-primary #0f1117, accent gradient #7c3aed → #a855f7
- All API calls via `fetch()` to `/api/*`
- Virtual env only, no global pip installs
- FFmpeg must be on PATH
- Commit at every milestone

---

### Task 1: Project Scaffold & Environment Setup

**Files:**
- Create: `.gitignore`, `requirements.txt`, `.env.example`, `main.py`
- Create: `backend/__init__.py`, `backend/app.py`, `backend/config.py`, `backend/database.py`
- Create: `frontend/` (initialized in Phase 4 — skip for now)

**Interfaces:**
- `create_app()` — Flask app factory, registers blueprints, serves frontend static
- `get_db()` — SQLite connection with WAL mode
- `Config` — static methods for env state

- [ ] **Step 1: Install system deps + create venv**
```bash
apt-get install -y ffmpeg 2>/dev/null || echo "ffmpeg install skipped"
python3 -m venv .venv && source .venv/bin/activate
```
- [ ] **Step 2: Create project structure**
```bash
mkdir -p backend/routes backend/services backend/models tests
touch backend/__init__.py backend/routes/__init__.py backend/services/__init__.py backend/models/__init__.py
```
- [ ] **Step 3: Write requirements.txt, .env.example, .gitignore**
- [ ] **Step 4: Write backend/config.py**
- [ ] **Step 5: Write backend/database.py**
- [ ] **Step 6: Write backend/app.py**
- [ ] **Step 7: Write main.py**
- [ ] **Step 8: Verify Flask app starts** `python main.py` → no import errors
- [ ] **Commit** `git add . && git commit -m "feat: backend scaffold with Flask app and DB"`

---

### Task 2: Core Services — Media + Caption

**Files:**
- Create: `backend/services/media_service.py`
- Create: `backend/services/caption_service.py`
- Create: `tests/test_media_service.py`
- Create: `tests/test_caption_service.py`

**Interfaces:**
- `probe_media(file_path)` -> `{duration_sec, has_video, width, height, video_codec, audio_codec}`
- `extract_audio(video_path, output_path)` -> output WAV path
- `render_portrait_clip(source, output, start, end, width, height, caption_words, caption_style)` -> output MP4 path
- `build_drawtext_filters(words, style_name, clip_start)` -> list of FFmpeg drawtext filter strings

- [ ] **Step 1: Write failing tests** (mock FFmpeg calls)
- [ ] **Step 2: Implement media_service.py** (probe, extract_audio, render_portrait_clip)
- [ ] **Step 3: Implement caption_service.py** (STYLES dict + build_drawtext_filters)
- [ ] **Step 4: Run tests** `pytest tests/test_media_service.py tests/test_caption_service.py -v`
- [ ] **Commit** `git commit -m "feat: media service + caption drawtext filters"`

---

### Task 3: Core Services — Transcription + LLM

**Files:**
- Create: `backend/services/transcription_service.py`
- Create: `backend/services/llm_service.py`
- Create: `tests/test_transcription_service.py`
- Create: `tests/test_llm_service.py`

**Interfaces:**
- `transcribe_deepgram(audio_path, api_key)` -> normalized transcript dict
- `transcribe_whisper(audio_path, model_size)` -> normalized transcript dict
- `analyze_transcript(transcript_text, duration, provider)` -> list of CandidateDraft
- `test_connection(provider)` -> `{ok, message, latencyMs}`

- [ ] **Step 1: Write failing tests** (mock HTTP calls)
- [ ] **Step 2: Implement transcription_service.py** (Deepgram + Whisper + normalizers)
- [ ] **Step 3: Implement llm_service.py** (PROVIDERS map, ANALYSIS_PROMPT, call_openai_compatible, call_anthropic, parse_candidates)
- [ ] **Step 4: Run tests** `pytest tests/test_transcription_service.py tests/test_llm_service.py -v`
- [ ] **Commit** `git commit -m "feat: transcription + LLM multi-provider services"`

---

### Task 4: API Routes

**Files:**
- Create: `backend/routes/system.py`, `backend/routes/projects.py`, `backend/routes/media.py`, `backend/routes/transcription.py`, `backend/routes/analysis.py`, `backend/routes/rendering.py`
- Create: `tests/test_routes.py`

**Interfaces:**
- `GET /api/status` — environment status
- `POST /api/test-connection` — test LLM provider
- `POST /api/projects` — create project
- `GET /api/projects` — list projects
- `GET /api/projects/:id` — project detail + transcript + candidates
- `DELETE /api/projects/:id` — delete project
- `PATCH /api/projects/:id` — rename project
- `POST /api/projects/:id/probe` — probe media
- `POST /api/projects/:id/extract-audio` — extract audio
- `POST /api/projects/:id/transcribe` — start transcription
- `POST /api/projects/:id/analyze` — generate candidates
- `POST /api/projects/:id/render/:candidateId` — render clip
- `POST /api/projects/:id/render-batch` — batch render

- [ ] **Step 1: Write route tests using Flask test client**
- [ ] **Step 2: Implement system.py + projects.py**
- [ ] **Step 3: Implement media.py + transcription.py**
- [ ] **Step 4: Implement analysis.py + rendering.py**
- [ ] **Step 5: Run all route tests**
- [ ] **Commit** `git commit -m "feat: all API routes implemented"`

---

### Task 5: React Frontend

**Files:**
- Initialize: `frontend/` via `npx create-vite@latest frontend --template react-ts`
- Create: `frontend/src/App.tsx`, `frontend/src/api/client.ts`
- Create: `frontend/src/styles/globals.css`
- Create: `frontend/src/components/` — Dashboard, Workspace, MediaPlayer, TranscriptView, CandidateList, ClipPreview, Onboarding, SettingsPanel, PipelineStatus
- Create: `frontend/src/hooks/` — useProjects, useProject, useEnvironment

**Interfaces:**
- `api.getStatus()`, `api.listProjects()`, `api.createProject(data)`, `api.getProject(id)`, `api.deleteProject(id)`, `api.renameProject(id, name)`
- `api.probeMedia(id)`, `api.extractAudio(id)`, `api.transcribe(id)`, `api.analyze(id)`
- `api.renderClip(projectId, candidateId)`, `api.testConnection(provider)`

- [ ] **Step 1: Init Vite + install deps** `npx create-vite@latest frontend --template react-ts && cd frontend && npm install lucide-react`
- [ ] **Step 2: Write globals.css + api/client.ts**
- [ ] **Step 3: Write App.tsx with routing/state**
- [ ] **Step 4: Build all components** (Dashboard, Workspace, MediaPlayer, TranscriptView, CandidateList, ClipPreview, Onboarding, SettingsPanel, PipelineStatus)
- [ ] **Step 5: Build hooks** (useProjects, useProject, useEnvironment)
- [ ] **Step 6: Verify frontend builds** `npm run build`
- [ ] **Commit** `git commit -m "feat: complete React frontend with all screens"`

---

### Task 6: Full Pipeline Test + Packaging

**Files:**
- Update: `README.md`
- Create: `start.sh`
- Create: `.github/workflows/ci.yml` (optional)

**Interfaces:**
- Full pipeline: import -> transcribe -> analyze -> render
- PyInstaller spec for Win/Mac/Linux builds

- [ ] **Step 1: End-to-end test with sample video** (if available)
- [ ] **Step 2: Write README.md** (setup, usage, API keys, build)
- [ ] **Step 3: PyInstaller build test**
- [ ] **Step 4: Final commit** `git commit -m "chore: final pipeline test + packaging + docs"`
