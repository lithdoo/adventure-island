# Task 050 — Subsystem Semantic Deep-Recovery Master Campaign

## 0. Mission

Task 050 is the next long-running client reverse-engineering campaign after Tasks 036–049.

The project has already crossed the difficult architectural boundaries:

- the CMS079 `MapleStory.exe` game body is available as an offline recovered analysis corpus;
- the socket/connect/handshake/send/receive core has been identified;
- packet codec primitives and the three-layer inbound dispatch architecture are mapped;
- c2s naming is mature;
- the complete server-side s2c wire-name table has been recovered;
- the range and field dispatch bands are mapped to named packet families;
- a broad first-pass subsystem atlas exists.

The remaining work is no longer primarily “find the code.”

The remaining work is to convert a broad architectural map into a **deep semantic reconstruction of the client**:

```text
named packet / known handler / known sender
    ↓
exact containing function
    ↓
function body semantics
    ↓
object owner
    ↓
field offsets and field meaning
    ↓
class / vtable / ctor / dtor relationships
    ↓
state-machine transitions
    ↓
resource / WZ dependencies
    ↓
packet schema and side effects
    ↓
call-chain context
    ↓
equivalent pseudocode
    ↓
coherent subsystem model
```

This is a **single giant campaign**.

Do not split Character, Field, Mob, Skill, Quest, NPC, Inventory, UI, Cash Shop, Social, or Login into separate tasks.

Do not stop after one subsystem becomes productive.

Continue across subsystems until the time budget is exhausted or the completion criteria in this document are met.

Recommended autonomous run budget:

```text
30–60 hours
```

The preferred outcome is not a list of addresses.

The preferred outcome is a durable client-semantic atlas that lets a researcher navigate CMS079 gameplay logic at the level of:

- classes and objects;
- fields;
- methods;
- packet schemas;
- state transitions;
- resource usage;
- equivalent C/C++-style pseudocode;
- subsystem interactions.

---

# 1. Scope

Task 050 covers the **main `MapleStory.exe` game logic** and uses already-recovered support information only as context.

Primary required subsystems:

1. Character / User / `CWvsContext`;
2. Field / Map / Stage / Portal;
3. Mob / Combat / Damage;
4. Skill / Buff / Debuff / Cooldown;
5. Quest / NPC / Dialog / Shop / Storage;
6. Inventory / Item / Equipment / Meso;
7. UI / Gameplay windows / controls;
8. Social / Party / Guild / Buddy / Chat / Messenger;
9. Login / World / Channel / Character-select / migration;
10. Cash Shop / MTS / transfer phases.

Cross-cutting concerns:

- packet readers and writers;
- handler ownership;
- sender/builder provenance;
- object lifecycle;
- vtables;
- globals/singletons;
- field inference;
- WZ/resource access;
- timers and update loops;
- rendering/audio calls when they expose gameplay semantics;
- exception/security code only when it directly affects game subsystem behavior.

Out of primary scope:

- further protector/VM investigation;
- compatibility-environment experiments;
- expanding support-DLL symbol inventories for their own sake;
- generic protocol work that does not help recover client semantics.

---

# 2. Safety and analysis boundary

This task is an offline/static semantic-recovery campaign over the project’s own analysis corpus and committed normalized artifacts.

Allowed:

- static disassembly/decompilation;
- offline xref analysis;
- control/data-flow analysis;
- comparison with repository-provided reference material;
- server-source/protocol cross-correlation;
- WZ/resource-model correlation;
- building project-owned analysis scripts;
- generation of summaries, graphs, CSVs, schemas, and pseudocode;
- reading already-authorized local analysis corpus under `.work/` when present.

Do not add new protector bypass work.

Do not modify the client to force code paths.

Do not patch conditionals, APIs, security checks, or environment checks.

Do not inject code or hooks.

Do not commit proprietary executable images, raw memory captures, or reconstructed binary code blobs.

If a requested semantic conclusion would require a technique outside this task’s static evidence model, record the evidence gap instead of fabricating certainty.

---

# 3. Repository synchronization gate

Before any analysis:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked or uncommitted user work exists:

- stop;
- report the paths;
- do not overwrite them.

Do not automatically:

```text
git stash
git reset
git restore
git checkout -- .
git rebase
```

If clean:

```text
git fetch origin
```

If needed:

```text
git switch main
```

Then:

```text
git pull --ff-only origin main
git rev-parse HEAD
```

Record this as:

```text
STARTING_HEAD
```

Re-read this task file from disk after synchronization.

---

# 4. Canonical corpus gate

When the original client file is available, verify:

```text
MapleStory.exe SHA-256
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Use the already-recovered Task-036 game-body analysis corpus when locally available.

Do not regenerate or commit proprietary binary artifacts merely to satisfy this task.

If the local recovered image is unavailable:

- use committed normalized artifacts;
- perform only analyses genuinely possible from those artifacts;
- mark binary-dependent phases blocked;
- do not infer function bodies from addresses alone.

Create:

```text
result/task050-preflight.md
```

Record:

- STARTING_HEAD;
- client hash if checked;
- analysis corpus paths used locally;
- corpus hashes if convenient;
- Python version;
- Capstone/Ghidra/IDA/radare2/etc. versions actually used;
- repository scripts used;
- reference bundles used;
- whether full static bytes are locally available.

---

# 5. Mandatory prior results to read

Read the latest committed versions of at least:

```text
README.md

result/36-game-body-materialization-campaign.md
result/task036-materialization-record.md

result/37-game-body-function-recovery.md
result/task037-imports.csv

result/38-game-body-cipher-dispatch-security.md

result/40-game-logic-full-decode-master-campaign.md
result/task040-game-logic-map.csv
result/task040-channel-opcodes.csv
result/task040-s2c-observed.csv

result/41-object-model-deep-dive.md

result/44-live-session-full-atlas.md
result/task044-handler-map.csv

result/45-grand-static-campaign.md

result/46-game-subsystem-mechanical-recovery.md
result/task046-coverage.csv
result/task046-handler-semantics.csv
result/task046-sender-provenance.csv
result/task046-packet-builders.csv
result/task046-class-map.csv
result/task046-vtable-map.csv
result/task046-field-map.csv
result/task046-function-map.csv
result/task046-call-edges.csv
result/task046-behavior-flows.md

result/47-s2c-enumeration.md
result/task047-s2c-opcodes.csv
result/task047-s2c-wire-full.csv

result/48-s2c-renumbering-decode.md
result/task048-s2c-wire-complete.csv
result/task048-handler-complete-map.csv

