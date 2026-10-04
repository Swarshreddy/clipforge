# AI Agent Prompt: Build ClipForge Desktop Application

## Context for the AI Agent

You are building **ClipForge**, a local-first desktop application that converts long-form video/audio into short-form vertical clips (9:16) with AI-powered viral moment detection. This is a full-stack desktop app using Python + Flask + pywebview for the backend/shell and React + Vite + TypeScript for the frontend.

You are working on a **dedicated VM** with full system access. You have the freedom to install packages, create files, run commands, and manage the entire development environment.

---

## Skills & Tools the AI Agent Should Use

> [!IMPORTANT]
> If you have access to any of these skills/capabilities, **USE THEM**:

### Required Skills
1. **`writing-plans`** — Use this FIRST to create a detailed implementation plan before writing any code
2. **`brainstorming`** — Use before designing features, components, or architecture decisions
3. **`subagent-driven-development`** or **`dispatching-parallel-agents`** — Use to parallelize independent tasks (backend + frontend can be built simultaneously)
4. **`test-driven-development`** — Write tests before implementation for critical services (LLM, transcription, media)
5. **`systematic-debugging`** — Use when encountering bugs or unexpected behavior
6. **`verification-before-completion`** — Run all tests and verify output before claiming completion
7. **`managing-python-dependencies`** — Use proper virtual environments, never global pip install
8. **`executing-plans`** — Follow the implementation plan systematically with review checkpoints

### Recommended Tools
- **Git** — Initialize a repo, commit at each milestone
- **Python 3.10+** — Backend language
- **Node.js 18+** — Frontend build tooling
- **FFmpeg** — Media processing (must be on PATH)
- **pytest** — Python testing
- **Vitest** — Frontend testing (optional)

---

## PHASE 0: Environment Setup

Execute these commands to prepare the VM:

```bash
# Update system (Ubuntu/Debian)
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y python3.10 python3.10-venv python3-pip nodejs npm ffmpeg git

# Verify installations
python3 --version    # Should be 3.10+
node --version       # Should be 18+
ffmpeg -version      # Should be 5.0+
git --version

# Create project directory
mkdir -p ~/clipforge && cd ~/clipforge
git init

# Create Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Create frontend directory
mkdir -p frontend
```

---

## PHASE 1: Backend Foundation

### 1.1 Project Structure

Create this exact directory structure:

```
clipforge/
├── main.py
├── requirements.txt
├── .env.example
├── .env
├── backend/
│   ├── __init__.py
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── projects.py
│   │   ├── media.py
│   │   ├── transcription.py
│   │   ├── analysis.py
│   │   ├── rendering.py
│   │   └── system.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── media_service.py
│   │   ├── transcription_service.py
│   │   ├── llm_service.py
│   │   ├── caption_service.py
│   │   └── youtube_service.py
│   └── models/
│       ├── __init__.py
│       ├── project.py
│       ├── transcript.py
│       ├── candidate.py
│       └── clip.py
├── frontend/
│   └── (React + Vite app — created in Phase 3)
├── tests/
│   ├── __init__.py
│   ├── test_database.py
│   ├── test_media_service.py
│   ├── test_llm_service.py
│   └── test_routes.py
└── README.md
```

### 1.2 requirements.txt

```
flask>=3.0
flask-cors>=4.0
pywebview>=5.0
python-dotenv>=1.0
requests>=2.31
SQLAlchemy>=2.0
ffmpeg-python>=0.2.0
uuid6>=2024.7
waitress>=3.0  # Production WSGI server for Windows
```

### 1.3 .env.example

```env
# Transcription
DEEPGRAM_API_KEY=

# LLM Providers
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENROUTER_API_KEY=
GROQ_API_KEY=

# Local AI
# WHISPER_MODEL=base

# Custom OpenAI-compatible provider
# LLM_PROVIDER=custom
CUSTOM_BASE_URL=
CUSTOM_API_KEY=
CUSTOM_MODEL=

# App Settings
DATA_DIR=~/.clipforge
```

### 1.4 main.py — Application Entry Point

