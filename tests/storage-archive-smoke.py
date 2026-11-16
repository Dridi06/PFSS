#!/usr/bin/env python3
"""Offline tests for PFMS Storage archive integrity and isolated restore."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile
import tarfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("storage_archive", ROOT / "scripts" / "storage_archive.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def expect_error(fn):
    try:
        fn()
    except mod.ArchiveError:
        return
    raise AssertionError("Unsafe or invalid archive operation was accepted.")


def main():
    with tempfile.TemporaryDirectory(prefix="pfms-storage-archive-") as tmp:
        root = Path(tmp) / "source"
        root.mkdir()
        (root / "alice").mkdir()
        (root / "alice" / "photo.jpg").write_bytes(b"image-bytes")
        (root / "clip.mp4").write_bytes(b"video-bytes" * 100)
        inventory = [
            {"path": "alice/photo.jpg", "size": 11, "mime_type": "image/jpeg"},
            {"path": "clip.mp4", "size": 1100, "mime_type": "video/mp4"},
        ]
        archive = Path(tmp) / "storage.tar"
        summary = mod.create_archive(inventory, root, archive)
        assert summary["object_count"] == 2 and summary["total_bytes"] == 1111
        assert mod.verify_archive(archive) == summary
        target = Path(tmp) / "restored"
        restored = mod.restore_archive(archive, target)
        assert restored == {"object_count": 2, "total_bytes": 1111}
        assert (target / "alice" / "photo.jpg").read_bytes() == b"image-bytes"
        assert (target / "clip.mp4").read_bytes() == b"video-bytes" * 100
        expect_error(lambda: mod.restore_archive(archive, target))
        expect_error(lambda: mod.create_archive([{"path": "../escape", "size": 1}], root, archive))
        expect_error(lambda: mod.create_archive([{"path": "alice/photo.jpg", "size": 10}], root, archive))
        expect_error(lambda: mod.create_archive(inventory + [inventory[0]], root, archive))
        expect_error(lambda: mod.create_archive(inventory, root, archive, max_total_bytes=100))
        expect_error(lambda: mod.verify_archive(archive, max_objects=1))

        # Ciphertext-independent archive tampering must be detected before restore.
        tampered = Path(tmp) / "tampered.tar"
        with tarfile.open(archive, "r:") as src, tarfile.open(tampered, "w") as dst:
            for member in src.getmembers():
                stream = src.extractfile(member)
                data = stream.read() if stream else b""
                if member.name == "objects/clip.mp4":
                    data = b"X" * len(data)
                info = tarfile.TarInfo(member.name)
                info.size, info.mode, info.mtime = len(data), 0o600, 0
                import io
                dst.addfile(info, io.BytesIO(data))
        expect_error(lambda: mod.verify_archive(tampered))
        assert not (Path(tmp) / "unsafe-target").exists() or not any((Path(tmp) / "unsafe-target").iterdir())

        empty = Path(tmp) / "empty.tar"
        empty_summary = mod.create_archive([], root, empty)
        assert empty_summary["object_count"] == 0 and mod.verify_archive(empty) == empty_summary

    print("PFMS Storage archive tests passed: deterministic package, integrity, traversal guards, limits, empty inventory and no-overwrite restore; no network.")


if __name__ == "__main__":
    main()
