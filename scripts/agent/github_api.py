#!/usr/bin/env python3
"""Small GitHub REST helper used by the self-hosted agent workflow.

This deliberately uses only the Python standard library so the runner does not
need the GitHub CLI or third-party Python packages.
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


API = "https://api.github.com"


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


def fetch_spec(args: argparse.Namespace) -> int:
    encoded_path = urllib.parse.quote(args.path, safe="/")
    encoded_ref = urllib.parse.quote(args.ref, safe="")
    result = request("GET", f"/repos/{args.repo}/contents/{encoded_path}?ref={encoded_ref}")
    if not isinstance(result, dict) or result.get("type") != "file":
        raise RuntimeError("design spec did not resolve to a file")
    content = base64.b64decode(result["content"]).decode("utf-8")
    with open(args.output, "w", encoding="utf-8") as handle:
        handle.write(content)
    return 0


def publish(args: argparse.Namespace) -> int:
    owner = args.repo.split("/", 1)[0]
    title = f"agent: implement design PR #{args.design_pr}"
    body = f"""## Agent implementation

Implements design PR #{args.design_pr}.

- Design head: `{args.design_sha}`
- Implementation branch: `{args.branch}`
- Executor: local OpenCode on self-hosted runner
- Deterministic repository verification: passed

This PR is generated as a draft for human code review. The agent does not merge it automatically.
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

    comment = (
        f"Agent implementation {action}: #{pr_number}\n\n"
        f"Design head: `{args.design_sha}`\n"
        f"Implementation branch: `{args.branch}`"
    )
    request(
        "POST",
        f"/repos/{args.repo}/issues/{args.design_pr}/comments",
        {"body": comment},
    )

    print(json.dumps({"number": pr_number, "url": pr["html_url"], "action": action}))
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
    pub.set_defaults(func=publish)

    args = parser.parse_args()
    try:
        return args.func(args)
    except (RuntimeError, ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
