import os
import threading

from flask import Blueprint, jsonify, request, current_app

youtube_bp = Blueprint('youtube', __name__)

_DOWNLOAD_JOBS = {}


@youtube_bp.route('/youtube/check', methods=['POST'])
def youtube_check():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'url is required'}), 400
    from backend.services.youtube_service import check_youtube_copyright
    result = check_youtube_copyright(url)
    status_code = 200 if result.get('ok') else 400
    return jsonify(result), status_code


@youtube_bp.route('/youtube/download', methods=['POST'])
def youtube_download():
    data = request.get_json() or {}
    url = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'url is required'}), 400

    job_id = str(uuid.uuid4())
    _DOWNLOAD_JOBS[job_id] = {'status': 'downloading', 'path': None, 'error': None, 'log': []}

    app = current_app._get_current_object()

    def _worker(app, url, job_id):
        from backend.services.youtube_service import download_youtube_video
        downloads_dir = os.path.join(
            os.environ.get('DATA_DIR', os.path.expanduser('~/.clipforge')),
            'downloads'
        )
        result = download_youtube_video(
            url, downloads_dir,
            progress_cb=lambda line: _DOWNLOAD_JOBS[job_id]['log'].append(line)
        )
        if result.get('ok'):
            _DOWNLOAD_JOBS[job_id] = {'status': 'done', 'path': result['path'], 'error': None}
        else:
            _DOWNLOAD_JOBS[job_id] = {
                'status': 'error', 'path': None, 'error': result.get('error'),
                'log': _DOWNLOAD_JOBS[job_id].get('log', [])
            }

    thread = threading.Thread(
        target=_worker,
        args=(app, url, job_id),
        daemon=True
    )
    thread.start()

    return jsonify({'jobId': job_id, 'status': 'started'}), 202


@youtube_bp.route('/youtube/download/<job_id>', methods=['GET'])
def youtube_download_status(job_id):
    job = _DOWNLOAD_JOBS.get(job_id)
    if job is None:
        return jsonify({'status': 'unknown'}), 404
    return jsonify(job)


@youtube_bp.route('/ollama/pull', methods=['POST'])
def ollama_pull():
    """Pull an Ollama model via the local Ollama daemon."""
    import requests as _requests

    data = request.get_json() or {}
    model = data.get('model', 'llama3.2')

    try:
        response = _requests.post(
            'http://localhost:11434/api/pull',
            json={'name': model, 'stream': False},
            timeout=600
        )
        response.raise_for_status()
        return jsonify({'ok': True, 'message': f'Model {model} pulled'})
    except _requests.exceptions.ConnectionError:
        return jsonify({'ok': False, 'message': 'Ollama is not running. Start it with: ollama serve'}), 400
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500
