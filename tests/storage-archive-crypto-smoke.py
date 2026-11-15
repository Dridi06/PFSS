#!/usr/bin/env python3
"""Offline tests for Storage archive encryption and authenticate-before-decrypt."""
from __future__ import annotations
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import storage_archive_crypto as crypto

PASSPHRASE = "PFMS-offline-storage-test-passphrase-2026"


def expect_error(fn):
    try:
        fn()
    except crypto.CryptoError:
        return
    raise AssertionError("Unsafe crypto operation was accepted.")


def main():
    if subprocess.run(["openssl", "version"], capture_output=True).returncode:
        raise SystemExit("OpenSSL is required for Storage crypto tests.")
    with tempfile.TemporaryDirectory(prefix="pfms-storage-crypto-") as tmp:
        root = Path(tmp)
        plain = root / "source.tar"
        plain.write_bytes(b"PFMS storage archive test payload\x00" * 200)
        encrypted = root / "backup.tar.enc"
        decrypted = root / "decrypted.tar"
        env = {"PFSS_BACKUP_ENCRYPTION_PASSPHRASE": PASSPHRASE}
        old = os.environ.get("PFSS_BACKUP_ENCRYPTION_PASSPHRASE")
        os.environ.update(env)
        try:
            hmac_path = crypto.encrypt_archive(plain, encrypted)
            assert encrypted.is_file() and hmac_path.is_file()
            crypto.decrypt_archive(encrypted, hmac_path, decrypted)
            assert decrypted.read_bytes() == plain.read_bytes()
            expect_error(lambda: crypto.encrypt_archive(plain, encrypted))
            expect_error(lambda: crypto.decrypt_archive(encrypted, hmac_path, decrypted))
            bad = root / "tampered.enc"
            bad.write_bytes(encrypted.read_bytes() + b"x")
            expect_error(lambda: crypto.decrypt_archive(bad, hmac_path, root / "must-not-exist.tar"))
            assert not (root / "must-not-exist.tar").exists()
            wrong_manifest = root / "wrong.hmac"
            wrong_manifest.write_text("0" * 64 + "\n", encoding="ascii")
            expect_error(lambda: crypto.decrypt_archive(encrypted, wrong_manifest, root / "also-not-created.tar"))
            assert not (root / "also-not-created.tar").exists()
        finally:
            if old is None:
                os.environ.pop("PFSS_BACKUP_ENCRYPTION_PASSPHRASE", None)
            else:
                os.environ["PFSS_BACKUP_ENCRYPTION_PASSPHRASE"] = old
    print("PFMS Storage crypto tests passed: AES-256-CBC, HMAC-before-decrypt, tampering and no-overwrite; no network.")


if __name__ == "__main__":
    main()