```python
"""
ClipForge — AI-Powered Short-Form Video Clip Studio
Entry point: launches Flask backend + pywebview desktop window
"""
import os
import sys
import threading
import webview
from backend.app import create_app

def start_server(app, port):
    """Run Flask in a background thread."""
    from waitress import serve
    serve(app, host='127.0.0.1', port=port, threads=4)

def main():
    port = 5174
    app = create_app()
    
    # Start Flask in background thread
    server_thread = threading.Thread(
        target=start_server, 
        args=(app, port), 
        daemon=True
    )
    server_thread.start()
    
    # Create pywebview window
    window = webview.create_window(
        title='ClipForge',
        url=f'http://127.0.0.1:{port}',
        width=1400,
        height=900,
        min_size=(1024, 700),
        resizable=True,
        text_select=True,
    )
    
    webview.start(debug=('--debug' in sys.argv))

if __name__ == '__main__':
    main()
```

### 1.5 backend/app.py — Flask Application Factory

```python
import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

def create_app():
    load_dotenv()
    
    app = Flask(
        __name__,
        static_folder='../frontend/dist',
        static_url_path='/'
    )
    CORS(app)
    
    # Initialize database
    from backend.database import init_db
    init_db(app)
    
    # Register route blueprints
    from backend.routes.system import system_bp
    from backend.routes.projects import projects_bp
    from backend.routes.media import media_bp
    from backend.routes.transcription import transcription_bp
    from backend.routes.analysis import analysis_bp
    from backend.routes.rendering import rendering_bp
    
    app.register_blueprint(system_bp, url_prefix='/api')
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(media_bp, url_prefix='/api')
    app.register_blueprint(transcription_bp, url_prefix='/api')
    app.register_blueprint(analysis_bp, url_prefix='/api')
    app.register_blueprint(rendering_bp, url_prefix='/api')
    
    # Serve React frontend for non-API routes
    @app.route('/')
    def serve_frontend():
        return app.send_static_file('index.html')
    
    @app.errorhandler(404)
    def not_found(e):
        # SPA fallback
        return app.send_static_file('index.html')
    
    return app
```

### 1.6 backend/database.py — SQLite Database

```python
import os
import sqlite3
from flask import g

DB_PATH = None

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_db(app):
    global DB_PATH
    data_dir = os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge'))
    os.makedirs(data_dir, exist_ok=True)
    DB_PATH = os.path.join(data_dir, 'clipforge.db')
    
    app.teardown_appcontext(close_db)
    
    with app.app_context():
        db = sqlite3.connect(DB_PATH)
        db.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT,
                source_path TEXT NOT NULL,
                source_duration REAL,
                status TEXT NOT NULL DEFAULT 'imported',
                transcription_mode TEXT NOT NULL DEFAULT 'cloud',
                caption_style TEXT DEFAULT 'classic',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                engine TEXT NOT NULL,
                raw_json TEXT NOT NULL,
                language TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS candidates (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                start_sec REAL NOT NULL,
                end_sec REAL NOT NULL,
                score REAL NOT NULL,
                hook TEXT NOT NULL,
                rationale TEXT NOT NULL,
                rank INTEGER NOT NULL,
                selected INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS clips (
                id TEXT PRIMARY KEY,
                candidate_id TEXT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending',
                output_path TEXT,
                face_track_json TEXT,
                caption_ass_path TEXT,
                render_log TEXT
            );
            CREATE TABLE IF NOT EXISTS clip_copies (
                id TEXT PRIMARY KEY,
                clip_id TEXT NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
                platform TEXT NOT NULL,
                hook_text TEXT,
                caption_text TEXT,
                hashtags TEXT
            );
        """)
        db.close()
```

### 1.7 backend/config.py — Configuration Manager

```python
import os
import shutil

class Config:
    @staticmethod
    def get_data_dir():
        return os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge'))
    
    @staticmethod
    def get_llm_provider():
        return os.environ.get('LLM_PROVIDER', 'deepseek').lower()
    
    @staticmethod
    def has_ffmpeg():
        return shutil.which('ffmpeg') is not None
    
    @staticmethod
    def has_ffprobe():
        return shutil.which('ffprobe') is not None
    
    @staticmethod
    def has_ytdlp():
        return shutil.which('yt-dlp') is not None
    
    @staticmethod
    def get_env_status():
        return {
            'dataDir': Config.get_data_dir(),
            'hasFfmpeg': Config.has_ffmpeg(),
            'hasFfprobe': Config.has_ffprobe(),
            'hasDeepgramKey': bool(os.environ.get('DEEPGRAM_API_KEY', '').strip()),
            'hasDeepseekKey': bool(os.environ.get('DEEPSEEK_API_KEY', '').strip()),
            'hasAnthropicKey': bool(os.environ.get('ANTHROPIC_API_KEY', '').strip()),
            'hasGeminiKey': bool(os.environ.get('GEMINI_API_KEY', '').strip()),
            'hasOpenaiKey': bool(os.environ.get('OPENAI_API_KEY', '').strip()),
            'hasOpenrouterKey': bool(os.environ.get('OPENROUTER_API_KEY', '').strip()),
            'hasGroqKey': bool(os.environ.get('GROQ_API_KEY', '').strip()),
            'hasCustomProvider': bool(os.environ.get('CUSTOM_BASE_URL', '').strip()) and 
                                 bool(os.environ.get('CUSTOM_API_KEY', '').strip()),
            'llmProvider': Config.get_llm_provider(),
            'hasYtdlp': Config.has_ytdlp(),
        }
```

