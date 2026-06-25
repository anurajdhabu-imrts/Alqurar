"""Google Drive storage for uploaded documents.

Authenticates with a service account (no human login) and uploads files into a
shared Drive folder. The Drive file id is stored on the document record; the
file bytes live in Drive, not on the server.

Config (.env):
  GOOGLE_DRIVE_FOLDER_ID      — the shared folder's id
  GOOGLE_SERVICE_ACCOUNT_FILE — path to the service-account JSON key
"""
import io
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_SCOPES = ["https://www.googleapis.com/auth/drive"]


def _folder_id() -> str:
    return os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")


def _creds_path() -> str:
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service-account.json")
    p = Path(raw)
    return str(p if p.is_absolute() else _BACKEND_ROOT / p)


def is_configured() -> bool:
    """True when the folder id is set and the key file exists."""
    return bool(_folder_id()) and os.path.exists(_creds_path())


def _service():
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_file(_creds_path(), scopes=_SCOPES)
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def upload_file(content: bytes, filename: str, mime_type: str | None) -> str:
    """Upload bytes to the shared folder; returns the Drive file id."""
    from googleapiclient.http import MediaIoBaseUpload

    svc = _service()
    media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type or "application/octet-stream", resumable=False)
    meta = {"name": filename, "parents": [_folder_id()]}
    created = svc.files().create(body=meta, media_body=media, fields="id", supportsAllDrives=True).execute()
    return created["id"]


def download_file(file_id: str) -> bytes:
    from googleapiclient.http import MediaIoBaseDownload

    svc = _service()
    request = svc.files().get_media(fileId=file_id, supportsAllDrives=True)
    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    buffer.seek(0)
    return buffer.read()


def delete_file(file_id: str) -> None:
    svc = _service()
    svc.files().delete(fileId=file_id, supportsAllDrives=True).execute()
