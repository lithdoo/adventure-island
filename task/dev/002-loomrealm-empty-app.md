# LoomRealm empty application scaffold

## Goal

Create a minimal, runnable LoomRealm application scaffold inside `adventure-island` for future integration and regression testing.

The scaffold should prove that this repository can consume the pinned `loom-realm` submodule as its runtime/platform dependency and can start through the same Game Package / launch-composition model used by LoomRealm's `examples/PokeMan` example, while containing no CMS gameplay yet.

## Context

The repository already includes LoomRealm as the `loom-realm` git submodule. At the time this task is written, the pinned submodule commit is:

```text
c5217e47be5a43f974e9e6ce82230077fb639c39
```

Use the checked-out submodule as the reference implementation. In particular, inspect:

- `loom-realm/examples/PokeMan/README.md`
- `loom-realm/examples/PokeMan/game.json`
- `loom-realm/examples/PokeMan/launch.pwa.json`
- `loom-realm/examples/PokeMan/launch.hostra.json`
- `loom-realm/examples/PokeMan/package.json`
- the minimal subsystem and smoke-test wiring used by that example

The current PokeMan example on this pinned revision uses a product-private `base + map + dialogue` topology. Treat that as an example of current Game Package and launch-composition conventions, not as the required topology for this empty application. Determine the actual minimum valid topology from the current LoomRealm APIs. Do not copy its game logic, content, Pokémon-specific configuration, map data, dialogue behavior, or control composition unless a generic piece is strictly required by LoomRealm itself.

Follow `DESIGN.md` in this repository:

- platform entry projects belong under `apps/pwa/` and `apps/hostra/`;
- reusable application subsystems belong under `systems/`;
- do not add this project's code to `loom-realm/packages`, `loom-realm/game-libs`, or `loom-realm/examples`;
- the `loom-realm` submodule is reference/runtime code and must remain unchanged.

This task is deliberately independent of the CMS 079 client input. Do not read or depend on `F:\CMS079` for this scaffold.

## Allowed Paths

- apps/pwa/**
- apps/hostra/**
- systems/loomrealm-smoke/**
- result/loomrealm-empty-app.md

## Non-goals

- Do not implement CMS 079 gameplay, movement, maps, actors, portals, skills, quests, or content importing.
- Do not modify the `loom-realm` submodule or its pinned commit.
- Do not add client files, WZ files, extracted assets, binaries, archives, or other proprietary inputs.
- Do not introduce a production architecture decision beyond what is required for a minimal smoke-test application.
- Do not modify existing `components/`, `libs/`, other `systems/`, workflows, or agent infrastructure.

## Requirements

- Inspect the pinned LoomRealm `examples/PokeMan` implementation and determine the minimum files and runtime topology needed for an external repository to define a LoomRealm Game Package.
- Create the smallest useful empty application scaffold under `apps/pwa/` and `apps/hostra/`.
- The PWA and Hostra entries should represent the same empty test application rather than two unrelated applications.
- Reuse LoomRealm through the existing `loom-realm` submodule, which must resolve to `c5217e47be5a43f974e9e6ce82230077fb639c39` for this task. Do not fetch a moving branch during execution and do not duplicate LoomRealm source code into this repository.
- If LoomRealm requires at least one subsystem to form a valid Game Package, create a minimal no-op/smoke subsystem under `systems/loomrealm-smoke/`. It must contain no CMS-specific behavior and no persistent product state.
- Keep the Game Package and launch manifests aligned with the current LoomRealm schema demonstrated by the latest pinned PokeMan files, while using the smallest valid generic topology and removing all game-specific data.
- Prefer a deterministic, headless validation path. Add or expose a smoke command/test that verifies as much of the following as the current LoomRealm APIs permit without requiring manual GUI interaction:
  - Game Package JSON can be parsed and validated;
  - PWA launch composition resolves;
  - Hostra launch composition resolves;
  - the no-op subsystem module can be imported/constructed if one is required;
  - references into the checked-out LoomRealm submodule resolve correctly.
- Do not require a web server, browser, CMS client, network service, or local proprietary data for the smoke validation.
- Write `result/loomrealm-empty-app.md` describing:
  - the scaffold that was created;
  - which PokeMan conventions were intentionally reused;
  - which PokeMan/game-specific pieces were intentionally omitted;
  - exact commands for running the smoke validation;
  - how this scaffold is intended to be extended by later CMS tasks.

## Acceptance Criteria

- [ ] `apps/pwa/` contains a minimal LoomRealm PWA entry for the empty test application.
- [ ] `apps/hostra/` contains a minimal LoomRealm Hostra entry for the same empty test application.
- [ ] The implementation uses the checked-out `loom-realm` submodule and does not modify it.
- [ ] Any required subsystem is a minimal generic smoke/no-op subsystem under `systems/loomrealm-smoke/`.
- [ ] There is a deterministic command that validates the scaffold without CMS079 client data or manual GUI interaction.
- [ ] The validation command succeeds on the self-hosted development environment.
- [ ] `result/loomrealm-empty-app.md` documents the resulting structure and validation command.
- [ ] No files outside the Allowed Paths are changed.

## Validation

Inspect the final diff and confirm only the Allowed Paths changed.

Run the new scaffold's headless smoke validation. Also run any directly relevant LoomRealm package/config validation exposed by the pinned submodule if it can be invoked without modifying the submodule or requiring interactive UI.

The final validation must not read `F:\CMS079`, must not require a browser, and must not modify the `loom-realm` submodule.
