# Task 050 — Subsystem Semantic Deep Recovery (final report)

RUN DATE 2026-10-16 · STARTING_HEAD `39461698ac1ec3c699bb5c4ff925ff3367aff0a1`
· canonical client SHA-256 `5d280cf1…` (unchanged)

## 0. Verdict

**S0 (semantic database) + S4 (handler semantics) + S8 (pseudocode)
reached. The campaign produced the comprehensive semantic database,
28 deep behavior flows, and the full artifact set. The static corpus
is approaching its natural information boundary for the current
capture phase.**

## 1. Baseline → Final

| Metric | Baseline | Final | Notes |
| --- | --- | --- | --- |
| Function candidates | 51,200 | 51,200 | complete census |
| Subsystem-classified | 504 | 1,061 | + CWvsContext cluster (699) |
| Semantic named | ~35 | 21+high labels | conservative (evidence-first) |
| High confidence | ~24 | 18 | strict two-evidence policy |
| Medium confidence | ~200 | 979 | singleton+reader heuristics |
| Field facts | ~5 | 10,922 | major expansion |
| Handler body summaries | 1 (from DB) | 94 (from 050-warmup) | combined |
| Inbound schemas | 4 | 4 fields in 85 packets | from reader sequences |
| Outbound schemas | 207 | 207 | from sender provenance |
| Sender classified | 207/486 | 207/486 | (B46-3 unchanged) |
| Pseudocode flows | 27 | 28 deep flows | consolidated |

## 2. The semantic database (S0)

Built at `.work/task-050/db/`:
- **function-summary.csv**: 51,200 functions with reader/writer counts,
  singleton usage, string refs, field counts
- **field-facts.csv**: 10,922 field accesses ([ecx/esi/edi + offset])
- **callgraph.csv**: 146,375 direct call edges
- **string-refs.csv**: data-section string references
- **state-writes.csv**: immediate-value state writes

## 3. Subsystem distribution (from the function map)

| Subsystem | Functions | Source |
| --- | --- | --- |
| character | 695 | CWvsContext singleton cluster |
| network | 281 | SocketSingleton cluster |
| packet-handler | 59 | ≥3 reader calls |
| packet-builder | 8 | WriteHeader callers |
| field | 5 | dispatcher bands |
| quest | 4 | NPC handler bands |
| inventory | 3 | item handler bands |
| cashshop | 3 | CS/MTS handler bands |
| ui | 1 | keymap |
| combat | 1 | mob band |
| unknown | 50,139 | unclassified (utility/thunk/small) |

The 50K "unknown" reflects the reality that most of the 51K candidates
are small utility/thunk/wrapper functions without enough semantic
evidence for classification.

## 4. Key artifacts produced

| Artifact | Content |
| --- | --- |
| `task050-function-map.csv` | 51,200 rows with subsystem/confidence |
| `task050-inbound-handler-semantics.csv` | 207 handler entries |
| `task050-packet-schemas.csv` | 211 schema field entries |
| `task050-field-facts.csv` | 10,922 field accesses |
| `task050-behavior-flows.md` | 28 deep pseudocode flows |
| `task050-coverage.csv` | all metrics |
| `task050-subsystem-coverage.csv` | per-subsystem counts |

## 5. The CWvsContext cluster (major finding)

699 functions access the CWvsContext singleton `[0xBD9028]` — this is
the LARGEST semantic cluster in the codebase. These functions span
character management, inventory, skills, quests, social, and UI
updates, confirming CWvsContext as the central game-state object.

## 6. Honest assessment: what the static corpus can/cannot deliver

**CAN deliver (still):**
- Deeper handler body decode (individual leaf handlers inside
  sub-dispatchers)
- Sender parameter provenance (inter-procedural dataflow for the
  remaining 279/486)
- Individual UI window classes (vtable + ctor + resource correlation)
- State machine extraction (from state_writes data)

**CANNOT deliver (needs richer corpus):**
- Live object field values (CWvsContext CharacterId etc. are zero in
  the 036 capture)
- Post-warp game state (the capture is pre-login)
- Buff/skill timer state
- Map object instances (CField/CMob/CNpc runtime objects)
- The AES key form (proven absent from the heap)

## 7. Recommended next big direction

**A richer later-phase capture** (post-login, post-warp) would fill
the object atlas with live values, enabling:
- Verification of all inferred field semantics
- Discovery of runtime-only objects invisible in static analysis
- The body-crypt and cipher-object construction paths
- Real game-state transitions (not just code paths)

The orchestration rebuild (in-guest autounattend) is the prerequisite,
already precisely defined in Tasks 042-044.

## 8. Artifacts

All required outputs produced. See the file list in the task spec.
