# CYCLE-188 — M4 decided: PARK multiprobes + querymod (boundary recorded) (2026-10-02)

**Vehicle:** `experiments/m4_recall.js` (standalone, not in `run_all.js`;
result `scratch/s6e_result.json` style → `scratch/m4_result.json`).
3/3 checks both fixtures. Pre-registered DESIGN in its header.

## Coherency pre-check

PLAN M4 QUEUED; method bags (`lshMethods`, `linalgMethods`) install cleanly
on a stub via Object.assign (no DB, no golden path); shipped default configs
used verbatim (`{maxFlips:2,budget:8}`, querymod defaults). Proceeded.

## M4 measurements (seeded clustered fixture, truth = top-5 euclid)

| fixture | def | +multiprobe | +querymod | +both |
|---|---|---|---|---|
| easy (200 protos, 8 bits, σ0.05) | 1.000 (50.0) | 1.000 (64.2) | 1.000 (66.4) | 1.000 (65.4) |
| hard (400 protos, 12 bits, σ0.35) | 0.8867 (40.5) | **0.9867** (61.3) | 0.9667 (67.6) | 0.9867 (68.5) |

Easy fixture ceilinged (upgrades add only cost) — rerun harder per honesty
rule; hard fixture separates: mp lift +0.1000, qm +0.0800.

## Director's M4 decision (rule as coded, boundary goes to PARK)

Lift sits EXACTLY on the pre-registered +0.10 boundary (float dust below).
Pre-registration binds: **PARK multiprobes + querymod** — no route into any
scored path. Recorded for future iterations: multiprobes is the choice IF a
live-reader build ever needs a probe (boundary-meeting + its own unit test
0.033→0.30 self-recall); querymod never reached the bar. BinaryPC/bitweight
not covered (pca-hash refreshes buckets the LIVE reader reads — stays
default-off, as-is). M4 DONE-decided.

## Bug + sanity sweep (touch set)

* Fixture-ceiling caught by the no-separation read (not by a guard) —
  hardened and rerun same cycle; no repo files touched; standalone.

## Research sync

No new sweep (10v EGGROLL/multiprobe literature carries M4). Next sweep
with M3 (execution microstructure) or phase-2 TSFM deltas.

## Next

M3 execution-uses data spec (model track). Then operator queue stacks:
phase-2 native (TSFM-probe + controller arms), full `npm test` re-gate.
