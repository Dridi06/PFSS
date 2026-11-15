#!/usr/bin/env python3
"""Encrypt/decrypt PFMS Storage archives with the existing AES-256-CBC + HMAC scheme.

OpenSSL is invoked without a shell. HMAC is verified before decryption.
This utility is local-only and has no Supabase/R2/network integration.
"""
from __future__ import annotations
import argparse
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
HMAC_HELPER = ROOT / "scripts" / "backup-hmac.py"
ITERATIONS = "600000"


class CryptoError(RuntimeError):
    pass


def _secret_env() -> dict[str, str]:
    secret = os.environ.get("PFSS_BACKUP_ENCRYPTION_PASSPHRASE", "")
    if len(secret) < 24:
        raise CryptoError("PFSS_BACKUP_ENCRYPTION_PASSPHRASE is missing or too short.")
    return {"PFSS_BACKUP_ENCRYPTION_PASSPHRASE": secret}


def _run(args: list[str], env: dict[str, str]) -> None:
    result = subprocess.run(args, env={**os.environ, **env}, stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        raise CryptoError("OpenSSL or HMAC operation failed; sensitive command output suppressed.")


def encrypt_archive(source: Path, destination: Path) -> Path:
    if not source.is_file() or source.is_symlink() or source.stat().st_size == 0:
        raise CryptoError("Plaintext Storage archive is missing, empty or unsafe.")
    if destination.exists() or destination.is_symlink():
        raise CryptoError("Encrypted destination already exists; overwrite is forbidden.")
    env = _secret_env()
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".pfms-storage-encrypted-", dir=destination.parent)
    os.close(fd)
    temp = Path(temp_name)
    try:
        _run(["openssl", "enc", "-aes-256-cbc", "-salt", "-pbkdf2", "-iter", ITERATIONS,
              "-in", str(source), "-out", str(temp), "-pass", "env:PFSS_BACKUP_ENCRYPTION_PASSPHRASE"], env)
        if not temp.is_file() or temp.stat().st_size == 0:
            raise CryptoError("Encrypted archive is empty.")
        # Reuse the established domain-separated HMAC implementation.
        _run([sys.executable, str(HMAC_HELPER), "create", str(temp)], env)
        manifest = Path(str(temp) + ".hmac")
        _run([sys.executable, str(HMAC_HELPER), "verify", str(temp), str(manifest)], env)
        os.replace(temp, destination)
        os.replace(manifest, Path(str(destination) + ".hmac"))
        return Path(str(destination) + ".hmac")
    finally:
        temp.unlink(missing_ok=True)
        Path(str(temp) + ".hmac").unlink(missing_ok=True)


def decrypt_archive(source: Path, manifest: Path, destination: Path) -> None:
    if not source.is_file() or source.is_symlink() or source.stat().st_size == 0:
        raise CryptoError("Encrypted Storage archive is missing, empty or unsafe.")
    if not manifest.is_file() or manifest.is_symlink():
        raise CryptoError("Encrypted Storage HMAC manifest is missing or unsafe.")
    if destination.exists() or destination.is_symlink():
        raise CryptoError("Decrypted destination already exists; overwrite is forbidden.")
    env = _secret_env()
    # Critical ordering: authenticate ciphertext before invoking OpenSSL decrypt.
    _run([sys.executable, str(HMAC_HELPER), "verify", str(source), str(manifest)], env)
    destination.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=".pfms-storage-plaintext-", dir=destination.parent)
    os.close(fd)
    temp = Path(temp_name)
    try:
        _run(["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", ITERATIONS,
              "-in", str(source), "-out", str(temp), "-pass", "env:PFSS_BACKUP_ENCRYPTION_PASSPHRASE"], env)
        if not temp.is_file() or temp.stat().st_size == 0:
            raise CryptoError("Decrypted Storage archive is empty.")
        os.replace(temp, destination)
    finally:
        temp.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    enc = sub.add_parser("encrypt")
    enc.add_argument("archive", type=Path)
    enc.add_argument("encrypted", type=Path)
    dec = sub.add_parser("decrypt")
    dec.add_argument("encrypted", type=Path)
    dec.add_argument("manifest", type=Path)
    dec.add_argument("archive", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "encrypt":
            hmac_path = encrypt_archive(args.archive, args.encrypted)
            print(f"Encrypted Storage archive and HMAC created: {args.encrypted.name}")
            return 0
        decrypt_archive(args.encrypted, args.manifest, args.archive)
        print(f"Authenticated Storage archive decrypted: {args.archive.name}")
        return 0
    except CryptoError as exc:
        raise SystemExit(str(exc)) from None


if __name__ == "__main__":
    raise SystemExit(main())
