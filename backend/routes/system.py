from flask import Blueprint, jsonify, request
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
    from backend.services.llm_service import check_connection
    data = request.get_json() or {}
    provider = data.get('provider', 'deepseek')
    result = check_connection(provider)
    return jsonify(result)


@system_bp.route('/settings', methods=['GET'])
def get_settings():
    """Get app settings (masked — never expose actual keys)."""
    import os
    return jsonify({
        'llmProvider': Config.get_llm_provider(),
        'transcriptionMode': os.environ.get('TRANSCRIPTION_MODE', 'cloud'),
        'whisperModel': os.environ.get('WHISPER_MODEL', 'base'),
        'captionStyle': os.environ.get('CAPTION_STYLE', 'classic'),
        'dataDir': Config.get_data_dir(),
    })


@system_bp.route('/settings', methods=['PUT'])
def update_settings():
    """Update app settings (persisted to .env in data dir)."""
    import os
    data = request.get_json() or {}
    allowed = ['LLM_PROVIDER', 'TRANSCRIPTION_MODE', 'WHISPER_MODEL', 'CAPTION_STYLE']
    for key in allowed:
        if key in data:
            os.environ[key] = str(data[key])
    return jsonify({'ok': True})
