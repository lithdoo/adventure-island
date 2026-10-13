# Task 026 — iloveaki Repack Layer / Drive-Identity Isolation / Post-Modal Progression

## 0. Purpose

Continue from Task 025 and close the three largest remaining uncertainties before returning to the deeper MapleStory game-runtime boundary.

Task 025 established several high-confidence facts:

- Program Compatibility Assistant is a message-only `MINORPROBLEM` path and is not the post-click blocker.
- Bare launch, `MapleStory.exe 127.0.0.1 9555`, and the original launcher batch behave equivalently when the surrounding environment is held constant.
- One controlled runtime outcome is a long single-threaded CPU-active spin with no continuing target-PID-attributed file/registry activity and no game-side modules.
- Another controlled runtime outcome loads the repack-side `iloveaki.dat`, `ijl15.dll`, `MSVCR90.dll`, and related Windows libraries, then stops at the repack-owned modal dialog `iloveaki` / `iloveaki success.`.
- In the Task 025 matrix, those two outcomes correlate perfectly with the client volume appearing as `G:` versus `F:`.
- However, Task 025 changed USB attach/mount ordering to obtain the two letters, so drive letter was not isolated from volume enumeration/device-order state.
- A historical Task 024 run also produced the spin while the client was on `F:`, under a different parent/elevation path. That means at least one second variable may exist.
- The success dialog was intentionally not dismissed, so the post-`iloveaki` path into PCOM/NameSpace/Winsock remains unknown.
- `result/task025-launch-matrix.csv` has a schema/data ordering defect that must be repaired before using it as machine-readable input.

This task therefore has four primary goals:

1. **Repair Task 025 data quality** without inventing values.
2. **Isolate drive letter from volume/device identity** using the same client virtual disk, the same VM device topology, the same launch command, and ordinary Windows volume-letter assignment only.
3. **Isolate the historical elevation/parent-process exception** using a controlled drive-letter × launch-parent matrix.
4. **Characterize the on-disk `iloveaki.dat` repack layer and observe what naturally happens after clicking its own `确定` button exactly once.**

If the post-modal path naturally reaches PCOM/NameSpace/Winsock, the task may proceed into a private-network 9555 observation phase. If it does not, stop at the next naturally visible boundary.

This is a compatibility / reverse-engineering characterization task. It is **not** a protection-bypass task. Do not patch branches, spoof environment-query return values, hide instrumentation, disable security enforcement, inject code, or dump protected process memory.

---

## 0.1 Repository synchronization gate

Start from a clean, current `origin/main`.

From the repository root:

```text
git status --short
git branch --show-current
git remote -v
git rev-parse HEAD
```

If tracked/uncommitted changes exist, stop and report the blocker. Do not stash, reset, restore, rebase, or overwrite user changes.

Then:

```text
git fetch origin
```

If clean and not on `main`, switch to `main`, then:

```text
git pull --ff-only origin main
git rev-parse HEAD
```

Record the resulting SHA as `STARTING_HEAD`.

If a clean fast-forward is not possible, stop. Do not rewrite history.

---

## 0.2 Directory and artifact contract

```text
.raw/
    read-only proprietary inputs

task/
    task specifications

.work/task-026/
    all VM-side raw logs, ETW/EVT/PML traces, screenshots, temporary exports,
    static-analysis databases, third-party tool copies, one-off harnesses,
    mount/volume experiments, and large intermediate data

result/
    permanent Task 026 findings and compact normalized CSV/Markdown outputs

scripts/
    only reusable project-owned observation/static-analysis helpers

glm-work/
    prior-research reference only; do not place Task 026 final outputs here
```

Recommended scratch layout:

```text
.work/task-026/
├── preflight/
├── task025-repair/
├── static-iloveaki/
├── volume-identity/
├── matrix/
│   ├── F-elevated/
│   ├── G-elevated/
│   ├── F-normal-parent/
│   └── G-normal-parent/
├── post-modal/
├── events/
├── modules/
├── threads/
├── network/
└── logs/
```

