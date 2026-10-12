import os
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT_DIR / '.env'
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)

DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'phenomenon-lms-dev-secret-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRES_MINUTES = 60 * 24 * 7  # 7 days
APP_ENV = os.environ.get('APP_ENV', 'development')
PRODUCTION_ADMIN_EMAIL = os.environ.get('PRODUCTION_ADMIN_EMAIL', 'nurdildanurasyl7@gmail.com').strip().lower()
CORS_ORIGINS = [value.strip() for value in os.environ.get('CORS_ORIGINS', 'http://localhost:3001').split(',') if value.strip()]
MAX_USER_STORAGE_BYTES = int(os.environ.get('MAX_USER_STORAGE_BYTES', str(500 * 1024 * 1024)))
MAX_USER_FILES = int(os.environ.get('MAX_USER_FILES', '200'))


def validate_production_config():
    if APP_ENV != 'production':
        return
    from urllib.parse import urlparse
    if len(JWT_SECRET) < 32 or any(word in JWT_SECRET.lower() for word in ('change', 'generate', 'dev-secret')):
        raise RuntimeError('A random production JWT_SECRET of at least 32 characters is required')
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL is required')
    db_password = urlparse(DATABASE_URL).password or ''
    if len(db_password) < 16 or any(word in db_password.lower() for word in ('change', 'password')):
        raise RuntimeError('A strong production database password is required')
    if not CORS_ORIGINS or any(origin == '*' or not origin.startswith('https://') for origin in CORS_ORIGINS):
        raise RuntimeError('Explicit HTTPS CORS_ORIGINS are required')
    if not FRONTEND_BASE_URL.startswith('https://') or urlparse(FRONTEND_BASE_URL).hostname in ('localhost', '127.0.0.1'):
        raise RuntimeError('An external HTTPS FRONTEND_BASE_URL is required')

BREVO_API_KEY = os.environ.get('BREVO_API_KEY', '')
BREVO_SENDER_ID = os.environ.get('BREVO_SENDER_ID', '')
FRONTEND_BASE_URL = os.environ.get('FRONTEND_BASE_URL', 'http://localhost:3001').rstrip('/')
PASSWORD_RESET_EXPIRES_MINUTES = int(os.environ.get('PASSWORD_RESET_EXPIRES_MINUTES', '30'))
PASSWORD_RESET_MAX_PER_HOUR = int(os.environ.get('PASSWORD_RESET_MAX_PER_HOUR', '3'))

UPLOAD_DIR = os.environ.get('UPLOAD_DIR', os.path.join(ROOT_DIR, 'uploads'))

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

ALLOWED_EXTENSIONS = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".txt": "text/plain",
    ".zip": "application/zip",
}