result/49-field-band-closure-atlas.md
result/task049-complete-s2c-dispatch-map.csv
```

Also read resource/context results where useful:

```text
result/19-wizet-dlls.md
result/20-wz-inventory.md
result/23-wz-library-cross-validation.md
result/01-server-baseline.md
result/02-runtime-network-bootstrap.md
```

Read repository-provided v95/reference material.

Reference policy:

```text
reference symbols = hypothesis generators
reference addresses = NEVER authoritative for CMS079
```

A reference match must be supported structurally.

---

# 6. Starting baseline to independently verify

Do not blindly copy these numbers into the final report.

Regenerate them from current artifacts.

Expected approximate baseline after Task 049:

```text
main-image function candidates        ~51,200
subsystem-classified functions        ~504
high/confirmed semantic names         ~35
class/object candidates               ~65, mostly low confidence
sender sites                           486 total
named/classified sender sites         ~207
packet-builder functions              ~376
known c2s wire names                  ~137
known s2c wire values                 ~217
range dispatcher named entries        58
field-band named entries              111
phase/login/other s2c entries         ~38 at phase level
named inbound handler sites           ~169 across range+field
Task046 pseudocode flows              27
```

Create a fresh baseline ledger:

```text
result/task050-baseline.csv
```

Suggested fields:

```text
metric
value
source_artifact
how_recomputed
confidence
notes
```

Never report a percentage without a meaningful denominator.

---

# 7. Core philosophy

Task 046 answered:

```text
Where are the subsystems?
Which packet names belong to which area?
What broad objects/functions exist?
```

Tasks 047–049 answered much of:

```text
What is each inbound wire packet called?
Which dispatcher/band receives it?
```

Task 050 must answer:

```text
What exactly does the code do?
Which object owns it?
Which fields does it read/write?
What are those fields?
What packet schema does it parse/build?
What state transition occurs?
What resources does it load?
Which other subsystem methods are called?
What C++-like behavior can we reconstruct?
```

Prefer depth over another shallow census.

Do not spend the campaign merely producing more address/name pairs.

Every major result should move at least one row from:

```text
named-but-shallow
```

into:

```text
semantically-understood
```

---

# 8. Evidence model

Every important semantic statement should carry confidence:

```text
confirmed
high
medium
low
unknown
```

Evidence families include:

```text
IMG       direct main-image code evidence
PKT       packet schema / read-write sequence
S2C       server→client wire-name correlation
C2S       client→server wire-name correlation
SRV       server implementation semantics
WZ        WZ path/resource-model evidence
RTTI      RTTI/type evidence
VTBL      vtable evidence
CTOR      constructor/vtable-write evidence
DTOR      destructor/delete evidence
FIELD     repeated field-offset evidence
GLOBAL    singleton/global evidence
CALL      callgraph/caller-callee evidence
STR       unique string evidence
REF       v95/reference structural correlation
IMPORT    imported API semantics
FLOW      cross-function behavioral-flow agreement
```

High-confidence naming should usually have at least two independent evidence families.

Confirmed should be reserved for especially strong cases such as:

```text
wire packet name + exact packet parse + matching field side effects
```

or:

```text
RTTI + vtable + ctor + unique behavior
```

Do not upgrade confidence merely because many weak clues repeat the same assumption.

---

# 9. Naming rules

If an original source symbol is well-supported:

```text
CUser::OnMove
CMob::OnDamaged
CField::OnPacket
```

may be used.

If class identity is strong but exact method name is not:

```text
CUser::HandleMovePacket
CMob::ApplyStatusPacket
```

If even class identity is uncertain:

```text
PlayerLike_HandleMove_A3xxxx
MobLike_UpdateStatus_FExxxx
```

Avoid pretending provisional names are original Wizet source names.

Every map must include:

```text
name_kind = original-like / semantic / provisional / unknown
```

---

# 10. Milestones

## S0 — Baseline reproduced

All Task 046–049 key counts and maps are loaded and normalized.

## S1 — Deep-analysis database built

A reusable static database exists containing:

- function boundaries/candidates;
- basic-block graph;
- direct call graph;
- import-call graph;
- global references;
- string references;
- field-offset accesses;
- RTTI/vtable relations;
- packet reader/writer sequences;
- inbound-handler ownership;
- outbound-sender provenance;
- known packet names;
- WZ/resource strings;
- subsystem labels.

## S2 — Inbound semantic closure materially advanced

Preferred target:

```text
>=140 inbound handler sites with body-level semantic summaries
```

where a summary contains more than the packet name.

## S3 — Sender provenance materially advanced

Preferred target:

```text
>=400 / 486 sender sites classified
>=325 / 486 with packet name or strong symbolic role
```

Stretch:

```text
>=450 classified
```

## S4 — Object-model confidence materially advanced

Preferred target:

```text
>=80 class/object families at medium+
>=50 at high/confirmed
>=60 vtables assigned to semantic owners
>=250 field facts with evidence
```

## S5 — Packet schemas reconstructed

Preferred target:

```text
>=120 inbound packet schemas
>=120 outbound packet schemas
```

A schema should capture ordered reads/writes and semantic fields where possible.

## S6 — State machines recovered

Preferred target:

```text
>=20 subsystem state machines
```

including at least:

- login/character selection;
- map transition;
- user spawn/update;
- mob lifecycle;
- buff lifecycle;
- quest/NPC dialog;
- inventory mutation;
- cash-shop transition;
- party/guild flow;
- UI window lifecycle examples.

## S7 — Equivalent pseudocode baseline

Preferred target:

```text
>=80 non-trivial pseudocode functions/flows
```

with at least 8 from each major gameplay domain where evidence allows.

## S8 — High-confidence semantic naming baseline

Preferred target:

```text
>=180 high/confirmed main-EXE semantic function names
>=700 main-EXE functions classified to a subsystem/role
```

Do not fabricate names merely to hit the target.

## S9 — Cross-subsystem semantic atlas

The major gameplay architecture can be navigated through classes/functions/fields/packets/resources without repeatedly returning to raw disassembly.

## S10 — Practical source-reconstruction baseline

At least five major subsystems have enough information to sketch equivalent class interfaces and core behaviors in C++-like form.

---

# 11. Run strategy

Recommended time allocation:

```text
5%      preflight, artifact normalization, baseline
10–15%  reusable analysis database/tooling
15–20%  inbound handler deep semantics
15–20%  sender/builder interprocedural provenance
20–30%  object/class/field recovery
20–30%  subsystem deep dives + pseudocode/state machines
5–10%   integration, conflict resolution, final atlas
```

Once a tool works, use it across all subsystems.

Avoid spending hours manually repeating a pattern that can be scripted.

Conversely, do not write a huge generic framework before proving it solves at least one real function family.

Use a loop:

```text
manual seed
→ understand one pattern
→ automate pattern
→ validate automation
→ batch apply
→ manually audit samples
→ promote high-confidence results
```

---

# 12. Phase A — Normalize all known packet and handler information

Build one canonical packet table joining:

```text
c2s wire name/value
s2c wire name/value
dispatcher
band
handler RVA
sender sites
builder functions
subsystem
prior confidence
```

Create:

```text
result/task050-packet-master.csv
```

Suggested fields:

```text
direction
opcode_hex
name
dispatch_layer
band
handler_rva
handler_owner_candidate
sender_sites
builder_functions
subsystem
source_artifacts
confidence
notes
```

Resolve conflicting labels explicitly.

Never silently choose one name where Task 046/048/049 disagree.

Create:

```text
result/task050-conflicts.csv
```

for semantic conflicts.

---

# 13. Phase B — Reusable function-analysis database

Create or extend scripts that build a local database under:

```text
.work/task-050/db/
```

The database should index as much as feasible:

```text
function_id
start_rva
end_rva
confidence_of_boundary
basic_blocks
callers
callees
import_calls
string_xrefs
global_reads
global_writes
field_offsets
vtables_referenced
packet_readers
packet_writers
switch_tables
known_handler_packets
known_sender_packets
WZ/resource strings
subsystem label
semantic confidence
```

Reusable committed tooling may live under `scripts/`.

Possible scripts:

```text
scripts/maple079_semantic_db.py
scripts/maple079_function_features.py
scripts/maple079_field_inference.py
scripts/maple079_interproc_provenance.py
scripts/maple079_packet_schema.py
scripts/maple079_ctor_vtable.py
scripts/maple079_state_machine.py
scripts/maple079_semantic_report.py
```

Do not duplicate an existing equivalent script.

Create:

```text
result/task050-analysis-db-summary.md
```

Describe coverage and limitations.

---

# 14. Phase C — Function boundary and ownership refinement

The 51k function-candidate count is useful as an index but not all boundaries are equally reliable.

Classify function boundaries:

```text
high
medium
low
```

Useful evidence:

- direct call targets;
- prologue patterns;
- exception metadata where available;
- vtable entries;
- switch-table targets;
- packet-handler targets;
- known reference functions;
- code-gap structure;
- tail-call patterns.

Identify wrappers/thunks separately from real semantic functions.

Create:

```text
result/task050-function-boundaries.csv
```

Fields:

```text
function_id
start_rva
end_rva
boundary_confidence
kind
owner_candidate
subsystem
reason
```

Kinds may include:

```text
real-function
thunk
wrapper
virtual-method
packet-handler
packet-builder
constructor
destructor
allocator-helper
state-transition
unknown
```

---

# 15. Phase D — Inbound handler body semantics

Task 049 provides named inbound routing.

For each mapped inbound packet, analyze beyond the name.

At minimum capture:

```text
opcode
packet name
handler function or sub-dispatch path
packet reads in exact order
conditional reads
loops
object/global reads
object/global writes
field offsets
calls
allocations
UI effects
resource lookups
outgoing packet side effects
state transition
error/ignore conditions
owner object/class candidate
```

Create:

```text
result/task050-inbound-handler-semantics.csv
```

Suggested fields:

```text
opcode
packet_name
handler_rva
owner
subsystem
read_schema
writes
calls
state_effect
resource_effect
confidence
notes
```

Do not treat a sub-dispatcher RVA as the final per-packet handler unless it truly handles the packet inline.

Where a common sub-dispatcher performs a secondary jump/switch, recover the leaf target.

Important priority bands:

```text
0x20–0x80        stats/inventory/buff/social/UI
0xA2–0xED        player/pet/summon/quest/combat
0xEE–0x103       monster lifecycle/status
0x104–0x10C      NPC lifecycle
0x110–0x111      map items
0x145            NPC dialog
0x146–0x147      NPC shop
0x16F–0x171      keymap/auto-pot
```

---

# 16. Packet schema recovery

For every sufficiently understood handler/sender, reconstruct packet schemas.

Inbound schema example format:

```text
SPAWN_MONSTER
u32 object_id
u8 controller_mode
u32 template_id
...
```

Outbound schema example format:

```text
NPC_TALK
u32 npc_object_id
u8 action
...
```

When field meaning is unknown, use:

```text
u32 unknown_0x0c
```

rather than inventing semantics.

Represent conditional schemas explicitly.

Create:

```text
result/task050-packet-schemas.csv
result/task050-packet-schemas.md
```

CSV fields:

```text
direction
opcode
packet_name
field_index
offset_or_order
wire_type
semantic_name
condition
consumer_or_producer
confidence
notes
```

Use server implementation as a cross-check, not as proof that the client consumes every server field identically.

---

# 17. Phase E — Sender provenance, interprocedural pass

Task 046 reached approximately 207/486 sender sites.

The remaining sites are likely dominated by:

- opcode values passed as parameters;
- wrappers around packet builders;
- object methods that choose opcodes by state;
- small tables;
- branch merges;
- register-carried constants.

Implement interprocedural backward slicing from:

```text
WriteHeader / packet header writer
```

and from known send/flush sites.

Track values through:

```text
mov
lea
push/pop
stack args
fastcall/thiscall registers
local variables
wrapper params
simple arithmetic
select/branch joins
small switch tables
object fields
```

Bound recursion/depth to keep analysis tractable.

Store symbolic expressions when exact constants cannot be determined.

Examples:

```text
opcode = arg1
opcode = this->mode ? 0x42 : 0x43
opcode = table[state]
opcode = caller.arg2
```

Create:

```text
result/task050-sender-provenance.csv
```

Fields:

```text
sender_site
containing_function
builder_function
opcode_numeric
opcode_symbolic
packet_name
provenance_path
caller_context
subsystem
confidence
notes
```

Create:

```text
result/task050-sender-coverage.md
```

with exact baseline/final counts.

Priority:

- high fan-in builder wrappers;
- functions with many sender sites;
- senders adjacent to already-known handlers/classes;
- gameplay domains currently shallow.

---

# 18. Packet-builder family recovery

Task 046 identified approximately 376 builder functions.

For each builder function where feasible, recover:

```text
packet name/opcode
arguments
ordered writes
conditional writes
string writes
object fields serialized
list/vector loops
nested structure writers
```

Classify:

```text
pure-builder
builder+state-change
builder+send
wrapper
unknown
```

Create:

```text
result/task050-builder-semantics.csv
```

Aim to transform the builder census from “contains WriteHeader” into actual packet-format knowledge.

---

# 19. Phase F — Global and singleton inference

Build a global-reference database.

For each global address used by gameplay code, track:

```text
readers
writers
initializers
cleanup functions
packet handlers touching it
subsystem distribution
reference-version analogs
```

Cluster globals by shared access neighborhoods.

Likely roles include:

```text
singleton pointers
static objects
stage/field pointer
socket pointer
context pointer
UI manager
resource manager
skill/quest tables
clock/timer state
packet dispatcher delegates
```

Create:

```text
result/task050-global-map.csv
```

Do not force names where only “singleton-like” is proven.

---

# 20. Phase G — Constructor / destructor / vtable recovery

Use multiple patterns:

```text
mov [this], vtable
base-ctor call
field zeroing/init sequence
allocator → ctor
ctor → global store
release/destructor → delete
vtable slot call patterns
```

Recover vtable families and inheritance hints.

For each vtable:

```text
vtable RVA
slot count
method RVAs
shared slots
unique slots
constructor candidates
destructor candidates
owner candidates
subsystem
RTTI/reference evidence
confidence
```

Create:

```text
result/task050-vtable-map.csv
result/task050-ctor-dtor-map.csv
```

Task 046 produced many low-confidence candidates.

Task 050 should attempt to **promote confidence**, not merely add more anonymous vtables.

---

# 21. Phase H — Field inference engine

For each likely object family, gather memory accesses of the form:

```text
[this + offset]
[reg + offset]
```

where the base register can be tied to an object instance.

For each field offset collect:

```text
read count
write count
access sizes
signed/unsigned operations
comparison constants
packet sources
packet sinks
UI/resource consumers
reference-version candidate
neighboring offsets
```

Infer field roles conservatively.

Examples of strong field evidence:

```text
packet ReadInt32 → [this+0x205C]
then compared against local-player ID
```

is much stronger than:

```text
[this+0x205C] read often
```

Create:

```text
result/task050-field-facts.csv
```

Suggested fields:

```text
owner_candidate
offset
size
readers
writers
packet_sources
packet_sinks
semantic_name
confidence
evidence
reference_candidate
notes
```

---

# 22. Object layout reconstruction

For important classes, produce layout drafts.

Example:

```text
class CSomeObject {
    /* +0x000 */ void* vtable;
    /* +0x004 */ ...;
    /* +0x038 */ int state;
    /* +0x03C */ ...;
};
```

Unknown regions should remain unknown.

Never fabricate contiguous layouts from isolated offsets.

Create:

```text
result/task050-object-layouts.md
result/task050-class-map.csv
```

Each layout should state:

```text
minimum size
known offsets
unknown gaps
method anchors
construction evidence
confidence
```

---

# 23. State-machine extraction

Identify state variables by patterns such as:

```text
switch([this+offset])
cmp [this+offset], constant
write new constant to same field
multiple UI/packet branches keyed by field
```

For each state machine recover:

```text
owner
state field
state values
entry functions
transition conditions
side effects
packets in/out
UI/resource effects
terminal states
```

Create:

```text
result/task050-state-machines.csv
result/task050-state-machines.md
```

Required candidates include:

- CLogin state/substate;
- field/map transition;
- character presence/lifecycle;
- mob lifecycle;
- buff lifecycle;
- NPC dialog;
- NPC shop/storage interaction;
- quest state presentation;
- cash-shop/MTS phase transition;
- UI window show/hide lifecycle;
- party/guild invitation/result flows.

---

# 24. WZ/resource correlation

Use the mature WZ inventory and Wizet DLL knowledge to connect gameplay functions to resources.

Search for:

- string paths;
- property names;
- animation names;
- UI path fragments;
- map/mob/npc/skill/item IDs converted to paths;
- Canvas/NameSpace/ResMan call sequences;
- localized text lookups.

Create:

```text
result/task050-resource-links.csv
```

Fields:

```text
function_rva
subsystem
resource_kind
resource_path_or_pattern
source_of_path
consumer
confidence
notes
```

Goal:

turn functions from:

```text
“unknown UI helper”
```

into evidence such as:

```text
“skill-window icon loader”
```

when resource usage supports it.

---

# 25. Reference-version structural correlation

Use v95/reference material aggressively but carefully.

For a candidate function/class compare:

```text
unique strings
call topology
callee family
packet behavior
field-offset pattern
vtable shape
switch shape
resource path
constants
object lifecycle
```

Do not require byte identity.

Do not copy absolute addresses.

Create:

```text
result/task050-reference-correlation.csv
```

Fields:

```text
cms079_rva
cms079_semantic_name
reference_symbol
reference_version
match_features
conflicts
confidence
notes
```

Record rejected matches when they prevent future false naming.

---

# 26. Character/User deep dive

Create:

```text
result/task050-character-user.md
```

Required questions:

### Identity / context

Recover relationships among:

- `CWvsContext`;
- local character/user object;
- remote user objects;
- CharacterId;
- account/world/channel/character state where present;
- char-changed/migration flags.

### Stats

Deep-analyze handlers/builders for:

```text
UPDATE_STATS
LEVEL_UPDATE
JOB_UPDATE
FAME_RESPONSE
UPDATE_SKILLS
TEMP_STATS
TEMP_STATS_RESET
```

Recover:

- packet fields;
- state fields;
- masks/bitfields;
- local cache updates;
- UI notification calls;
- derived recalculation calls.

### Spawn / look

Analyze:

```text
SPAWN_PLAYER
REMOVE_PLAYER_FROM_MAP
UPDATE_CHAR_LOOK
CHAR_INFO
FACIAL_EXPRESSION
SHOW_FOREIGN_EFFECT
```

Recover:

- local-vs-remote branching;
- object creation/removal;
- appearance serialization;
- field object registration;
- display/animation calls.

### Actions

Connect outgoing:

```text
CLOSE_RANGE_ATTACK
RANGED_ATTACK
MAGIC_ATTACK
TAKE_DAMAGE
FACE_EXPRESSION
CHAR_INFO_REQUEST
```

with local object/state methods.

Deliver:

- class/object candidates;
- field layout facts;
- packet schemas;
- state transitions;
- at least 10 non-trivial pseudocode snippets/flows if evidence permits.

---

# 27. Field/Map/Stage deep dive

Create:

```text
result/task050-field-map.md
```

Analyze:

```text
WARP_TO_MAP
CHANGE_MAP
CHANGE_CHANNEL
CURRENT_MAP_WARP
SPAWN_PORTAL
SPAWN_DOOR
REMOVE_DOOR
MAP_EFFECT
CLOCK
BOSS_ENV
BOAT_EFFECT
BOAT_HIDE
MOVE_PLATFORM
```

Recover:

### Field lifecycle

```text
old field cleanup
resource acquisition
new field construction
object population
camera/background/UI setup
player placement
post-load events
```

### Map identity

Find map-id fields/globals and functions that consume them.

### Portal logic

Recover:

- portal IDs/names;
- target maps;
- client portal state;
- portal requests;
- special-map transitions.

### Stage architecture

Determine whether CMS079 has a clear `CStage`-like abstraction and how field/login/cash-shop stages relate.

### WZ bridge

Trace map ID → WZ path → resource object graph as far as static evidence permits.

Deliver at least 8 representative field/map pseudocode flows.

---

# 28. Mob / Combat deep dive

Create:

```text
result/task050-mob-combat.md
```

Prioritize inbound:

```text
SPAWN_MONSTER
SPAWN_MONSTER_CONTROL
KILL_MONSTER
MOVE_MONSTER
MOVE_MONSTER_RESPONSE
DAMAGE_MONSTER
APPLY_MONSTER_STATUS
CANCEL_MONSTER_STATUS
SHOW_MONSTER_HP
```

Prioritize outbound:

```text
CLOSE_RANGE_ATTACK
RANGED_ATTACK
MAGIC_ATTACK
PASSIVE_ENERGY
TAKE_DAMAGE
SPECIAL_MOVE
```

Recover:

### CMob-like object

- object ID;
- template ID;
- position/movement;
- HP/display state;
- controller ownership;
- status/buff fields;
- spawn/remove registration.

### Movement

Trace movement-fragment parsing/building if present.

### Damage

Recover:

- damage list representation;
- hit counts;
- mob IDs;
- critical/miss flags where identifiable;
- UI damage-number calls;
- server-confirmed vs predicted state.

### Status

Recover buff/debuff/status mask representation where feasible.

Deliver at least 10 combat/mob pseudocode functions/flows.

---

# 29. Skill / Buff / Debuff deep dive

Create:

```text
result/task050-skill-buff.md
```

Analyze:

```text
UPDATE_SKILLS
GIVE_BUFF
CANCEL_BUFF
TEMP_STATS
TEMP_STATS_RESET
SKILL_USE_RESULT
SKILL_EFFECT
CANCEL_SKILL_EFFECT
COOLDOWN
SKILL_MACRO
DISTRIBUTE_SP
SPECIAL_MOVE
```

Recover:

### Skill data

Find:

- skill ID handling;
- level/master-level fields;
- local skill lookup;
- WZ path construction;
- skill metadata/resource loading.

### Buff model

Recover:

- buff mask/bitset representation;
- value/duration/source skill fields;
- application path;
- cancellation path;
- timer/update integration;
- UI icon updates.

### Cooldowns

Locate timer/state structures if possible.

### Macros

Recover macro data layout and packet schemas.

Deliver a draft skill/buff state model plus at least 8 pseudocode flows.

---

# 30. Quest / NPC / Dialog deep dive

Create:

```text
result/task050-quest-npc.md
```

Analyze inbound:

```text
SPAWN_NPC
REMOVE_NPC
SPAWN_NPC_REQUEST_CONTROLLER
NPC_TALK
NPC_ACTION
UPDATE_QUEST_INFO
SHOW_QUEST_COMPLETION
OPEN_NPC_SHOP
CONFIRM_SHOP_TRANSACTION
OPEN_STORAGE
```

Analyze outbound:

```text
NPC_TALK
NPC_TALK_MORE
NPC_SHOP
STORAGE
QUEST_ACTION
```

Recover:

### NPC objects

- object ID;
- template ID;
- position;
- control state;
- animation/resource paths;
- field registration.

### Dialog protocol

Recover dialog message types, response encoding, selection/input fields, and dialog state.

### Quest state

Trace quest IDs, status, progress fields, completion notifications, and any local condition checks.

### Shop/storage

Recover item-entry parsing and UI model where feasible.

Deliver at least 10 pseudocode flows across NPC/quest/shop/storage.

---

# 31. Inventory / Item / Equipment deep dive

Create:

```text
result/task050-inventory-item.md
```

Analyze inbound:

```text
MODIFY_INVENTORY_ITEM
UPDATE_INVENTORY_SLOT
FINISH_SORT
FINISH_GATHER
USE_SKILL_BOOK
SET_TAMING_MOB_INFO
UPDATE_MOUNT
CHAR_CASH
```

Analyze outbound:

```text
ITEM_SORT
ITEM_GATHER
ITEM_MOVE
USE_ITEM
USE_CASH_ITEM
USE_SUMMON_BAG
PET_FOOD
USE_MOUNT_FOOD
USE_CATCH_ITEM
USE_SKILL_BOOK
USE_RETURN_SCROLL
USE_UPGRADE_SCROLL
MESO_DROP
```

Recover:

### Inventory containers

- inventory type/index;
- slot representation;
- item identity;
- quantity;
- equip vs stackable distinction;
- add/remove/update operations.

### Equipment

Trace equipment-stat structures and display calculations where feasible.

### Item serialization

Use packet schemas + server structures to recover common item encoding.

### Item use

Connect UI action → packet builder → local optimistic state → server result.

Deliver at least 10 pseudocode functions/flows.

---

# 32. UI deep dive

Create:

```text
result/task050-ui.md
```

Task 046 identified many low-confidence UI vtable candidates.

Task 050 should promote them by correlating:

```text
ctor patterns
vtable writes
resource strings
WZ paths
packet handlers
button/event callbacks
window show/hide calls
parent/child object creation
reference-version structures
```

Prioritize UI families for:

- login;
- character select;
- status/character info;
- inventory/equipment;
- skill;
- quest;
- keymap;
- chat/messenger;
- party/guild/buddy;
- NPC dialog/shop/storage;
- cash shop/MTS;
- system message/notification.

Recover:

```text
window object
open/show method
close/hide method
button/event callbacks
packet senders
packet-driven refresh methods
resource paths
important fields
```

Create a UI class table:

```text
result/task050-ui-classes.csv
```

Deliver at least 12 UI flows where evidence permits.

---

# 33. Social deep dive

Create:

```text
result/task050-social.md
```

Analyze:

```text
PARTY_OPERATION
GUILD_OPERATION
ALLIANCE_OPERATION
BUDDYLIST
MULTICHAT
WHISPER
BBS_OPERATION
MESSENGER
FAMILY*
GENERAL_CHAT
PARTYCHAT
```

Recover:

- party member structures;
- guild member structures;
- buddy list entries;
- chat routing;
- invite/accept/deny state;
- UI refresh paths;
- packet schemas.

Distinguish:

```text
local social model
UI model
wire packet DTO-like structures
```

when possible.

Deliver at least 8 pseudocode flows.

---

# 34. Login / World / Channel deep dive

Create:

```text
result/task050-login-world-channel.md
```

Existing seed:

```text
CLogin ~0x45EB00
[this+0x64] state
[this+0x68] substate
```

Deepen this into:

- state enum candidates;
- state-transition methods;
- server-list population;
- world/channel selection;
- character-list handling;
- character creation/deletion/select;
- migration/channel transfer;
- transition into field stage;
- error UI paths.

Analyze s2c phase packets:

```text
LOGIN_STATUS
LICENSE_RESULT
CHOOSE_GENDER
GENDER_SET
SERVERSTATUS
SERVERLIST
CHARLIST
SERVER_IP
CHAR_NAME_RESPONSE
ADD_NEW_CHAR_ENTRY
CHANGE_CHANNEL
CHANNEL_SELECTED
```

Connect them to c2s login requests and builders.

Recover at least one coherent login→character-select→field transition state graph.

---

# 35. Cash Shop / MTS deep dive

Create:

```text
result/task050-cashshop-mts.md
```

Analyze:

```text
CS_OPEN
MTS_OPEN
CHAR_CASH
CASH_SONG
ENTER_CASH_SHOP
ENTER_MTS
USE_CASH_ITEM
```

Recover:

- stage/context transition;
- object ownership;
- UI creation;
- inventory/cash-item representation;
- packet schemas;
- return-to-game flow where statically visible.

Separate evidence-backed findings from expected MapleStory architecture.

Deliver at least 5 pseudocode flows.

---

# 36. Pet / Summon / Reactor / Map Object families

These cross several subsystems and should not remain unnamed just because they are not one of the primary dossiers.

Analyze:

```text
SPAWN_PET
MOVE_PET
PET_CHAT
PET_NAMECHANGE
PET_COMMAND
SPAWN_SUMMON
REMOVE_SUMMON
MOVE_SUMMON
SUMMON_ATTACK
DAMAGE_SUMMON
SUMMON_SKILL
REACTOR_SPAWN
REACTOR_HIT
REACTOR_DESTROY
DROP_ITEM_FROM_MAPOBJECT
REMOVE_ITEM_FROM_MAP
```

Create:

```text
result/task050-map-object-families.md
```

Recover common field-object interfaces when possible.

Look for shared base classes/vtable slots among:

```text
CUser-like
CMob-like
CNpc-like
CPet-like
CSummoned-like
CReactor-like
CDrop-like
```

---

# 37. Common object-family / inheritance analysis

Identify repeated virtual-method shapes across field objects.

Potential common operations:

```text
GetObjectId
GetType
Update
Draw
OnPacket
GetPos
SetPos
GetRect
IsKindOf
```

Names above are hypotheses, not assumptions.

Use shared vtable slot topology and repeated call sites.

Create:

```text
result/task050-inheritance-hypotheses.csv
```

Fields:

```text
family
class_a
class_b
shared_slots
shared_methods
base_candidate
confidence
notes
```

---

# 38. Update/tick loop recovery

Find major periodic update methods.

Evidence:

```text
time/tick APIs
field object iteration
timer comparisons
animation updates
UI updates
mob/user updates
```

Recover likely:

- global app update loop;
- field update loop;
- UI update loop;
- object update methods;
- timer/cooldown processing.

Create:

```text
result/task050-update-loops.md
```

Do not confuse protector-era timing code with game update logic.

---

# 39. Event / input routing

Where useful, connect:

```text
Windows input / UI event
→ control/window callback
→ gameplay method
→ packet builder
```

Examples:

```text
inventory double-click → use item
skill hotkey → special move
NPC click → NPC_TALK
portal input → change map
chat submit → chat packet
```

Create:

```text
result/task050-input-action-flows.csv
```

This can significantly improve UI method naming.

---

# 40. Semantic clustering

Use function features to cluster unnamed code around known seeds.

Features may include:

```text
callees
callers
globals
field offsets
strings
WZ paths
packet APIs
vtable membership
imports
neighbor functions
reference matches
```

Do not automatically convert clustering into high-confidence names.

Use it to prioritize manual review.

Create:

```text
result/task050-clusters.csv
```

Include cluster explanation and representative anchors.

---

# 41. Interprocedural field propagation

When a field-bearing object passes through wrappers/helpers, track its identity across calls.

Support common calling conventions:

```text
thiscall ecx
fastcall ecx/edx
stack this pointer
wrapper-local alias
```

This is important for:

- `CUser`/`CMob` helpers;
- UI helpers;
- packet serializers;
- field-object lifecycle functions.

Record alias-confidence to avoid false ownership.

---

# 42. Semantic call graph

Create a normalized gameplay call graph:

```text
result/task050-call-edges.csv
```

Fields:

```text
caller
callee
caller_name
callee_name
caller_subsystem
callee_subsystem
edge_kind
packet_context
state_context
confidence
notes
```

Edge kinds:

```text
direct
virtual
wrapper
projected-reference
packet-triggered
resource-call
unknown
```

Do not mix projected reference edges with observed CMS079 calls.

---

# 43. Behavioral flow reconstruction

Task 046 produced 27 flows.

Task 050 should expand and deepen them.

Each flow should include:

```text
trigger
packet/input/resource event
entry function
important calls
objects touched
fields read/written
state transition
outgoing packets
UI/resource effects
termination/result
confidence
```

Create:

```text
result/task050-behavior-flows.md
```

Preferred target:

```text
>=60 total flows
```

Stretch:

```text
>=80
```

Do not count trivial one-call wrappers as flows.

---

# 44. Equivalent pseudocode standard

Pseudocode should be evidence-backed and should not pretend to be the original source.

Good:

```cpp
// semantic reconstruction, not original source
void CharacterContext::ApplyStatUpdate(Packet& p) {
    uint32_t mask = p.ReadInt32();
    if (mask & kLevelBit) {
        level = p.ReadByte();
    }
    if (mask & kJobBit) {
        job = p.ReadInt16();
    }
    RefreshStatusUI(mask);
}
```

Bad:

```cpp
void CWvsContext::OnStatChanged(...) // exact original name asserted without evidence
```

unless the original-style name is strongly supported.

For every pseudocode block record source RVAs/functions nearby.

---

# 45. Pseudocode deliverables

Create subsystem pseudocode files when depth warrants:

```text
result/task050-pseudocode-character.md
result/task050-pseudocode-field.md
result/task050-pseudocode-mob.md
result/task050-pseudocode-skill.md
result/task050-pseudocode-quest-npc.md
result/task050-pseudocode-inventory.md
result/task050-pseudocode-ui.md
result/task050-pseudocode-social.md
result/task050-pseudocode-login.md
result/task050-pseudocode-cashshop.md
```

Do not create empty placeholders.

---

# 46. Class interface sketches

For sufficiently understood classes, produce semantic interface sketches.

Example format:

```cpp
class MobLike {
public:
    void ApplyMovePacket(Packet&);
    void ApplyDamagePacket(Packet&);
    void ApplyStatusPacket(Packet&);
    int  GetObjectId() const;

private:
    // +0x?? confirmed/probable fields only
};
```

Create:

```text
result/task050-class-interfaces.md
```

Each class should state:

```text
identity confidence
method confidence
field confidence
reference correlation
known unknowns
```

---

# 47. Confidence promotion campaign

Task 046 left many low-confidence class candidates.

Create a dedicated ledger:

```text
result/task050-confidence-promotions.csv
```

Fields:

```text
entity
old_confidence
new_confidence
new_evidence
conflicts_resolved
notes
```

A major success of Task 050 is not just finding new things but converting:

```text
low → medium
medium → high
```

for important classes/functions/fields.

---

# 48. Contradiction handling

When server semantics, reference semantics, and client code disagree:

1. keep the CMS079 client code as primary for client behavior;
2. keep wire observations as primary for actual protocol values;
3. treat server code as implementation context;
4. treat v95 as reference only.

Record contradictions:

```text
result/task050-contradictions.md
```

Do not silently force all sources to agree.

---

# 49. Coverage metrics

Maintain:

```text
result/task050-coverage.csv
```

Track at least:

```text
function candidates
reliable function boundaries
subsystem-classified functions
medium+ semantic functions
high+ semantic functions
class/object candidates
medium+ classes
high+ classes
assigned vtables
field facts
high+ field facts
inbound packet names
inbound leaf handlers located
inbound handlers with body summaries
inbound packet schemas
sender sites total
sender sites classified
sender sites packet-named
builder functions total
builder functions semantically summarized
outbound packet schemas
state machines
WZ/resource links
reference correlations
pseudocode functions/flows
```

For every metric preserve:

```text
baseline
current
preferred target
```

---

# 50. Per-subsystem coverage table

Maintain:

```text
result/task050-subsystem-coverage.csv
```

One row per subsystem with fields:

```text
subsystem
function_count_classified
high_semantic_functions
classes_medium_plus
fields_known
inbound_handlers
outbound_senders
packet_schemas
state_machines
pseudocode_flows
resource_links
largest_gap
confidence
```

This becomes the best future answer to “how much of the client is reversed?”

---

# 51. Work prioritization score

Use a simple prioritization score for unknown functions.

Possible factors:

```text
+ known packet association
+ known subsystem callers
+ vtable membership
+ high fan-in/fan-out
+ unique string
+ WZ/resource path
+ server/reference correlation
+ touches known object fields
+ bridges two known components
```

Low-value isolated helpers should not consume the campaign early.

Create:

```text
result/task050-hotspots.csv
```

with top unresolved functions/objects.

---

# 52. Tool validation

Any new automatic naming/inference script must be validated against known anchors.

At minimum test on:

```text
CClientSocket::Connect
CClientSocket::ProcessRecv
WARP_TO_MAP handler
SPAWN_PLAYER handler
KEYMAP handler
WriteHeader
CLogin state machine region
CWvsContext known fields
```

Measure false-positive behavior.

Do not apply automatic high-confidence naming if validation is poor.

---

# 53. Checkpoint policy

This is one Task 050 campaign, but long runs may make checkpoint commits useful.

Permitted checkpoint commits:

```text
Task 050 checkpoint semantic database
Task 050 checkpoint sender provenance
Task 050 checkpoint object model
Task 050 checkpoint subsystem dossiers
```

Do not stop merely because a checkpoint was committed.

Continue the same task unless a real stop condition is reached.

Before each commit:

```text
git status --short
git diff
git diff --cached
```

Never force push.

---

# 54. Durable result artifacts

Core required artifacts:

```text
result/50-subsystem-semantic-deep-recovery.md
result/task050-preflight.md
result/task050-baseline.csv
result/task050-milestones.csv
result/task050-blockers.csv
result/task050-coverage.csv
result/task050-subsystem-coverage.csv
result/task050-packet-master.csv
result/task050-conflicts.csv
result/task050-function-map.csv
result/task050-call-edges.csv
result/task050-inbound-handler-semantics.csv
result/task050-packet-schemas.csv
result/task050-packet-schemas.md
result/task050-sender-provenance.csv
result/task050-builder-semantics.csv
result/task050-global-map.csv
result/task050-vtable-map.csv
result/task050-ctor-dtor-map.csv
result/task050-field-facts.csv
result/task050-class-map.csv
result/task050-object-layouts.md
result/task050-state-machines.csv
result/task050-state-machines.md
result/task050-resource-links.csv
result/task050-reference-correlation.csv
result/task050-confidence-promotions.csv
result/task050-hotspots.csv
result/task050-behavior-flows.md
result/task050-class-interfaces.md
```

Required subsystem dossiers:

```text
result/task050-character-user.md
result/task050-field-map.md
result/task050-mob-combat.md
result/task050-skill-buff.md
result/task050-quest-npc.md
result/task050-inventory-item.md
result/task050-ui.md
result/task050-social.md
result/task050-login-world-channel.md
result/task050-cashshop-mts.md
result/task050-map-object-families.md
```

Conditional pseudocode files only when populated:

```text
result/task050-pseudocode-*.md
```

Do not create empty files just to satisfy the list.

---

# 55. Function map schema

`result/task050-function-map.csv` should preferably include:

```text
function_id
rva
end_rva
boundary_confidence
semantic_name
name_kind
semantic_confidence
subsystem
owner_class
vtable_slot
packet_in
packet_out
fields_read
fields_written
important_callees
important_callers
strings
resource_links
reference_symbol
reference_confidence
pseudocode_artifact
notes
```

---

# 56. Class map schema

`result/task050-class-map.csv` should preferably include:

```text
class_id
semantic_name
name_kind
confidence
subsystem
rtti
vtable_rva
vtable_slots
ctor_rvas
dtor_rvas
singleton_global
static_object
minimum_size
field_count_known
method_count_known
packet_handlers
packet_senders
reference_class
reference_basis
notes
```

---

# 57. Field-fact schema

`result/task050-field-facts.csv`:

```text
class_or_object
offset_hex
size
semantic_name
confidence
read_functions
write_functions
packet_sources
packet_sinks
comparison_constants
resource_consumers
reference_field
notes
```

---

# 58. Milestone ledger

Maintain:

```text
result/task050-milestones.csv
```

Fields:

```text
milestone
status
time_or_checkpoint
evidence
artifact
confidence
notes
```

Statuses:

```text
not-started
in-progress
reached
partial
blocked
not-applicable
```

Do not mark S4/S8 reached based purely on low-confidence candidate counts.

---

# 59. Blocker ledger

Maintain:

```text
result/task050-blockers.csv
```

Fields:

```text
blocker_id
subsystem
stage
symptom
evidence
attempted_methods
why_unresolved
needs_richer_corpus
next_safe_option
```

Record a blocker once, then move to another productive branch unless it blocks the entire campaign.

---

# 60. Stop conditions

Do not stop because:

- one function is hard;
- one class lacks RTTI;
- one sender provenance fails;
- a reference match is rejected;
- one subsystem reaches a local plateau.

Switch branches and continue.

Valid stop conditions:

### Stop A — Strong completion

S8/S9 reached and most major subsystems have useful deep models.

### Stop B — Practical corpus boundary

Static semantics remaining are dominated by facts impossible to infer without later-phase populated state, and this is demonstrated subsystem by subsystem.

### Stop C — Missing corpus

Required recovered-image bytes are unavailable and committed normalized artifacts are insufficient for deep analysis.

### Stop D — Time budget

30–60 hours of high-value work completed, with durable maps/scripts and a precise continuation.

---

# 61. What counts as strong completion

A strong completion should look approximately like:

```text
>=180 high/confirmed semantic functions
>=700 subsystem-classified functions
>=400/486 senders classified
>=325 senders packet-named or strongly role-named
>=80 medium+ classes/objects
>=50 high+ classes/objects
>=250 field facts
>=140 inbound handler body summaries
>=120 inbound packet schemas
>=120 outbound packet schemas
>=20 state machines
>=60 deep pseudocode flows
all 10 major subsystem dossiers materially populated
```

These are preferred targets, not quotas that justify weak naming.

Quality beats artificial count completion.

---

# 62. What counts as weak completion

The following is not enough:

```text
“read all handlers”
“generated 50k functions”
“classified many by address range”
“copied v95 names”
“mapped all opcodes”
```

without deeper body semantics.

A weak completion that only adds names should explicitly say so.

---

# 63. Final report requirements

Final report:

```text
result/50-subsystem-semantic-deep-recovery.md
```

Must contain:

## Repository state

```text
STARTING_HEAD
FINAL_COMMIT
push status
checkpoint commits
```

## Corpus

```text
client hash
recovered image availability
analysis tools
reference sources
```

## Highest milestone

State S0–S10 honestly.

## Baseline → final table

Include all coverage metrics.

## Major semantic achievements

At least the top 30 newly understood functions/classes/fields/state machines.

## Per-subsystem summary

For each:

```text
Character/User
Field/Map
Mob/Combat
Skill/Buff
Quest/NPC
Inventory/Item
UI
Social
Login/World/Channel
CashShop/MTS
```

report:

- class/object families;
- high-confidence functions;
- fields/layout;
- inbound packet handlers;
- outbound senders;
- packet schemas;
- state machines;
- WZ/resource links;
- representative pseudocode flows;
- largest unresolved gap.

## Sender recovery

```text
baseline named
final classified
final packet-named
remaining
major provenance patterns
```

## Inbound recovery

```text
handler sites total
leaf handlers located
body summaries
packet schemas
```

## Object model

```text
class candidates
medium+
high+
vtables assigned
fields recovered
```

## Pseudocode

Count and list the strongest examples.

## Static corpus boundary

Answer precisely:

```text
What can still be recovered statically?
What now genuinely needs populated runtime state?
```

## Next direction

Recommend one broad next campaign, not ten microtasks.

---

# 64. Final top lists

Final report must include:

```text
Top 30 newly recovered semantic functions/methods
Top 20 newly recovered classes/objects
Top 30 strongest field facts
Top 20 state-machine discoveries
Top 30 unresolved semantic hotspots
```

Each item should include confidence and evidence basis.

---

# 65. Commit hygiene

Never commit:

```text
.raw/
.work/
original EXE/DLL/DAT/WZ files
recovered executable image
raw memory capture
large disassembler databases
bulk binary blobs
raw third-party source trees
```

Reusable project-owned scripts are allowed.

Normalized CSV/Markdown results are allowed.

Check before final commit:

```text
git status --short
git diff
git diff --cached
```

Preferred final commit message:

```text
Complete Task 050 subsystem semantic deep recovery master campaign
```

Then:

```text
git rev-parse HEAD
```

Record:

```text
FINAL_COMMIT
```

Push:

```text
git push origin main
```

No force push.

If the remote advanced:

- fetch;
- report divergence;
- do not rewrite history automatically.

---

# 66. Recommended autonomous work loop

The local agent should repeatedly execute:

```text
1. choose highest-value unresolved semantic anchor
2. inspect direct code
3. collect caller/callee/field/string/resource/packet evidence
4. compare server/reference behavior
5. produce provisional semantic model
6. validate against at least one independent evidence family
7. update maps
8. identify repeatable pattern
9. automate if worthwhile
10. batch apply
11. manually audit samples
12. promote confidence where justified
13. move to next subsystem/hotspot
```

Do not repeatedly ask the user which function to analyze next.

Use the task priorities and evidence score autonomously.

---

# 67. Suggested first 12 hours

A productive opening sequence is:

### Hour 0–2

- sync;
- normalize 046–049 artifacts;
- rebuild baseline;
- create packet master table;
- build or refresh function-analysis database.

### Hour 2–5

- deepen 0x20–0x80 inbound handlers;
- recover packet reader schemas;
- extract field writes;
- prioritize UPDATE_STATS / inventory / buff / social handlers.

### Hour 5–8

- deepen player lifecycle 0xA2–0xED;
- separate leaf handlers;
- identify CUser/Pet/Summon families;
- begin field-offset clusters.

### Hour 8–12

- monster/NPC bands;
- ctor/vtable correlation;
- interprocedural sender-provenance tool proof;
- first object layouts.

This is guidance, not a rigid schedule.

---

# 68. Suggested second 12 hours

Prioritize:

- sender provenance batch pass;
- packet builder schemas;
- field inference;
- UI ctor/vtable promotion;
- Character/Field/Mob/Skill dossiers;
- state-machine extraction.

Checkpoint if useful, but continue.

---

# 69. Suggested later hours

Shift from breadth to semantic closure:

```text
unknown packet field → semantic field
anonymous vtable → class family
class family → field layout
field layout → pseudocode
pseudocode → cross-subsystem flow
```

Focus on entities that unlock many neighbors.

---

# 70. Final campaign principle

Task 050 should move the project from:

```text
“We know where most major client logic lives and what packets route to it.”
```

into:

```text
“We can explain how the major CMS079 client subsystems represent state,
process packets, update objects, interact with resources, and emit actions,
with evidence-backed class/field/method models and equivalent pseudocode.”
```

That is the acceptance standard.
