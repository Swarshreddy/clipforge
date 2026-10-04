import os
import uuid
import threading
import sqlite3
from datetime import datetime

from flask import Blueprint, jsonify, request

from backend.database import get_db
from backend.services.transcription_service import transcribe_deepgram

transcription_bp = Blueprint('transcription', __name__)

# In-process job status store (simple polling approach)
_TRANSCRIPTION_JOBS = {}


def _run_transcription(app, project_id, audio_path, mode, api_key, whisper_model):
    """Background worker for transcription."""
    with app.app_context():
        try:
            _TRANSCRIPTION_JOBS[project_id] = {'status': 'processing', 'error': None}
            if mode == 'whisper':
                from backend.services.transcription_service import transcribe_whisper
                transcript = transcribe_whisper(audio_path, whisper_model or 'base')
                engine = f'whisper:{whisper_model or "base"}'
            else:
                transcript = transcribe_deepgram(audio_path, api_key)
                engine = 'deepgram:nova-2'

            db = get_db()
            db.execute(
                'INSERT INTO transcripts (id, project_id, engine, raw_json, language, created_at) VALUES (?,?,?,?,?,?)',
                (
                    str(uuid.uuid4()), project_id, engine,
                    __import__('json').dumps(transcript),
                    transcript.get('language'), datetime.utcnow().isoformat()
                )
            )
            db.execute('UPDATE projects SET status=?, updated_at=? WHERE id=?',
                       ('transcribed', datetime.utcnow().isoformat(), project_id))
            db.commit()
            _TRANSCRIPTION_JOBS[project_id] = {'status': 'done', 'error': None}
        except Exception as e:
            _TRANSCRIPTION_JOBS[project_id] = {'status': 'error', 'error': str(e)}


@transcription_bp.route('/projects/<project_id>/transcribe', methods=['POST'])
def transcribe_project(project_id):
    from flask import current_app
    import json as jsonlib

    db = get_db()
    row = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    project = dict(row)

    data = request.get_json() or {}
    mode = data.get('mode') or project.get('transcription_mode', 'cloud')
    api_key = os.environ.get('DEEPGRAM_API_KEY', '')
    whisper_model = os.environ.get('WHISPER_MODEL', 'base')

    if mode == 'cloud' and not api_key:
        return jsonify({'error': 'DEEPGRAM_API_KEY not configured'}), 400

    # Locate extracted audio
    data_dir = os.path.join(
        os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge')),
        'projects', project_id
    )
    audio_path = os.path.join(data_dir, 'audio.wav')
    if not os.path.exists(audio_path):
        # Try extracting on the fly
        if not os.path.exists(project['source_path']):
            return jsonify({'error': 'Audio not extracted and source file missing'}), 400
        try:
            from backend.services.media_service import extract_audio
            extract_audio(project['source_path'], audio_path)
        except Exception as e:
            return jsonify({'error': f'Audio extraction failed: {e}'}), 500

    # Run in background thread
    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_run_transcription,
        args=(app, project_id, audio_path, mode, api_key, whisper_model),
        daemon=True
    )
    thread.start()

    return jsonify({'status': 'started'}), 202


@transcription_bp.route('/projects/<project_id>/transcribe/status', methods=['GET'])
def transcription_status(project_id):
    job = _TRANSCRIPTION_JOBS.get(project_id)
    if job is None:
        return jsonify({'status': 'idle'})
    return jsonify(job)
