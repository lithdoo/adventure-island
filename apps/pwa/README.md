# apps/pwa — PWA entry of the empty LoomRealm test application

This directory is the PWA **installation root** for the empty test application.
It contains no gameplay: it only proves that this repository can define a
LoomRealm Game Package and start it through the PWA launch-composition model
used by `loom-realm/examples/PokeMan`.

| File | Purpose |
|---|---|
| `game.json` | Game Entry V1 — declares the single `smoke` subsystem with a `null` initial input. |
| `launch.pwa.json` | PWA launch composition — binds `smoke` to the logical module `subsystems/smoke.mjs`. |
| `subsystems/smoke.mjs` | Installation-root shim re-exporting `systems/loomrealm-smoke/subsystem.mjs`. |

`apps/hostra` declares the same application for the Hostra platform; both
entries share the identical Game Entry and the same shared subsystem
implementation, so they are one empty test application with two platform
entries, not two applications.

## Validation

```bash
node --test systems/loomrealm-smoke/test/smoke.test.mjs
```

See `result/loomrealm-empty-app.md` for the full scaffold documentation.
