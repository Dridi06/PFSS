#!/usr/bin/env python3
"""Offline tests for recursive, paginated Storage inventory traversal."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "storage_inventory", ROOT / "scripts" / "storage_inventory.py"
)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)
InventoryError = module.InventoryError
build_inventory = module.build_inventory


def main() -> None:
    calls: list[tuple[str, int, int]] = []
    fixtures = {
        ("", 0): [
            {"name": "alice", "id": None},
            {"name": "root.jpg", "id": "obj-root", "metadata": {"size": 10, "mimetype": "image/jpeg"}},
        ],
        ("alice/", 0): [
            {"name": "main", "id": None},
            {"name": "scout.png", "id": "obj-scout", "metadata": {"size": 20, "mimetype": "image/png"}},
        ],
        ("alice/main/", 0): [
            {"name": "cover.webp", "id": "obj-cover", "metadata": {"size": 30, "mimetype": "image/webp"}},
        ],
    }

    def fetch(prefix: str, limit: int, offset: int):
        calls.append((prefix, limit, offset))
        return fixtures.get((prefix, offset), [])

    result = build_inventory(fetch, page_size=2)
    assert [item["path"] for item in result] == [
        "alice/main/cover.webp",
        "alice/scout.png",
        "root.jpg",
    ]
    assert len(calls) == 5
    assert result[0]["size"] == 30

    # A full page must trigger the next offset; a short page ends pagination.
    pages = {
        ("", 0): [{"name": "a.bin", "id": "1"}, {"name": "b.bin", "id": "2"}],
        ("", 2): [{"name": "c.bin", "id": "3"}],
    }
    paged = build_inventory(
        lambda prefix, limit, offset: pages.get((prefix, offset), []),
        page_size=2,
    )
    assert len(paged) == 3

    def expect_error(fetcher, **kwargs):
        try:
            build_inventory(fetcher, **kwargs)
        except InventoryError:
            return
        raise AssertionError("Unsafe or incomplete listing was accepted.")

    expect_error(lambda *_: [{"name": "../escape", "id": "x"}])
    expect_error(lambda *_: [{"name": "folder/file", "id": "x"}])
    expect_error(lambda *_: [{"name": "bad", "id": "x", "metadata": {"size": -1}}])
    expect_error(lambda *_: [{"name": "a", "id": "same"}, {"name": "a", "id": "same"}])
    expect_error(lambda *_: [{"name": "x", "id": "x"}], page_size=0)

    print("PFMS Storage inventory core tests passed: recursion, pagination, sorting, path safety, duplicates and metadata validation; no network.")


if __name__ == "__main__":
    main()
