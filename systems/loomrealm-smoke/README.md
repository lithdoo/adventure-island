# systems/loomrealm-smoke

The no-op **smoke Subsystem** shared by the empty LoomRealm application
scaffold (`apps/pwa` and `apps/hostra`), plus the headless smoke validation
suite for that scaffold.

## Why this exists

A LoomRealm Game Package must declare at least one Subsystem, and both platform
launch compositions must bind every declared Subsystem to a module inside the
installation root. The smallest valid topology for the empty application is
therefore a single generic no-op Subsystem bound under the key `smoke`. It
contains no CMS-specific behavior and holds no persistent product state: every
Frame completes immediately with the same frozen value.

## Layout

| File | Purpose |
|---|---|
| `subsystem.mjs` | The shared no-op Subsystem (dependency-free, default-exports a `SubsystemDefinitionFactory`). |
| `test/smoke.test.mjs` | Headless smoke validation for the whole scaffold (see below). |

## Subsystem ABI alignment

The module keeps the exact Subsystem module ABI required by the pinned
`loom-realm` submodule (`packages/subsystem/src/model.ts`): a default-exported
factory returning a definition whose `frame()` returns a frozen
`{ type: "completed", value }` FrameOutcome. The pinned Hostra e2e test
(`packages/game-launcher-hostra/test/e2e.test.mjs`) launches exactly such
dependency-free modules, and PWA executable graph rules
(`buildPwaExecutableIndexV1`) require published executable modules to carry no
bare `@loomrealm/*` imports — so the module is authored dependency-free and is
importable from a bare checkout without building the submodule. When the
submodule has been built, the test suite additionally cross-checks the module
against the real `@loomrealm/subsystem` SDK helpers.

## Running the validation

From the repository root:

```bash
node --test systems/loomrealm-smoke/test/smoke.test.mjs
# or equivalently
npm test --prefix systems/loomrealm-smoke
```

The suite is deterministic and needs no network, browser, server, or client
data. If the `loom-realm` submodule has been built in place
(`npm install && npm run build:packages` inside `loom-realm/`), the same
command additionally validates the scaffold through the real pinned LoomRealm
APIs and boots the empty application through real Main + Hostra hosting.
