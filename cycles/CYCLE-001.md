# CYCLE-001 — The lead library

**Date:** 2026-09-18
**Goal:** turn the founding session's findings into a documented **lead library**: one file per lead,
a board, a runner guide, a protocol, and a cycle journal — so a future iteration can continue without
this chat.

## Work

1. **`leads/`** — 13 lead files (`L01`…`L13`), each with status, claim, mechanism, evidence tables,
   verdict, next actions, log, and a pre-registered **falsifier**. `leads/INDEX.md` is the board.
   * 5 closed with a number (L04, L05 negative; L11 parked), 1 critical-methodological (L01),
     2 supported tools (L02, L03), 1 ongoing audit (L10), 4 open (L06, L07, L08, L09) plus 2 newly
     opened (L12 cross-sectional carry, L13 reversal gross edge).
2. **`RUNNER.md`** — exact run recipes, the `globalThis.__fs` invariant (must expose `writeTextFile`),
   how to add an experiment, conventions (`positionsOfFast`, bar-label price lookups).
3. **`PROTOCOL.md`** — cycles, the lead template, statuses, the six evidence rules, prototype rules,
   the bug-hunt protocol.
4. **`INDEX.md`** — the top-level map of docs, leads, code and cycles.
5. **`cycles/CYCLE-000.md`** — the founding session written up as a cycle, so the record starts at the
   beginning.
6. **`README.md`** — rewritten around the library, with the ground rules preserved and the layout
   updated.
7. New leads opened this cycle: **L12** (cross-sectional carry dispersion) and **L13** (short-horizon
   reversal gross edge / break-even) — both cheap, both mechanism-driven, both independent of the
   closed directional families.

## Ledger effects

* No number changed: this cycle is structure and documentation, not measurement.
* `FINDINGS.md` positions unmoved; every lead now cites the finding(s) it rests on.

## What is now false that was believed at the start of the cycle

* "The lab is a set of documents with results in them." → it is now a **library of tracked leads**
  with a board, a protocol, and a cycle journal; the status of every line of research is one file
  away, and what would kill it is registered before it is run.

## Next

* **CYCLE-002** — challenge L01 (the only supported-critical claim): reproduce the window effect
  through the repo's *own* walk-forward/pool aggregation, and close the cheapest audit rows in L10
  (`effectiveBars` bound, carry-grid alignment). Verify every number in `FINDINGS.md` against the
  regenerated `results/*.json`.
* Then the open frontier in expected-value order: L07 (new data) → L06 (meta-labelling) → L09 (vol
  sizing) → L12 (xs carry) → L13 (reversal).