Never commit VM disks, snapshots, EXE/DLL/SYS/VXD/DAT binaries, raw PML/ETL/EVTX/PCAP, debugger databases, screenshots containing private host details, or third-party binaries.

---

## 1. Mandatory reading

After synchronization, read at least:

```text
README.md
result/24-win7-x64-natural-runtime.md
result/24-win7-x86-sp1-natural-runtime.md
result/25-win7-post-pca-runtime-localization.md
result/task025-launch-matrix.csv
result/task025-appcompat-evidence.md
result/task025-thread-summary.md
result/task025-repeated-operations.csv
result/task025-static-runtime-correlation.md
result/task025-module-timeline.csv
result/task025-event-timeline.csv
scripts/maple079_runtime_observe.ps1
```

Also read the relevant static chain:

```text
result/04-static-loader-dataflow.md
result/06-stage2-inplace-decode.md
result/07-protector-resolver-antidebug.md
result/08-winlicense-reference-normal-path.md
result/09-probe-cluster-full-cfg.md
result/09-normal-probe-path-materialization.md
result/10-post-probe-stage.md
result/10b-static-extension.md
```

And the latest Task 012/012c material about the `0x862000+` mixed encoded/plaintext region.

Canonical `MapleStory.exe` SHA-256 remains:

```text
5d280cf1c5663e925104736e73e5715a5a529d25420babf410cc411b37940f4d
```

Do not reuse prior RVA or runtime conclusions if the guest copy differs.

---

## 2. Phase 0 — Repair Task 025 machine-readable artifacts

Before new experiments, repair the known Task 025 CSV defect.

### 2.1 `task025-launch-matrix.csv`

The current header interleaves fields as:

```text
cpu_s_at_10
ws_kb_at_10
threads_at_10
cpu_s_at_30
...
```

but the current rows appear to contain grouped blocks:

```text
cpu10,cpu30,cpu60,cpu120,
ws10,ws30,ws60,ws120,
threads10,threads30,threads60,threads120
```

Do not repair by visual guess alone.

Use the preserved raw Task 025 run outputs under `.work/task-025/` if available and/or regenerate values from `task025-thread-activity.csv`, process/window records, and the observer's source logic.

Requirements:

- determine the intended canonical schema;
- verify at least three representative runs manually against raw evidence;
- repair `result/task025-launch-matrix.csv` in place if the intended values can be proven;
- check the A3 working-directory corruption/truncation (`Ma\\ ...`) and repair only if supported by raw evidence;
- add a short correction note to `result/25-win7-post-pca-runtime-localization.md` rather than rewriting the historical narrative;
- if a value cannot be proven, write blank/unknown rather than inventing it.

Generate a short audit note:

```text
result/task026-task025-data-repair.md
```

It must state exactly what was wrong, what evidence was used, and which rows/columns changed.

---

## 3. Primary experimental environment

Use the existing Windows 7 Professional SP1 x86 guest as the main environment:

```text
6.1.7601
x86
```

Use the existing clean snapshot if still intact. Do not reinstall the OS unless the VM is no longer reproducible.

For all causal-isolation runs:

- same VM image;
- same QEMU version;
- same machine/cpu/memory options;
- same client virtual disk image;
- same client-disk device/controller slot;
- same USB/device attach order;
- same transfer/logging mechanism;
- same client files and hashes;
- same launch command;
- same working directory;
- same observer build/version;
- same PCA interaction;
- same network state.

Only the variable explicitly named by the experiment may change.

---

## 4. Sample identity gate — client volume and repack files

Before experiments, hash inside the guest or from the same attached client volume:

```text
MapleStory.exe
iloveaki.dat
ijl15.dll
单机登陆器.bat
```

Also hash any repack-side DLL or data file that static analysis later identifies as directly imported/loaded by `iloveaki.dat`.