---

## PHASE 2: Core Services Implementation

### 2.1 Media Service (backend/services/media_service.py)

This service handles all FFmpeg operations. Key functions:

```python
"""
Media service — wraps FFmpeg/FFprobe for:
- Probing media metadata (duration, resolution, codecs)
- Extracting audio from video (WAV, 16kHz mono for Whisper)
- Rendering portrait clips (landscape → 9:16 center-crop)
- Burning in captions via drawtext filter
"""

import subprocess
import json
import os

def probe_media(file_path: str) -> dict:
    """Get media file metadata using ffprobe."""
    cmd = [
        'ffprobe', '-v', 'quiet',
        '-print_format', 'json',
        '-show_format', '-show_streams',
        file_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    # Parse and return: duration_sec, has_video, width, height, video_codec, audio_codec
    # ... implementation details

def extract_audio(video_path: str, output_path: str) -> str:
    """Extract audio as 16kHz mono WAV (ideal for Whisper)."""
    cmd = [
        'ffmpeg', '-i', video_path,
        '-vn', '-acodec', 'pcm_s16le',
        '-ar', '16000', '-ac', '1',
        '-y', output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path

def render_portrait_clip(
    source_path: str,
    output_path: str,
    start_sec: float,
    end_sec: float,
    width: int = 1080,
    height: int = 1920,
    caption_words: list = None,
    caption_style: str = 'classic'
) -> str:
    """
    Render a portrait (9:16) clip from a landscape source.
    Steps:
    1. Trim to start_sec → end_sec
    2. Center-crop to 9:16 aspect ratio
    3. Scale to 1080x1920
    4. Burn in captions using drawtext filter chain
    5. Encode H.264 MP4
    """
    duration = end_sec - start_sec
    
    # Build FFmpeg filter chain
    # Center-crop: crop=ih*9/16:ih:(iw-ih*9/16)/2:0
    # Scale: scale=1080:1920
    # Captions: drawtext with enable='between(t,start,end)' per word chunk
    
    vf_filters = [
        f"crop=ih*9/16:ih:(iw-ih*9/16)/2:0",
        f"scale={width}:{height}:force_original_aspect_ratio=decrease",
        f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
    ]
    
    # Add caption drawtext filters if words are provided
    if caption_words:
        caption_filters = build_caption_drawtext(caption_words, caption_style)
        vf_filters.extend(caption_filters)
    
    vf = ','.join(vf_filters)
    
    cmd = [
        'ffmpeg',
        '-ss', str(start_sec),
        '-i', source_path,
        '-t', str(duration),
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-y', output_path
    ]
    subprocess.run(cmd, check=True)
    return output_path
```

### 2.2 Transcription Service (backend/services/transcription_service.py)

```python
"""
Transcription service — supports:
- Deepgram API (cloud, fast, speaker diarization)
- OpenAI Whisper (local, offline)
Both return a normalized transcript: { language, duration, speakers, words[], segments[] }
"""

import requests
import json

def transcribe_deepgram(audio_path: str, api_key: str) -> dict:
    """Send audio to Deepgram Nova-2 for transcription."""
    url = "https://api.deepgram.com/v1/listen"
    params = {
        "model": "nova-2",
        "smart_format": "true",
        "diarize": "true",
        "punctuate": "true",
        "filler_words": "true"
    }
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/wav"
    }
    with open(audio_path, 'rb') as f:
        response = requests.post(url, params=params, headers=headers, data=f)
    response.raise_for_status()
    return normalize_deepgram(response.json())

def transcribe_whisper(audio_path: str, model_size: str = 'base') -> dict:
    """Transcribe using local Whisper model."""
    import whisper
    model = whisper.load_model(model_size)
    result = model.transcribe(audio_path, word_timestamps=True)
    return normalize_whisper(result)

def normalize_deepgram(data: dict) -> dict:
    """Convert Deepgram response to normalized format."""
    # Extract words with timestamps, speakers, segments
    # Return: { language, duration, speakers: [], words: [{text, start, end, speaker}], segments: [{start, end, speaker, text}] }
    pass  # Implement based on Deepgram response structure

def normalize_whisper(data: dict) -> dict:
    """Convert Whisper output to normalized format."""
    # Similar normalization
    pass
```

