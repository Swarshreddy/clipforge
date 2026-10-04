import os
import sys
import pytest
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import init_db, get_db, close_db, DB_PATH


@pytest.fixture
def app():
    from flask import Flask
    test_db_dir = tempfile.mkdtemp()
    os.environ['DATA_DIR'] = test_db_dir
    from backend.app import create_app
    app = create_app()
    yield app
    shutil.rmtree(test_db_dir, ignore_errors=True)


@pytest.fixture
def client(app):
    return app.test_client()


class TestDatabase:
    def test_init_db_creates_tables(self, app):
        with app.app_context():
            db = get_db()
            tables = db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
            table_names = [t['name'] for t in tables]
            assert 'projects' in table_names
            assert 'transcripts' in table_names
            assert 'candidates' in table_names
            assert 'clips' in table_names
            assert 'clip_copies' in table_names

    def test_create_and_read_project(self, app):
        with app.app_context():
            db = get_db()
            db.execute(
                'INSERT INTO projects (id, name, source_path, status, created_at, updated_at) VALUES (?,?,?,?,?,?)',
                ('test-id', 'Test Project', '/path/to/video.mp4', 'imported', '2026-01-01T00:00:00', '2026-01-01T00:00:00')
            )
            db.commit()
            project = db.execute('SELECT * FROM projects WHERE id=?', ('test-id',)).fetchone()
            assert project['name'] == 'Test Project'
            assert project['source_path'] == '/path/to/video.mp4'
