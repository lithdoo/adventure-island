#!/usr/bin/env python3
"""Finalize an agent turn result after deterministic repository verification."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def git_lines(*args: str) -> list[str]:
    result = subprocess.run(["git", *args], check=True, text=True, capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


def changed_paths() -> list[str]:
    paths = set(git_lines("diff", "--name-only", "HEAD", "--"))
    paths.update(git_lines("ls-files", "--others", "--exclude-standard"))
    return sorted(paths)


def read_text_tail(path: str | None, limit: int = 6000) -> str:
    if not path:
        return ""
    source = Path(path)
    if not source.exists():
        return ""
    text = source.read_text(encoding="utf-8", errors="replace").strip()
    return text[-limit:]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-result", required=True)
    parser.add_argument("--verification", choices=("passed", "failed", "skipped"), required=True)
    parser.add_argument("--verification-log")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source = Path(args.run_result)
    if source.exists():
        try:
            result = json.loads(source.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            result = {}
    else:
        result = {}

    result.setdefault("protocolVersion", 1)
    result.setdefault("runtimeStatus", "failed")
    result.setdefault("runtimeExitCode", 1)
    result.setdefault("sessionId", None)
    result.setdefault("sessionContinuity", "unknown")
    result.setdefault("turn", None)
    result.setdefault(
        "finalResponse",
        "OpenCode did not produce a recoverable final response. Inspect the workflow run for infrastructure diagnostics.",
    )

    paths = changed_paths()
    has_changes = bool(paths)
    result["hasChanges"] = has_changes
    result["changedFiles"] = paths
    result["verification"] = args.verification
    result["verificationOutput"] = read_text_tail(args.verification_log)

    if result.get("runtimeStatus") != "completed" or int(result.get("runtimeExitCode") or 0) != 0:
        status = "runtime_failed"
    elif not has_changes:
        status = "no_changes"
    elif args.verification == "passed":
        status = "verified"
    else:
        status = "verify_failed"

    result["status"] = status
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": status, "hasChanges": has_changes, "changedFiles": paths}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
