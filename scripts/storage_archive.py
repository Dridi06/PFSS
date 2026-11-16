#!/usr/bin/env python3
"""Offline, deterministic PFMS Storage archive builder/verifier/restorer.

This module performs local filesystem operations only. It never contacts
Supabase, R2, GitHub, or any other network service.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import tarfile
import tempfile
from typing import Any

FORMAT = "pfms-storage-archive-v1"
MANIFEST_NAME = "PFMS-STORAGE-MANIFEST.json"
CHUNK = 1024 * 1024
DEFAULT_MAX_OBJECTS = 100_000
DEFAULT_MAX_TOTAL_BYTES = 10 * 1024 * 1024 * 1024


class ArchiveError(RuntimeError):
    """Raised when an archive or local source is incomplete or unsafe."""


def _safe_path(value: Any) -> str:
    if not isinstance(value, str) or not value or value.startswith("/") or "\\" in value or "\x00" in value:
        raise ArchiveError("Unsafe Storage object path.")
    path = PurePosixPath(value)
    if any(part in ("", ".", "..") for part in value.split("/")) or path.as_posix() != value:
        raise ArchiveError("Unsafe Storage object path.")
    return value


def _hash_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(CHUNK), b""):
            size += len(chunk)
            digest.update(chunk)
    return size, digest.hexdigest()


def _canonical_manifest(records: list[dict[str, Any]], bucket: str) -> bytes:
    return (json.dumps(
        {"format": FORMAT, "bucket": bucket, "objects": records},
        ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ) + "\n").encode("utf-8")


def create_archive(inventory: list[dict[str, Any]], source_root: Path, archive_path: Path,
                   *, bucket: str = "pfss-scout-private",
                   max_objects: int = DEFAULT_MAX_OBJECTS,
                   max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES) -> dict[str, Any]:
    if bucket != "pfss-scout-private":
        raise ArchiveError("Unexpected private Storage bucket.")
    if not isinstance(inventory, list) or len(inventory) > max_objects:
        raise ArchiveError("Inventory is invalid or exceeds the object limit.")
    root = source_root.resolve(strict=True)
    if not root.is_dir() or root.is_symlink():
        raise ArchiveError("Source root must be a real directory.")
    seen: set[str] = set()
    records: list[dict[str, Any]] = []
    total = 0
    for item in inventory:
        if not isinstance(item, dict):
            raise ArchiveError("Inventory entry is malformed.")
        name = _safe_path(item.get("path"))
        if name in seen:
            raise ArchiveError("Duplicate inventory path.")
        seen.add(name)
        rel = PurePosixPath(name)
        current = root
        for part in rel.parts:
            current = current / part
            if current.is_symlink():
                raise ArchiveError("Symbolic links are not allowed in Storage archives.")
        file_path = current.resolve(strict=True)
        if not file_path.is_relative_to(root) or not file_path.is_file():
            raise ArchiveError("Inventory object is missing or escapes the source root.")
        size, digest = _hash_file(file_path)
        expected_size = item.get("size")
        if isinstance(expected_size, bool) or not isinstance(expected_size, int) or expected_size != size:
            raise ArchiveError("Local object size does not match the inventory.")
        mime_type = item.get("mime_type")
        if mime_type is not None and not isinstance(mime_type, str):
            raise ArchiveError("Invalid MIME type in inventory.")
        total += size
        if total > max_total_bytes:
            raise ArchiveError("Storage archive exceeds the total byte limit.")
        records.append({"path": name, "size": size, "mime_type": mime_type, "sha256": digest})
    records.sort(key=lambda row: row["path"])
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    manifest = _canonical_manifest(records, bucket)
    # Write to a sibling temporary file and atomically replace the destination.
    fd, temp_name = tempfile.mkstemp(prefix=".pfms-storage-", dir=str(archive_path.parent))
    os.close(fd)
    try:
        with tarfile.open(temp_name, "w", format=tarfile.USTAR_FORMAT) as tar:
            info = tarfile.TarInfo(MANIFEST_NAME)
            info.size, info.mode, info.mtime = len(manifest), 0o600, 0
            import io
            tar.addfile(info, io.BytesIO(manifest))
            for row in records:
                file_path = root.joinpath(*PurePosixPath(row["path"]).parts)
                info = tarfile.TarInfo("objects/" + row["path"])
                info.size, info.mode, info.mtime = row["size"], 0o600, 0
                with file_path.open("rb") as stream:
                    tar.addfile(info, stream)
        os.replace(temp_name, archive_path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    return {"object_count": len(records), "total_bytes": total,
            "manifest_sha256": hashlib.sha256(manifest).hexdigest()}


def _inspect(archive_path: Path, *, max_objects: int, max_total_bytes: int):
    if not archive_path.is_file() or archive_path.is_symlink():
        raise ArchiveError("Archive file is missing or unsafe.")
    try:
        tar = tarfile.open(archive_path, "r:")
    except (tarfile.TarError, OSError):
        raise ArchiveError("Storage archive is not a valid uncompressed tar.") from None
    try:
        members = tar.getmembers()
        if not members or members[0].name != MANIFEST_NAME or not members[0].isfile():
            raise ArchiveError("Storage archive manifest is missing or not first.")
        manifest_stream = tar.extractfile(members[0])
        if manifest_stream is None:
            raise ArchiveError("Storage archive manifest cannot be read.")
        manifest_bytes = manifest_stream.read(16 * 1024 * 1024 + 1)
        if len(manifest_bytes) > 16 * 1024 * 1024:
            raise ArchiveError("Storage archive manifest is too large.")
        try:
            manifest = json.loads(manifest_bytes)
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise ArchiveError("Storage archive manifest is malformed.") from None
        if not isinstance(manifest, dict) or manifest.get("format") != FORMAT or manifest.get("bucket") != "pfss-scout-private":
            raise ArchiveError("Unsupported Storage archive format or bucket.")
        records = manifest.get("objects")
        if not isinstance(records, list) or len(records) > max_objects:
            raise ArchiveError("Storage archive object count is invalid.")
        expected: dict[str, dict[str, Any]] = {}
        total = 0
        for row in records:
            if not isinstance(row, dict):
                raise ArchiveError("Storage manifest entry is malformed.")
            name = _safe_path(row.get("path"))
            size, digest, mime = row.get("size"), row.get("sha256"), row.get("mime_type")
            if name in expected or isinstance(size, bool) or not isinstance(size, int) or size < 0:
                raise ArchiveError("Storage manifest has duplicate paths or invalid sizes.")
            if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
                raise ArchiveError("Storage manifest SHA-256 is invalid.")
            if mime is not None and not isinstance(mime, str):
                raise ArchiveError("Storage manifest MIME type is invalid.")
            total += size
            if total > max_total_bytes:
                raise ArchiveError("Storage archive exceeds the total byte limit.")
            expected[name] = row
        actual: dict[str, tarfile.TarInfo] = {}
        for member in members[1:]:
            if not member.isfile() or not member.name.startswith("objects/"):
                raise ArchiveError("Archive contains a non-regular or unexpected entry.")
            name = _safe_path(member.name[len("objects/"):])
            if name in actual or name not in expected or member.size != expected[name]["size"]:
                raise ArchiveError("Archive entries do not match the manifest.")
            actual[name] = member
        if set(actual) != set(expected):
            raise ArchiveError("Archive is missing or contains unexpected objects.")
        for name, member in actual.items():
            stream = tar.extractfile(member)
            if stream is None:
                raise ArchiveError("Archive object cannot be read.")
            digest = hashlib.sha256()
            read_size = 0
            for chunk in iter(lambda: stream.read(CHUNK), b""):
                read_size += len(chunk)
                digest.update(chunk)
            row = expected[name]
            if read_size != row["size"] or digest.hexdigest() != row["sha256"]:
                raise ArchiveError("Storage object size or SHA-256 verification failed.")
        return tar, manifest, total
    except Exception:
        tar.close()
        raise


def verify_archive(archive_path: Path, *, max_objects: int = DEFAULT_MAX_OBJECTS,
                   max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES) -> dict[str, Any]:
    tar, manifest, total = _inspect(archive_path, max_objects=max_objects, max_total_bytes=max_total_bytes)
    try:
        raw = _canonical_manifest(manifest["objects"], manifest["bucket"])
        return {"object_count": len(manifest["objects"]), "total_bytes": total,
                "manifest_sha256": hashlib.sha256(raw).hexdigest()}
    finally:
        tar.close()


def restore_archive(archive_path: Path, destination: Path, *,
                    max_objects: int = DEFAULT_MAX_OBJECTS,
                    max_total_bytes: int = DEFAULT_MAX_TOTAL_BYTES) -> dict[str, Any]:
    tar, manifest, total = _inspect(archive_path, max_objects=max_objects, max_total_bytes=max_total_bytes)
    try:
        destination.mkdir(parents=True, exist_ok=True)
        if any(destination.iterdir()):
            raise ArchiveError("Restore destination must be empty; overwrite is forbidden.")
        root = destination.resolve(strict=True)
        members = {m.name[len("objects/"):]: m for m in tar.getmembers()[1:]}
        for row in manifest["objects"]:
            name = _safe_path(row["path"])
            target = root.joinpath(*PurePosixPath(name).parts)
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.resolve().is_relative_to(root) or target.exists() or target.is_symlink():
                raise ArchiveError("Restore path conflict or traversal detected.")
            stream = tar.extractfile(members[name])
            if stream is None:
                raise ArchiveError("Restore object cannot be read.")
            with target.open("xb") as output:
                while True:
                    chunk = stream.read(CHUNK)
                    if not chunk:
                        break
                    output.write(chunk)
        return {"object_count": len(manifest["objects"]), "total_bytes": total}
    finally:
        tar.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    verify = sub.add_parser("verify")
    verify.add_argument("archive", type=Path)
    restore = sub.add_parser("restore")
    restore.add_argument("archive", type=Path)
    restore.add_argument("destination", type=Path)
    args = parser.parse_args()
    result = verify_archive(args.archive) if args.command == "verify" else restore_archive(args.archive, args.destination)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
