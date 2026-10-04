import os
import uuid
import json
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from flask import Blueprint, jsonify, request, current_app

from backend.database import get_db

rendering_bp = Blueprint('rendering', __name__)

# Cap concurrent batch renders so FFmpeg doesn't saturate the CPU.
_RENDER_EXECUTOR = ThreadPoolExecutor(max_workers=2)

_RENDER_JOBS = {}


@rendering_bp.route('/projects/<project_id>/render/<candidate_id>', methods=['POST'])
def render_clip(project_id, candidate_id):
    from flask import current_app

    db = get_db()
    row = db.execute(
        'SELECT * FROM candidates WHERE id=? AND project_id=?',
        (candidate_id, project_id)
    ).fetchone()
    if row is None:
        return jsonify({'error': 'Candidate not found'}), 404
    candidate = dict(row)

    project = dict(db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone())
    transcript = db.execute(
        'SELECT * FROM transcripts WHERE project_id=? ORDER BY created_at DESC LIMIT 1',
        (project_id,)
    ).fetchone()

    caption_words = None
    if transcript:
        transcript_data = json.loads(transcript['raw_json'])
        caption_words = [
            w for w in transcript_data.get('words', [])
            if w.get('start') >= candidate['start_sec'] - 0.1 and w.get('end') <= candidate['end_sec'] + 0.1
        ]

    data = request.get_json() or {}
    caption_style = data.get('captionStyle') or project.get('caption_style', 'classic')

    # Create clip record
    clip_id = str(uuid.uuid4())
    output_dir = os.path.join(
        os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge')),
        'projects', project_id, 'clips'
    )
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, f'clip_{candidate_id[:8]}.mp4')

    db.execute(
        'INSERT INTO clips (id, candidate_id, status, output_path, render_log) VALUES (?,?,?,?,?)',
        (clip_id, candidate_id, 'pending', output_path, 'Queued')
    )
    db.commit()

    app = current_app._get_current_object()
    thread = threading.Thread(
        target=_run_render,
        args=(app, project_id, clip_id, output_path, candidate['start_sec'], candidate['end_sec'], caption_words, caption_style),
        daemon=True
    )
    thread.start()

    return jsonify({'clipId': clip_id, 'status': 'started'}), 202


def _run_render(app, project_id, clip_id, output_path, start_sec, end_sec, caption_words, caption_style):
    """Background worker for clip rendering."""
    with app.app_context():
        try:
            _RENDER_JOBS[clip_id] = {'status': 'rendering', 'error': None}
            db = get_db()
            db.execute('UPDATE clips SET status=?, render_log=? WHERE id=?',
                       ('rendering', 'FFmpeg started', clip_id))
            db.commit()

            row = db.execute('SELECT source_path FROM projects WHERE id=?', (project_id,)).fetchone()
            source_path = row['source_path']

            from backend.services.media_service import render_portrait_clip
            render_portrait_clip(
                source_path=source_path,
                output_path=output_path,
                start_sec=start_sec,
                end_sec=end_sec,
                caption_words=caption_words,
                caption_style=caption_style,
            )

            db.execute('UPDATE clips SET status=?, output_path=?, render_log=? WHERE id=?',
                       ('done', output_path, 'Render complete', clip_id))
            db.commit()
            _RENDER_JOBS[clip_id] = {'status': 'done', 'error': None}
        except Exception as e:
            try:
                db = get_db()
                db.execute('UPDATE clips SET status=?, render_log=? WHERE id=?',
                           ('error', str(e), clip_id))
                db.commit()
            except Exception:
                pass
            _RENDER_JOBS[clip_id] = {'status': 'error', 'error': str(e)}


@rendering_bp.route('/clips/<clip_id>/status', methods=['GET'])
def clip_status(clip_id):
    db = get_db()
    row = db.execute('SELECT status, render_log FROM clips WHERE id=?', (clip_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Clip not found'}), 404
    return jsonify({'status': row['status'], 'log': row['render_log']})


@rendering_bp.route('/clips/<clip_id>/file', methods=['GET'])
def serve_clip_file(clip_id):
    from flask import send_file
    db = get_db()
    row = db.execute('SELECT output_path FROM clips WHERE id=?', (clip_id,)).fetchone()
    if row is None or not row['output_path']:
        return jsonify({'error': 'Clip not found'}), 404
    output_path = row['output_path']
    if not os.path.exists(output_path):
        return jsonify({'error': 'Clip file not found on disk'}), 404
    return send_file(output_path)


@rendering_bp.route('/projects/<project_id>/render-batch', methods=['POST'])
def render_batch(project_id):
    from flask import current_app

    db = get_db()
    project = dict(db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone())
    selected = db.execute(
        'SELECT * FROM candidates WHERE project_id=? AND selected=1 ORDER BY rank ASC',
        (project_id,)
    ).fetchall()
    if not selected:
        return jsonify({'error': 'No selected candidates to render'}), 400

    transcript = db.execute(
        'SELECT * FROM transcripts WHERE project_id=? ORDER BY created_at DESC LIMIT 1',
        (project_id,)
    ).fetchone()

    transcript_data = json.loads(transcript['raw_json']) if transcript else {'words': []}

    clip_ids = []
    for candidate in selected:
        caption_words = [
            w for w in transcript_data.get('words', [])
            if w.get('start') >= candidate['start_sec'] - 0.1 and w.get('end') <= candidate['end_sec'] + 0.1
        ]
        clip_id = str(uuid.uuid4())
        output_dir = os.path.join(
            os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge')),
            'projects', project_id, 'clips'
        )
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f'clip_{candidate["id"][:8]}.mp4')

        db.execute(
            'INSERT INTO clips (id, candidate_id, status, output_path, render_log) VALUES (?,?,?,?,?)',
            (clip_id, candidate['id'], 'pending', output_path, 'Queued (batch)')
        )
        db.commit()

        _RENDER_EXECUTOR.submit(
            _run_render,
            current_app._get_current_object(), project_id, clip_id, output_path,
            candidate['start_sec'], candidate['end_sec'], caption_words,
            project.get('caption_style', 'classic'),
        )
        clip_ids.append(clip_id)

    return jsonify({'clipIds': clip_ids, 'count': len(clip_ids), 'status': 'started'}), 202
