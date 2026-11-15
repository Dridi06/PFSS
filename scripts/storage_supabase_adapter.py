"""Injected, read-only Supabase Storage listing adapter.

No HTTP client is created here. A caller must explicitly supply a POST transport;
tests use a fake transport and never contact Supabase.
"""
from __future__ import annotations

import base64
import json
import re
from collections.abc import Callable
from typing import Any
from urllib.parse import urlsplit

from storage_inventory import InventoryError

JsonPoster = Callable[[str, dict[str, str], dict[str, Any]], Any]
_PROJECT_REF = re.compile(r"^[a-z0-9]{20}$")
_BUCKET = "pfss-scout-private"


def _jwt_role(token: str) -> str | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload = parts[1] + "=" * (-len(parts[1]) % 4)
        decoded = base64.urlsafe_b64decode(payload.encode("ascii"))
        data = json.loads(decoded)
        return data.get("role") if isinstance(data, dict) else None
    except (ValueError, UnicodeError, json.JSONDecodeError):
        return None


def create_storage_page_fetcher(
    *,
    project_url: str,
    project_ref: str,
    bucket: str,
    publishable_key: str,
    user_access_token: str,
    post_json: JsonPoster,
) -> Callable[[str, int, int], list[dict[str, Any]]]:
    """Build a page fetcher; network activity occurs only when it is called.

    The supplied access token must be a short-lived authenticated-user JWT
    with Storage read permission. JWT role inspection is a guardrail, not
    cryptographic verification; Supabase remains responsible for verification.
    """
    if not isinstance(project_ref, str) or not _PROJECT_REF.fullmatch(project_ref):
        raise InventoryError("Invalid staging project reference.")
    parsed = urlsplit(project_url if isinstance(project_url, str) else "")
    if (
        parsed.scheme != "https"
        or parsed.hostname != f"{project_ref}.supabase.co"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.port is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        raise InventoryError("Project URL does not match the canonical staging host.")
    if bucket != _BUCKET:
        raise InventoryError("Unexpected Storage bucket.")
    if not isinstance(publishable_key, str) or not publishable_key.strip():
        raise InventoryError("A publishable/anon API key is required.")
    if _jwt_role(publishable_key) == "service_role":
        raise InventoryError("Service-role API keys are not accepted.")
    if not isinstance(user_access_token, str) or _jwt_role(user_access_token) != "authenticated":
        raise InventoryError("A user access token with authenticated role is required.")
    if not callable(post_json):
        raise InventoryError("An explicit JSON POST transport is required.")

    endpoint = f"https://{project_ref}.supabase.co/storage/v1/object/list/{bucket}"

    def fetch_page(prefix: str, limit: int, offset: int) -> list[dict[str, Any]]:
        if not isinstance(prefix, str) or prefix.startswith("/") or "\\\\" in prefix or "\x00" in prefix:
            raise InventoryError("Invalid Storage prefix.")
        if not isinstance(limit, int) or isinstance(limit, bool) or not 1 <= limit <= 1000:
            raise InventoryError("Invalid Storage page limit.")
        if not isinstance(offset, int) or isinstance(offset, bool) or offset < 0:
            raise InventoryError("Invalid Storage page offset.")

        headers = {
            "apikey": publishable_key,
            "Authorization": f"Bearer {user_access_token}",
            "Content-Type": "application/json",
        }
        body = {
            "prefix": prefix,
            "limit": limit,
            "offset": offset,
            "sortBy": {"column": "name", "order": "asc"},
        }
        try:
            result = post_json(endpoint, headers, body)
        except Exception:
            # Do not leak transport exceptions; they may contain request headers.
            raise InventoryError("Storage listing request failed.") from None
        if not isinstance(result, list) or any(not isinstance(row, dict) for row in result):
            raise InventoryError("Storage listing response is not a JSON object array.")
        return result

    return fetch_page