### 2.3 LLM Service (backend/services/llm_service.py)

This is the **most critical service**. It handles calling multiple LLM providers to analyze transcripts and extract viral clip candidates.

```python
"""
LLM Service — Multi-provider viral moment detection.
Supports: DeepSeek, Claude, Gemini, OpenAI, OpenRouter, Groq, Ollama, Custom.

Each provider call sends the full transcript to the LLM with a carefully crafted
prompt that instructs it to find viral moments and return structured JSON:
[
  {
    "start": 45.2,
    "end": 78.5,
    "score": 92,
    "hook": "You won't believe what happened next...",
    "rationale": "Strong emotional peak with unexpected revelation"
  },
  ...
]
"""

import os
import requests
import json
import time

# Provider configurations
PROVIDERS = {
    'deepseek': {
        'base_url': 'https://api.deepseek.com/v1',
        'model': 'deepseek-chat',
        'env_key': 'DEEPSEEK_API_KEY',
    },
    'claude': {
        'base_url': 'https://api.anthropic.com/v1/messages',
        'model': 'claude-sonnet-4-20250514',
        'env_key': 'ANTHROPIC_API_KEY',
        'auth_type': 'x-api-key',
    },
    'openai': {
        'base_url': 'https://api.openai.com/v1',
        'model': 'gpt-4o',
        'env_key': 'OPENAI_API_KEY',
    },
    'groq': {
        'base_url': 'https://api.groq.com/openai/v1',
        'model': 'llama-3.3-70b-versatile',
        'env_key': 'GROQ_API_KEY',
    },
    'gemini': {
        'base_url': 'https://generativelanguage.googleapis.com/v1beta/openai',
        'model': 'gemini-2.0-flash',
        'env_key': 'GEMINI_API_KEY',
    },
    'openrouter': {
        'base_url': 'https://openrouter.ai/api/v1',
        'model': 'deepseek/deepseek-chat',
        'env_key': 'OPENROUTER_API_KEY',
    },
    'ollama': {
        'base_url': 'http://localhost:11434/v1',
        'model': 'llama3.2',
        'env_key': None,  # No key needed
    }
}

ANALYSIS_PROMPT_TEMPLATE = """You are an expert viral content analyst for short-form video platforms (TikTok, YouTube Shorts, Instagram Reels).

Analyze the following transcript from a {duration:.0f}-second video and identify the top 3-8 most viral-worthy moments.

For each moment, provide:
- **start**: Start timestamp in seconds (float)
- **end**: End timestamp in seconds (float) — clip should be 15-60 seconds
- **score**: Virality score 0-100 (100 = guaranteed viral)
- **hook**: A compelling 5-10 word hook that would make someone stop scrolling
- **rationale**: Why this moment would go viral (emotional peaks, controversy, humor, revelation, etc.)

IMPORTANT RULES:
1. Clips must be 15-60 seconds long
2. Each clip must be a coherent, self-contained moment
3. Clips should NOT overlap
4. Higher score = stronger emotional impact, surprise, humor, or controversy
5. The hook should be attention-grabbing and make people want to watch

Return your response as a JSON array only, no other text:
[{{"start": 0.0, "end": 0.0, "score": 0, "hook": "", "rationale": ""}}]

TRANSCRIPT:
{transcript}"""

def analyze_transcript(transcript_text: str, duration: float, provider: str = None) -> list:
    """
    Send transcript to LLM and get viral clip candidates.
    Returns list of CandidateDraft dicts.
    """
    provider = provider or os.environ.get('LLM_PROVIDER', 'deepseek').lower()
    prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        duration=duration,
        transcript=transcript_text
    )
    
    if provider == 'claude':
        response_text = call_anthropic(prompt)
    else:
        response_text = call_openai_compatible(prompt, provider)
    
    # Parse JSON response
    candidates = parse_candidates(response_text)
    return candidates

def call_openai_compatible(prompt: str, provider: str, retries: int = 3) -> str:
    """Call any OpenAI-compatible API."""
    config = PROVIDERS.get(provider, {})
    base_url = config.get('base_url', '')
    model = config.get('model', '')
    api_key = os.environ.get(config.get('env_key', ''), '')
    
    # Handle custom provider
    if provider == 'custom':
        base_url = os.environ.get('CUSTOM_BASE_URL', '')
        api_key = os.environ.get('CUSTOM_API_KEY', '')
        model = os.environ.get('CUSTOM_MODEL', '')
    
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    
    headers = {
        'Content-Type': 'application/json',
    }
    if api_key:
        headers['Authorization'] = f'Bearer {api_key}'
    
    body = {
        'model': model,
        'messages': [{'role': 'user', 'content': prompt}],
        'temperature': 0.4,
        'response_format': {'type': 'json_object'},
    }
    
    for attempt in range(retries):
        try:
            response = requests.post(endpoint, json=body, headers=headers, timeout=120)
            response.raise_for_status()
            data = response.json()
            return data['choices'][0]['message']['content']
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise
    
def call_anthropic(prompt: str) -> str:
    """Call Claude API (uses different format than OpenAI)."""
    api_key = os.environ.get('ANTHROPIC_API_KEY', '')
    response = requests.post(
        'https://api.anthropic.com/v1/messages',
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        json={
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 4096,
            'messages': [{'role': 'user', 'content': prompt}],
            'temperature': 0.4,
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    return data['content'][0]['text']

def parse_candidates(response_text: str) -> list:
    """Parse LLM response into candidate dicts, handling various JSON formats."""
    # Try to find JSON array in response
    text = response_text.strip()
    # Handle markdown code blocks
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0]
    elif '```' in text:
        text = text.split('```')[1].split('```')[0]
    # Handle wrapping object like { "candidates": [...] }
    parsed = json.loads(text)
    if isinstance(parsed, dict):
        for key in ['candidates', 'moments', 'clips', 'results']:
            if key in parsed:
                parsed = parsed[key]
                break
    if not isinstance(parsed, list):
        raise ValueError("LLM did not return a valid JSON array of candidates")
    return parsed

