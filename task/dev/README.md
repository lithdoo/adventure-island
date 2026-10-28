# Agent development tasks

This directory contains **design-only PRs** that may trigger the local development agent.

A design PR must:

- target `main`;
- originate from this repository, not a fork;
- be opened by the repository owner;
- be non-draft;
- change exactly one Markdown file under `task/dev/`;
- not change code, workflows, submodules, tests, or any other file.

The agent always starts from the current trusted `main` branch. The design PR is treated as an instruction document, not as a code checkout.

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
- `.raw/**`
- `.work/**`

Client/resource binaries and archives such as `*.wz`, `*.exe`, `*.dll`, `*.sys`, `*.zip`, `*.rar`, and `*.7z` are also forbidden.

## Execution model

A successful `Agent Spec Gate` run triggers the default-branch `Agent Implement` workflow.

The implementation workflow:

1. revalidates the PR on a GitHub-hosted runner;
2. GitHub-hosted Actions checks out trusted `main` plus read-only submodule context;
3. trusted source and the approved design document are transferred to the self-hosted runner through short-lived Actions artifacts;
4. the self-hosted runner creates a local-only Git baseline and runs `opencode2` (falling back to `opencode`);
5. trusted verifier scripts enforce the allowed-path and repository safety policy and run deterministic checks;
6. the self-hosted runner uploads only the verified Git patch as a short-lived Actions artifact;
7. a GitHub-hosted publish job applies that patch to the exact trusted base commit;
8. the GitHub-hosted publish job pushes `agent/pr-<number>` and creates or updates one draft implementation PR.

The self-hosted runner does not need direct Git access to `github.com`, and it never receives repository write credentials.

Updating the design PR reruns the process. The dedicated implementation branch is replaced with a fresh implementation based on the latest `main`.


## Repository setup required for publication

The workflow requests `contents: write` and `pull-requests: write` only for the final implementation job.

For the simplest setup, enable GitHub Actions to create pull requests for this repository. For generated implementation PRs to trigger normal downstream workflows reliably, configure an `AGENT_GITHUB_TOKEN` repository secret backed by a narrowly scoped GitHub App installation token or another suitable repository token. If the secret is absent, the workflow falls back to the built-in `GITHUB_TOKEN`.

The self-hosted runner must have:

- `git`;
- Python 3;
- `opencode2` or `opencode`;
- the project-specific runtimes needed by the task (for example Node.js for JavaScript work).

Keep local proprietary inputs outside the runner's agent workspace. The self-hosted job works from a short-lived source artifact under `$RUNNER_TEMP`, rejects a `.raw` directory inside that workspace, and never checks out or pushes the GitHub repository directly.
