# CYCLE-173 — Executing S3: 122a/b/c + research sync 10q (2026-10-02)

**Coherency check first:** PLAN S1 is operator-owned (118 honesty decision)
— cannot execute; S3 (122a/b/c, AI-side, ungated) is the in-order AI work.
Bug/sanity + tests every step; research synced (10q).

## 122a — sign gap explained (folds.jsonl, gh16 run, 2880 score folds)

* Flat folds score exactly 0 (baseline 148 zero-folds → median 0).
* Fold Sharpe sd 3.7–4.2, range −12.5..+10.2; meanPos ≈ +3.2..3.7,
  meanNeg ≈ −3.3..−3.6 for ALL arms — the mean is a win-rate contest on
  ±3.4 noise. Non-zero win rates: baseline 48%, signals 48–50% — no
  separation, yet pooled 0.11 vs 0.29–0.53.
* P&L-weighted mean overshoots pooled 2× (1.01 vs 0.50) while equal-weight
  understates (−0.25): neither fold aggregation is canonical; pooled is.
* Proposal (TODO 85 datum, needs DESIGN + native gate): demote the mean-fold
  hurdle to diagnostic; paired-cluster + adj DSR stay binding.

## 122b — run.json records P2 flags (code + test)

* `run.js`: `cadences` (copied array or null) + `exposureMatch` (bool) in the
  run.json write — additive, no shape assertion exists. AI-verified:
  parse-OK, in-scope, emulation on/off/empty all correct.
* New native test `records the P2 restatement flags` (on-run + default-off
  run, tiny fixture). NATIVE OWED — operator command below.

## 122c — power audit closes 117's revisit condition

* Variance-ratio bound: wave-2 (16→24 streams, rbar 0.39→0.35 lab-measured)
  trims paired se ~8% (t 1.36→1.47, p≈0.09→0.07); optimistic r→0.15 still
  only reaches p≈0.04 on the single closest approach. Nothing flips under
  measured correlations. Revisit condition now a number: an arm at
  one-sided p≲0.07.

## Research sync 10q (targeted: aggregation, correlated testing, carry, WF)

* `arxiv-sweep-2026-10q.json` + README line. Grounded: 2610.01115 (certified
  alpha capacity — KL evidence-vs-decay feasibility; task form for G5),
  2609.05433 (perp no-arbitrage nesting; sleeve theory), 2506.08573
  (funding-rate design; shelf), 2608.27734 (search-aware evaluation;
  audit-architecture convergence). Two quoted queries returned zero (too
  strict) — shorter phrases worked; noted in the JSON.

## Observed, not changed

* `--cadences`/`--exposure-match` are silently ignored in `--sleeve` mode
  (accepted flags, no effect) — #69-adjacent smell, left for a fixes round.

## Next

S1 (operator honesty decision) → S2 (118) → S4 (G5). AI-side S3 DONE.
Native owed: the 122b test (command below) — then 122 fully closes.