def test_connection(provider: str) -> dict:
    """Test LLM provider connectivity."""
    try:
        start = time.time()
        if provider == 'claude':
            call_anthropic("Say 'ok' in one word.")
        else:
            call_openai_compatible("Say 'ok' in one word.", provider)
        latency = int((time.time() - start) * 1000)
        return {'ok': True, 'message': 'Connected', 'latencyMs': latency}
    except Exception as e:
        return {'ok': False, 'message': str(e), 'latencyMs': None}
```

### 2.4 Caption Service (backend/services/caption_service.py)

```python
"""
Caption service — generates FFmpeg drawtext filter chains for burned-in captions.
Supports multiple styles: classic, neon, minimal, bold, gradient.

Words are chunked into groups of 2 and displayed with timing based on word-level timestamps.
"""

CAPTION_WORDS_PER_CHUNK = 2

STYLES = {
    'classic': {
        'fontsize': 48, 'fontcolor': 'white',
        'borderw': 3, 'bordercolor': 'black',
        'font': 'Arial', 'shadowx': 2, 'shadowy': 2
    },
    'neon': {
        'fontsize': 52, 'fontcolor': '#00ff88',
        'borderw': 2, 'bordercolor': '#003322',
        'font': 'Arial Bold', 'shadowx': 0, 'shadowy': 0
    },
    'minimal': {
        'fontsize': 40, 'fontcolor': '#cccccc',
        'borderw': 0, 'bordercolor': 'none',
        'font': 'Arial', 'shadowx': 1, 'shadowy': 1
    },
    'bold': {
        'fontsize': 60, 'fontcolor': 'yellow',
        'borderw': 4, 'bordercolor': 'black',
        'font': 'Impact', 'shadowx': 3, 'shadowy': 3
    },
}

