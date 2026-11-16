#!/usr/bin/env python3
"""Fail-closed, network-free preflight for PFMS staging Storage backups.

This tool deliberately performs no HTTP requests and reads no Storage objects.
It only validates explicit staging intent and prints a sanitized dry-run plan.
"""

from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlsplit

BUCKET = "pfss-scout-private"
PROJECT_REF_RE = re.compile(r"^[a-z0-9]{20}$")


def fail(message: str) -> "NoReturn":
    raise SystemExit("STAGING STORAGE PREFLIGHT BLOCKED: " + message)


def main(argv: list[str]) -> int:
    if argv[1:] != ["--dry-run"]:
        fail("only --dry-run is supported; network operations are not implemented.")

    if os.environ.get("PFMS_STORAGE_BACKUP_TARGET") != "staging":
        fail("PFMS_STORAGE_BACKUP_TARGET must be exactly 'staging'.")
    if os.environ.get("PFMS_STORAGE_BACKUP_ALLOW_STAGING") != "1":
        fail("PFMS_STORAGE_BACKUP_ALLOW_STAGING must be explicitly set to '1'.")

    project_ref = os.environ.get("PFMS_STAGING_PROJECT_REF", "")
    if not PROJECT_REF_RE.fullmatch(project_ref):
        fail("PFMS_STAGING_PROJECT_REF must be a 20-character lowercase alphanumeric project ref.")

    raw_url = os.environ.get("PFSS_SUPABASE_URL", "")
    try:
        parsed = urlsplit(raw_url)
        port = parsed.port
    except ValueError:
        fail("PFSS_SUPABASE_URL is malformed.")

    expected_host = project_ref + ".supabase.co"
    if (
        parsed.scheme != "https"
        or parsed.hostname != expected_host
        or parsed.username is not None
        or parsed.password is not None
        or port is not None
        or parsed.path not in ("", "/")
        or parsed.query
        or parsed.fragment
    ):
        fail("PFSS_SUPABASE_URL must be the canonical HTTPS URL for the declared staging project.")

    print("PFMS staging Storage preflight passed (dry-run only).")
    print("Target: staging")
    print("Project ref: " + project_ref)
    print("Supabase host: " + expected_host)
    print("Bucket to inventory later: " + BUCKET)
    print("Network access: none")
    print("Storage objects read or changed: none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
