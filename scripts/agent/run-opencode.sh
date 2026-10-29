#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
usage: run-opencode.sh \
  --mode initial|revise \
  --spec <path> \
  --design-pr <number> \
  --design-head <sha> \
  --session-root <path> \
  --output-dir <path> \
  [--feedback <path>]
EOF
  exit 2
}

mode=""
spec_path=""
design_pr=""
design_head=""
session_root=""
output_dir=""
feedback_path=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode) mode="${2:-}"; shift 2 ;;
    --spec) spec_path="${2:-}"; shift 2 ;;
    --design-pr) design_pr="${2:-}"; shift 2 ;;
    --design-head) design_head="${2:-}"; shift 2 ;;
    --session-root) session_root="${2:-}"; shift 2 ;;
    --output-dir) output_dir="${2:-}"; shift 2 ;;
    --feedback) feedback_path="${2:-}"; shift 2 ;;
    *) usage ;;
  esac
done

[[ "$mode" == "initial" || "$mode" == "revise" ]] || usage
[[ -n "$spec_path" && -f "$spec_path" ]] || usage
[[ "$design_pr" =~ ^[0-9]+$ ]] || usage
[[ -n "$design_head" && -n "$session_root" && -n "$output_dir" ]] || usage
if [[ "$mode" == "revise" ]]; then
  [[ -n "$feedback_path" && -s "$feedback_path" ]] || {
    echo "revision mode requires non-empty trusted feedback" >&2
    exit 2
  }
fi

mkdir -p "$session_root" "$output_dir"
metadata_path="$session_root/metadata.json"
turns_root="$session_root/turns"
mkdir -p "$turns_root"

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

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
parser="$script_dir/parse_opencode_result.py"
[[ -f "$parser" ]] || {
  echo "Missing trusted OpenCode result parser: $parser" >&2
  exit 2
}

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
feedback=""
if [[ -n "$feedback_path" ]]; then
  feedback="$(cat "$feedback_path")"
fi

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

session_id=""
continuity="new"
turn=1
if [[ "$mode" == "initial" ]]; then
  rm -rf "$turns_root"
  mkdir -p "$turns_root"
  rm -f "$metadata_path"
