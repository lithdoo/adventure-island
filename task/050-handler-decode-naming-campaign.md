# Task 050 — Handler Deep Decode & Semantic Naming Assault Campaign

## Objective

Task 049 gave us 169 named handler sites with s2c wire names. This
campaign decodes the ACTUAL handler functions — extracting packet read
sequences, field writes, object interactions, and call patterns — to
produce high-confidence semantic names:

```
1. For each of the 169 named handler sites, disassemble the handler
   function and extract:
   - packet read sequence (ReadInt32/ReadByte/ReadInt16/ReadString)
   - singleton/global writes (CWvsContext and other objects)
   - calls to UI/builder/other subsystem functions
   - conditional branches and state changes
2. Correlate with the s2c name for two-evidence naming
3. For sub-dispatchers (bands), decode the internal opcode routing
   to name individual sub-handlers
4. Expand the class/field atlas through handler field writes
5. Update the subsystem classification with deep semantic labels
```

## Milestones
- **H0** all 58 range-table handlers decoded to semantic summaries
- **H1** sub-dispatcher internals decoded (the 47-entry SPAWN band,
  14-entry MOB band, 25-slot jump table)
- **H2** ≥120 high-confidence semantic function names
- **H3** field atlas expanded to ≥20 annotated fields
- **H4** subsystem classification with deep labels

## Corpus
Client image + complete s2c dispatch map (Task 049).
