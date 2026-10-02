# CYCLE-172 — 116 deep-dive: mechanisms, numbers, and the plan

**Trigger:** operator asked for deeper digging + a proper documented next-step
plan. Investigation only (plus two doc-side data actions noted below).

## Dug-up results (all from the banked reports + `folds.jsonl`)

Per-variant table (mean / median / std of fold Sharpes | pooled | adj DSR):

* t15 — baseline: −0.03 / 0 / 3.68 | 0.11 | 0.17 · momentum: −0.25 / −0.09 /
  4.12 | 0.50 | 0.63 · vol: −0.27 / −0.20 / 4.16 | 0.53 | 0.70 · blend:
  −0.66 / −0.85 / 4.02 | 0.29 | 0.42 · network: +0.01 / −0.08 / 4.14 |
  0.45 | 0.46.
* t10 — baseline: +0.45 / 0 / 4.71 | 0.34 | 0.31 · momentum: −0.34 | 0.64 |
  0.70 · vol: −0.38 | 0.67 | 0.76 · blend: −0.80 | 0.37 | 0.45 · network:
  +0.34 / +0.73 | 0.65 | 0.65.
* Ranges: −12.5..+10.2 (t15), −21.9..+16.0 (t10). Baseline positiveFraction
  0.36–0.40 vs signals 0.41–0.55.

Mechanism reads → findings D-01…D-07 in `PLAN.md` (sign gap = heavy-tailed
zero-inflated fold Sharpes; network orthogonal; exposure inconstructible;
power time-bound; TIA benign; provenance gap; ladder shape).

## Data actions this cycle

* Ported 8 midcap funding series into repo `src/data/` (7× 2466×8h,
  TIA 4931×4h — verified benign); removed a stray lab `manifest.json` that
  rode along (caught same session).
* TODO updates: 117 parked with reason, 118 rewritten to in-repo paths +
  TIA note, 84/87 evidence appended, new 122 (lab-first follow-ups).

## Records created

* `PLAN.md` — the durable trackable plan (findings, decision log, sequenced
  steps S1–S5, budgets). Future iterations update status lines here.
* `RUN-ANALYSIS.md` §84 holds the full native readout.

## Next

S3 (122a/b/c, AI-side) is the only open AI-owned step; S1 is the operator's
honesty decision. CYCLE-173 picks up whichever moves first.
