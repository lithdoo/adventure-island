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

version="$("$bin" --version 2>&1 | head -n 1 || true)"
echo "Using $bin: $version"

spec="$(cat "$spec_path")"

prompt=$(cat <<EOF
You are implementing an approved design task for the adventure-island repository.

Design PR: #$design_pr

Repository rules:
- Treat the checked-out repository as the trusted code baseline.
- Follow DESIGN.md and relevant component/library design documents.
- Implement only what the task requests.
- Do not modify .github/**.
- Do not modify the loom-realm submodule or anything below loom-realm/**.
- Do not modify task/dev/**.
- Do not add WZ files, client binaries, archives, dumps, credentials, or secrets.
- Do not run git push, gh, curl-to-GitHub, or any command intended to publish changes.
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

# Keep GitHub publication credentials out of the agent process even if the runner
# service or a future workflow configuration happens to define them globally.
unset GITHUB_TOKEN GH_TOKEN AGENT_GITHUB_TOKEN

exec "$bin" run "$prompt"
