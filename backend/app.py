import os
from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

def create_app():
    # Load project root .env first, then DATA_DIR/.env with override so settings
    # saved from the UI (persisted to DATA_DIR/.env) win on restart.
    load_dotenv()
    from backend.config import Config
    load_dotenv(os.path.join(Config.get_data_dir(), '.env'), override=True)

    app = Flask(
        __name__,
        static_folder='../frontend/dist',
        static_url_path='/'
    )
    CORS(app)

    # Initialize database
    from backend.database import init_db
    init_db(app)

    # Register route blueprints
    from backend.routes.system import system_bp
    from backend.routes.projects import projects_bp
    from backend.routes.media import media_bp
    from backend.routes.transcription import transcription_bp
    from backend.routes.analysis import analysis_bp
    from backend.routes.rendering import rendering_bp
    from backend.routes.youtube import youtube_bp

    app.register_blueprint(system_bp, url_prefix='/api')
    app.register_blueprint(projects_bp, url_prefix='/api')
    app.register_blueprint(media_bp, url_prefix='/api')
    app.register_blueprint(transcription_bp, url_prefix='/api')
    app.register_blueprint(analysis_bp, url_prefix='/api')
    app.register_blueprint(rendering_bp, url_prefix='/api')
    app.register_blueprint(youtube_bp, url_prefix='/api')

    # Serve React frontend for non-API routes
    @app.route('/')
    def serve_frontend():
        return app.send_static_file('index.html')

    @app.errorhandler(404)
    def not_found(e):
        # SPA fallback
        return app.send_static_file('index.html')

    return app