Record:

```text
relative_path
size
sha256
PE/non-PE
```

Output:

```text
result/task026-repack-file-manifest.csv
```

`MapleStory.exe` must match the canonical SHA above.

Do not commit the binaries.

---

## 5. Volume/device identity baseline

Task 025 correlated outcome with `F:` versus `G:` but changed attach order. Task 026 must measure and hold all non-letter volume identity fields constant.

For the client volume record, where ordinary Windows tools expose them:

```text
volume GUID path
filesystem
volume label
volume serial number
logical drive letter
disk index
partition index / offset
filesystem size
free space
PnP/device identity
controller/device slot visible to the guest
mount-manager mappings
```

Use built-in read-only tools where practical (`mountvol`, WMI/WMIC, `fsutil fsinfo`, registry reads of MountedDevices if needed).

Do not modify:

- partition contents;
- filesystem serial number;
- volume label;
- disk signature;
- client files.

The only intended state change in the drive-letter experiment is the ordinary Windows logical-drive-letter assignment.

Output:

```text
result/task026-volume-identity.csv
```

---

## 6. Phase A — True single-variable drive-letter A/B/A/B test

Use the **same client virtual disk attached in the same device position and order** for every run.

Do not obtain F:/G: by swapping USB attach order.

Instead, after restoring the same clean snapshot and attaching the client disk identically, use ordinary Windows volume-management functionality to assign that same volume the required logical letter.

Do not spoof API returns. Do not patch the client. Do not alter the filesystem.

Preferred launch command for all Phase-A runs:

```text
MapleStory.exe 127.0.0.1 9555
```

Working directory: client root.

Guest network remains disconnected.

Use the same elevated-observer launch model that produced the controlled Task 025 success path.

Minimum sequence:

```text
A-F1  -> same volume assigned F:
A-G1  -> same volume assigned G:
A-F2  -> same volume assigned F:
A-G2  -> same volume assigned G:
```

Prefer a third repeat pair if time is reasonable:

```text
A-F3 / A-G3
```

For each run:

- restore the same clean snapshot;
- attach devices identically;
- verify the client volume's GUID/serial/device identity;
- assign only the logical drive letter;
- re-hash MapleStory.exe and iloveaki.dat;
- launch with the exact same command/working directory;
- dismiss PCA using the ordinary `Run program` action exactly once;
- observe for at least 60 seconds or until the `iloveaki` dialog is stable.

Record:

```text
PCA timing
CPU curve
thread curve
module timeline
window timeline
iloveaki.dat loaded?
iloveaki success dialog?
ws2_32?
PCOM?
NameSpace?
process exit?
```

Output:

```text
result/task026-drive-letter-ab.csv
```

### Phase-A interpretation

Only call **drive letter itself causal** if:

- client volume GUID/serial/device identity remain identical;
- QEMU/device topology remains identical;
- parent/elevation path remains identical;
- F and G outcomes alternate reproducibly with letter assignment alone.

If outcomes do not track the letter under these controls, Task 025's result must be reclassified as a broader mount/enumeration correlation.

---

## 7. Phase B — Parent/elevation-path matrix

Task 024 contains a historical exception: client on F: but spin outcome under a non-elevated parent followed by UAC elevation. Task 025's F: success came from the controlled elevated-observer launch path.

Test that second variable directly.

Use the same client disk/device identity and a fixed drive letter, preferably F: first.

Two launch models:

### B-E — elevated-parent/direct launch

The already-proven Task 025 model: observer/launcher is already elevated and directly creates MapleStory.

### B-U — ordinary-parent / natural UAC launch

Start MapleStory from an ordinary non-elevated shell or equivalent user launch so its normal `requireAdministrator` behavior invokes UAC.

The passive observer may already be elevated and running separately, but in B-U it must **not be MapleStory's parent** and must not alter the target.

Record:

