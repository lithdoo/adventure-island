#!/usr/bin/env python3
"""Validate the machine-readable contract of a task/dev design document."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import PurePosixPath

REQUIRED_SECTIONS = (
    "Goal",
    "Context",
    "Allowed Paths",
    "Non-goals",
    "Requirements",
    "Acceptance Criteria",
    "Validation",
)

ALWAYS_FORBIDDEN_PREFIXES = (
    ".github",
    "loom-realm",
    "task/dev",
    ".raw",
    ".work",
)


def split_sections(text: str) -> dict[str, str]:
    matches = list(re.finditer(r"(?m)^##\s+(.+?)\s*$", text))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        name = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        sections[name] = text[start:end].strip()
    return sections


def parse_bullets(body: str) -> list[str]:
    values: list[str] = []
    for line in body.splitlines():
        match = re.match(r"^\s*[-*]\s+(.+?)\s*$", line)
        if not match:
            continue
        value = match.group(1).strip()
        if value.startswith("`") and value.endswith("`") and len(value) >= 2:
            value = value[1:-1]
        values.append(value)
    return values


def validate_allowed_pattern(pattern: str) -> str | None:
    if not pattern:
        return "empty allowed path"
    if pattern.startswith("/") or pattern.startswith("~"):
        return f"absolute/home path is not allowed: {pattern}"
    if pattern.startswith("!"):
        return f"negated patterns are not allowed: {pattern}"
    if "\\" in pattern:
        return f"use POSIX paths, not backslashes: {pattern}"

    parts = PurePosixPath(pattern).parts
    if ".." in parts:
        return f"parent traversal is not allowed: {pattern}"

    normalized = pattern.rstrip("/")
    for prefix in ALWAYS_FORBIDDEN_PREFIXES:
        if (
            normalized == prefix
            or normalized.startswith(prefix + "/")
            or normalized.startswith(prefix + "*")
        ):
            return f"glob overlaps always-forbidden path {prefix!r}: {pattern}"
    return None


def parse_spec(text: str) -> tuple[dict[str, str], list[str]]:
    if not re.search(r"(?m)^#\s+\S", text):
        raise ValueError("missing level-1 task title")

    sections = split_sections(text)
    missing = [name for name in REQUIRED_SECTIONS if not sections.get(name)]
    if missing:
        raise ValueError("missing or empty required sections: " + ", ".join(missing))

    allowed = parse_bullets(sections["Allowed Paths"])
    if not allowed:
        raise ValueError("Allowed Paths must contain at least one bullet glob")

    errors = [err for pattern in allowed if (err := validate_allowed_pattern(pattern))]
    if errors:
        raise ValueError("; ".join(errors))

    criteria = parse_bullets(sections["Acceptance Criteria"])
    if not criteria:
        raise ValueError("Acceptance Criteria must contain at least one bullet")

    requirements = parse_bullets(sections["Requirements"])
    if not requirements:
        raise ValueError("Requirements must contain at least one bullet")

    return sections, allowed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("spec")
    args = parser.parse_args()

    try:
        text = open(args.spec, "r", encoding="utf-8").read()
        _, allowed = parse_spec(text)
    except (OSError, ValueError) as exc:
        print(f"spec validation failed: {exc}", file=sys.stderr)
        return 1

    print("spec validation passed")
    for pattern in allowed:
        print(f"  allowed: {pattern}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
