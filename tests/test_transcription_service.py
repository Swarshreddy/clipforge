import os
import sys
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.transcription_service import normalize_deepgram, normalize_whisper


class TestNormalizeDeepgram:
    def test_normalize_deepgram_basic(self):
        # Realistic Nova-2 response shape: results -> channels -> alternatives[0] -> words
        data = {
            "metadata": {"duration": 120.5, "language": "en"},
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {
                                "words": [
                                    {"word": "Hello", "start": 0.0, "end": 1.0, "speaker": 0},
                                    {"word": "world", "start": 1.0, "end": 2.0, "speaker": 0},
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        result = normalize_deepgram(data)
        assert result['language'] == 'en'
        assert result['duration'] == 120.5
        assert len(result['words']) == 2
        assert result['words'][0]['text'] == 'Hello'
        assert len(result['speakers']) == 1
        assert len(result['segments']) == 1

    def test_normalize_deepgram_multi_speaker(self):
        data = {
            "metadata": {"duration": 60.0, "language": "en"},
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {
                                "words": [
                                    {"word": "Hi", "start": 0.0, "end": 0.5, "speaker": 0},
                                    {"word": "There", "start": 0.5, "end": 1.0, "speaker": 1},
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        result = normalize_deepgram(data)
        assert len(result['speakers']) == 2
        assert result['speakers'] == ['Speaker 1', 'Speaker 2']
        assert len(result['segments']) == 2
        assert result['segments'][0]['speaker'] == 'Speaker 1'
        assert result['segments'][1]['speaker'] == 'Speaker 2'

    def test_normalize_deepgram_silence_splits_segments(self):
        # Gap > 1.2s between words with same speaker should split into two segments
        data = {
            "metadata": {"duration": 60.0, "language": "en"},
            "results": {
                "channels": [
                    {
                        "alternatives": [
                            {
                                "words": [
                                    {"word": "First", "start": 0.0, "end": 0.5, "speaker": 0},
                                    {"word": "part", "start": 0.5, "end": 1.0, "speaker": 0},
                                    {"word": "Second", "start": 3.0, "end": 3.5, "speaker": 0},
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        result = normalize_deepgram(data)
        assert len(result['segments']) == 2

    def test_normalize_deepgram_duration_dict(self):
        # Some Deepgram responses return duration as {value, ...}
        data = {
            "metadata": {"duration": {"value": 30.0}, "language": "en"},
            "results": {
                "channels": [
                    {"alternatives": [{"words": [{"word": "Hi", "start": 0.0, "end": 0.5, "speaker": 0}]}]}
                ]
            }
        }
        result = normalize_deepgram(data)
        assert result['duration'] == 30.0


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
