#!/usr/bin/env python3
"""Verify that an agent implementation stays inside its declared filesystem policy."""

from __future__ import annotations

import argparse
import fnmatch
import os
import subprocess
import sys

from validate_spec import parse_spec

ALWAYS_FORBIDDEN_PREFIXES = (
    ".github/",
    "loom-realm",
    "task/dev/",
    "scripts/agent/",
    ".raw/",
    ".work/",
)

FORBIDDEN_EXTENSIONS = (
    ".wz",
    ".exe",
    ".dll",
    ".sys",
    ".zip",
    ".rar",
    ".7z",
    ".dmp",
    ".dump",
    ".mdmp",
)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def changed_paths() -> list[str]:
    tracked = set(filter(None, git("diff", "--name-only", "HEAD", "--").splitlines()))
    untracked = set(
        filter(None, git("ls-files", "--others", "--exclude-standard").splitlines())
    )
    return sorted(tracked | untracked)


def forbidden_reason(path: str) -> str | None:
    normalized = path.replace("\\", "/")
    for prefix in ALWAYS_FORBIDDEN_PREFIXES:
        if normalized == prefix.rstrip("/") or normalized.startswith(prefix):
            return f"always-forbidden path: {prefix}"

    lower = normalized.lower()
    for extension in FORBIDDEN_EXTENSIONS:
        if lower.endswith(extension):
            return f"forbidden binary/archive extension: {extension}"

    if os.path.islink(path):
        return "symbolic links are not allowed in agent output"
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    args = parser.parse_args()

    try:
        spec = open(args.spec, "r", encoding="utf-8").read()
        _, allowed = parse_spec(spec)
    except (OSError, ValueError) as exc:
        print(f"cannot validate implementation: {exc}", file=sys.stderr)
        return 1

    paths = changed_paths()
    if not paths:
        print("agent produced no repository changes", file=sys.stderr)
        return 1

    errors: list[str] = []
    for path in paths:
        if reason := forbidden_reason(path):
            errors.append(f"{path}: {reason}")
            continue
        if not any(fnmatch.fnmatchcase(path, pattern) for pattern in allowed):
            errors.append(f"{path}: not matched by Allowed Paths")

    if errors:
        print("agent diff rejected:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1

    print("agent diff policy passed")
    for path in paths:
        print(f"  changed: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
