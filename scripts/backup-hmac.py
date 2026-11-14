#!/usr/bin/env python3
"""Create or verify an HMAC-SHA-256 manifest for an encrypted PFMS database backup."""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import sys
from pathlib import Path

DOMAIN = b"PFSS-R2-BACKUP-HMAC-v1"
ITERATIONS = 600_000
CHUNK_SIZE = 1024 * 1024
MANIFEST_SUFFIX = ".hmac"


def derive_key() -> bytes:
    passphrase = os.environ.get("PFSS_BACKUP_ENCRYPTION_PASSPHRASE", "")
    if len(passphrase) < 24:
        raise SystemExit(
            "PFSS_BACKUP_ENCRYPTION_PASSPHRASE is missing or too short; "
            "use a high-entropy secret of at least 24 characters."
        )
    return hashlib.pbkdf2_hmac(
        "sha256",
        passphrase.encode("utf-8"),
        DOMAIN,
        ITERATIONS,
        dklen=32,
    )


def calculate_digest(archive: Path, key: bytes) -> str:
    digest = hmac.new(key, digestmod=hashlib.sha256)
    with archive.open("rb") as source:
        for chunk in iter(lambda: source.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_manifest(archive: Path) -> Path:
    if not archive.is_file() or archive.stat().st_size == 0:
        raise SystemExit(f"Backup archive is missing or empty: {archive}")
    manifest = Path(str(archive) + MANIFEST_SUFFIX)
    digest = calculate_digest(archive, derive_key())
    manifest.write_text(digest + "\n", encoding="ascii")
    return manifest


def verify_manifest(archive: Path, manifest: Path) -> None:
    if not archive.is_file() or archive.stat().st_size == 0:
        raise SystemExit(f"Backup archive is missing or empty: {archive}")
    if not manifest.is_file():
        raise SystemExit(f"Backup HMAC manifest is missing: {manifest}")

    expected = manifest.read_text(encoding="ascii").strip()
    if not re.fullmatch(r"[0-9a-f]{64}", expected):
        raise SystemExit("Backup HMAC manifest has an invalid format.")

    actual = calculate_digest(archive, derive_key())
    if not hmac.compare_digest(actual, expected):
        raise SystemExit("Backup HMAC verification failed; refusing to decrypt.")

    print("Backup HMAC verification passed.")


def main(argv: list[str]) -> int:
    if len(argv) not in (3, 4):
        raise SystemExit(
            "Usage: backup-hmac.py create ARCHIVE | "
            "backup-hmac.py verify ARCHIVE MANIFEST"
        )

    command = argv[1]
    archive = Path(argv[2])

    if command == "create" and len(argv) == 3:
        manifest = create_manifest(archive)
        print(f"Backup HMAC manifest created: {manifest.name}")
        return 0

    if command == "verify" and len(argv) == 4:
        verify_manifest(archive, Path(argv[3]))
        return 0

    raise SystemExit(
        "Usage: backup-hmac.py create ARCHIVE | "
        "backup-hmac.py verify ARCHIVE MANIFEST"
    )


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
