import os
import sys
import json
import pytest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.llm_service import (
    PROVIDERS, parse_candidates, check_connection, analyze_transcript,
    call_openai_compatible, call_anthropic
)


class TestParseCandidates:
    def test_parse_json_array(self):
        result = parse_candidates(
            '[{"start": 10.0, "end": 30.0, "score": 85, "hook": "Test", "rationale": "Rationale"}]'
        )
        assert len(result) == 1
        assert result[0]['score'] == 85
        assert result[0]['hook'] == 'Test'

    def test_parse_wrapped_object(self):
        result = parse_candidates(
            '{"candidates": [{"start": 5.0, "end": 20.0, "score": 70, "hook": "Wrapped", "rationale": "Test"}]}'
        )
        assert len(result) == 1

    def test_parse_code_block(self):
        result = parse_candidates(
            '```json\n[{"start": 0.0, "end": 15.0, "score": 90, "hook": "Code block", "rationale": "Test"}]\n```'
        )
        assert len(result) == 1

    def test_parse_invalid_raises(self):
        with pytest.raises((ValueError, json.JSONDecodeError)):
            parse_candidates('not valid json')

    def test_parse_non_list_raises(self):
        with pytest.raises(ValueError, match="valid JSON array"):
            parse_candidates('{"not": "a list"}')


class TestTestConnection:
    @patch('backend.services.llm_service.call_openai_compatible')
    def test_test_connection_success(self, mock_call):
        mock_call.return_value = 'ok'
        result = check_connection('deepseek')
        assert result['ok'] is True
        assert result['message'] == 'Connected'

    @patch('backend.services.llm_service.call_anthropic')
    def test_test_connection_claude(self, mock_call):
        mock_call.return_value = 'ok'
        result = check_connection('claude')
        assert result['ok'] is True

    @patch('backend.services.llm_service.call_openai_compatible')
    def test_test_connection_failure(self, mock_call):
        mock_call.side_effect = Exception('Connection refused')
        result = check_connection('deepseek')
        assert result['ok'] is False
        assert 'Connection refused' in result['message']
