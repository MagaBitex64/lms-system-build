"""File storage abstraction.

LocalDiskStorage stores uploaded files on the server's local filesystem
(maps to a VPS volume in production). Swap this class for an S3/Blob
implementation without touching any router code.
"""

import os
import uuid

from core.config import ALLOWED_EXTENSIONS, MAX_FILE_SIZE, UPLOAD_DIR


class FileValidationError(Exception):
    pass


class LocalDiskStorage:
    def __init__(self, base_dir: str = UPLOAD_DIR):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def validate(self, filename: str, size: int) -> str:
        """Validate extension and size. Returns the canonical extension."""
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise FileValidationError(f"File type '{ext}' is not allowed")
        if size > MAX_FILE_SIZE:
            raise FileValidationError("File exceeds the 25 MB size limit")
        return ext

    def save(self, filename: str, content: bytes) -> tuple[str, str]:
        """Save bytes to disk. Returns (stored_name, mime)."""
        ext = self.validate(filename, len(content))
        stored_name = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(self.base_dir, stored_name)
        with open(path, "wb") as f:
            f.write(content)
        return stored_name, ALLOWED_EXTENSIONS[ext]

    def path_for(self, stored_name: str) -> str:
        # Prevent path traversal
        safe = os.path.basename(stored_name)
        return os.path.join(self.base_dir, safe)

    def exists(self, stored_name: str) -> bool:
        return os.path.isfile(self.path_for(stored_name))

    def delete(self, stored_name: str) -> None:
        path = self.path_for(stored_name)
        if os.path.isfile(path):
            os.remove(path)


storage = LocalDiskStorage()
