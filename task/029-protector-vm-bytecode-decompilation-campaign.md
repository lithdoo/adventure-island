# Task 029 — Protector VM Bytecode Decompilation & Import Reconstruction Campaign

## Objective

Continue from Task 028.

Task 028 established that the 0x84Bxxx–0x866xxx region is not a normal opaque blob but a custom bytecode VM:

- handler table around RVA 0x84B1E0
- VM dispatch through handler table
- VM state stored through encrypted frame addressing
- API resolution through APIT CRC hashing
- continuation selection controlled by VM state

Task 029 does not continue environment experiments.

The goal is to reverse the VM itself:

```
VM bytecode
 -> opcode semantics
 -> verification scripts
 -> staged parameter table
 -> continuation graph
 -> import reconstruction
 -> Tail-A materialization
 -> main EXE game logic
```

## Milestones

V0 VM inventory completed

V1 opcode handler table recovered

V2 bytecode disassembler working

V3 26-check verification program reconstructed

V4 staged parameter table identified

V5 normal continuation path recovered

V6 import reconstruction observed

V7 Tail-A materialization observed

V8 MapleStory.exe game-side anchors recovered

## Main Work

### 1. Build VM model

Document:

- opcode byte format
- handler dispatch
- VM registers/state
- stack/frame behavior
- memory model
- branch/continuation mechanism

Create:

- result/task029-vm-architecture.md
- result/task029-vm-handlers.csv

### 2. Recover opcode semantics

For reachable handlers from the dispatch table:

Record:

- handler RVA
- opcode
- inputs
- outputs
- memory effects
- control-flow effects

Create:

- result/task029-opcode-semantics.csv

### 3. Build bytecode disassembler

Use decoded image evidence only.

The disassembler should output:

- opcode sequence
- handler mapping
- immediate values
- VM state reads/writes
- branches

Create:

- scripts/maple079_vm_disasm.py

### 4. Decode verification scripts

Recover the programs involved in:

- item 0–3 staged table construction
- 26 verification checks
- continuation selection

Do not patch success.

The goal is to understand the checks.

Create:

- result/task029-check-programs.md
- result/task029-check-items.csv

### 5. Recover staged parameter provenance

For every consumed value:

Track:

- producer
- source API
- transform
- storage location
- VM consumer

Create:

- result/task029-staged-data-map.csv

### 6. Continue to import reconstruction

Only after the VM naturally selects the non-error continuation.

Record:

- DLL hash/name resolution
- IAT writes
- API bindings
- module loading

Create:

- result/task029-import-reconstruction.md

### 7. Tail-A observation

If Tail-A receives writes:

Record metadata only:

- producer
- destination range
- size
- timing
- classification

Do not commit extracted protected code.

Create:

- result/task029-tail-a-materialization.md

## Restrictions

Do not:

- force VM continuation
- modify bytecode
- patch branches
- patch API results
- bypass protection
- dump decrypted protected code

All progress must come from understanding the existing execution model.

## Final Report

Create:

- result/29-protector-vm-bytecode-decompilation.md
- result/task029-milestones.csv
- result/task029-blockers.csv

The final report must state:

- highest milestone reached
- recovered VM model
- opcode coverage
- verification program status
- staged data status
- import reconstruction status
- Tail-A status
- next blocker
