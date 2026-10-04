"""
Transcription service — supports:
- Deepgram API (cloud, fast, speaker diarization)
- OpenAI Whisper (local, offline)
Both return a normalized transcript: { language, duration, speakers, words[], segments[] }
"""

import json
import os
import requests


def transcribe_deepgram(audio_path: str, api_key: str) -> dict:
    """Send audio to Deepgram Nova-2 for transcription."""
    url = "https://api.deepgram.com/v1/listen"
    params = {
        "model": "nova-2",
        "smart_format": "true",
        "diarize": "true",
        "punctuate": "true",
        "filler_words": "true"
    }
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "audio/wav"
    }
    with open(audio_path, 'rb') as f:
        response = requests.post(url, params=params, headers=headers, data=f)
    response.raise_for_status()
    return normalize_deepgram(response.json())


def transcribe_whisper(audio_path: str, model_size: str = 'base') -> dict:
    """Transcribe using local Whisper model."""
    import whisper
    model = whisper.load_model(model_size)
    result = model.transcribe(audio_path, word_timestamps=True)
    return normalize_whisper(result)


def normalize_deepgram(data: dict) -> dict:
    """Convert Deepgram response to normalized format.

    Nova-2 nests the payload under results -> channels -> alternatives[0] -> words.
    Words are grouped into segments by speaker change or silence gap (> 1.2s).
    """
    results = data.get('results', {})
    channels = results.get('channels', [])
    speakers = set()
    words = []
    segments = []

    for channel in channels:
        alts = channel.get('alternatives', [])
        if not alts:
            continue
        alt = alts[0]
        for w in alt.get('words', []):
            speaker_idx = w.get('speaker', 0)
            speaker_label = f"Speaker {speaker_idx + 1}"
            speakers.add(speaker_label)
            words.append({
                'text': w.get('word', '').strip(),
                'start': float(w.get('start', 0)),
                'end': float(w.get('end', 0)),
                'speaker': speaker_label
            })

    # Group words into segments by speaker change or silence (> 1.2s gap)
    current_seg = None
    for w in words:
        if (current_seg is None or
                current_seg['speaker'] != w['speaker'] or
                (w['start'] - current_seg['end']) > 1.2):
            if current_seg:
                segments.append(current_seg)
            current_seg = {
                'start': w['start'],
                'end': w['end'],
                'speaker': w['speaker'],
                'text': w['text']
            }
        else:
            current_seg['end'] = w['end']
            current_seg['text'] += ' ' + w['text']
    if current_seg:
        segments.append(current_seg)

    metadata = data.get('metadata', {})
    language = metadata.get('language', 'en')
    duration = metadata.get('duration', 0)
    if isinstance(duration, dict):
        duration = float(duration.get('value', 0))

    return {
        'language': language,
        'duration': float(duration),
        'speakers': sorted(list(speakers)) if speakers else ['Speaker 1'],
        'words': words,
        'segments': segments,
    }


def normalize_whisper(data: dict) -> dict:
    """Convert Whisper output to normalized format."""
    words = []
    segments = []

    for seg in data.get('segments', []):
        segment_text = seg.get('text', '').strip()
        seg_start = seg.get('start', 0)
        seg_end = seg.get('end', 0)
        segments.append({
            'start': seg_start,
            'end': seg_end,
            'text': segment_text
        })
        for word_info in seg.get('words', []):
            words.append({
                'text': word_info.get('word', '').strip(),
                'start': word_info.get('start', 0),
                'end': word_info.get('end', 0),
                'speaker': 'Speaker 1'
            })

    return {
        'language': data.get('language', 'en'),
        'duration': data.get('duration', 0),
        'speakers': ['Speaker 1'],
        'words': words,
        'segments': segments,
    }
