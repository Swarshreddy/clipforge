import os
import json
import uuid
import threading
from datetime import datetime

from flask import Blueprint, jsonify, request, current_app

from backend.database import get_db
from backend.services.llm_service import analyze_transcript

analysis_bp = Blueprint('analysis', __name__)

_ANALYSIS_JOBS = {}


def _run_analysis(app, project_id, transcript_text, duration, provider):
    """Background worker for LLM analysis."""
    with app.app_context():
        try:
            _ANALYSIS_JOBS[project_id] = {'status': 'processing', 'error': None}
            candidates = analyze_transcript(transcript_text, duration, provider)

            db = get_db()
            # Clear previous candidates
            db.execute('DELETE FROM candidates WHERE project_id=?', (project_id,))

            # Rank by score descending
            sorted_candidates = sorted(candidates, key=lambda c: c.get('score', 0), reverse=True)
            for rank, cand in enumerate(sorted_candidates, start=1):
                db.execute(
                    'INSERT INTO candidates (id, project_id, start_sec, end_sec, score, hook, rationale, rank, selected) VALUES (?,?,?,?,?,?,?,?,?)',
                    (
                        str(uuid.uuid4()), project_id,
                        float(cand.get('start', 0)), float(cand.get('end', 0)),
                        float(cand.get('score', 0)),
                        cand.get('hook', ''), cand.get('rationale', ''),
                        rank, 0
                    )
                )
            db.execute('UPDATE projects SET status=?, updated_at=? WHERE id=?',
                       ('analyzed', datetime.utcnow().isoformat(), project_id))
            db.commit()
            _ANALYSIS_JOBS[project_id] = {'status': 'done', 'error': None}
        except Exception as e:
            _ANALYSIS_JOBS[project_id] = {'status': 'error', 'error': str(e)}


@analysis_bp.route('/projects/<project_id>/analyze', methods=['POST'])
def analyze_project(project_id):
    from flask import current_app

    db = get_db()
    row = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    project = dict(row)

    transcript = db.execute(
        'SELECT * FROM transcripts WHERE project_id=? ORDER BY created_at DESC LIMIT 1',
        (project_id,)
    ).fetchone()
    if transcript is None:
        return jsonify({'error': 'Project has no transcript — transcribe first'}), 400

    transcript_data = json.loads(transcript['raw_json'])
    words = transcript_data.get('words', [])
    segments = transcript_data.get('segments', [])

    # Build transcript text from segments (fallback to words)
    if segments:
        transcript_text = ' '.join(seg.get('text', '') for seg in segments)
    else:
        transcript_text = ' '.join(w.get('text', '') for w in words)

    duration = project.get('source_duration') or transcript_data.get('duration', 0)
    provider = (request.get_json() or {}).get('provider') or os.environ.get('LLM_PROVIDER', 'deepseek')

    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_run_analysis,
        args=(app, project_id, transcript_text, duration, provider),
        daemon=True
    )
    thread.start()

    return jsonify({'status': 'started'}), 202


@analysis_bp.route('/projects/<project_id>/analyze/status', methods=['GET'])
def analysis_status(project_id):
    job = _ANALYSIS_JOBS.get(project_id)
    if job is None:
        return jsonify({'status': 'idle'})
    return jsonify(job)


@analysis_bp.route('/projects/<project_id>/candidates', methods=['PATCH'])
def update_candidates(project_id):
    """Update candidate selection (selected flag)."""
    db = get_db()
    data = request.get_json() or {}
    candidate_ids = data.get('selectedIds', [])

    # Reset all, then set the selected ones
    db.execute('UPDATE candidates SET selected=0 WHERE project_id=?', (project_id,))
    if candidate_ids:
        placeholders = ','.join('?' * len(candidate_ids))
        db.execute(
            f'UPDATE candidates SET selected=1 WHERE project_id=? AND id IN ({placeholders})',
            [project_id, *candidate_ids]
        )
    db.commit()
    return jsonify({'ok': True})
