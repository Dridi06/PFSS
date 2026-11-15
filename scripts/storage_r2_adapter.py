"""Explicit, injected AWS CLI transport for encrypted PFMS Storage archives.

This module never discovers credentials or starts a process by itself. Callers
must inject a runner and explicit R2 configuration. Tests use a fake runner.
"""
from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from pathlib import Path
from urllib.parse import urlsplit

BUCKET_PREFIX = "storage/daily/"
_NAME = re.compile(r"^pfms-storage-[0-9]{8}T[0-9]{6}Z-[A-Za-z0-9_-]{6,40}\.tar\.enc$")
_BUCKET = re.compile(r"^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$")
_R2_HOST = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.r2\.cloudflarestorage\.com$")


class R2TransportError(RuntimeError):
    pass


Runner = Callable[[list[str], Mapping[str, str]], object]


def _config(endpoint: str, bucket: str, access_key: str, secret_key: str) -> tuple[str, str, dict[str, str]]:
    if not isinstance(endpoint, str) or not endpoint or endpoint != endpoint.strip():
        raise R2TransportError("R2 endpoint must be a canonical HTTPS origin.")
    try:
        parsed = urlsplit(endpoint)
        port = parsed.port
    except ValueError:
        raise R2TransportError("R2 endpoint must be a canonical HTTPS origin.") from None
    hostname = parsed.hostname
    if (parsed.scheme != "https" or not hostname or not _R2_HOST.fullmatch(hostname)
            or parsed.username is not None or parsed.password is not None
            or parsed.query or parsed.fragment or parsed.path not in ("", "/")
            or port not in (None, 443)):
        raise R2TransportError("R2 endpoint must be a canonical Cloudflare R2 HTTPS origin.")
    if not isinstance(bucket, str) or not _BUCKET.fullmatch(bucket):
        raise R2TransportError("Invalid R2 bucket name.")
    if not isinstance(access_key, str) or not access_key or not isinstance(secret_key, str) or not secret_key:
        raise R2TransportError("Explicit R2 credentials are required.")
    return f"https://{hostname}", bucket, {
        "AWS_ACCESS_KEY_ID": access_key,
        "AWS_SECRET_ACCESS_KEY": secret_key,
        "AWS_EC2_METADATA_DISABLED": "true",
    }


def _key(filename: str) -> str:
    if not isinstance(filename, str) or not _NAME.fullmatch(filename):
        raise R2TransportError("Storage backup filename must contain a UTC timestamp and unique run suffix.")
    return BUCKET_PREFIX + filename


def _invoke(runner: Runner, args: list[str], env: Mapping[str, str]) -> object:
    if not callable(runner):
        raise R2TransportError("An explicit AWS CLI runner is required.")
    try:
        return runner(args, env)
    except Exception:
        raise R2TransportError("R2 transport command failed; command output suppressed.") from None


def _returncode(result: object) -> int:
    code = getattr(result, "returncode", None)
    if isinstance(code, bool) or not isinstance(code, int):
        raise R2TransportError("AWS CLI runner returned an invalid result.")
    return code


def upload_encrypted_pair(*, endpoint: str, bucket: str, access_key: str,
                          secret_key: str, encrypted_file: Path, runner: Runner) -> dict[str, str]:
    """Upload ciphertext and detached HMAC; HEAD checks are existence checks only.

    The timestamp/run suffix must be unique. HEAD followed by PUT is not an
    atomic no-overwrite guarantee; bucket versioning/retention is an external
    operational control and concurrent writers must be prevented.
    """
    endpoint, bucket, env = _config(endpoint, bucket, access_key, secret_key)
    if not isinstance(encrypted_file, Path) or encrypted_file.is_symlink() or not encrypted_file.is_file():
        raise R2TransportError("Encrypted archive file is missing or unsafe.")
    filename = encrypted_file.name
    key = _key(filename)
    manifest = Path(str(encrypted_file) + ".hmac")
    if manifest.is_symlink() or not manifest.is_file() or manifest.stat().st_size == 0:
        raise R2TransportError("Detached HMAC manifest is missing or unsafe.")
    if encrypted_file.stat().st_size == 0:
        raise R2TransportError("Encrypted archive is empty.")
    for object_key in (key, key + ".hmac"):
        head = _invoke(runner, ["aws", "s3api", "head-object", "--bucket", bucket,
                                "--key", object_key, "--endpoint-url", endpoint, "--region", "auto"], env)
        head_code = _returncode(head)
        if head_code == 0:
            raise R2TransportError("R2 object already exists; refusing to upload.")
        # A generic nonzero exit can mean 403, network failure, or 404.
        # Proceed only when the injected runner positively identifies NotFound.
        if getattr(head, "not_found", False) is not True:
            raise R2TransportError("R2 preflight could not prove the object is absent.")
    for source, object_key in ((encrypted_file, key), (manifest, key + ".hmac")):
        result = _invoke(runner, ["aws", "s3", "cp", str(source), f"s3://{bucket}/{object_key}",
                                  "--endpoint-url", endpoint, "--region", "auto",
                                  "--only-show-errors"], env)
        if _returncode(result) != 0:
            raise R2TransportError("R2 upload failed; command output suppressed.")
    for object_key in (key, key + ".hmac"):
        result = _invoke(runner, ["aws", "s3api", "head-object", "--bucket", bucket,
                                  "--key", object_key, "--endpoint-url", endpoint, "--region", "auto"], env)
        if _returncode(result) != 0:
            raise R2TransportError("R2 upload existence check failed.")
    return {"key": key, "hmac_key": key + ".hmac"}


def download_encrypted_pair(*, endpoint: str, bucket: str, access_key: str,
                             secret_key: str, filename: str, destination: Path,
                             runner: Runner) -> tuple[Path, Path]:
    """Download ciphertext/HMAC to new local paths; never overwrite."""
    endpoint, bucket, env = _config(endpoint, bucket, access_key, secret_key)
    key = _key(filename)
    if not isinstance(destination, Path) or destination.exists() or destination.is_symlink():
        raise R2TransportError("Download destination must not already exist.")
    destination.mkdir(parents=True, exist_ok=True)
    encrypted = destination / filename
    manifest = destination / (filename + ".hmac")
    for object_key, target in ((key, encrypted), (key + ".hmac", manifest)):
        result = _invoke(runner, ["aws", "s3", "cp", f"s3://{bucket}/{object_key}", str(target),
                                  "--endpoint-url", endpoint, "--region", "auto",
                                  "--only-show-errors"], env)
        if _returncode(result) != 0 or not target.is_file() or target.is_symlink() or target.stat().st_size == 0:
            raise R2TransportError("R2 download failed or returned an empty file.")
    return encrypted, manifest