```text
actual parent PID/image
parent integrity/elevation state where ordinary APIs expose it
whether consent/UAC appears
MapleStory PID
post-elevation parent relationship
PCA timing
runtime outcome
```

Do not suppress UAC or modify the executable manifest.

Minimum controlled matrix:

```text
F + elevated parent      >= 2 runs
F + ordinary parent/UAC  >= 2 runs
```

If Phase A confirms a true F/G letter effect and time permits, complete the 2×2 matrix:

```text
G + elevated parent
G + ordinary parent/UAC
```

Output:

```text
result/task026-parent-elevation-matrix.csv
```

Goal: explain the Task 024 F:-spin historical exception or explicitly leave it unresolved.

---

## 8. Phase C — Offline static characterization of `iloveaki.dat`

`iloveaki.dat` is an on-disk local sample loaded as a PE module in the Task 025 success path. Analyze the file **offline**.

Do not use process-memory dumping or runtime unpacking.

Record at minimum:

```text
size
sha256
PE machine/type
image base
entry point RVA
section table
section permissions
section entropy
imports
exports
resources
TLS callbacks if any
load config / relocations
PDB/debug path if present
version info
Authenticode status
compiler/runtime hints
```

Identify whether it is:

- ordinary DLL renamed `.dat`;
- statically linked wrapper;
- packed/obfuscated wrapper;
- mixed data/code container.

If the file is packed/protected, characterize that fact and the visible surface. Do not escalate into protection bypass, runtime dumping, or patching.

Output:

```text
result/task026-iloveaki-static.md
result/task026-iloveaki-pe.csv
result/task026-iloveaki-imports.csv
```

A reusable metadata/xref helper may be added under `scripts/` if it contains only project-owned static-analysis logic.

---

## 9. Phase D — `iloveaki` strings and call-site mapping

Search the on-disk `iloveaki.dat` for ASCII/UTF-16 strings and relevant references.

Mandatory strings/semantic anchors:

```text
iloveaki
success
success.
MapleStory
F:\
G:\
volume
logical drive
mount
serial
```

Also inspect references to ordinary environment/volume APIs if present, such as families equivalent to:

```text
GetModuleFileName*
GetCurrentDirectory*
GetFullPathName*
GetLogicalDriveStrings*
GetLogicalDrives
GetDriveType*
GetVolumeInformation*
GetVolumeNameForVolumeMountPoint*
QueryDosDevice*
GetDiskFreeSpace*
RegOpen*/RegQuery*/RegEnum*
CreateFile*
DeviceIoControl
```

The exact import names may differ or be dynamically resolved. Record only what the file actually contains.

For the `iloveaki success.` message, locate the static reference/call site if possible and map:

```text
function containing the message reference
callers/callees at a high level
nearby condition checks
nearby environment/volume queries
message-box API or wrapper
what return path follows after dialog dismissal
```

Allowed: static disassembly/decompilation of the on-disk module.

Forbidden: patching the condition, forcing the success branch, modifying the module, or providing a binary bypass.

Output:

```text
result/task026-iloveaki-xrefs.csv
result/task026-iloveaki-controlflow.md
```

If static tooling cannot resolve a branch confidently, label it `unknown` rather than guessing.

---

## 10. Phase E — Correlate static `iloveaki` findings with Phase A/B

Build a correlation table:

```text
static API/string/check candidate
static function/RVA
what environment property it appears to query
Phase-A F result
Phase-A G result
Phase-B elevation result
runtime evidence supporting/refuting relevance
confidence
```

Do not claim that a branch is the runtime cause solely because its strings look relevant.

A strong causal claim requires both:

- a static check whose semantics match the changing variable; and
- a controlled runtime A/B result that changes only that variable.

Output:

```text
result/task026-iloveaki-runtime-correlation.csv
```

---

## 11. Phase F — Post-modal progression: click `iloveaki` OK exactly once

This phase is allowed only after reproducing the normal F-like loader-success path from a clean snapshot.

Use the most controlled successful environment established by Phase A/B.

