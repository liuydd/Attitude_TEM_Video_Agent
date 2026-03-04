"""Thread-safe JSON file store for local metadata persistence."""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any


class JsonFileStore:
    """Simple JSON file CRUD with a per-store threading lock."""

    def __init__(self) -> None:
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # List-based files  (experiments.json, participants.json)
    # ------------------------------------------------------------------

    def load_all(self, path: Path) -> list[dict[str, Any]]:
        with self._lock:
            if not path.exists():
                return []
            return json.loads(path.read_text(encoding="utf-8"))

    def save_all(self, path: Path, items: list[dict[str, Any]]) -> None:
        with self._lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(items, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )

    def append_item(self, path: Path, item: dict[str, Any]) -> None:
        with self._lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            items: list[dict[str, Any]] = []
            if path.exists():
                items = json.loads(path.read_text(encoding="utf-8"))
            items.append(item)
            path.write_text(
                json.dumps(items, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )

    # ------------------------------------------------------------------
    # Single-object files  (sessions/{id}.json)
    # ------------------------------------------------------------------

    def load_one(self, path: Path) -> dict[str, Any] | None:
        with self._lock:
            if not path.exists():
                return None
            return json.loads(path.read_text(encoding="utf-8"))

    def save_one(self, path: Path, item: dict[str, Any]) -> None:
        with self._lock:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(item, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def find_by_field(items: list[dict[str, Any]], field: str, value: Any) -> dict[str, Any] | None:
        for item in items:
            if item.get(field) == value:
                return item
        return None


store = JsonFileStore()