def build_drawtext_filters(words: list, style_name: str = 'classic', clip_start: float = 0) -> list:
    """
    Build FFmpeg drawtext filter strings for word-by-word captions.
    
    Args:
        words: List of {text, start, end} dicts (absolute timestamps)
        style_name: Caption style preset name
        clip_start: The start time of the clip (to offset timestamps)
    
    Returns:
        List of drawtext filter strings
    """
    style = STYLES.get(style_name, STYLES['classic'])
    filters = []
    
    for i in range(0, len(words), CAPTION_WORDS_PER_CHUNK):
        chunk = words[i:i + CAPTION_WORDS_PER_CHUNK]
        text = ' '.join(w['text'] for w in chunk)
        # Escape FFmpeg special characters
        text = text.replace("'", "'\\''").replace(":", "\\:")
        
        start = chunk[0]['start'] - clip_start
        end = chunk[-1]['end'] - clip_start
        
        f = (
            f"drawtext=text='{text}'"
            f":fontsize={style['fontsize']}"
            f":fontcolor={style['fontcolor']}"
            f":borderw={style['borderw']}"
            f":bordercolor={style['bordercolor']}"
            f":x=(w-text_w)/2:y=h-h/4"
            f":enable='between(t,{start:.2f},{end:.2f})'"
        )
        filters.append(f)
    
    return filters
```

---

## PHASE 3: Flask API Routes

### 3.1 System Routes (backend/routes/system.py)

```python
from flask import Blueprint, jsonify
from backend.config import Config

system_bp = Blueprint('system', __name__)

@system_bp.route('/status', methods=['GET'])
def get_status():
    """Return environment status — API keys, FFmpeg, etc."""
    return jsonify(Config.get_env_status())

@system_bp.route('/test-connection', methods=['POST'])
def test_connection():
    """Test LLM provider connectivity."""
    from flask import request
    from backend.services.llm_service import test_connection
    data = request.get_json()
    provider = data.get('provider', 'deepseek')
    result = test_connection(provider)
    return jsonify(result)
```

### 3.2 Project Routes (backend/routes/projects.py)

```python
from flask import Blueprint, jsonify, request
from backend.database import get_db
import uuid
from datetime import datetime

projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/projects', methods=['GET'])
def list_projects():
    db = get_db()
    rows = db.execute('SELECT * FROM projects ORDER BY updated_at DESC').fetchall()
    return jsonify([dict(r) for r in rows])

@projects_bp.route('/projects', methods=['POST'])
def create_project():
    data = request.get_json()
    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = get_db()
    db.execute(
        'INSERT INTO projects (id, name, source_path, status, transcription_mode, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
        (project_id, data.get('name'), data['sourcePath'], 'imported', data.get('transcriptionMode', 'cloud'), now, now)
    )
    db.commit()
    return jsonify({'id': project_id}), 201

@projects_bp.route('/projects/<project_id>', methods=['GET'])
def get_project_detail(project_id):
    db = get_db()
    project = dict(db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone())
    transcript = db.execute('SELECT * FROM transcripts WHERE project_id=? ORDER BY created_at DESC LIMIT 1', (project_id,)).fetchone()
    candidates = db.execute('SELECT * FROM candidates WHERE project_id=? ORDER BY rank ASC', (project_id,)).fetchall()
    clips = db.execute('''
        SELECT c.* FROM clips c 
        JOIN candidates cand ON c.candidate_id = cand.id 
        WHERE cand.project_id=?
    ''', (project_id,)).fetchall()
    
    return jsonify({
        'project': project,
        'transcript': dict(transcript) if transcript else None,
        'candidates': [dict(c) for c in candidates],
        'clips': [dict(c) for c in clips],
    })

@projects_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    db = get_db()
    db.execute('DELETE FROM projects WHERE id=?', (project_id,))
    db.commit()
    return '', 204

@projects_bp.route('/projects/<project_id>', methods=['PATCH'])
def rename_project(project_id):
    data = request.get_json()
    db = get_db()
    db.execute('UPDATE projects SET name=?, updated_at=? WHERE id=?',
               (data['name'], datetime.utcnow().isoformat(), project_id))
    db.commit()
    return '', 204