Sequence:

1. launch the canonical client with the fixed chosen command;
2. dismiss PCA with ordinary `Run program`;
3. wait until the repack-owned `iloveaki` dialog is confirmed with body `iloveaki success.`;
4. record a pre-click process/module/thread/window snapshot;
5. click its ordinary `确定` button **once**;
6. perform no further automatic UI actions for at least the next 120 seconds;
7. observe the next natural boundary.

Clicking this application-owned confirmation button is ordinary UI progression, not a patch/bypass. Do not auto-dismiss any later error/protection dialog without first recording it and deciding whether it is within task scope.

Collect a high-resolution timeline around the click:

```text
t_iloveaki_shown
t_ok_clicked
CPU/thread changes
module first-seen events
window creation/destruction
child processes
HSUpdate/ASPLnchr
PCOM/NameSpace/Canvas/ResMan/ZLZ
Gr2D_DX8/Sound_DX8
ws2_32/wininet
service/driver side effects
process exit or next modal boundary
```

Repeat the post-modal run at least twice if the first result is stable and reproducible.

Output:

```text
result/task026-post-modal-timeline.csv
result/task026-post-modal-observation.md
```

---

## 12. Post-modal outcome classes

Classify each controlled run into one of these evidence outcomes:

```text
P0  iloveaki dialog cannot be reproduced
P1  dialog closes and process exits
P2  dialog closes and process returns to CPU spin
P3  another modal/error boundary appears
P4  HShield/update layer starts
P5  Wizet runtime modules begin loading (PCOM/NameSpace/etc.)
P6  Winsock loads / socket activity begins
P7  private-server login connection is observed
```

Do not skip classes or call P7 if only `ws2_32.dll` appears.

---

## 13. Phase G — Conditional private-network observation

Only enter this phase if Phase F naturally reaches either:

- `ws2_32.dll`/socket activity; or
- clear PCOM/NameSpace/game-runtime initialization showing the client has crossed the previous gate.

Do not configure private networking merely to satisfy the task checklist.

If the gate is reached:

- restore a clean snapshot;
- reproduce the same successful drive-letter/elevation conditions;
- use an isolated host-only/internal network, never bridged/public Internet;
- run the known CMS079 server or a project-owned minimal compatible listener on the private side;
- because guest `127.0.0.1` is the guest itself, use a private host IP if the server is outside the guest;
- keep firewall changes minimal and scoped to the isolated interface/required ports;
- record exact server-side listen/accept evidence.

Observe:

```text
ws2_32 first seen
first SYN/connect attempt
9555 connect/ESTABLISHED
server accept
15-byte CMS079 handshake delivery if applicable
client close/continue behavior
7575–7578 transition
8600 transition
```

Raw PCAP/ETL stays in `.work/task-026/network/`.

Output only if the gate is reached:

```text
result/task026-network-observations.csv
```

---

## 14. Phase H — Validate or revise the Task 025 interpretation

At task end, explicitly revisit these Task 025 statements:

1. `F:` vs `G:` was the discriminating variable.
2. the spin is an internal loader/protector loop rather than external dependency retry.
3. Task 024's F:-spin historical run is explained by parent/elevation differences or remains anomalous.
4. the `iloveaki` modal gate is before Wizet runtime/network transition.

Use one of:

```text
confirmed
refined
rejected
still-unknown
```

If Task 026 materially changes the Task 025 interpretation, add a short clearly dated refinement note to `result/25-win7-post-pca-runtime-localization.md`; do not erase the original Task 025 observations.

---

## 15. Observation tooling and non-interference checks

Reuse `scripts/maple079_runtime_observe.ps1` where possible.

Any script modification must remain:

- normal user/process APIs only;
- no debugger attach;
- no ReadProcessMemory;
- no thread context reads;
- no suspension;
- no injection/hooking;
- no environment-return spoofing.

