# CYCLE-156 — Pre-point coherency S16 + research sweep 10o + Phase-A recipe audit

**Date:** 2026-10-02
**Goal:** full coherency check before tackling the first plan point (Phase A),
plus the regular research sync. No code change.

## S16 static re-verification (AI-side)

* **Dangling:** 0 across 210 src + 93 test files (relative-target
  resolution). The one S13 flag stays exonerated.
* **New-doc refs:** every `PLAN-next.md` / `CYCLE-15x` cite in repo docs and
  lab docs resolves to an existing file. The plan is wired in.
* **run_all / ledger:** unchanged since S13 (138/138, 81+81 rows now +F-163…
  pending this cycle's row).

## Research sweep 10o (AI-side)

* Three arXiv queries (funding+crypto 35, vol+targeting 410→top-25,
  impact+capacity 157→top-25), deduped against 569 filed IDs.
* Raw snapshot: `docs/research/raw/arxiv-sweep-2026-10o.json`.
* **4 grounded notes:** 2607.01550 (short-term trend dead post-2009,
  impact-feedback mechanism — convergence for the L04 closure + F-26
  framing); 2608.18299 (position vs representation crowding — task form for
  Phase C2 joint bound); 2609.00187 (confidence map+scale must be fitted
  jointly per family — design constraint for TODO 85); 2609.27024 (align
  forecast levels before comparing vol models — method checklist for the W4
  vol tournament, follow-up queued below). No doc changes (context only);
  PPO-HRAP noted-not-filed per anti-re-tread.
* **Queued follow-up (10o-1):** verify the repo vol tournament's HAR-vs-AR
  reads are level-aligned (MSE skill has no alignment step; QLIKE second
  skill mitigates but does not remove the concern). Synthetic-ground-truth
  experiment in the e53–e68 style; file an L10 row if it bites.

## Phase-A recipe audit (AI-side, static + code-read)

* **Filenames align exactly:** lab `candles_<sym>_1h.jsonl` and
  `funding_<sym>_8h.jsonl` match the repo `src/data/` convention — the A1
  copy step is a straight copy. Midcap dirs hold 8 series + manifest each.
* **Manifest wiring confirmed:** `--symbols=all` expands to
  `CANDLE_MANIFEST.map(symbol)` in three call sites (main.js:262/324,
  run.js:68) — adding 8 entries makes the 16-panel automatic. Entry shape
  pinned; midcaps need `minRows: 19_000`, `group: 'binance-1h'`.
* **GAP 1 (blocks the A2 band read):** no CLI path scores a sleeve with a
  non-pinned risk spec. `runSleeveAnalysis` takes no cap/band input;
  `carry-dispersion` pins `{cap: 0.125, bandEps: null}` in two places
  (sleeve spec + `CAP_BAND_SPECS`), while the A2 read needs cap 0.125 +
  band ~0.01 (e135/e136). Fix: additive opt-in `--sleeve-cap=` /
  `--sleeve-band=` overrides, default-identical — round 110.
* **GAP 2 (doc, rides with 116):** `--symbols` help says "(8 available)" —
  goes stale the moment 8 entries land. Note for the 116 change, not fixed
  here (currently true).

## Rerank

Unchanged: 116 → 118 → 117, then B. Round 110 (this cycle's fix) is
enablement for A2/B1, not a reordering.
