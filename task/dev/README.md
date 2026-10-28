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
- `.raw/**`
- `.work/**`

Client/resource binaries and archives such as `*.wz`, `*.exe`, `*.dll`, `*.sys`, `*.zip`, `*.rar`, and `*.7z` are also forbidden.

## Execution model

A successful `Agent Spec Gate` run triggers the default-branch `Agent Implement` workflow.

The implementation workflow:

1. revalidates the PR on a GitHub-hosted runner;
2. checks out trusted `main` on the self-hosted runner;
3. fetches only the approved design document from the design PR;
4. runs local `opencode2` (falling back to `opencode`);
5. enforces the allowed-path and repository safety policy;
6. runs deterministic syntax/tests where known;
7. pushes `agent/pr-<number>`;
8. creates or updates one draft implementation PR.

Updating the design PR reruns the process. The dedicated implementation branch is replaced with a fresh implementation based on the latest `main`.