else
  continuity="bootstrapped"
  if [[ -f "$metadata_path" ]]; then
    mapfile -t metadata_values < <(python3 - "$metadata_path" "$design_head" <<'PY'
import json
import sys

path, expected_head = sys.argv[1:]
try:
    value = json.load(open(path, encoding="utf-8"))
except (OSError, json.JSONDecodeError):
    raise SystemExit(0)
if value.get("designHead") != expected_head:
    raise SystemExit(0)
session_id = value.get("sessionId")
turn = value.get("turn")
if isinstance(session_id, str) and session_id.startswith("ses_"):
    print(session_id)
    print(int(turn or 0) + 1)
PY
)
    if [[ ${#metadata_values[@]} -ge 2 ]]; then
      candidate="${metadata_values[0]}"
      turn="${metadata_values[1]}"
      if "$bin" session export --standalone "$candidate" >/dev/null 2>&1; then
        session_id="$candidate"
        continuity="resumed"
      fi
    fi
  fi
fi

printf -v turn_name '%04d' "$turn"
turn_dir="$turns_root/$turn_name"
rm -rf "$turn_dir"
mkdir -p "$turn_dir"
events_path="$turn_dir/events.ndjson"
stderr_path="$turn_dir/stderr.log"
export_path="$turn_dir/session.json"
sessions_path="$turn_dir/sessions.json"
run_result="$output_dir/run-result.json"
session_title="agent adventure-island design #$design_pr ${design_head:0:12}"

if [[ "$mode" == "initial" ]]; then
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
- Run useful local tests while working; obtain actual command output and exit status for relevant validation before finishing.
- If direct shell commands are denied, do not stop at static analysis. Use the available `subagent` tool (or the runtime's task/delegation equivalent) to run the allowed Node/npm/Git validation commands in a shell-capable subagent, wait for its concrete result, and report that output.
- Do not claim tests ran unless a command actually executed. If no shell-capable subagent is available, explicitly report the blocker and leave validation unverified.
- Keep all repository changes inside the task's Allowed Paths.
- Never include credentials, environment variable values, or proprietary input contents in your final response.

Approved task document:

--- BEGIN DESIGN TASK ---
$spec
--- END DESIGN TASK ---

Implement the task now. Before finishing, inspect your diff and run relevant tests. Leave the working tree with the implementation changes uncommitted.

Your final assistant response is part of the review record. Summarize what changed, validation performed, and any blocker or limitation the reviewer should know about.
EOF
)
else
  if [[ "$continuity" == "resumed" ]]; then
    continuity_note="Continue the existing OpenCode session for this Implementation PR. Preserve prior decisions unless the trusted review feedback requires changing them."
  else
    continuity_note="The prior OpenCode session is unavailable, so bootstrap a new session from the current Implementation PR workspace. Treat the current code and approved design document as the accepted prior context, then address the trusted review feedback."
  fi
  prompt=$(cat <<EOF
You are revising the existing implementation for adventure-island Design PR #$design_pr.

$continuity_note

$reference_section

Repository rules remain unchanged:
- Treat the current working tree as the current Implementation PR baseline.
- Follow DESIGN.md and relevant component/library design documents.
- Modify only what is needed to address the trusted human review feedback while remaining within the original Allowed Paths.
- Do not modify .github/**, loom-realm/**, task/dev/**, or scripts/agent/**.
- Do not add WZ files, client binaries, archives, dumps, credentials, or secrets.
- Do not run git push, git commit, gh, curl, wget, or any publishing/exfiltration command.
- Do not commit changes. The surrounding automation owns Git publication.
- Run useful local tests while working; obtain actual command output and exit status for relevant validation before finishing.
- If direct shell commands are denied, do not stop at static analysis. Use the available `subagent` tool (or the runtime's task/delegation equivalent) to run the allowed Node/npm/Git validation commands in a shell-capable subagent, wait for its concrete result, and report that output.
- Do not claim tests ran unless a command actually executed. If no shell-capable subagent is available, explicitly report the blocker and leave validation unverified.
- Never include credentials, environment variable values, or proprietary input contents in your final response.

Approved design document:

--- BEGIN DESIGN TASK ---
$spec
--- END DESIGN TASK ---

Trusted human review feedback for this revision:

--- BEGIN TRUSTED REVIEW ---
$feedback
--- END TRUSTED REVIEW ---

Address the review now. Inspect the current implementation before editing, preserve already-accepted work where possible, run relevant validation, and leave changes uncommitted.

Your final assistant response is part of the PR review record. Explicitly state which feedback items you addressed, what you changed, what validation ran, and any feedback item you could not safely complete and why.
EOF
)
fi

unset GITHUB_TOKEN GH_TOKEN AGENT_GITHUB_TOKEN GITHUB_ACCESS_TOKEN
# The revision workspace is generated code, not a trusted instruction source.
# Keep project-level OpenCode config/AGENTS/skills out of the privileged prompt.
export OPENCODE_DISABLE_PROJECT_CONFIG=1
export OPENCODE_DISABLE_EXTERNAL_SKILLS=1

args=(run --standalone --auto --format json)
if [[ "$continuity" == "resumed" ]]; then
  args+=(--session "$session_id")
else
  args+=(--title "$session_title")
fi

set +e
"$bin" "${args[@]}" "$prompt" >"$events_path" 2>"$stderr_path"
run_status=$?
set -e

if [[ -z "$session_id" ]]; then
  set +e
  "$bin" session list --standalone --max-count 20 --format json >"$sessions_path" 2>>"$stderr_path"
  list_status=$?
  set -e
  if [[ $list_status -eq 0 ]]; then
    session_id="$(python3 "$parser" session-id --events "$events_path" --sessions "$sessions_path" --title "$session_title" 2>/dev/null || true)"
  else
    session_id="$(python3 "$parser" session-id --events "$events_path" 2>/dev/null || true)"
  fi
fi

final_response=""
if [[ -n "$session_id" ]]; then
  set +e
  "$bin" session export --standalone "$session_id" >"$export_path" 2>>"$stderr_path"
  export_status=$?
  set -e
  if [[ $export_status -eq 0 ]]; then
    final_response="$(python3 "$parser" final-response --export "$export_path" --events "$events_path" 2>/dev/null || true)"
  else
    final_response="$(python3 "$parser" final-response --events "$events_path" 2>/dev/null || true)"
  fi
fi

if [[ -z "$final_response" ]]; then
  final_response="OpenCode did not produce a recoverable final assistant response for this turn. Review the workflow diagnostics for the runtime failure."
fi

# The final response is uploaded to GitHub. Redact the provider credential by
# exact value before it leaves the self-hosted runner, even if the model or a
# tool accidentally echoed it.
final_response="$(
  printf '%s' "$final_response" | python3 -c '
import os
import sys
text = sys.stdin.read()
value = os.environ.get("GLM_API_KEY", "")
if value:
    text = text.replace(value, "[REDACTED:GLM_API_KEY]")
sys.stdout.write(text)
'
)"

runtime_status="completed"
effective_status=$run_status
if [[ -z "$session_id" ]]; then
  runtime_status="failed"
  effective_status=1
  final_response="OpenCode completed without a recoverable session ID, so this turn cannot be safely continued. The implementation was not accepted for publication."
elif [[ $run_status -ne 0 ]]; then
  runtime_status="failed"
fi

python3 - "$metadata_path" "$session_id" "$design_pr" "$design_head" "$turn" "$PWD" "$continuity" <<'PY'
import json
import os
import sys
from datetime import datetime, timezone

path, session_id, design_pr, design_head, turn, workspace, continuity = sys.argv[1:]
if session_id:
    value = {
        "version": 1,
        "repository": "lithdoo/adventure-island",
        "designPr": int(design_pr),
        "implementationBranch": f"agent/pr-{design_pr}",
        "sessionId": session_id,
        "designHead": design_head,
        "turn": int(turn),
        "workspace": os.path.realpath(workspace),
        "continuity": continuity,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(tmp, path)
PY

python3 - "$run_result" "$mode" "$runtime_status" "$effective_status" "$session_id" "$continuity" "$turn" "$design_pr" "$design_head" "$final_response" "$version" <<'PY'
import json
import sys

(
    path,
    mode,
    runtime_status,
    exit_code,
    session_id,
    continuity,
    turn,
    design_pr,
    design_head,
    final_response,
    version,
) = sys.argv[1:]
value = {
    "protocolVersion": 1,
    "mode": mode,
    "runtimeStatus": runtime_status,
    "runtimeExitCode": int(exit_code),
    "sessionId": session_id or None,
    "sessionContinuity": continuity,
    "turn": int(turn),
    "designPr": int(design_pr),
    "designHead": design_head,
    "openCodeVersion": version,
    "finalResponse": final_response,
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(value, handle, ensure_ascii=False, indent=2)
    handle.write("\n")
PY

printf 'OpenCode turn %s complete: runtime=%s continuity=%s session=%s\n' \
  "$turn" "$runtime_status" "$continuity" "${session_id:-unavailable}"
printf '%s\n' "$final_response" | sed -n '1,80p'

exit "$effective_status"
