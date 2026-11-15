#!/usr/bin/env python3
"""Offline tests for the injected Supabase Storage listing adapter."""
from __future__ import annotations

import base64
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    import sys
    if str(ROOT / "scripts") not in sys.path:
        sys.path.insert(0, str(ROOT / "scripts"))
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

core = load("storage_inventory", "scripts/storage_inventory.py")
adapter = load("storage_supabase_adapter", "scripts/storage_supabase_adapter.py")
Error = core.InventoryError

def jwt(role):
    payload = base64.urlsafe_b64encode(json.dumps({"role": role}).encode()).decode().rstrip("=")
    return "header." + payload + ".signature"

def main():
    calls = []
    def fake_post(url, headers, body):
        calls.append((url, headers, body))
        return [{"name": "photo.jpg", "id": "obj1", "metadata": {"size": 5}}]

    fetch = adapter.create_storage_page_fetcher(
        project_url="https://abcdefghijklmnopqrst.supabase.co",
        project_ref="abcdefghijklmnopqrst",
        bucket="pfss-scout-private",
        publishable_key="anon-key",
        user_access_token=jwt("authenticated"),
        post_json=fake_post,
    )
    rows = fetch("user-1/", 50, 100)
    assert rows[0]["name"] == "photo.jpg"
    url, headers, body = calls[0]
    assert url.endswith("/storage/v1/object/list/pfss-scout-private")
    assert headers["apikey"] == "anon-key"
    assert headers["Authorization"].startswith("Bearer ")
    assert body == {"prefix": "user-1/", "limit": 50, "offset": 100,
                    "sortBy": {"column": "name", "order": "asc"}}

    def reject(**kwargs):
        try:
            adapter.create_storage_page_fetcher(post_json=fake_post, **kwargs)
        except Error:
            return
        raise AssertionError("Unsafe adapter configuration accepted.")

    base = dict(project_url="https://abcdefghijklmnopqrst.supabase.co",
                project_ref="abcdefghijklmnopqrst", bucket="pfss-scout-private",
                publishable_key="anon-key", user_access_token=jwt("authenticated"))
    reject(**{**base, "project_url": "https://wrong.supabase.co"})
    reject(**{**base, "bucket": "another-bucket"})
    reject(**{**base, "publishable_key": jwt("service_role")})
    reject(**{**base, "user_access_token": jwt("service_role")})
    reject(**{**base, "user_access_token": "not-a-jwt"})

    before = len(calls)
    for prefix, limit, offset in [("../", 10, 0), ("/absolute", 10, 0),
                                  ("ok/", 0, 0), ("ok/", 10, -1)]:
        try:
            fetch(prefix, limit, offset)
        except Error:
            pass
        else:
            raise AssertionError("Invalid listing arguments accepted.")
    assert len(calls) == before
    print("PFMS Storage adapter tests passed: request shape, staging host, bucket, user JWT guard and offline transport.")

if __name__ == "__main__":
    main()
