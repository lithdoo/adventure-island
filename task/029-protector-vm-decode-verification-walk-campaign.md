# Task 029 — Protector VM Decode & Verification-Walk Semantics Campaign

## 0. Mission

Task 029 continues directly from Task 028 and makes the current technical
objective precise:

> Decode the protector's bytecode VM (handler table, opcode semantics,
> bytecode programs), read out the verification walk's 26 check items with
> their staged inputs and expected values, name the exact check(s) whose
> real-guest inputs differ from the replay, close D3 with a faithful model
> — or prove that the boundary requires live extraction — and if the
> faithful replay naturally passes the old divergence (D4), immediately
> continue the standing ladder through import reconstruction, `ijl15.dll`,
> Tail-A materialization, and the first main-EXE game anchors.

This is a **long-running exploratory reverse-engineering campaign**. The
local AI should work autonomously for approximately 8–16 hours if the
environment permits, iterating through offline decoding, replay
experiments, and static analysis without stopping after a single
sub-result.

Task 029 is not a general re-audit of replay fidelity and not another
environment sweep. Task 028 already fixed every externally-testable
semantic defect and falsified the timing/PEB/TEB/concurrency hypotheses
three ways. The divergence is now known to live **inside the staged-data
dimension of the walk**, and the VM decode is the only remaining
evidence channel that can name it.

The central cut point Task 029 inherits:

```text
VM handler table @ RVA 0x84B1E0
  -> opcode reference (all reachable handlers documented)
  -> decoded Z-program (208 ops) / X-program (127 ops)
  -> staged actual-parameter table (dynamic, 26 items)
     vs expected-value immediates (static, decoded from bytecode)
  -> the failing check(s) named with named inputs
  -> faithful replay naturally passes (D4)
       -> import rebuild watch -> ijl15 -> Tail A -> game body (D5-D9)
  OR the boundary is proven to require prohibited live extraction
     (Stop B/C condition, honestly recorded)
```

---

# 0.1 Starting evidence model

Treat the following Task 028 findings as the starting model, but verify
them from current repository artifacts after synchronization:

- canonical `MapleStory.exe` SHA-256:
  `5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d`;
