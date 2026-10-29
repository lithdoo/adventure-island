# Agent development tasks

This directory contains **design-only PRs** that may trigger the repository development agent.

A design PR must:

- target `main`;
- originate from this repository, not a fork;
- be opened by the repository owner;
- be non-draft;
- change exactly one Markdown file under `task/dev/`;
- not change code, workflows, submodules, tests, or any other file.

The design PR is the durable task specification. The generated Implementation PR is the durable code-review surface. Each Design PR is also bound to a persistent OpenCode conversation on the project-scoped container runner.

## Required template

```markdown
# <Task title>

## Goal

What should be implemented and what user-visible or system behavior should result.

## Context

Relevant repository design documents, existing components, constraints, and rationale.

## Allowed Paths

- libs/example/**
- systems/example/**
- tests/**

## Non-goals

What must not be implemented in this task.

## Requirements

- Concrete requirement 1
- Concrete requirement 2

## Acceptance Criteria

- [ ] Observable criterion 1
- [ ] Observable criterion 2

## Validation

Describe the tests or checks expected for this task. This section is guidance to the agent; it is **not executed as shell code**.
```

## Path policy

`Allowed Paths` is machine-enforced after OpenCode finishes. Every changed or newly created file must match at least one listed glob.

The following paths are always forbidden to the agent even if a task lists them:

- `.github/**`
- `loom-realm` and `loom-realm/**`
- `task/dev/**`
- `scripts/agent/**`
- `.opencode/**`
- `.agents/**`
- root `AGENTS.md`
- root `opencode.json` / `opencode.jsonc`
- `.raw/**`
- `.work/**`

Client/resource binaries and archives such as `*.wz`, `*.exe`, `*.dll`, `*.sys`, `*.zip`, `*.rar`, and `*.7z` are also forbidden.

Project-level OpenCode config and agent-instruction discovery are disabled during CI turns. This prevents code produced in an earlier Implementation PR turn from becoming privileged instructions in a later revision turn.

## Initial implementation flow

A successful `Agent Spec Gate` run triggers `Agent Implement` from the trusted default branch.

The implementation workflow:

1. revalidates the owner-authored Design PR on a GitHub-hosted runner;
2. checks out the exact trusted `main` base plus read-only submodule context;
3. sends trusted source and the approved design document to the project-scoped Docker runner through short-lived Actions artifacts;
4. rebuilds a stable per-Design-PR workspace under `/runner/state/adventure-island/agent-sessions/design-<N>/workspace`;
5. invokes container-local `opencode2` with GLM credentials supplied by the runner environment;
6. captures OpenCode JSON events locally, recovers the authoritative final assistant response from `opencode session export`, and records the OpenCode session ID;
7. runs the deterministic repository verifier;
8. uploads only a structured `agent-result.json` and, when verification passes, the verified Git patch;
9. a GitHub-hosted publish job applies the patch to the exact trusted base, pushes `agent/pr-<N>`, creates or updates one draft Implementation PR, and posts the OpenCode final response for review.

Raw OpenCode event/session exports are kept on the self-hosted machine and are never committed or posted to GitHub.

## Agent result protocol

Every completed turn produces a structured result with one of these statuses:

| Status | Meaning | Code published? |
| --- | --- | --- |
| `verified` | OpenCode completed, repository changes exist, deterministic verification passed | Yes |
| `no_changes` | OpenCode completed but produced no repository changes | No |
| `verify_failed` | OpenCode produced changes but deterministic verification rejected them | No |
| `runtime_failed` | OpenCode/session execution did not complete successfully | No |

The final assistant response is posted even when no patch is published. This means blockers, limitations, failed validation, and “no change required” outcomes are visible directly in the PR/Design PR rather than being hidden behind a red Actions run.

## Persistent OpenCode sessions

The container runner persists OpenCode data and per-task session metadata under the existing runner state bind mount:

```text
/runner/state/adventure-island/
├── opencode-data/
└── agent-sessions/
    └── design-<N>/
        ├── metadata.json
        ├── workspace/
        └── turns/
            ├── 0001/
            ├── 0002/
            └── ...
```