For new Phase-A/B/F runs, retain at least one low-instrumentation baseline and compare it with ETW/observer-assisted runs if behavior unexpectedly changes.

If instrumentation changes the outcome, label the run `observer-affected`; do not attempt to conceal the observer.

---

## 16. Explicit safety / research boundaries

Do not:

```text
patch MapleStory.exe
patch iloveaki.dat
NOP/flip conditional branches
modify message-box return flow
fake drive-query API results
fake registry/device/service objects
hide debugger/VM/observer presence
disable driver-signature enforcement
enable test-signing for the target
dump decrypted/protected process memory
inject DLL/code
set hardware breakpoints
modify PEB/debug flags
force Oreans/SoftICE probe returns
```

If progress would require those actions, stop that path and report the boundary.

Allowed within this task:

- ordinary drive-letter assignment for controlled compatibility testing;
- offline static analysis of the unchanged local `iloveaki.dat` file;
- ordinary UI clicks on PCA `Run program` and `iloveaki` `确定` exactly as specified;
- passive process/module/thread/window/ETW observation;
- isolated private-network testing after the runtime gate is naturally reached.

---

## 17. Evidence labels

Use the same evidence taxonomy:

```text
confirmed-runtime
observed-side-effect
static-only
probable
possible
not-observed
unknown
observer-affected
```

For causal claims, additionally label:

```text
controlled-causal
controlled-correlation
uncontrolled-historical
```

Examples:

- same disk/device, only drive letter changed, repeated F/G/F/G with matching outcomes -> `controlled-causal` candidate;
- F/G outcome from USB attach-order changes -> `controlled-correlation` only;
- Task 024 F:-spin -> `uncontrolled-historical` relative to Task 026 matrix.

---

## 18. Formal outputs

Required if the relevant phase is executable:

```text
result/26-iloveaki-drive-identity-post-modal.md
result/task026-task025-data-repair.md
result/task026-repack-file-manifest.csv
result/task026-volume-identity.csv
result/task026-drive-letter-ab.csv
result/task026-parent-elevation-matrix.csv
result/task026-iloveaki-static.md
result/task026-iloveaki-pe.csv
result/task026-iloveaki-imports.csv
result/task026-iloveaki-xrefs.csv
result/task026-iloveaki-controlflow.md
result/task026-iloveaki-runtime-correlation.csv
result/task026-post-modal-timeline.csv
result/task026-post-modal-observation.md
```

Conditional:

```text
result/task026-network-observations.csv
```

Potential reusable scripts:

```text
scripts/maple079_runtime_observe.ps1      # update only if needed
scripts/maple079_iloveaki_static.py       # optional, project-owned helper
```

Do not create empty placeholder result files just to satisfy the list. If a phase is blocked, document the blocker in the main report.

---

## 19. Minimum success criteria

Task 026 is successful if it completes all of the following that are technically available:

1. clean/current `origin/main` start and `STARTING_HEAD` recorded;
2. Task 025 launch-matrix CSV defect audited and repaired or formally marked unrepairable;
3. MapleStory/iloveaki/launcher file hashes recorded;
4. same-volume identity captured sufficiently to prove whether only drive letter changes;
5. at least F/G/F/G true single-variable drive-letter sequence completed;
6. at least two controlled elevated-parent vs ordinary-parent/UAC comparisons completed on fixed F:;
7. Task 024 historical F:-spin exception explained or explicitly retained as unresolved;
8. `iloveaki.dat` PE/static metadata documented;
9. `iloveaki success.` call site/control-flow context mapped as far as static evidence allows;
10. likely volume/environment-query code identified or honestly marked unknown;
11. successful `iloveaki` modal path reproduced from clean state;
12. `iloveaki` `确定` clicked exactly once in a controlled run and the subsequent natural boundary recorded;
13. post-modal result repeated if reproducible;
14. PCOM/NameSpace/Winsock/network gate status stated explicitly;
15. Task 025 interpretation classified as confirmed/refined/rejected/still-unknown;
16. a single final Route selected.

