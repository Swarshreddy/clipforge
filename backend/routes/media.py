from flask import Blueprint, jsonify, request
from datetime import datetime
import os

from backend.database import get_db
from backend.services.media_service import probe_media, extract_audio

media_bp = Blueprint('media', __name__)


@media_bp.route('/projects/<project_id>/probe', methods=['POST'])
def probe_project(project_id):
    db = get_db()
    row = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    project = dict(row)
    try:
        info = probe_media(project['source_path'])
    except Exception as e:
        return jsonify({'error': f'Media probe failed: {e}'}), 500

    db.execute('UPDATE projects SET source_duration=?, status=?, updated_at=? WHERE id=?',
               (info['duration_sec'], 'probed', datetime.utcnow().isoformat(), project_id))
    db.commit()
    return jsonify(info)


@media_bp.route('/projects/<project_id>/extract-audio', methods=['POST'])
def extract_project_audio(project_id):
    db = get_db()
    row = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    project = dict(row)
    if not os.path.exists(project['source_path']):
        return jsonify({'error': 'Source file not found on disk'}), 400

    data_dir = os.path.join(
        os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge')),
        'projects', project_id
    )
    os.makedirs(data_dir, exist_ok=True)
    audio_path = os.path.join(data_dir, 'audio.wav')

    try:
        extract_audio(project['source_path'], audio_path)
    except Exception as e:
        return jsonify({'error': f'Audio extraction failed: {e}'}), 500

    db.execute('UPDATE projects SET status=?, updated_at=? WHERE id=?',
               ('audio_extracted', datetime.utcnow().isoformat(), project_id))
    db.commit()
    return jsonify({'audioPath': audio_path})


@media_bp.route('/projects/<project_id>/file', methods=['GET'])
def serve_media_file(project_id):
    """Stream the source media file to the frontend video player."""
    from flask import send_file
    db = get_db()
    row = db.execute('SELECT source_path FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    source_path = row['source_path']
    if not os.path.exists(source_path):
        return jsonify({'error': 'Source file not found on disk'}), 404
    return send_file(source_path)
