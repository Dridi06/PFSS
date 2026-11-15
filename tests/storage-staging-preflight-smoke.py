#!/usr/bin/env python3
"""Regression tests for the network-free staging Storage preflight."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "storage-staging-preflight.py"
REF = "abcdefghijklmnopqrst"
BASE = {
    "PFMS_STORAGE_BACKUP_TARGET": "staging",
    "PFMS_STORAGE_BACKUP_ALLOW_STAGING": "1",
    "PFMS_STAGING_PROJECT_REF": REF,
    "PFSS_SUPABASE_URL": f"https://{REF}.supabase.co",
}


def run(overrides: dict[str, str] | None = None, args: tuple[str, ...] = ("--dry-run",)):
    env = {"PATH": os.environ.get("PATH", "")}
    env.update(BASE)
    if overrides:
        env.update(overrides)
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        cwd=ROOT,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def main() -> None:
    valid = run()
    assert valid.returncode == 0, valid.stderr
    assert "Network access: none" in valid.stdout
    assert "Storage objects read or changed: none" in valid.stdout
    assert REF in valid.stdout

    blocked = [
        ({"PFMS_STORAGE_BACKUP_TARGET": "production"}, "must be exactly 'staging'"),
        ({"PFMS_STORAGE_BACKUP_ALLOW_STAGING": "0"}, "explicitly set to '1'"),
        ({"PFMS_STAGING_PROJECT_REF": "ProductionProject123"}, "20-character lowercase"),
        ({"PFSS_SUPABASE_URL": "https://wrong.supabase.co"}, "canonical HTTPS URL"),
        ({"PFSS_SUPABASE_URL": "http://abcdefghijklmnopqrst.supabase.co"}, "canonical HTTPS URL"),
        ({"PFSS_SUPABASE_URL": "https://user:pass@abcdefghijklmnopqrst.supabase.co"}, "canonical HTTPS URL"),
        ({"PFSS_SUPABASE_URL": "https://abcdefghijklmnopqrst.supabase.co.evil.test"}, "canonical HTTPS URL"),
        ({"PFSS_SUPABASE_URL": "https://abcdefghijklmnopqrst.supabase.co/path"}, "canonical HTTPS URL"),
    ]
    for overrides, expected in blocked:
        result = run(overrides)
        assert result.returncode != 0, f"Unsafe config unexpectedly passed: {overrides}"
        assert expected in result.stderr, result.stderr

    no_dry_run = run(args=())
    assert no_dry_run.returncode != 0
    assert "only --dry-run is supported" in no_dry_run.stderr

    print("PFMS staging Storage preflight tests passed: explicit staging opt-in, canonical host, malformed/production targets blocked, no network.")


if __name__ == "__main__":
    main()
