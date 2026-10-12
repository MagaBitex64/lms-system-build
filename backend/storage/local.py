"""File storage abstraction.

LocalDiskStorage stores uploaded files on the server's local filesystem
(maps to a VPS volume in production). Swap this class for an S3/Blob
implementation without touching any router code.
"""

import io
import os
import uuid
import zipfile

from typing import BinaryIO

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

    @staticmethod
    def _validate_zip(source: BinaryIO, ext: str) -> None:
        try:
            with zipfile.ZipFile(source) as archive:
                members = archive.infolist()
                if len(members) > 1000:
                    raise FileValidationError("Archive contains too many files")
                uncompressed_size = sum(member.file_size for member in members)
                if uncompressed_size > 100 * 1024 * 1024:
                    raise FileValidationError("Archive expands beyond the allowed size")
                for member in members:
                    normalized_name = member.filename.replace("\\", "/")
                    if normalized_name.startswith("/") or ".." in normalized_name.split("/"):
                        raise FileValidationError("Archive contains an unsafe path")
                    if member.flag_bits & 0x1:
                        raise FileValidationError("Encrypted archives are not supported")
                names = {member.filename for member in members}
                if ext == ".docx" and ("[Content_Types].xml" not in names or "word/document.xml" not in names):
                    raise FileValidationError("File is not a valid DOCX document")
                if ext == ".pptx" and ("[Content_Types].xml" not in names or "ppt/presentation.xml" not in names):
                    raise FileValidationError("File is not a valid PPTX presentation")
        except zipfile.BadZipFile as exc:
            raise FileValidationError("File is not a valid ZIP-based document") from exc

    def validate_content(self, filename: str, content: bytes) -> str:
        ext = self.validate(filename, len(content))
        signatures = {
            ".pdf": content.startswith(b"%PDF-"),
            ".doc": content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
            ".ppt": content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
            ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
            ".jpg": content.startswith(b"\xff\xd8\xff"),
            ".jpeg": content.startswith(b"\xff\xd8\xff"),
            ".gif": content.startswith((b"GIF87a", b"GIF89a")),
            ".webp": content.startswith(b"RIFF") and content[8:12] == b"WEBP",
            ".zip": content.startswith(b"PK"),
            ".docx": content.startswith(b"PK\x03\x04"),
            ".pptx": content.startswith(b"PK\x03\x04"),
        }
        if ext in signatures and not signatures[ext]:
            raise FileValidationError("File contents do not match the selected file type")
        if ext in {".zip", ".docx", ".pptx"}:
            self._validate_zip(io.BytesIO(content), ext)
        return ext

    def validate_path(self, filename: str, path: str, size: int) -> str:
        ext = self.validate(filename, size)
        with open(path, "rb") as source:
            prefix = source.read(16)
            if ext in {".zip", ".docx", ".pptx"}:
                if not prefix.startswith(b"PK"):
                    raise FileValidationError("File contents do not match the selected file type")
                source.seek(0)
                self._validate_zip(source, ext)
            else:
                self.validate_content(filename, prefix)
        return ext

    async def save_upload(self, filename: str, upload_file) -> tuple[str, str, int]:
        ext = self.validate(filename, 0)
        temporary_name = f".{uuid.uuid4().hex}.upload"
        temporary_path = os.path.join(self.base_dir, temporary_name)
        size = 0
        try:
            with open(temporary_path, "wb") as target:
                while chunk := await upload_file.read(1024 * 1024):
                    size += len(chunk)
                    if size > MAX_FILE_SIZE:
                        raise FileValidationError("File exceeds the 25 MB size limit")
                    target.write(chunk)
            ext = self.validate_path(filename, temporary_path, size)
            stored_name = f"{uuid.uuid4().hex}{ext}"
            os.replace(temporary_path, os.path.join(self.base_dir, stored_name))
            return stored_name, ALLOWED_EXTENSIONS[ext], size
        finally:
            if os.path.exists(temporary_path):
                os.remove(temporary_path)

    def save(self, filename: str, content: bytes) -> tuple[str, str]:
        """Save bytes to disk. Returns (stored_name, mime)."""
        ext = self.validate_content(filename, content)
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
