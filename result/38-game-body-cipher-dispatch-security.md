# Task 038 — Cipher/dispatch/security decode (final report, session 1)

RUN DATE 2026-10-14 · STARTING_HEAD `81c0b1aab093259930b559286fd83b2feb8b5e84`
· corpus: the Task-036 authorized capture; static analysis only;
nothing binary committed.

## 0. Task 038 complete?

**Stop D (budget) with G1 — the campaign's head — delivered**: the
client codec family is decoded instruction-level and matches the
project's proven wire codec. G2-G6 open with the entry points pinned.

## 1. G1 — the cipher family (decoded, two-way matched)

| RVA | Function (client) | maple079_packet.py counterpart | Match |
| --- | --- | --- | --- |
| **0x6590BD** | `funny_shit(pIV, byte)`: block[1] -= (T[block[1]]-in); block[2] ^= …T[in]…; block[3] = T-mix + block[0]…; **rol32(block,3)** (`shl 3 \| shr 29`) | `funny_shit` | form-identical ✓ |
| **0x659082** | `crypt(data, len, pIV)`: default seed **0xC65053F2** (= `F25350C6` LE) when pIV==NULL; per-byte funny_shit | `crypt`/IV default | ✓ |
| **0x65911A** | `custom_encrypt`: nibble-swap (`shl 4\|shr 4`) + bit-pair rotate (`(b&0xD5)<<1 \|(b>>1)&0x55`) + `T[IV[0]]^` + funny_shit | `custom_encrypt` (roll sequences) | ✓ |
| **0x659182** | `custom_decrypt` (inverse) | `custom_decrypt` | ✓ |

- **The table**: single active copy at **RVA 0x7D4130** — all six code
  xrefs are inside the codec functions above. (The second copy
  0x7A0630 has no absolute-VA refs — a passive/alternate instance.)
- **The AES layer is heap-resident and runtime-computed**: the module
  image contains NO AES tables and no CryptoAPI — instead the process
  heap holds two **compact-AES (Sbox2 doubled-byte form)** cipher
  instances at **VA 0x74F12C00 and 0x756D2000** (the send/recv pair).
  This also explains Task-034's "packet AES key absent from every
  static module": the key never exists in any file — it is expanded
  at runtime next to the computed S-box.

**Net**: the server-side-validated codec and the client's decoded
codec are the same algorithm family — the two-way proof the task
asked for, at the funny_shit/custom layer; the compact-AES block
functions (in the 0x658-0x659 cluster, alongside their heap state)
remain for the next pass.

## 2. G2-G6 — open, entry points pinned

- G2 (recv path): owners of recv@0x94994/0x95A72 (from 037's map).
- G3 (dispatch): hunt the renumbered s2c values as compare/jump-table
  constants (0x41/0x81/0xA2/0x16F are distinctive).
- G4 (builders): the handshake's version-write sequence
  (0x95CC2-0x95D13) leads into the COutPacket encode family.
- G5 (CSecurity): the 13 RTTI TD xrefs (inline-compare style, 034
  method).
- G6: naming ledger after the above.

## 3. Strongest finding / uncertainty / blocker

- **Strongest finding**: the client's codec core is read —
  funny_shit/crypt/custom-encrypt/decrypt named and matched; the AES
  mystery resolved (runtime-computed compact AES in heap, two
  instances).
- **Strongest uncertainty**: the compact-AES block functions
  themselves (0x658-0x659 cluster) and the recv/dispatch path.
- **Blocker**: none — budget only.

## 4. Artifacts

`result/task038-cipher-decode.md` (the G1 decode record),
`task038-milestones.csv`, `task038-blockers.csv`,
`task038-progression-timeline.csv`, this report. Disassembly logs in
`.work/task-038/logs/`.