`XDG_DATA_HOME=/runner/state/adventure-island/opencode-data` keeps the OpenCode V2 SQLite session database persistent across workflow jobs and container restarts. `metadata.json` binds the Design PR to the active OpenCode session ID and turn number.

The raw `turns/*/events.ndjson`, OpenCode stderr, and session export are local diagnostic/state data. They are intentionally not uploaded as Actions artifacts.

If the recorded session cannot be resumed (for example after state loss), the revision workflow boots a replacement session from the current Implementation PR checkout, the approved Design spec, and the trusted review feedback. The PR result reports this as `sessionContinuity=bootstrapped`; subsequent revision turns resume that replacement session normally.

## Human review and `/agent revise`

After the first verified implementation, review the generated draft Implementation PR normally. Leave ordinary PR review text, review summaries, or inline review comments first. When the feedback is ready, add an issue comment containing exactly:

```text
/agent revise
```

`Agent Revise` runs only when:

- the command author is the repository owner;
- the target is an open same-repository PR targeting `main`;
- the PR head is exactly `agent/pr-<DesignPR>`;
- the corresponding Design PR is still open, non-draft, owner-authored, same-repository, and still changes exactly one valid `task/dev/*.md` file;
- there is new owner-authored review feedback after the previous agent turn.

The revision preflight collects only trusted owner feedback. It does not pass arbitrary third-party comments to OpenCode.

A revision turn:

1. snapshots the **current Implementation PR HEAD**, not `main`;
2. restores/resumes the Design PR's OpenCode session when available;
3. supplies the original approved Design spec plus only the new trusted review feedback;
4. asks OpenCode for an incremental revision rather than a fresh implementation;
5. runs the same deterministic verifier against the revision diff;
6. fast-forwards the existing `agent/pr-<N>` branch only when verification passes;
7. posts the OpenCode final response back to the same Implementation PR.

Revision concurrency is serialized per Implementation PR and uses `cancel-in-progress: false`, so a later `/agent revise` request does not terminate a turn that is already mutating the same persistent session.

## Updating the Design PR

Updating the Design PR still triggers the normal Spec Gate and a fresh initial implementation from the latest trusted `main`.

That path intentionally replaces `agent/pr-<N>` with a newly generated implementation and starts a new primary OpenCode session for the new Design head. Use this when the actual task specification changes.

Use `/agent revise` instead when the Design intent is unchanged and you are asking the agent to address code-review feedback on the current Implementation PR.

## Security model

The trust boundary remains unchanged:

```text
GitHub-hosted trusted preflight
        ↓
short-lived trusted artifacts
        ↓
project-scoped self-hosted OpenCode runner
        ↓  (no GitHub write credential)
verified patch + sanitized agent result
        ↓
GitHub-hosted trusted publisher
```

The OpenCode process explicitly drops `GITHUB_TOKEN`, `GH_TOKEN`, `AGENT_GITHUB_TOKEN`, and `GITHUB_ACCESS_TOKEN`. It cannot push, create PRs, or publish comments directly.

Only the GitHub-hosted publisher receives repository write permissions. Repository settings must allow GitHub Actions to create pull requests. If `AGENT_GITHUB_TOKEN` is configured, it should remain narrowly scoped to this repository; otherwise publication falls back to the built-in `GITHUB_TOKEN`.

## Runner requirements

The project runner is the Linux Docker runner labeled:

```yaml
runs-on: [self-hosted, opencode, adventure-island]
```

It must provide:

- `git`;
- Python 3;
- Node.js for JavaScript validation;
- `opencode2` V2;
- readable trusted `OPENCODE_CONFIG`;
- `GLM_API_KEY` in the runner environment;
- writable `/runner/state/adventure-island` from the persistent host state mount.

OpenCode runs with `--standalone --auto --format json`. Provider/model configuration remains outside Git; the container's trusted OpenCode configuration supplies `zai-coding-plan/glm-5.3` and reads the key from `GLM_API_KEY`.

## Optional local reference input

The agent denies external directories by default. A future task may explicitly provide `AGENT_REFERENCE_ROOT` through trusted runner configuration. When set, OpenCode may read that directory but is denied direct edits there. Proprietary reference inputs must remain outside the repository and outside uploaded artifacts.

The current workflow does **not** require `F:\CMS079` or any Windows host path.
