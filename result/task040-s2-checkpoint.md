# Task 040 — Session 2 checkpoint (login-band dispatcher found)

RUN DATE 2026-10-15 · corpus: the Task-036 capture; static only.

## Delivered (S1 continuation — B39-1 RESOLVED)

1. **Address-confusion fix recorded** (hazard): capstone prints VAs;
   the pump's `call 0x496587` = VA → RVA 0x96587 (a small buffer
   wrapper), not RVA 0x496587. A caller-search base bug (offset vs VA,
   off by 0x400000) was also found and fixed — codec callers then
   appeared immediately.

2. **The codec integration points** (fixed search):
   - crypt called at **0x95CE7 / 0x95D1D** (inside the handshake fn
     0x95C5C) and **0x95F0D** (inside the pump 0x9583A — the rx
     decrypt).
   - **0x6591EA = encrypt_full / 0x65922E = decrypt_full**: two-stage
     wrappers (header/IV part + body) around custom_encrypt/decrypt —
     the client's encrypt_packet/decrypt_packet equivalents, with the
     0xC65053F2 default seed appearing at each stage.

3. **THE LOGIN-BAND DISPATCHER @ 0x95F83** (B39-1 resolved): called
   directly by the pump at 0x95F1D after decrypt; reads the 16-bit
   opcode (via 0x4259A2) and switches the LOW band (0x10/0x13/0x14/
   0x15/0x16… visible in the cascade; handlers at 0x4961C7 etc.).
   The full dispatch architecture is now linked end-to-end:

```text
CClientSocket::Process (the pump 0x9583A):
    recv(1460-chunks) → append → header/decrypt (crypt @0x95F0D)
    → OnPacket @0x95F83 (the phase dispatcher, low band)
        → in-game phase → the field dispatcher 0x14112E (20 bands)
```

## Honest notes

- The 0x95F83 switch head is decoded; its FULL case table (all
  low-band opcodes) and the phase-routing to 0x14112E are the next
  mechanical step (S2 opener).
- The zero pages at RVA 0x7D6/0x7D9-0x7DC (near the codec table) are
  data pages absent at capture — no code impact observed.

## Next (S2)

(a) full case table of 0x95F83 (the complete login-band map);
(b) the phase-routing call into 0x14112E's receiver;
(c) band-internal tables (inventory 0x97F64C first).

## Artifacts

`result/task040-s2-milestones.csv`, this checkpoint; logs in
`.work/task-040/logs/s1f-s1m`.
