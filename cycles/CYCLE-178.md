# CYCLE-178 — S6a executed: trailing hedge FAILS, D-14 corrected, S6 fleshed (2026-10-02)

**Vehicle:** `experiments/s6a_hedge_overlay.js` (standalone, not in
`run_all.js`; result `scratch/s6a_result.json`). Read-only, ~10 s via the
harness. Pre-registered pass criteria met 7/7.

## S6a verdict (director): NO hedge — the neutral gap is lookahead

* All 4 lanes reproduce the banked operator reports to **1e-9** on
  net/turnover/BE (workspace data == operator data — no tree drift, and the
  AI-side harness verification path works).
* **D-14 corrected:** `neutral` is NOT an equal-weight portfolio — it is the
  first-PC-hedged Sharpe of the same book (`dependence/student.js`:
  net − beta·PC1 with FULL-SAMPLE beta). The +0.08 (mid) / +0.45 (stacked)
  gap is an in-sample upper bound, not an opportunity.
* Trailing implementable hedge (W=270/540 bars, hedge turnover costed at
  4 bps) destroys value on all 3 tested lanes: stkBand 9.50 → 9.10/7.41,
  stkFlat 8.87 → 8.39/6.69, midBand 8.56 → 7.69/5.65.
* Decomposition: hedge cost is tiny (gross→net −0.1…−0.3); the loss is
  bad-beta — gross hedged already trails the book. mean|beta| ≈ 0.04
  (book nearly factor-pure already), betaSd 0.027 at W270 (SNR ~1.5),
  W540 smoother but stale-beta catastrophic. Small, unstable loading +
  lookahead = unhedgeable. **No hedge overlay; book stays as-is.**

## By-hand attribution (from banked reports, exact under report arithmetic)

* **D-17 band = purely a cost story.** Backed-out per-bar means: mid gross
  −4.2% / cost −53% → net +2.2%; stacked gross −6.3% / cost −61.5% → net
  +4.4%. The band sacrifices single-digit gross to halve costs.
* **Breadth at flat:** gross +12.3%, cost +55.7% → net +6.5% (BE falls
  because turnover outgrows gross-sum — the D-11 mechanism, quantified).
* **D-18 decay bracket −0.09…−0.17/yr.** Bars-weighted OLS −0.091
  (slope robust to weighting — 2025 dominates by bars); halves-implied
  −0.128…−0.172. S6c haircuts the bracket, never a point. Caveats: 3
  yearly points, seasonal mix (2024 = Jun–Dec only); halves are
  seasonally balanced (~13.7 mo each) → primary for S6c.

## Context flags for S6b/c (D-19, D-20)

* Band dividend is window-dependent (lab full-history +0.18 vs this window
  +0.40/+0.54/+0.63). Worst-block breadth effect ×2.1–2.5 (stacking
  stabilizes the weakest sixth). DE 8.75–10.81 — band + breadth both lower it.
* Sizing hard constraints: pinned spec `sizeUsd.neverBreach` 11.5e6
  (OI-bound on LINK, F-41). Crash-robustness (+2.98/+13.18/+5.51,
  F-17/F-21) is OUT-OF-WINDOW evidence — the allocation case must label it.

## Next

S6a DONE-decided. S6b allocation DESIGN (AI) → native runs (operator,
minutes) → S6c sizing. S0 (122b native test) still the only owed gate.
