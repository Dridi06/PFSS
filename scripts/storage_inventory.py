"""Pure, network-free recursive inventory logic for Supabase Storage listings.

The caller supplies a page-fetch function. This module never performs HTTP,
reads credentials, downloads objects, or mutates remote/local storage.
"""

from __future__ import annotations

from collections.abc import Callable
import hashlib
import json
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
    max_objects: int = 100_000,
    max_pages: int = 10_000,
    max_depth: int = 32,
) -> list[dict[str, Any]]:
    """Return a sorted inventory of files, recursively paging every folder."""
    if not isinstance(page_size, int) or isinstance(page_size, bool) or page_size < 1 or page_size > 1000:
        raise InventoryError("page_size must be between 1 and 1000.")
    for name, value, upper in (
        ("max_objects", max_objects, 1_000_000),
        ("max_pages", max_pages, 100_000),
        ("max_depth", max_depth, 128),
    ):
        if not isinstance(value, int) or isinstance(value, bool) or value < 1 or value > upper:
            raise InventoryError(f"{name} is outside the supported safety range.")

    files: list[dict[str, Any]] = []
    page_count = 0
    seen_files: set[str] = set()
    visited_folders: set[str] = set()

    def walk(prefix: str) -> None:
        depth = prefix.count("/")
        if depth > max_depth:
            raise InventoryError("Storage folder nesting exceeds the configured safety limit.")
        if prefix in visited_folders:
            raise InventoryError("Storage folder cycle or duplicate folder detected.")
        visited_folders.add(prefix)
        offset = 0

        while True:
            nonlocal page_count
            page_count += 1
            if page_count > max_pages:
                raise InventoryError("Storage listing exceeded the configured page safety limit.")
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
                    if path in seen_files:
                        raise InventoryError("Storage path is both a file and a folder.")
                    walk(path + "/")
                    continue

                if path + "/" in visited_folders:
                    raise InventoryError("Storage path is both a file and a folder.")
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
                        isinstance(size, bool) or not isinstance(size, int) or size < 0
                    ):
                        raise InventoryError("Storage object size is invalid.")
                    if mime_type is not None and not isinstance(mime_type, str):
                        raise InventoryError("Storage object MIME type is invalid.")

                files.append({
                    "path": path,
                    "size": size,
                    "mime_type": mime_type,
                })
                if len(files) > max_objects:
                    raise InventoryError("Storage listing exceeded the configured object safety limit.")

            if len(page) < page_size:
                break
            offset += len(page)

    walk("")
    return sorted(files, key=lambda item: item["path"])


def build_inventory_manifest(inventory: list[dict[str, Any]]) -> dict[str, Any]:
    """Create a deterministic integrity summary for a complete inventory."""
    if not isinstance(inventory, list):
        raise InventoryError("Inventory must be an array.")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    total_bytes = 0
    for item in inventory:
        if not isinstance(item, dict):
            raise InventoryError("Inventory contains a malformed item.")
        path = item.get("path")
        size = item.get("size")
        mime_type = item.get("mime_type")
        if not isinstance(path, str) or not path or path.startswith("/") or path.endswith("/"):
            raise InventoryError("Inventory path must be a non-empty relative file path.")
        for segment in path.split("/"):
            _validate_segment(segment)
        if path in seen:
            raise InventoryError("Inventory paths must be unique.")
        if isinstance(size, bool) or not isinstance(size, int) or size < 0:
            raise InventoryError("A complete manifest requires a known non-negative byte size.")
        if mime_type is not None and not isinstance(mime_type, str):
            raise InventoryError("Inventory MIME type is invalid.")
        seen.add(path)
        total_bytes += size
        normalized.append({"path": path, "size": size, "mime_type": mime_type})

    normalized.sort(key=lambda item: item["path"])
    canonical = json.dumps(
        normalized, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    return {
        "object_count": len(normalized),
        "total_bytes": total_bytes,
        "manifest_sha256": hashlib.sha256(canonical).hexdigest(),
    }
