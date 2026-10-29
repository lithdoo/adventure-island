#!/usr/bin/env python3
"""Small GitHub REST helper used by the trusted agent workflows.

Only GitHub-hosted jobs receive repository write credentials. The self-hosted
OpenCode runner receives trusted artifacts and produces local result/patch
artifacts, but it never receives a GitHub write token.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


API = "https://api.github.com"
MAX_RESPONSE_CHARS = 12000
MAX_VERIFICATION_CHARS = 5000


def token() -> str:
    value = os.environ.get("GITHUB_TOKEN", "")
    if not value:
        raise RuntimeError("GITHUB_TOKEN is required for this operation")
    return value


def request(method: str, path: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        API + path,
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token()}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "adventure-island-agent",
        },
    )
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"GitHub API {exc.code} for {method} {path}: {body}") from exc
    return json.loads(raw) if raw else None


def request_all(path: str) -> list[Any]:
    items: list[Any] = []
    page = 1
    separator = "&" if "?" in path else "?"
    while True:
        batch = request("GET", f"{path}{separator}per_page=100&page={page}") or []
        if not isinstance(batch, list):
            raise RuntimeError(f"expected list response for {path}")
        items.extend(batch)
        if len(batch) < 100:
            return items
        page += 1


def load_result(path: str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read agent result {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError("agent result must be a JSON object")
    return value


def truncate(text: str, limit: int) -> str:
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[: limit - 80].rstrip() + "\n\n…(truncated by trusted publisher)…"


def agent_comment(result: dict[str, Any], *, phase: str, commit_sha: str | None = None) -> str:
    status = str(result.get("status") or "unknown")
    turn = result.get("turn") or "?"
    continuity = result.get("sessionContinuity") or "unknown"
    response = truncate(str(result.get("finalResponse") or "No final assistant response was recovered."), MAX_RESPONSE_CHARS)
    changed = result.get("changedFiles") or []
    verification = result.get("verification") or "unknown"
    verification_output = truncate(str(result.get("verificationOutput") or ""), MAX_VERIFICATION_CHARS)

    lines = [
        f"<!-- agent-turn design={result.get('designPr', '?')} turn={turn} -->",
        f"## Agent turn {turn} — `{status}`",
        "",
        f"- Phase: `{phase}`",
        f"- Session continuity: `{continuity}`",
        f"- Verification: `{verification}`",
    ]
    if commit_sha:
        lines.append(f"- Published commit: `{commit_sha}`")
    if changed:
        lines.append(f"- Changed files: {len(changed)}")
    lines.extend(["", "### OpenCode response", "", response])

    if status == "verify_failed" and verification_output:
        lines.extend(["", "### Verification failure", "", "```text", verification_output, "```"])
    elif status == "runtime_failed":
        lines.extend(["", "The candidate implementation was not published because the OpenCode runtime did not complete successfully."])
    elif status == "no_changes":
        lines.extend(["", "No repository patch was published for this turn."])

    return "\n".join(lines).strip() + "\n"


def fetch_spec(args: argparse.Namespace) -> int:
    encoded_path = urllib.parse.quote(args.path, safe="/")
    encoded_ref = urllib.parse.quote(args.ref, safe="")
    result = request("GET", f"/repos/{args.repo}/contents/{encoded_path}?ref={encoded_ref}")
    if not isinstance(result, dict) or result.get("type") != "file":
        raise RuntimeError("design spec did not resolve to a file")
    content = base64.b64decode(result["content"]).decode("utf-8")
    Path(args.output).write_text(content, encoding="utf-8")
    return 0


def publish(args: argparse.Namespace) -> int:
    result = load_result(args.result)
    if result.get("status") != "verified":
        raise RuntimeError("publish requires a verified agent result")

    owner = args.repo.split("/", 1)[0]
    title = f"agent: implement design PR #{args.design_pr}"
    body = f"""## Agent implementation

Implements design PR #{args.design_pr}.

