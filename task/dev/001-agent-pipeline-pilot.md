# Agent pipeline pilot

## Goal

Verify the complete design-to-implementation automation path with a harmless repository-only change.

## Context

This is the first end-to-end test of the automatic agent pipeline after merging the agent infrastructure. The second attempt uses Actions artifacts so the self-hosted runner does not need direct Git access to GitHub. The third attempt also uses native PowerShell on the Windows self-hosted runner. The fourth attempt uses the built-in Windows PowerShell runtime available on the runner. The fifth attempt also resolves a user-level OpenCode installation outside the runner service PATH. The sixth attempt follows the repository's existing Windows profile and GLM credential convention. The seventh attempt receives the official Windows x64 standalone OpenCode V2 CLI as a short-lived Actions artifact so the runner service does not need access to the interactive user's installation. The eighth attempt uses the runner's machine-persistent OpenCode cache, validates read access to the local CMS079 reference input, and then exercises the local GLM/Z.AI-backed OpenCode execution path. The ninth attempt switches the cache bootstrap to the official Windows x64 baseline OpenCode build after the standard x64 binary failed its local execution check. The tenth attempt reuses the staged baseline payload and records the native Windows process diagnostics for the remaining execution failure. The implementation must not change application code, workflows, submodules, or local proprietary inputs.

## Allowed Paths

- result/agent-pilot.md

## Non-goals

Do not implement product features, change runtime behavior, modify tests, or touch any file other than the single allowed result document.

## Requirements

- Create `result/agent-pilot.md`.
- State that the automated agent pipeline successfully reached the implementation stage.
- Briefly record that the implementation was produced from a Design PR by the local OpenCode runner.
- Do not include machine names, filesystem paths, credentials, environment variables, tokens, local client data, or other sensitive/local-only information.

## Acceptance Criteria

- [ ] `result/agent-pilot.md` exists.
- [ ] The file is concise Markdown.
- [ ] No other repository file is changed.

## Validation

Confirm the working tree contains exactly one changed file: `result/agent-pilot.md`, and run the repository agent diff policy checks.
