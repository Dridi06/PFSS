#!/usr/bin/env python3
"""Exercise the real PFMS backup HMAC helper, including tamper rejection."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "scripts" / "backup-hmac.py"
PASSPHRASE = "PFMS-test-only-passphrase-2026-11-14"


def run(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    return subprocess.run(
        [sys.executable, str(HELPER), *args],
        cwd=ROOT,
        env=merged,
        text=True,
        capture_output=True,
        check=False,
    )


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="pfms-backup-hmac-") as temp:
        archive = Path(temp) / "backup.dump.enc"
        manifest = Path(str(archive) + ".hmac")
        archive.write_bytes(os.urandom(8192))
        env = {"PFSS_BACKUP_ENCRYPTION_PASSPHRASE": PASSPHRASE}

        created = run("create", str(archive), env=env)
        assert created.returncode == 0, created.stderr
        assert manifest.is_file() and len(manifest.read_text(encoding="ascii").strip()) == 64

        verified = run("verify", str(archive), str(manifest), env=env)
        assert verified.returncode == 0, verified.stderr

        wrong_key = run(
            "verify",
            str(archive),
            str(manifest),
            env={"PFSS_BACKUP_ENCRYPTION_PASSPHRASE": "different-test-passphrase-2026"},
        )
        assert wrong_key.returncode != 0, "A different passphrase must not verify the HMAC."

        archive.write_bytes(archive.read_bytes() + b"tampered")
        tampered = run("verify", str(archive), str(manifest), env=env)
        assert tampered.returncode != 0, "Tampered ciphertext must be rejected."
        assert "refusing to decrypt" in tampered.stderr.lower()

        missing_secret = run("create", str(archive), env={"PFSS_BACKUP_ENCRYPTION_PASSPHRASE": ""})
        assert missing_secret.returncode != 0, "Missing backup passphrase must fail closed."

    print("PFMS backup HMAC tests passed: create, verify, wrong key, tampering and missing secret.")


if __name__ == "__main__":
    main()
