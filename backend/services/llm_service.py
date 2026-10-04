"""
LLM Service — Multi-provider viral moment detection.
Supports: DeepSeek, Claude, Gemini, OpenAI, OpenRouter, Groq, Ollama, Custom.

Each provider call sends the full transcript to the LLM with a carefully crafted
prompt that instructs it to find viral moments and return structured JSON:
{
  "candidates": [
    {
      "start": 45.2,
      "end": 78.5,
      "score": 92,
      "hook": "You won't believe what happened next...",
      "rationale": "Strong emotional peak with unexpected revelation"
    },
    ...
  ]
}
"""

import os
import requests
import json
import time
import re

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

Return your response as a JSON object containing a "candidates" array, no other text:
{{"candidates": [{{"start": 0.0, "end": 0.0, "score": 0, "hook": "", "rationale": ""}}]}}

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
        else:
            # Fallback: first top-level key holding a list
            for value in parsed.values():
                if isinstance(value, list):
                    parsed = value
                    break
    if not isinstance(parsed, list):
        raise ValueError("LLM did not return a valid JSON array of candidates")
    return parsed


def check_connection(provider: str) -> dict:
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
