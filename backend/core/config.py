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
