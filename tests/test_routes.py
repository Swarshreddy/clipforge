import os
import sys
import json
import tempfile
import shutil
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def app():
    test_db_dir = tempfile.mkdtemp()
    os.environ['DATA_DIR'] = test_db_dir
    from backend.app import create_app
    app = create_app()
    app.config['TESTING'] = True
    yield app
    shutil.rmtree(test_db_dir, ignore_errors=True)


@pytest.fixture
def client(app):
    return app.test_client()


class TestSystemRoutes:
    def test_get_status(self, client):
        response = client.get('/api/status')
        assert response.status_code == 200
        data = response.get_json()
        assert 'hasFfmpeg' in data
        assert 'llmProvider' in data
        assert 'dataDir' in data

    def test_get_settings(self, client):
        response = client.get('/api/settings')
        assert response.status_code == 200
        data = response.get_json()
        assert 'llmProvider' in data

    def test_update_settings(self, client):
        response = client.put('/api/settings', json={'LLM_PROVIDER': 'openai'})
        assert response.status_code == 200
        assert response.get_json()['ok'] is True

    def test_update_settings_persists_to_env(self, client, app):
        import tempfile
        from backend.config import Config
        from dotenv import dotenv_values
        response = client.put('/api/settings', json={'DEEPSEEK_API_KEY': 'sk-test-123'})
        assert response.status_code == 200
        env_file = os.path.join(Config.get_data_dir(), '.env')
        assert os.path.exists(env_file)
        persisted = dotenv_values(env_file) or {}
        assert persisted.get('DEEPSEEK_API_KEY') == 'sk-test-123'
        # Also exposed to the runtime env immediately
        assert os.environ.get('DEEPSEEK_API_KEY') == 'sk-test-123'

    def test_update_settings_ignores_unknown_keys(self, client):
        response = client.put('/api/settings', json={'MALICIOUS_KEY': 'x', 'LLM_PROVIDER': 'deepseek'})
        assert response.status_code == 200
        assert 'MALICIOUS_KEY' not in os.environ

    def test_test_connection_missing_key(self, client):
        response = client.post('/api/test-connection', json={'provider': 'openai'})
        assert response.status_code == 200
        data = response.get_json()
        # Without a key the call will fail gracefully
        assert data['ok'] is False


class TestProjectRoutes:
    def test_create_project(self, client):
        response = client.post('/api/projects', json={
            'name': 'Test Project',
            'sourcePath': '/tmp/test_video.mp4',
        })
        assert response.status_code == 201
        assert 'id' in response.get_json()

    def test_create_project_requires_source(self, client):
        response = client.post('/api/projects', json={'name': 'No path'})
        assert response.status_code == 400

    def test_list_projects(self, client):
        client.post('/api/projects', json={'sourcePath': '/tmp/a.mp4', 'name': 'A'})
        client.post('/api/projects', json={'sourcePath': '/tmp/b.mp4', 'name': 'B'})
        response = client.get('/api/projects')
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)
        assert len(data) == 2

    def test_get_project_detail(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/c.mp4', 'name': 'C'})
        pid = create.get_json()['id']
        response = client.get(f'/api/projects/{pid}')
        assert response.status_code == 200
        data = response.get_json()
        assert data['project']['name'] == 'C'
        assert data['transcript'] is None
        assert data['candidates'] == []

    def test_get_project_not_found(self, client):
        response = client.get('/api/projects/nonexistent')
        assert response.status_code == 404

    def test_rename_project(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/d.mp4', 'name': 'D'})
        pid = create.get_json()['id']
        response = client.patch(f'/api/projects/{pid}', json={'name': 'Renamed'})
        assert response.status_code == 204
        detail = client.get(f'/api/projects/{pid}').get_json()
        assert detail['project']['name'] == 'Renamed'

    def test_delete_project(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/e.mp4', 'name': 'E'})
        pid = create.get_json()['id']
        response = client.delete(f'/api/projects/{pid}')
        assert response.status_code == 204
        detail = client.get(f'/api/projects/{pid}')
        assert detail.status_code == 404

    def test_delete_cascades(self, client):
        """Deleting a project removes its transcripts and candidates."""
        from backend.database import get_db
        create = client.post('/api/projects', json={'sourcePath': '/tmp/f.mp4', 'name': 'F'})
        pid = create.get_json()['id']
        client.post(f'/api/projects/{pid}/probe')

        # Manually insert transcript + candidate
        with client.application.app_context():
            db = get_db()
            db.execute(
                'INSERT INTO transcripts (id, project_id, engine, raw_json, language, created_at) VALUES (?,?,?,?,?,?)',
                ('t1', pid, 'test', json.dumps({'words': []}), 'en', '2026-01-01T00:00:00')
            )
            db.execute(
                'INSERT INTO candidates (id, project_id, start_sec, end_sec, score, hook, rationale, rank, selected) VALUES (?,?,?,?,?,?,?,?,?)',
                ('c1', pid, 0.0, 30.0, 90.0, 'Hook', 'Rationale', 1, 1)
            )
            db.execute(
                'INSERT INTO clips (id, candidate_id, status) VALUES (?,?,?)',
                ('cl1', 'c1', 'pending')
            )
            db.commit()

        response = client.delete(f'/api/projects/{pid}')
        assert response.status_code == 204

        with client.application.app_context():
            db = get_db()
            assert db.execute('SELECT COUNT(*) FROM transcripts WHERE project_id=?', (pid,)).fetchone()[0] == 0
            assert db.execute('SELECT COUNT(*) FROM candidates WHERE project_id=?', (pid,)).fetchone()[0] == 0
            assert db.execute('SELECT COUNT(*) FROM clips').fetchone()[0] == 0


class TestMediaRoutes:
    def test_probe_missing_file(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/does_not_exist.mp4'})
        pid = create.get_json()['id']
        response = client.post(f'/api/projects/{pid}/probe')
        assert response.status_code == 500
        assert 'error' in response.get_json()

    def test_probe_real_video(self, client):
        """Integration: probe an actual generated test video."""
        import subprocess
        video_path = os.path.join(tempfile.mkdtemp(), 'test.mp4')
        subprocess.run([
            'ffmpeg', '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x360:rate=30',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
            '-c:v', 'libx264', '-c:a', 'aac', '-shortest', '-y', video_path
        ], capture_output=True, check=True)

        create = client.post('/api/projects', json={'sourcePath': video_path, 'name': 'Real video'})
        pid = create.get_json()['id']
        response = client.post(f'/api/projects/{pid}/probe')
        assert response.status_code == 200
        data = response.get_json()
        assert data['duration_sec'] == pytest.approx(2.0, abs=0.5)
        assert data['has_video'] is True
        assert data['width'] == 640


class TestAnalysisRoutes:
    def test_analyze_without_transcript(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/g.mp4'})
        pid = create.get_json()['id']
        response = client.post(f'/api/projects/{pid}/analyze')
        assert response.status_code == 400
        assert 'transcript' in response.get_json()['error'].lower()


class TestRenderingRoutes:
    def test_render_missing_candidate(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/h.mp4'})
        pid = create.get_json()['id']
        response = client.post(f'/api/projects/{pid}/render/nonexistent')
        assert response.status_code == 404

    def test_render_batch_no_selected(self, client):
        create = client.post('/api/projects', json={'sourcePath': '/tmp/i.mp4'})
        pid = create.get_json()['id']
        response = client.post(f'/api/projects/{pid}/render-batch')
        assert response.status_code == 400
