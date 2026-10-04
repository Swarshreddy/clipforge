import os
import sys
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.transcription_service import normalize_deepgram, normalize_whisper


class TestNormalizeDeepgram:
    def test_normalize_deepgram_basic(self):
        data = {
            "metadata": {"duration": 120.5, "language": "en"},
            "channels": [
                {
                    "channel": 0,
                    "words": [
                        {"word": "Hello", "start": 0.0, "end": 1.0},
                        {"word": "world", "start": 1.0, "end": 2.0},
                    ]
                }
            ]
        }
        result = normalize_deepgram(data)
        assert result['language'] == 'en'
        assert result['duration'] == 120.5
        assert len(result['words']) == 2
        assert result['words'][0]['text'] == 'Hello'
        assert len(result['speakers']) == 1

    def test_normalize_deepgram_multi_speaker(self):
        data = {
            "metadata": {"duration": 60.0, "language": "en"},
            "channels": [
                {
                    "channel": 0,
                    "words": [{"word": "Hi", "start": 0.0, "end": 0.5}]
                },
                {
                    "channel": 1,
                    "words": [{"word": "There", "start": 0.5, "end": 1.0}]
                }
            ]
        }
        result = normalize_deepgram(data)
        assert len(result['speakers']) == 2
        assert result['speakers'] == ['Speaker 1', 'Speaker 2']


class TestNormalizeWhisper:
    def test_normalize_whisper_basic(self):
        data = {
            "language": "en",
            "duration": 45.0,
            "segments": [
                {
                    "start": 0.0, "end": 5.0, "text": "Hello world",
                    "words": [
                        {"word": "Hello", "start": 0.0, "end": 2.0},
                        {"word": "world", "start": 2.0, "end": 4.0},
                    ]
                }
            ]
        }
        result = normalize_whisper(data)
        assert result['language'] == 'en'
        assert result['duration'] == 45.0
        assert len(result['segments']) == 1
        assert len(result['words']) == 2
