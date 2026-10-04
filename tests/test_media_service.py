import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock

# Ensure backend is importable
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.media_service import probe_media, extract_audio, render_portrait_clip


class TestProbeMedia:
    @patch('backend.services.media_service.subprocess.run')
    def test_probe_returns_metadata(self, mock_run):
        mock_result = MagicMock()
        mock_result.stdout = '''{
            "format": {"duration": "120.5"},
            "streams": [
                {"codec_type": "video", "width": 1920, "height": 1080, "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac"}
            ]
        }'''
        mock_run.return_value = mock_result

        result = probe_media('/fake/video.mp4')
        assert result['duration_sec'] == 120.5
        assert result['has_video'] is True
        assert result['width'] == 1920
        assert result['height'] == 1080
        assert result['video_codec'] == 'h264'
        assert result['audio_codec'] == 'aac'

    @patch('backend.services.media_service.subprocess.run')
    def test_probe_no_video(self, mock_run):
        mock_result = MagicMock()
        mock_result.stdout = '''{
            "format": {"duration": "60.0"},
            "streams": [
                {"codec_type": "audio", "codec_name": "mp3"}
            ]
        }'''
        mock_run.return_value = mock_result

        result = probe_media('/fake/audio.mp3')
        assert result['has_video'] is False
        assert result['duration_sec'] == 60.0


class TestBuildCaptionFilters:
    def test_build_drawtext_filters_chunks_words(self):
        from backend.services.caption_service import build_drawtext_filters
        words = [
            {'text': 'Hello', 'start': 0.0, 'end': 1.0},
            {'text': 'world', 'start': 1.0, 'end': 2.0},
            {'text': 'ClipForge', 'start': 2.0, 'end': 3.0},
        ]
        filters = build_drawtext_filters(words, 'classic', 0)
        assert len(filters) == 2  # 3 words -> 2 chunks (2+1)
        assert 'Hello world' in filters[0]
        assert 'ClipForge' in filters[1]

    def test_build_drawtext_filters_offsets_clip_start(self):
        from backend.services.caption_service import build_drawtext_filters
        words = [
            {'text': 'Test', 'start': 5.0, 'end': 6.0},
        ]
        filters = build_drawtext_filters(words, 'minimal', 3.0)
        # The timestamp should be offset by clip_start=3.0
        assert 'between(t,2.00' in filters[0]

    def test_styles_contain_required_keys(self):
        from backend.services.caption_service import STYLES
        for style_name, style in STYLES.items():
            assert 'fontsize' in style
            assert 'fontcolor' in style
