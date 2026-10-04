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
    if not data or not data.get('sourcePath'):
        return jsonify({'error': 'sourcePath is required'}), 400
    project_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    db = get_db()
    db.execute(
        'INSERT INTO projects (id, name, source_path, source_duration, status, transcription_mode, caption_style, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
        (
            project_id,
            data.get('name') or 'Untitled Project',
            data['sourcePath'],
            data.get('duration'),
            'imported',
            data.get('transcriptionMode', 'cloud'),
            data.get('captionStyle', 'classic'),
            now, now
        )
    )
    db.commit()
    return jsonify({'id': project_id}), 201


@projects_bp.route('/projects/<project_id>', methods=['GET'])
def get_project_detail(project_id):
    db = get_db()
    row = db.execute('SELECT * FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    project = dict(row)
    transcript = db.execute(
        'SELECT * FROM transcripts WHERE project_id=? ORDER BY created_at DESC LIMIT 1',
        (project_id,)
    ).fetchone()
    candidates = db.execute(
        'SELECT * FROM candidates WHERE project_id=? ORDER BY rank ASC',
        (project_id,)
    ).fetchall()
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
    row = db.execute('SELECT id FROM projects WHERE id=?', (project_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Project not found'}), 404
    # Delete children explicitly (SQLite may not have FK cascade enabled per-connection)
    db.execute('DELETE FROM clip_copies WHERE clip_id IN (SELECT c.id FROM clips c JOIN candidates cand ON c.candidate_id=cand.id WHERE cand.project_id=?)', (project_id,))
    db.execute('DELETE FROM clips WHERE candidate_id IN (SELECT id FROM candidates WHERE project_id=?)', (project_id,))
    db.execute('DELETE FROM candidates WHERE project_id=?', (project_id,))
    db.execute('DELETE FROM transcripts WHERE project_id=?', (project_id,))
    db.execute('DELETE FROM projects WHERE id=?', (project_id,))
    db.commit()
    return '', 204


@projects_bp.route('/projects/<project_id>', methods=['PATCH'])
def rename_project(project_id):
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'error': 'name is required'}), 400
    db = get_db()
    db.execute('UPDATE projects SET name=?, updated_at=? WHERE id=?',
               (data['name'], datetime.utcnow().isoformat(), project_id))
    db.commit()
    return '', 204