```

### 3.3 Implement remaining routes similarly for:
- **media.py**: `/projects/:id/probe`, `/projects/:id/extract-audio`
- **transcription.py**: `/projects/:id/transcribe`
- **analysis.py**: `/projects/:id/analyze`
- **rendering.py**: `/projects/:id/render/:candidateId`, `/projects/:id/render-batch`

Each route should:
1. Get data from request
2. Call the appropriate service
3. Update the database
4. Return JSON response
5. Handle errors gracefully with try/except and proper HTTP status codes
6. Use background threads for long operations (transcription, rendering)

---

## PHASE 4: React Frontend

### 4.1 Initialize Frontend

```bash
cd frontend
npx -y create-vite@latest ./ --template react-ts
npm install lucide-react
```

### 4.2 Frontend Architecture

```
frontend/src/
├── App.tsx              # Main app with routing/state management
├── api/
│   └── client.ts        # Fetch wrapper for backend API
├── components/
│   ├── Dashboard.tsx     # Project list grid
│   ├── ProjectCard.tsx   # Individual project card
│   ├── Workspace.tsx     # Main project workspace
│   ├── MediaPlayer.tsx   # Video/audio player with timeline
│   ├── TranscriptView.tsx # Scrollable transcript
│   ├── CandidateList.tsx # Ranked clip candidates
│   ├── ClipPreview.tsx   # 9:16 clip preview
│   ├── Onboarding.tsx    # Setup wizard
│   ├── SettingsPanel.tsx # API keys & configuration
│   ├── PipelineStatus.tsx # Progress indicator
│   └── ui/              # Shared UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       └── Toast.tsx
├── hooks/
│   ├── useProjects.ts
│   ├── useProject.ts
│   └── useEnvironment.ts
├── styles/
│   ├── globals.css       # Design system tokens
│   ├── dashboard.css
│   ├── workspace.css
│   └── onboarding.css
└── main.tsx             # React entry point
```

### 4.3 Design System (frontend/src/styles/globals.css)

```css
/* ClipForge Design System */
:root {
  /* Colors — Deep Dark Theme */
  --bg-primary: #0f1117;
  --bg-secondary: #1a1d23;
  --bg-tertiary: #22252d;
  --bg-elevated: #2a2d35;
  --bg-glass: rgba(26, 29, 35, 0.8);
  
  --text-primary: #f0f0f5;
  --text-secondary: #8b8d97;
  --text-muted: #5a5c66;
  
  --accent-primary: #7c3aed;
  --accent-secondary: #a855f7;
  --accent-gradient: linear-gradient(135deg, #7c3aed, #a855f7);
  
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  
  /* Typography */
  --font-sans: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Borders */
  --border-color: rgba(255, 255, 255, 0.08);
  --border-radius-sm: 6px;
  --border-radius-md: 10px;
  --border-radius-lg: 16px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.5);
  
  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--font-sans);
  background: var(--bg-primary);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Glass card effect */
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-lg);
}

/* Accent button */
.btn-accent {
  background: var(--accent-gradient);
  color: white;
  border: none;
  padding: var(--space-sm) var(--space-lg);
  border-radius: var(--border-radius-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-accent:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 58, 237, 0.4);
}
```

### 4.4 API Client (frontend/src/api/client.ts)

```typescript
const API_BASE = '/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  getStatus: () => request<EnvironmentStatus>('/status'),
  listProjects: () => request<Project[]>('/projects'),
  createProject: (data: CreateProjectRequest) => 
    request<{ id: string }>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  deleteProject: (id: string) => request(`/projects/${id}`, { method: 'DELETE' }),
  renameProject: (id: string, name: string) => 
    request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  probeMedia: (id: string) => request(`/projects/${id}/probe`, { method: 'POST' }),
  extractAudio: (id: string) => request(`/projects/${id}/extract-audio`, { method: 'POST' }),
  transcribe: (id: string) => request(`/projects/${id}/transcribe`, { method: 'POST' }),
  analyze: (id: string) => request(`/projects/${id}/analyze`, { method: 'POST' }),
  renderClip: (projectId: string, candidateId: string) => 
    request(`/projects/${projectId}/render/${candidateId}`, { method: 'POST' }),
  testConnection: (provider: string) => 
    request<ConnectionTestResult>('/test-connection', { method: 'POST', body: JSON.stringify({ provider }) }),
};
```

### 4.5 Key Frontend Implementation Notes

1. **NO Tauri imports** — All communication is via `fetch()` to the Flask backend
2. **State management** — Use React `useState` + `useEffect`, no need for Redux
3. **File selection** — Use `<input type="file">` instead of Tauri's file dialog
4. **Polling for long operations** — Transcription and rendering are async; poll status or use SSE
5. **Responsive but desktop-first** — Minimum width 1024px, optimize for 1400px+
6. **Icons** — Use `lucide-react` (same as AutoShorts for consistency)
7. **Video player** — Use native `<video>` element with custom controls

---

## PHASE 5: Testing & Validation

### 5.1 Backend Tests

```bash
# Install test dependencies
pip install pytest pytest-cov httpx

# Run all tests
pytest tests/ -v --cov=backend

