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
