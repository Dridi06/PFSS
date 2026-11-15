"""Pure, network-free recursive inventory logic for Supabase Storage listings.

The caller supplies a page-fetch function. This module never performs HTTP,
reads credentials, downloads objects, or mutates remote/local storage.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

PageFetcher = Callable[[str, int, int], list[dict[str, Any]]]


class InventoryError(RuntimeError):
    """Raised when a Storage listing is incomplete or structurally unsafe."""


def _validate_segment(name: Any) -> str:
    if not isinstance(name, str) or not name or name in {".", ".."}:
        raise InventoryError("Storage listing contains an invalid path segment.")
    if "/" in name or "\\" in name or "\x00" in name:
        raise InventoryError("Storage listing contains a path segment separator.")
    return name


def build_inventory(
    fetch_page: PageFetcher,
    *,
    page_size: int = 100,
) -> list[dict[str, Any]]:
    """Return a sorted inventory of files, recursively paging every folder."""
    if not isinstance(page_size, int) or page_size < 1 or page_size > 1000:
        raise InventoryError("page_size must be between 1 and 1000.")

    files: list[dict[str, Any]] = []
    seen_files: set[str] = set()
    visited_folders: set[str] = set()

    def walk(prefix: str) -> None:
        if prefix in visited_folders:
            raise InventoryError("Storage folder cycle or duplicate folder detected.")
        visited_folders.add(prefix)
        offset = 0

        while True:
            page = fetch_page(prefix, page_size, offset)
            if not isinstance(page, list):
                raise InventoryError("Storage listing page is not an array.")
            if len(page) > page_size:
                raise InventoryError("Storage listing returned more rows than requested.")

            for entry in page:
                if not isinstance(entry, dict):
                    raise InventoryError("Storage listing contains a malformed entry.")
                segment = _validate_segment(entry.get("name"))
                path = prefix + segment

                # Supabase Storage folders have no object id; files have an id.
                object_id = entry.get("id")
                if object_id is None:
                    walk(path + "/")
                    continue

                if path in seen_files:
                    raise InventoryError("Duplicate Storage object path detected.")
                seen_files.add(path)

                metadata = entry.get("metadata")
                if metadata is not None and not isinstance(metadata, dict):
                    raise InventoryError("Storage object metadata is malformed.")

                size = None
                mime_type = None
                if isinstance(metadata, dict):
                    size = metadata.get("size")
                    mime_type = metadata.get("mimetype")
                    if size is not None and (
                        isinstance(size, bool) or not isinstance(size, (int, float)) or size < 0
                    ):
                        raise InventoryError("Storage object size is invalid.")
                    if mime_type is not None and not isinstance(mime_type, str):
                        raise InventoryError("Storage object MIME type is invalid.")

                files.append({
                    "path": path,
                    "size": size,
                    "mime_type": mime_type,
                })

            if len(page) < page_size:
                break
            offset += len(page)

    walk("")
    return sorted(files, key=lambda item: item["path"])