# Test individual modules
pytest tests/test_database.py -v
pytest tests/test_media_service.py -v
pytest tests/test_llm_service.py -v
pytest tests/test_routes.py -v
```

### 5.2 Critical Test Cases

1. **Database**: Create/read/update/delete projects, cascading deletes
2. **Media Service**: Probe a test video, extract audio, verify output format
3. **LLM Service**: Mock API responses, test JSON parsing, test retry logic
4. **Routes**: End-to-end API tests with httpx test client
5. **Caption Service**: Verify drawtext filter string generation

### 5.3 Integration Test

```bash
# Full pipeline test with a sample video
python -c "
from backend.services.media_service import probe_media, extract_audio
from backend.services.transcription_service import transcribe_deepgram
from backend.services.llm_service import analyze_transcript

# 1. Probe
info = probe_media('test_video.mp4')
print(f'Duration: {info[\"duration_sec\"]}s')

# 2. Extract audio
extract_audio('test_video.mp4', 'test_audio.wav')

# 3. Transcribe (needs API key)
# transcript = transcribe_deepgram('test_audio.wav', os.environ['DEEPGRAM_API_KEY'])

# 4. Analyze (needs API key)
# candidates = analyze_transcript(transcript_text, duration)
"
```

---

## PHASE 6: Packaging

### 6.1 Build Frontend

```bash
cd frontend
npm run build
# Output goes to frontend/dist/
```

### 6.2 PyInstaller Bundle

```bash
pip install pyinstaller

pyinstaller --name ClipForge \
  --onedir \
  --windowed \
  --add-data "frontend/dist:frontend/dist" \
  --add-data ".env.example:.env.example" \
  --hidden-import webview \
  --hidden-import waitress \
  main.py
```

### 6.3 Development Run

```bash
# Terminal 1: Frontend dev server
cd frontend && npm run dev

# Terminal 2: Backend (point to Vite dev server)
python main.py --debug
```

---

## IMPORTANT CONSTRAINTS

1. **Do NOT copy the AutoShorts UI** — Create a unique, premium design inspired by Linear, Raycast, and Vercel
2. **Do NOT use Tauri or Rust** — This is a pure Python + React app
3. **Do NOT use Electron** — Use pywebview for the desktop wrapper
4. **Always handle errors gracefully** — Show user-friendly messages, never crash
5. **Run FFmpeg in background threads** — Never block the main thread
6. **Use proper Python packaging** — Virtual env, requirements.txt, no global installs
7. **Commit at every milestone** — Git commit after each phase completion
8. **Test before claiming done** — Run the full app and verify each feature works

---

## Milestone Checklist

- [ ] Phase 0: VM setup, Python/Node/FFmpeg installed
- [ ] Phase 1: Backend foundation — Flask app starts, DB tables created
- [ ] Phase 2: Core services — media, transcription, LLM, captions all functional
- [ ] Phase 3: API routes — all endpoints return correct responses
- [ ] Phase 4: React frontend — all screens rendered, API connected
- [ ] Phase 5: Full pipeline test — import → transcribe → analyze → render works
- [ ] Phase 6: PyInstaller build — standalone executable runs on target OS
- [ ] README.md — Installation guide, usage docs, screenshots

---

## Reference: AutoShorts Feature Parity

Ensure all these AutoShorts features are replicated:

| AutoShorts Feature | ClipForge Equivalent |
|:---|:---|
| `environment_status` | `GET /api/status` |
| `pull_ollama_model` | `POST /api/ollama/pull` |
| `install_local_whisper` | Onboarding wizard step |
| `create_project_from_path` | `POST /api/projects` |
| `list_projects` | `GET /api/projects` |
| `get_project_detail` | `GET /api/projects/:id` |
| `probe_project` | `POST /api/projects/:id/probe` |
| `extract_project_audio` | `POST /api/projects/:id/extract-audio` |
| `transcribe_project` | `POST /api/projects/:id/transcribe` |
| `generate_candidates` | `POST /api/projects/:id/analyze` |
| `test_llm_connection` | `POST /api/test-connection` |
| `set_selected_clip_count` | `PATCH /api/projects/:id/candidates` |
| `render_flat_clip_for_candidate` | `POST /api/projects/:id/render/:candidateId` |
| `delete_project` | `DELETE /api/projects/:id` |
| `rename_project` | `PATCH /api/projects/:id` |
| `check_youtube_copyright` | `POST /api/youtube/check` |
| `download_youtube_video` | `POST /api/youtube/download` |

---

*This prompt is designed to be self-contained. The AI agent should be able to build the entire application from this document alone, with no additional context needed.*