---

## 20. Final Route

Select exactly one primary route.

### Route A — Drive letter is independently causal

Same volume/device/topology, letter-only F/G assignment reproduces the fork. Static `iloveaki` analysis also exposes a compatible path/volume check or at least a strong candidate.

Next work: characterize the check's purpose/history and continue only on the naturally successful environment; do not patch it.

### Route B — Mount/device identity, not letter alone

True letter-only A/B does not reproduce Task 025. Some broader volume enumeration/device-order property explains the correlation.

Next work: isolate that ordinary environment property using further non-spoofed compatibility tests.

### Route C — Elevation/parent path is causal or co-causal

The Task 024 exception is reproduced and parent/UAC launch path changes the outcome under fixed volume identity.

Next work: characterize the launch-token/parent/environment difference without bypassing UAC/protection.

### Route D — `iloveaki` static layer explains the fork but runtime remains pre-game

Static analysis identifies the controlling check and post-modal progression still fails before PCOM/NameSpace/Winsock.

Next work: focus on the next visible wrapper/game-runtime transition.

### Route E — Post-modal Wizet runtime reached

After ordinary `确定`, PCOM/NameSpace/Canvas/ZLZ or equivalent game runtime loads, but Winsock/login is not yet reached.

Next work: resource/runtime initialization timeline.

### Route F — Network bootstrap reached

Post-modal execution naturally loads Winsock and makes a private 9555 attempt/connection.

Next work: protocol handshake and login bootstrap validation.

### Route G — No reliable causal isolation

Drive-letter/parent results are unstable or observer-sensitive, and static evidence does not resolve the fork.

Next work: return to offline static/reference correlation rather than escalating to invasive protection bypass.

---

## 21. Final report requirements

`result/26-iloveaki-drive-identity-post-modal.md` must include:

```text
Task 026 complete?
STARTING_HEAD
FINAL_COMMIT
push status

Task 025 data repair:
what was wrong
what changed
verification source

sample identities:
MapleStory.exe SHA256
iloveaki.dat SHA256/size
ijl15.dll SHA256/size
launcher SHA256/content confirmation

volume identity:
GUID
serial
label
device identity/topology
drive-letter assignment method
proof that non-letter identity stayed constant

Phase A:
F/G/F/G runs
outcome per run
whether letter alone is causal

Phase B:
elevated-parent vs ordinary-parent/UAC
actual parent chain
outcome per run
Task 024 exception explained?

iloveaki static:
PE type
image base
entry point
sections/imports/exports
packing/obfuscation status
success-string call site
volume/path/environment APIs/checks
confidence

post-modal:
pre-click state
OK click time
next modules/windows/children
PCOM?
NameSpace?
Canvas/ResMan/ZLZ?
HShield?
ws2_32?
process exit/error/next modal?
repeatability

network gate:
reached/skipped
if reached: 9555 SYN/connect/ESTABLISHED/server accept/handshake/channel/cashshop

Task 025 interpretation:
confirmed/refined/rejected/still-unknown

strongest new finding
strongest remaining uncertainty
final Route A–G
recommended next task

generated result files
generated scripts
blockers
```

---

## 22. Commit and push

Before commit:

```text
git status --short
git diff
git diff --cached
```

Check carefully that only safe permanent artifacts are staged.

Allowed primary commit paths:

```text
result/
scripts/
```

A Task 025 result file may be updated only for the documented CSV/data-quality correction or a clearly marked Task 026 refinement note.

Do not commit `.work/`, binaries, VM artifacts, traces, screenshots, or third-party tools.

Recommended commit message:

```text
Complete Task 026 iloveaki drive-identity and post-modal exploration
```

Then record:

```text
git rev-parse HEAD
```

as `FINAL_COMMIT`, and:

```text
git push origin main
```

Never force-push. If the remote advanced, fetch and report the divergence rather than rewriting history.
