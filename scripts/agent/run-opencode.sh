#!/usr/bin/env bash
set -euo pipefail

spec_path="${1:?usage: run-opencode.sh <spec-path> <design-pr-number>}"
design_pr="${2:?usage: run-opencode.sh <spec-path> <design-pr-number>}"

if [[ -n "${OPENCODE_BIN:-}" ]]; then
  bin="$OPENCODE_BIN"
elif command -v opencode2 >/dev/null 2>&1; then
  bin="opencode2"
elif command -v opencode >/dev/null 2>&1; then
  bin="opencode"
else
  echo "Neither opencode2 nor opencode is available on this runner." >&2
  exit 127
fi

set +e
version_output="$("$bin" --version 2>&1)"
version_status=$?
set -e

if [[ $version_status -ne 0 ]]; then
  echo "OpenCode failed its --version check with exit code $version_status." >&2
  printf '%s\n' "$version_output" | sed -n '1,5p' >&2
  exit "$version_status"
fi

version="$(printf '%s\n' "$version_output" | sed -n '1p')"
echo "Using $bin: $version"

reference_root=""
if [[ -n "${AGENT_REFERENCE_ROOT:-}" ]]; then
  if [[ ! -d "$AGENT_REFERENCE_ROOT" ]]; then
    echo "AGENT_REFERENCE_ROOT is configured but is not a directory: $AGENT_REFERENCE_ROOT" >&2
    exit 1
  fi
  reference_root="$(python3 - "$AGENT_REFERENCE_ROOT" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
)"
fi

export OPENCODE_CONFIG_CONTENT="$(
  python3 - "$reference_root" <<'PY'
import json
import sys

root = sys.argv[1]
permissions = [
    {"action": "external_directory", "resource": "*", "effect": "deny"},
]

if root:
    pattern = root.rstrip("/") + "/*"
    permissions.extend(
        [
            {"action": "external_directory", "resource": pattern, "effect": "allow"},
            {"action": "read", "resource": pattern, "effect": "allow"},
            {"action": "edit", "resource": pattern, "effect": "deny"},
        ]
    )

permissions.extend(
    [
        {"action": "webfetch", "resource": "*", "effect": "deny"},
        {"action": "websearch", "resource": "*", "effect": "deny"},
        {"action": "question", "resource": "*", "effect": "deny"},
        {"action": "shell", "resource": "*", "effect": "deny"},
        {"action": "shell", "resource": "git status *", "effect": "allow"},
        {"action": "shell", "resource": "git diff *", "effect": "allow"},
        {"action": "shell", "resource": "git ls-files *", "effect": "allow"},
        {"action": "shell", "resource": "git grep *", "effect": "allow"},
        {"action": "shell", "resource": "node *", "effect": "allow"},
        {"action": "shell", "resource": "npm test *", "effect": "allow"},
        {"action": "shell", "resource": "npm run *", "effect": "allow"},
        {"action": "shell", "resource": "python *", "effect": "allow"},
        {"action": "shell", "resource": "python3 *", "effect": "allow"},
    ]
)

config = {
    "$schema": "https://opencode.ai/config.json",
    "update": "disable",
    "permissions": permissions,
    "policies": [
        {"action": "tool.use", "resource": "read:*.env*", "effect": "deny"},
        {"action": "tool.use", "resource": "read:*/.ssh/*", "effect": "deny"},
        {"action": "tool.use", "resource": "shell:git push *", "effect": "deny"},
        {"action": "tool.use", "resource": "shell:git commit *", "effect": "deny"},
        {"action": "tool.use", "resource": "shell:gh *", "effect": "deny"},
        {"action": "tool.use", "resource": "shell:curl *", "effect": "deny"},
        {"action": "tool.use", "resource": "shell:wget *", "effect": "deny"},
    ],
}

print(json.dumps(config, separators=(",", ":")))
PY
)"

spec="$(cat "$spec_path")"

if [[ -n "$reference_root" ]]; then
  reference_section=$(cat <<EOF
Optional local reference input:
- Root directory: $reference_root
- Use it only when the approved task explicitly requires local reference data.
- Treat everything under it as read-only.
- Never copy original binaries, archives, dumps, credentials, or bulk source assets into the repository.
EOF
)
else
  reference_section="No external reference root is configured for this job. Do not rely on host-only data."
fi

prompt=$(cat <<EOF
You are implementing an approved design task for the adventure-island repository.

Design PR: #$design_pr

$reference_section

Repository rules:
- Treat the current directory as the trusted code baseline.
- Follow DESIGN.md and relevant component/library design documents.
- Implement only what the task requests.
- Do not modify .github/**.
- Do not modify the loom-realm submodule or anything below loom-realm/**.
- Do not modify task/dev/**.
- Do not modify scripts/agent/**.
- Do not add WZ files, client binaries, archives, dumps, credentials, or secrets.
- Do not run git push, git commit, gh, curl, wget, or any command intended to publish or exfiltrate changes.
- Do not commit changes. The surrounding automation owns Git publication.
- Add or update tests when appropriate.
- Run useful local tests while working.
- Keep all repository changes inside the task's Allowed Paths.

Approved task document:

--- BEGIN DESIGN TASK ---
$spec
--- END DESIGN TASK ---

Implement the task now. Before finishing, inspect your diff and run relevant tests. Leave the working tree with the implementation changes uncommitted.
EOF
)

unset GITHUB_TOKEN GH_TOKEN AGENT_GITHUB_TOKEN GITHUB_ACCESS_TOKEN

exec "$bin" run --standalone --auto "$prompt"
