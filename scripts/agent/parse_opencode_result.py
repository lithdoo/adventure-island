#!/usr/bin/env python3
"""Parse OpenCode V2 machine-readable output without depending on its DB schema.

The V2 JSON event stream is useful but not authoritative: some v2.0.x builds can
omit trailing events. The workflow therefore uses the event stream primarily to
identify the session and uses `opencode session export` to recover the final
assistant response after the run completes.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from datetime import datetime
from typing import Any, Iterable

SESSION_RE = re.compile(r"^ses_[A-Za-z0-9_-]+$")


def load_json(path: str) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def iter_json_lines(path: str) -> Iterable[dict[str, Any]]:
    source = Path(path)
    if not source.exists():
        return
    for raw in source.read_text(encoding="utf-8", errors="replace").splitlines():
        raw = raw.strip()
        if not raw:
            continue
        try:
            value = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            yield value


def session_id_from_events(path: str) -> str | None:
    candidate = None
    for event in iter_json_lines(path):
        for value in (
            event.get("sessionID"),
            event.get("sessionId"),
            event.get("session_id"),
            (event.get("part") or {}).get("sessionID") if isinstance(event.get("part"), dict) else None,
        ):
            if isinstance(value, str) and SESSION_RE.match(value):
                candidate = value
                break
        if candidate:
            break
    return candidate


def _walk(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk(child)


def session_id_from_list(path: str, title: str) -> str | None:
    try:
        data = load_json(path)
    except (OSError, json.JSONDecodeError):
        return None

    matches: list[tuple[float, str]] = []
    for obj in _walk(data):
        session_id = obj.get("id") or obj.get("sessionID") or obj.get("sessionId")
        if not isinstance(session_id, str) or not SESSION_RE.match(session_id):
            continue
        info = obj.get("info")
        obj_title = obj.get("title")
        if not obj_title and isinstance(info, dict):
            obj_title = info.get("title")
        if obj_title != title:
            continue
        stamp = 0.0
        for key in ("updated", "updatedAt", "timeUpdated", "created", "createdAt", "timeCreated"):
            value = obj.get(key)
            if isinstance(value, (int, float)):
                stamp = float(value)
                break
            if isinstance(value, str):
                try:
                    stamp = datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
                    break
                except ValueError:
                    pass
        time_obj = obj.get("time")
        if isinstance(time_obj, dict):
            for key in ("updated", "created"):
                value = time_obj.get(key)
                if isinstance(value, (int, float)):
                    stamp = max(stamp, float(value))
        matches.append((stamp, session_id))

    if not matches:
        return None
    matches.sort()
    return matches[-1][1]


def _assistant_message(obj: dict[str, Any]) -> bool:
    role = obj.get("role") or obj.get("type")
    info = obj.get("info")
    if isinstance(info, dict):
        role = info.get("role") or info.get("type") or role
    return role == "assistant"


def _texts_from_parts(parts: Any) -> list[str]:
    result: list[str] = []
    if not isinstance(parts, list):
        return result
    for part in parts:
        if not isinstance(part, dict):
            continue
        if part.get("type") == "text" and isinstance(part.get("text"), str):
            text = part["text"].strip()
            if text:
                result.append(text)
    return result


def final_response_from_export(path: str) -> str | None:
    try:
        data = load_json(path)
    except (OSError, json.JSONDecodeError):
        return None

    candidates: list[str] = []
    messages = data.get("messages") if isinstance(data, dict) else None
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict) or not _assistant_message(message):
                continue
            texts = _texts_from_parts(message.get("parts"))
            if not texts and isinstance(message.get("text"), str):
                texts = [message["text"].strip()]
            if texts:
                candidates.append("\n".join(texts).strip())

    if not candidates:
        for obj in _walk(data):
            if not _assistant_message(obj):
                continue
            texts = _texts_from_parts(obj.get("parts"))
            if not texts and isinstance(obj.get("text"), str):
                texts = [obj["text"].strip()]
            if texts:
                candidates.append("\n".join(texts).strip())

    return candidates[-1] if candidates else None


def final_response_from_events(path: str) -> str | None:
    order: list[str] = []
    groups: dict[str, list[str]] = {}
    anonymous: list[str] = []
    for event in iter_json_lines(path):
        part = event.get("part")
        if not isinstance(part, dict) or part.get("type") != "text":
            continue
        text = part.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        message_id = part.get("messageID") or part.get("messageId")
        if isinstance(message_id, str):
            if message_id not in groups:
                groups[message_id] = []
                order.append(message_id)
            groups[message_id].append(text.strip())
        else:
            anonymous.append(text.strip())

    if order:
        return "\n".join(groups[order[-1]]).strip()
    if anonymous:
        return anonymous[-1]
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    sid = sub.add_parser("session-id")
    sid.add_argument("--events", required=True)
    sid.add_argument("--sessions")
    sid.add_argument("--title")

    response = sub.add_parser("final-response")
    response.add_argument("--export", dest="export_path")
    response.add_argument("--events", required=True)

    args = parser.parse_args()

    if args.command == "session-id":
        value = session_id_from_events(args.events)
        if not value and args.sessions and args.title:
            value = session_id_from_list(args.sessions, args.title)
        if not value:
            return 1
        print(value)
        return 0

    value = None
    if args.export_path:
        value = final_response_from_export(args.export_path)
    if not value:
        value = final_response_from_events(args.events)
    if not value:
        return 1
    print(value)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
