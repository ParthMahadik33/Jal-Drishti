"""
WhatsApp Media Service for JalDrishti.
Provides safe integration boundary for Meta Graph API media downloading.
Does NOT block webhook responses; provides clean metadata lookup interface.
"""

import logging
from typing import Optional, Dict, Any
import httpx

from backend.config import settings

logger = logging.getLogger("jaldrishti.whatsapp.media")


def get_whatsapp_media_url(
    media_id: str,
    access_token: Optional[str] = None,
    timeout_sec: float = 8.0,
) -> Dict[str, Any]:
    """
    Retrieves temporary download URL for a WhatsApp media object from Meta Graph API.
    If no token is configured, returns a safe pending-configuration descriptor.
    """
    token = access_token or settings.WHATSAPP_ACCESS_TOKEN
    if not token or token.startswith("your_"):
        return {
            "media_id": media_id,
            "status": "pending_token_configuration",
            "url": None,
            "message": "Meta Graph API access token not configured. Media cannot be fetched yet.",
        }

    meta_url = f"https://graph.facebook.com/v21.0/{media_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "JalDrishti-WhatsApp/1.0",
    }

    try:
        with httpx.Client(timeout=timeout_sec) as client:
            resp = client.get(meta_url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "media_id": media_id,
                    "status": "available",
                    "url": data.get("url"),
                    "mime_type": data.get("mime_type"),
                    "sha256": data.get("sha256"),
                    "file_size": data.get("file_size"),
                }
            else:
                logger.warning(
                    f"Meta Graph API error for media {media_id}: status={resp.status_code}"
                )
                return {
                    "media_id": media_id,
                    "status": "upstream_error",
                    "url": None,
                    "error": f"Meta returned HTTP {resp.status_code}",
                }
    except Exception as exc:
        logger.error(f"Failed to query Meta Graph API for media {media_id}: {exc}")
        return {
            "media_id": media_id,
            "status": "connection_error",
            "url": None,
            "error": str(exc),
        }