- the post-probe corridor is a **bytecode VM**:
  - handler table at RVA **0x84B1E0**; **opcode 0x00 = the error
    reporter 0xC5941F itself**;
  - dispatch `jmp dword ptr [edi + eax*4]` at RVA 0x8574D9 on an
    obfuscated opcode byte (`xor bl, al; movzx eax, al`);
  - bytecode stream at `esi` (RVA 0x8624xx–0x8662xx); the Task 012-era
    0x862000+ zone (incl. the #UD/SEH choreography 0x862E76/0x862F19) is
    VM bytecode territory;
  - encrypted frame base `ebp = 0xF97D9014`; all VM state addressed
    `[ebp + 0x744xxxx]` → Tail B;
- first opcode semantics already decoded (Task 028 static pass):
  0x61/0x3E = `lodsb; xor al, bl` immediate fetch, 0x88/0x8E/0x92 =
  32-bit immediate variants, 0x7D = `pop [edx]` store-to-cell,
  0x99 = `push [edx]` push-cell, 0xA6 = conditional check
  (`lodsd; jmp 0xC4F6A5` → `cmp [edi+0x20],0; je`), 0x36 =
  `push [edi+0x38]`;
- the verification walk = **26 unrolled check items** in the bytecode;
  steady-state items run strictly repeating programs (Z-family 208 ops,
  X-family 127 ops); one anomalous 92-op Z-item (n≈19,996,653) and
  boundary programs (59-op item 25, 132-op post-walk tail);
- the walk **completes normally** — the accumulator timeline
  (0x46 boundary states / 0x83–0x97 running states, parity 1 mid-walk)
  shows the "item-25 anomaly" was the planned phase boundary, not a
  failed comparison;
- **D1** = the VM continuation store, RVA 0x84E638 `pop [edx]` at
  n=20,204,446, installing 0xC5941F into cell [0x84B1E0] (overwriting
  the 13th timeGetTime sample); consumed by 0x85694F `push [edx]` and
  the final `ret` (0x857108);
- the corridor's **complete external surface** is tiny and faithful:
  kernel32/advapi32 export structures (manual hash-based resolution —
  custom CRC-32, polynomial 0x54495041 "APIT"; `Sleep` resolution
  proven end-to-end), `timeGetTime` ×2022, `Sleep(50)` ×1 — and
  **zero PEB/TEB debug-field reads**;
- timing falsified three ways as the divergence cause: rate (Task 027
  scale tests), granularity (15.625 ms quantization changes flow not
  outcome), absolute uptime (measured-plausible 60–300 s sweep invariant);
- concurrency falsified (no thread/sync APIs on the path);
- Task 028 fidelity fixes in place: GetVersionExA strict layout + 16-byte
  OOB write removed, GetCommandLineA quoting verified against the
  WMI-captured exact form (`"F:\MapleStory.exe"`, run A1R2), RegOpenKeyA
  duplicate-handle value normalized;
- tooling available: corridor checkpoint v2 (~30 s iterations), selective
  JSONL tracer with per-instruction registers/flags/writes/reads,
  uncapped API log, Tail-A write provenance monitor, `--tgt-15ms`,
  `--vclock-base`, `--cmdline` fidelity options;
- Tail A still has **0 writes** in every state; ZtlTaskMem slots zero;
  no import-rebuild / ijl15 / ws2_32 / 9555 activity has ever appeared;
- the decoded-image dump at the corridor stop is reproducible
  (`--dump-image`; RVA == file offset in the dump).

Do not silently relabel protector/loader functions as game functions.

---

# 0.2 Safety / research boundary

Allowed:

- offline static analysis and dynamic replay of the user's local client
  binaries (including full decoding of the protector VM, its bytecode,
  and its expected-value tables — these are analysis outputs, not
  bypasses);
- faithful implementation of documented or experimentally measured Win7
  API semantics;
- dynamic tracing, def-use/slicing, provenance analysis inside the
  offline emulator;
- standalone guest-side truth probes that call normal Win7 APIs in their
  own helper process (e.g., to pin Win7 Pro's exact `wSuiteMask` bits);
- normal passive observation and the opportunistic VM-gate policy
  inherited from Task 028;
- reference correlation using repository-provided v95 or other approved
  symbol bundles (names/structures only, never addresses).

Forbidden (unchanged from Task 028, restated because they are precisely
the temptations this task's objective creates):

- patching `MapleStory.exe`, `ijl15.dll`, `iloveaki.dat`, or protection
  code;
- forcing any conditional branch / register / flag / memory value in the
  replay merely to see downstream code — **including writing "expected"
  values into the walk's staged-parameter table by guesswork**;
- spoofing API results, timing, CPUID, debugger/VM state, or registry;
- anti-debug or anti-emulation bypass;
- dumping decrypted/protected main-EXE code from a running process,
  `ReadProcessMemory` extraction, DLL injection, behavior-changing hooks;
- committing reconstructed executable blobs, decrypted sections, raw VM/
  process dumps, or proprietary binaries.

The distinction that governs this whole task:

```text
expected values read out of the protector's own bytecode = analysis
staged actuals produced by a faithful replay              = analysis
writing either by hand to make the walk pass               = forbidden
```

If the decode shows the walk can only pass with data the offline replay
cannot faithfully produce, record the blocker and stop that branch
(Stop B/C condition) rather than synthesizing the value.

---

# 1. Repository synchronization gate

Identical to Task 028 §1. From a clean `origin/main`:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted changes exist, stop and report. Otherwise:

```text
git fetch origin
git switch main      # if needed
git pull --ff-only origin main
git rev-parse HEAD        # record as STARTING_HEAD
```

Then re-read this Task 029 document from disk. Do not use a cached copy.

---

# 2. Directory / artifact contract

```text
.raw/                   proprietary inputs, read-only
task/                   task specifications
.work/task-029/         all scratch decoding, traces, dumps, probes
result/                 compact permanent conclusions/normalized tables
scripts/                reusable project-owned tooling
glm-work/               prior-research reference only
```

Recommended scratch structure:

```text
.work/task-029/
├── preflight/
├── vmref/              opcode-handler disassembly/reference work
├── programs/           decoded Z/X/boundary program listings
├── staging/            staged-parameter table dumps (actual vs expected)
├── replay-runs/        differential replay outputs
├── guest-truth-probes/
├── materialization/    Tail-A images if D6 is reached
├── functions/ classes/ references/ network/
└── logs/
```

Never commit original EXE/DLL/DAT/SYS/VXD/WZ files, dumps, replay images
containing decoded code, decrypted blobs, VM/process dumps, ETL/EVTX/
PCAP, decompiler databases, or huge raw traces. Commit only normalized
textual/CSV findings and reusable project-owned scripts.

---

# 3. Mandatory reading

After synchronization read at least:

```text
README.md
task/028-protector-decision-tail-a-materialization-campaign.md
result/28-protector-decision-tail-a-materialization.md
result/task028-milestones.csv
result/task028-blockers.csv
result/task028-decision-isolation.md
result/task028-decision-slice.md
result/task028-provenance-edges.csv
result/task028-main-static-bridge.md          # incl. the opcode table
result/task028-replay-fidelity-fixes.csv
result/task028-api-fidelity.csv
result/task028-replay-determinism.csv
result/task028-guest-truth.csv
scripts/maple079_full_replay.py
```

Context (read as needed): Task 027 results (`27-main-exe-game-logic-
recovery.md`, `task027-main-static-bridge.md`, `task027-decoder-targets.csv`),
the Task 012/012c evidence for 0x862000+ round-3/Tail A/ZtlTaskMem,
and the protector-chain results 06–10b. Support-runtime context:
`result/19-wizet-dlls.md`, `20-wz-inventory.md`, `23-wz-library-cross-
validation.md`. Server/network baseline: `01`, `02`, `03`.

---

# 4. Canonical sample and tool gate

Revalidate the canonical hash and that the replay tool starts cleanly:

```text
python scripts/maple079_full_replay.py --help
```

Record Python/Unicorn/Capstone versions, host arch, sample hash, and
guest-DLL source identity. If the hash differs, stop reuse of prior RVA
evidence.

Reproduce the Task 028 final baseline once (post-fix default: count
20,211,772, error box, corridor checkpoint at n=18,865,228) and record
it as the Task 029 reference run before any new work.

Create:

```text
result/task029-replay-baseline.md
```

---

# 5. Milestone model

Task 029 continues the Task 028 **D-ladder** and adds **W-milestones**
for the decode work. W-milestones map onto the D-ladder as noted.

## W0 — VM opcode reference

Every handler reachable from the table at RVA 0x84B1E0 (plus any
secondary tables discovered) is disassembled from the dumped decoded
image and its semantics documented at the level needed to interpret the
walk programs (fetch/stack/ALU/cell/branch/continuation classes).

## W1 — Walk programs decoded

The steady-state Z-program (208 ops) and X-program (127 ops), the
boundary programs (items 0–3, 25–26, the 92-op anomalous item, and the
132-op post-walk tail) are decoded into readable instruction listings
with resolved immediates and cell references.

## W2 — Parameter tables extracted

- **actual**: the staged values each walk item reads (VM cells
  0x84B364/0x84B3B4/0x84B404/0x84B478/0x84B480 and any further cells the
  decode reveals), dumped per item from the faithful replay;
- **expected**: the value immediates decoded from the bytecode
  (protector constants).

Both tables published as normalized CSV.

## W3 — Failing check(s) named

The per-item comparison (actual vs expected, plus the accumulator fold)
identifies precisely which item(s) fail in the replay and what each
consumes. Requires: item id, program, inputs, expected, actual,
accumulator effect.

## D3 (completion) — real Win7 semantics for every named input

For each input of the named failing check(s), determine real-vs-replay
semantics (documentation, system-DLL disassembly, guest truth probes).
Classify faithful/incomplete/incorrect/unknown/context-dependent.

## D4 — Faithful replay passes the old divergence

After only evidence-backed corrections (or after proving the walk's
expected values are self-consistent with faithful staging), the replay
naturally takes the non-error continuation and reaches a new stable
protector stage. If not reachable, record the honest boundary.

## D5/D6/D7/D8/D9 — unchanged from Task 028

Import reconstruction / ijl15 boundary; Tail-A materialization with
producer provenance; ≥5 and ≥20 main-EXE game anchors; network/login
boundary if naturally reached.

W0→W3 are the decode core (≈40–60% of the campaign); D3-completion and
the D4 attempt follow directly; if D4 falls, immediately shift most
effort to D5–D9 per the standing ladder.

---

# 6. Time budget / priority

```text
8–16 hours total

baseline + W0 opcode reference        10–20%
W1/W2 program + table decode          25–35%
W3 failing-check naming + D3          15–25%
D4 attempt (fix or boundary proof)    10–20%
D5–D9 continuation if D4 falls        30–60% once reached
VM experiments / guest probes         <=5% (opportunistic)
```

Do not re-litigate falsified hypotheses (timing scale/granularity/
absolute uptime, PEB/TEB debug fields, concurrency, cmdline quoting,
GetVersionEx layout) — they are closed unless the decode surfaces a
*specific* new consumer, in which case reopen with that evidence only.

---

# 7. Phase A — Build the VM opcode reference (W0)

1. Regenerate the decoded-image dump at the corridor stop
   (`--resume-ck .work/task-028/checkpoints --dump-image …`) and
   verify it against the Task 028 dump.
2. Read the full handler table (0x84B1E0, 0x100 entries) from the dump;
   classify entries (in-image gadget chains vs data).
3. For each entry, disassemble and follow the short gadget chain
   (the handlers are 5–30 instruction thunks that join the shared
   obfuscated corridor); assign a semantic class:
   `imm8/imm16/imm32-fetch (xor/add/sub keyed)`, `push-cell`,
   `pop-cell`, `stack-shuffle`, `ALU`, `check/branch`, `continuation
   push`, `report (opcode 0)`, `syscall-thunk`, `unknown`.
4. Cross-validate every class dynamically: the Task 028 tracer already
   logs per-instruction state; add a **clean opcode tracer** to
   `scripts/maple079_full_replay.py` (record the dispatch index only at
   the exact `movzx eax, al`→`jmp [edi+eax*4]` pair with `edi` equal to
   the table base — this also removes the extraction-noise seen in the
   Task 028 ad-hoc opcode stream).
5. Output:

```text
result/task029-vm-opcode-reference.csv
```

(opcode, handler RVA, class, first instructions, dynamic exec count,
notes). Reachable-but-never-executed handlers stay `static-only`.

---

# 8. Phase B — Decode the walk programs (W1)

1. From the W0 reference, write a **bytecode disassembler** (reusable
   `scripts/` module): walk `esi` from a known program entry applying
   each handler's fetch width/key until the next dispatch leaves the
   program (or the item's check completes).
2. Decode, at minimum: the steady-state Z and X programs, items 0–3
   (staging: export walks + "APIT"-CRC hashing), item 25/26 boundary
   programs, the anomalous 92-op item, and the post-walk tail that
   computes/installs the error continuation (constants like
   `add [esp+4], 0x2E3D5322` must fall out of the decode, not out of
   the trace, proving the decoder).
3. Output:

```text
result/task029-walk-programs.md      (annotated listings)
result/task029-vm-program-catalog.csv
```

---

# 9. Phase C — Extract the parameter tables (W2)

1. **Actual table**: extend the replay to dump, per walk item, the
   values read from the check-parameter cells (the read-set is known
   from Task 028; the decode may reveal more). Also dump the accumulator
   fold value per item.
2. **Expected table**: from the Phase B listings, extract every
   comparison immediate / expected cell value per item.
3. Publish both as:

```text
result/task029-staged-parameters.csv   (item, cell/operand, actual, expected, match)
```

---

# 10. Phase D — Name the failing check(s) (W3) and close D3

1. Diff actual vs expected per item; enumerate every mismatching item
   with its decoded semantics.
2. For each mismatching input, trace provenance (Task 028 tooling:
   writer search, read-map, apilog) to its root source and determine
   the real Win7 semantics (documents, DLL disassembly, or a standalone
   guest truth probe — e.g., `wSuiteMask` bits, if anything consumes
   them).
3. Classify each root input faithful/incomplete/incorrect/unknown and
   update:

```text
result/task029-decision-input-semantics.csv
result/task029-guest-truth.csv        (append probe results)
```

---

# 11. Phase E — D4 attempt or boundary proof

- If a faithful correction exists: implement it (smallest change,
  documented issue/old/new/evidence/regression, appended to
  `result/task029-replay-fidelity-fixes.csv`), rerun from the corridor
  checkpoint, compare normalized traces, and check whether the walk
  aggregate and the post-walk continuation change **naturally**.
- If the decode shows the walk's expected values depend on data only a
  live protected process can produce (e.g., values sealed to the real
  machine), record the boundary precisely (Stop B/C) — that is a valid
  and valuable campaign outcome; do not synthesize values.
- Either way, update `result/task029-milestones.csv` honestly.

---

# 12. Phase F — Continuation beyond D4 (D5/D6 watch)

If the old divergence falls, keep going immediately (inherited monitors
already exist in the tool):

- import reconstruction: record DLL/API name sources, resolver, IAT
  slots, module bases, `GetProcAddress` results
  (`result/task029-import-reconstruction.csv` — only if reached);
- `ijl15.dll` boundary (D5);
- Tail-A first-write provenance: producer RVA, instruction, source,
  destination range, length; no code bytes committed
  (`result/task029-tail-a-writes.csv`,
  `result/task029-materialization-summary.md` — only if reached);
- progression timeline + static bridge updates.

---

# 13. Phase G — Game-code recovery if D6 falls

Classify newly materialized regions (protector/loader/runtime-support/
probable-game/confirmed-game), then build the function/class/reference
artifacts exactly as Task 028 §21–23 specified (only `MapleStory.exe`
game-side anchors count toward D7/D8; protector and support-DLL rows
reported separately). Targets, only with evidence: `CWvsApp`,
`CClientSocket`, `CLogin`, `CStage`, `CField`, `CUser`, `CUI*`,
application bootstrap, packet dispatch, network init.

```text
result/task029-main-region-classification.csv
result/task029-main-function-map.csv
result/task029-main-class-map.csv
result/task029-reference-correlation.csv
result/task029-main-call-edges.csv
result/task029-startup-login-callchain.md
```

(Create only when actually reached.)

---

# 14. Phase H — Network gate and VM gate

Network: only if ws2_32/socket/connect appears naturally; host-only/
internal; ports 9555 / 7575–7578 / 8600; artifacts only if reached.

VM gate: opportunistic only (unchanged policy from Tasks 027/028). If
`iloveaki success.` naturally reappears, capture, execute the single
authorized OK click, observe — but do not spend hours on QEMU/USB/drive
permutations.

---

# 15. Evidence vocabulary

Inherited from Task 028 §27 (confirmed-static/-replay/-runtime,
historical-runtime, faithful/incomplete/incorrect/context-dependent,
proven-root-input, supported-correlation, hypothesis, falsified). Do
not use "anti-emulation check" as a confirmed label; prefer
"replay/guest divergence decision" until intent is proven by the decode.

---

# 16. Milestone and blocker ledgers

```text
result/task029-milestones.csv     (W0–W3 + D3..D9 rows, conservative)
result/task029-blockers.csv       (B28-x carried forward + new)
```

For each blocker: id, stage, symptom, exact evidence, attempted safe
methods, falsified, why unresolved, requires-prohibited-technique?,
next safe option.

---

# 17. Required core artifacts

```text
result/29-protector-vm-decode-verification-walk.md     (final report)
result/task029-replay-baseline.md
result/task029-vm-opcode-reference.csv
result/task029-walk-programs.md
result/task029-vm-program-catalog.csv
result/task029-staged-parameters.csv
result/task029-decision-input-semantics.csv
result/task029-milestones.csv
result/task029-blockers.csv
result/task029-replay-fidelity-fixes.csv     (or a note that none were needed)
result/task029-progression-timeline.csv
result/task029-main-static-bridge.md
result/task029-guest-truth.csv               (appended probes)
```

Later-stage artifacts (import/Tail-A/function/class/callchain/network)
only when reached. No empty placeholder files.

Reusable decode tooling belongs in `scripts/` (a VM bytecode
disassembler module is an expected deliverable of this task).

---

# 18. Minimum success criteria

1. W0 opcode reference complete for all handlers reachable from the
   walk programs (unknown classes explicitly listed);
2. W1 program listings for the steady-state and boundary programs,
   validated by reproducing at least one known constant (e.g.
   0x2E3D5322) from the decode alone;
3. W2 both parameter tables published;
4. W3 at least one failing check named with inputs, expected vs actual;
5. D3 classification for every named input;
6. either a D4 attempt with documented evidence-backed changes, or a
   defensible boundary proof (Stop B/C);
7. updated ledgers and static bridge;
8. honest W/D milestone state.

Strong completion: **D4**. Excellent: **D5 or D6**. Ideal: **D7+** with
the first game anchors.

---

# 19. Stop conditions

- **Stop A** — D7/D8/D9 reached and a sustainable recovery pipeline
  exists.
- **Stop B** — the decode proves the real semantics imply the same
  failure path and further progress requires a prohibited bypass.
- **Stop C** — the required root input cannot be recovered offline
  without prohibited live-code extraction.
- **Stop D** — 8–16 hours of high-value work completed with the decode
  state precisely documented and a clear next direction.

A single opcode class remaining `unknown`, or a single program resisting
decode, is not a stop condition.

---

# 20. Submission hygiene

Identical to Task 028 §32:

```text
git status --short && git diff && git diff --cached
```

Commit only safe text/CSV findings and reusable project-owned scripts.
Never commit `.raw/`, `.work/`, EXE/DLL/DAT/SYS/VXD/WZ, dumps, decoded
blobs, VM images, ETL/EVTX/PCAP, decompiler databases, third-party
binaries.

Suggested commit message:

```text
Complete Task 029 protector VM decode and verification-walk campaign
```

Record `FINAL_COMMIT`, push `origin main`, never force.

---

# 21. Final report requirements

The final response must explicitly state:

```text
Task 029 complete?  STARTING_HEAD  FINAL_COMMIT  push status
highest W and D milestone reached and why
canonical sample hash / tool versions
W0: handler coverage (documented / unknown counts)
W1: programs decoded (which; decoder validation)
W2: parameter tables (items, mismatches)
W3: the named failing check(s) and their inputs
D3: per-input real-vs-replay classification + proof sources
D4: attempted fixes and natural outcome, or the proven boundary
D5/D6/D7/D8/D9 status if reached
replay corrections made (with evidence and regression results)
strongest new finding / strongest uncertainty / primary blocker
recommended next broad direction
generated result files and scripts
```

The most important question Task 029 must answer is not:

```text
"Can we make the walk pass?"
```

It is:

```text
"What exactly does the protector's verification walk check, what does it
expect, what does a faithful environment actually provide — and does the
faithful replay therefore continue, or is the boundary real?"
```