- Design head: `{args.design_sha}`
- Implementation branch: `{args.branch}`
- Executor: containerized OpenCode on the project-scoped self-hosted runner
- Conversation: persistent OpenCode session bound to Design PR #{args.design_pr}
- Deterministic repository verification: passed

This PR is generated as a draft for human code review. The agent does not merge it automatically.

To request another agent turn after leaving review feedback, comment exactly:

`/agent revise`
"""

    query = urllib.parse.urlencode(
        {
            "state": "open",
            "head": f"{owner}:{args.branch}",
            "base": args.base,
            "per_page": "10",
        }
    )
    pulls = request("GET", f"/repos/{args.repo}/pulls?{query}")

    if pulls:
        pr_number = pulls[0]["number"]
        pr = request(
            "PATCH",
            f"/repos/{args.repo}/pulls/{pr_number}",
            {"title": title, "body": body},
        )
        action = "updated"
    else:
        pr = request(
            "POST",
            f"/repos/{args.repo}/pulls",
            {
                "title": title,
                "head": args.branch,
                "base": args.base,
                "body": body,
                "draft": True,
            },
        )
        pr_number = pr["number"]
        action = "created"

    request(
        "POST",
        f"/repos/{args.repo}/issues/{pr_number}/comments",
        {"body": agent_comment(result, phase="initial implementation", commit_sha=args.commit_sha)},
    )

    design_comment = (
        f"Agent implementation {action}: #{pr_number}\n\n"
        f"Design head: `{args.design_sha}`\n"
        f"Implementation branch: `{args.branch}`\n"
        f"Agent turn: `{result.get('turn', '?')}`\n"
        f"Status: `{result.get('status')}`"
    )
    request(
        "POST",
        f"/repos/{args.repo}/issues/{args.design_pr}/comments",
        {"body": design_comment},
    )

    print(json.dumps({"number": pr_number, "url": pr["html_url"], "action": action}))
    return 0


def report_design(args: argparse.Namespace) -> int:
    result = load_result(args.result)
    body = agent_comment(result, phase="initial implementation")
    request("POST", f"/repos/{args.repo}/issues/{args.design_pr}/comments", {"body": body})
    print(json.dumps({"issue": args.design_pr, "status": result.get("status")}))
    return 0


def comment_result(args: argparse.Namespace) -> int:
    result = load_result(args.result)
    body = agent_comment(result, phase=args.phase, commit_sha=args.commit_sha)
    request("POST", f"/repos/{args.repo}/issues/{args.issue}/comments", {"body": body})
    print(json.dumps({"issue": args.issue, "status": result.get("status")}))
    return 0


MIN_TIME = datetime.min.replace(tzinfo=timezone.utc)


def _parse_time(value: str | None) -> datetime:
    if not value:
        return MIN_TIME
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def collect_feedback(args: argparse.Namespace) -> int:
    trigger = request("GET", f"/repos/{args.repo}/issues/comments/{args.trigger_comment_id}")
    if not isinstance(trigger, dict):
        raise RuntimeError("trigger comment not found")
    trigger_time = _parse_time(trigger.get("created_at"))

    issue_comments = request_all(
        f"/repos/{args.repo}/issues/{args.implementation_pr}/comments"
    )
    reviews = request_all(
        f"/repos/{args.repo}/pulls/{args.implementation_pr}/reviews"
    )
    review_comments = request_all(
        f"/repos/{args.repo}/pulls/{args.implementation_pr}/comments"
    )

    boundary = MIN_TIME
    for comment in issue_comments:
        if not isinstance(comment, dict):
            continue
        body = str(comment.get("body") or "")
        login = ((comment.get("user") or {}).get("login")) if isinstance(comment.get("user"), dict) else None
        if login != "github-actions[bot]":
            continue
        if "<!-- agent-turn" not in body and not body.startswith("Agent implementation"):
            continue
        stamp = _parse_time(comment.get("created_at"))
        if stamp < trigger_time:
            boundary = max(boundary, stamp)

    items: list[tuple[datetime, str, str]] = []

    for comment in issue_comments:
        if not isinstance(comment, dict):
            continue
        if comment.get("id") == args.trigger_comment_id:
            continue
        login = ((comment.get("user") or {}).get("login")) if isinstance(comment.get("user"), dict) else None
        if login != args.owner:
            continue
        body = str(comment.get("body") or "").strip()
        if not body or body == "/agent revise" or "<!-- agent-turn" in body:
            continue
        stamp = _parse_time(comment.get("created_at"))
        if boundary < stamp <= trigger_time:
            items.append((stamp, f"Issue comment #{comment.get('id')}", body))

    for review in reviews:
        if not isinstance(review, dict):
            continue
        login = ((review.get("user") or {}).get("login")) if isinstance(review.get("user"), dict) else None
        if login != args.owner:
            continue
        body = str(review.get("body") or "").strip()
        stamp = _parse_time(review.get("submitted_at") or review.get("created_at"))
        if body and boundary < stamp <= trigger_time:
            state = str(review.get("state") or "review")
            items.append((stamp, f"PR review #{review.get('id')} ({state})", body))

    for comment in review_comments:
        if not isinstance(comment, dict):
            continue
        login = ((comment.get("user") or {}).get("login")) if isinstance(comment.get("user"), dict) else None
        if login != args.owner:
            continue
        body = str(comment.get("body") or "").strip()
        stamp = _parse_time(comment.get("created_at"))
        if not body or not (boundary < stamp <= trigger_time):
            continue
        path = comment.get("path") or "unknown path"
        line = comment.get("line") or comment.get("original_line") or "?"
        items.append((stamp, f"Inline review #{comment.get('id')} ({path}:{line})", body))

    items.sort(key=lambda item: item[0])
    blocks = [
        "# Trusted review feedback",
        "",
        f"Implementation PR: #{args.implementation_pr}",
        f"Owner: {args.owner}",
        f"Trigger comment: #{args.trigger_comment_id}",
        "",
    ]
    for _, label, body in items:
        blocks.extend([f"## {label}", "", body, ""])

    Path(args.output).write_text("\n".join(blocks).rstrip() + "\n", encoding="utf-8")
    print(json.dumps({"count": len(items), "boundary": boundary.isoformat() if boundary != MIN_TIME else None}))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    fetch = sub.add_parser("fetch-spec")
    fetch.add_argument("--repo", required=True)
    fetch.add_argument("--path", required=True)
    fetch.add_argument("--ref", required=True)
    fetch.add_argument("--output", required=True)
    fetch.set_defaults(func=fetch_spec)

    pub = sub.add_parser("publish")
    pub.add_argument("--repo", required=True)
    pub.add_argument("--design-pr", required=True, type=int)
    pub.add_argument("--design-sha", required=True)
    pub.add_argument("--branch", required=True)
    pub.add_argument("--base", default="main")
    pub.add_argument("--result", required=True)
    pub.add_argument("--commit-sha", required=True)
    pub.set_defaults(func=publish)

    report = sub.add_parser("report-design")
    report.add_argument("--repo", required=True)
    report.add_argument("--design-pr", required=True, type=int)
    report.add_argument("--result", required=True)
    report.set_defaults(func=report_design)

    comment = sub.add_parser("comment-result")
    comment.add_argument("--repo", required=True)
    comment.add_argument("--issue", required=True, type=int)
    comment.add_argument("--result", required=True)
    comment.add_argument("--phase", required=True)
    comment.add_argument("--commit-sha")
    comment.set_defaults(func=comment_result)

    feedback = sub.add_parser("collect-feedback")
    feedback.add_argument("--repo", required=True)
    feedback.add_argument("--implementation-pr", required=True, type=int)
    feedback.add_argument("--owner", required=True)
    feedback.add_argument("--trigger-comment-id", required=True, type=int)
    feedback.add_argument("--output", required=True)
    feedback.set_defaults(func=collect_feedback)

    args = parser.parse_args()
    try:
        return args.func(args)
    except (RuntimeError, ValueError, OSError, json.JSONDecodeError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
