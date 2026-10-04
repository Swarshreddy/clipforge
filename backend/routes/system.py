import os
from flask import Blueprint, jsonify, request
from dotenv import set_key
from backend.config import Config

system_bp = Blueprint('system', __name__)

# Settings/env names accepted by PUT /settings. Kept explicit so arbitrary
# data cannot be injected into the environment.
SETTINGS_KEYS = [
    'LLM_PROVIDER', 'TRANSCRIPTION_MODE', 'WHISPER_MODEL', 'CAPTION_STYLE',
    'DEEPSEEK_API_KEY', 'DEEPGRAM_API_KEY', 'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY',
    'OPENROUTER_API_KEY', 'CUSTOM_BASE_URL', 'CUSTOM_API_KEY', 'CUSTOM_MODEL',
]


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
    """Update app settings, persisting them to DATA_DIR/.env so they survive restarts."""
    data = request.get_json() or {}

    env_file = os.path.join(Config.get_data_dir(), '.env')
    if not os.path.exists(env_file):
        os.makedirs(os.path.dirname(env_file), exist_ok=True)
        open(env_file, 'a').close()

    updated = []
    for key in SETTINGS_KEYS:
        if key in data:
            value = data[key]
            if value is not None:
                os.environ[key] = str(value)
                set_key(env_file, key, str(value))
                updated.append(key)

    return jsonify({'ok': True, 'updated': updated})
