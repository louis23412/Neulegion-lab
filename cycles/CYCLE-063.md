# CYCLE-063 — The decision-grade report: `foldConcentration`, `confidencePersistence`, `nextRunPlan`, `promotionAcrossCadences` and the six-block `decisionReport` are exact — but `restateReportAtPolicy` carries a stale `foldInputs` (L10-cn)

**Date:** 2028-08-01
**Goal:** `analysis/decision.js` (round 26, R26-8) is the module that turns the analysis layer's numbers into
ONE artifact answering the six questions the next cycle asks (training / edge / concentration / economics /
family / nextRun). Every field is either a real value or an explicit `{ available: false, reason }` — never a
silent null. It computes **no new strategy statistic**: each block is a restatement of data the
walk-forward, dependence, cost-ladder, forecast and replication layers already produced. It is **pure** (no
I/O, no RNG) and **shipped** (`analyze.js` composes `foldConcentration` / `confidencePersistence` /
`nextRunPlan` / `decisionReport` / `formatDecision` / `promotionAcrossCadences` behind `--decision`). It was the
last lab-consumed analysis module without a dedicated synthetic audit.

## Work

New experiment `experiments/e71_decision_audit.js` (registered; **79 steps, 48 gated, 0 fails**; 34 ms in the
suite; **10 checks, all pass**). The audit recomputes `foldConcentration` from a direct `strategyReturns` +
`sharpeRatio` replay, hand-checks `confidencePersistence`'s pooled within-fold lag-1 and half-life,
brute-forces the smallest cluster count `pairedUnitsNeeded` resolves, verifies each `cheapestFlip` kind and
the `promotionAcrossCadences` majority/veto rule, checks the six-block `decisionReport`'s explicit-na
discipline and `formatDecision`, and then pins one defect in the restatement chaining.

## Results

### A. `foldConcentration` reproduces a direct recompute (validated)

For a six-fold fixture with an explicit gross vector `[8, 4, 3, −1, −2, −3]` (total **9**), the top-K shares are
`8/9`, `15/9`, `9/9` and the signed sums are the positive/negative fold sums, all to **1e-12**. The
delete-one-cluster block matches a leave-one-out replay of `sharpeRatio` exactly — full **−3.5204429235768973**,
min **−5.253810564276818**, max **−1.6034020777212812**, with the right `worstIndex`/`bestIndex` — and each
per-fold marginal is `full − leaveOut[i]` (mean **0.023595765513707272**) to 1e-12. A non-positive gross total
makes a "share of gross" meaningless, so every `topKs[].share` is **null** (not a misleading 1.0), verified.
The module abstains with explicit `{ available:false, reason }` blocks when `folds` is empty, when
`foldInputs` is absent or length-mismatched, or when a fold's `returns`/`signals` are malformed.

### B. `confidencePersistence` is the pooled within-fold lag-1 (validated)

On a known 12-bar series the pooled lag-1 is **0.666707822740828** and the half-life is `ln 0.5 / ln ρ` =
**1.709771604681528**, matching a hand recompute to 1e-9, with `bars = 12`, `pairs = 11`. Two folds whose
boundary would otherwise look like a pair ([1,1,1] then [−1,−1,−1]) give `pairs = 4` (no cross-fold pairs) and
`lag1 = 1` exactly. A constant-confidence fold states `lag1 = null`, `halfLife = null` with a `note` (it has no
decay rate); fewer than two adjacent finite pairs, or no journaled confidence, abstains.

### C. `nextRunPlan` / `pairedUnitsNeeded` match a brute-force search (validated)

From a candidate whose paired difference is `0.30 ± 0.08` over `C = 36` clusters, `pairedUnitsNeeded` returns
the **smallest** cluster count whose one-sided cluster-t resolves the observed difference: **9** (a brute-force
search of `tCritical(n−1,α)·se·√(C/n) ≤ 0.30` agrees), and for the 80 %-power target **18** (`+ z₈₀·se·√(C/n)`),
with `seScale = 'paired'` and `reference.pairedMde95 = tCritical(35, 0.05) · 0.08 = 0.13516579662244632` exactly.
`nextRunPlan` carries the documented fields: `designEffect 2.95`, `effectiveBars 244`, `mde95 0.5`,
`underpowered true` against a **1.0** threshold, `barsToDetectDependent = ceil(620 · 2.95) = 1829`,
`breakEvenBps 6.5`, `clearsBps {0:true, 2:true, 5:true, 10:false}`, per-fold timing (`50000` ms → 24 folds →
`1200000` ms), and the `cadence`/`scales` blocks.

### D. The `cheapestFlip` kinds and `promotionAcrossCadences` are the documented rules (validated)

All six `cheapestFlip` kinds fire from their witnesses — `none` (promoted), `cost` (break-even below the
cheapest ladder level), `stability` (an unstable promotion test, reading "window 4"), `magnitude` (stable but
short, quoting the **one-sided** t reference `tCritical(35, 0.05)·0.08` and a positive factor), `gate` (a
binding failed hurdle) and `search` (no reasons). `promotionAcrossCadences` is majority-pass
(2/1 → promote **true**) with a strict-majority tie failing (1/2 → **false**), and the catastrophic veto fires
on a negative `netSharpe` and on a `lookahead audit` reason via `defaultCatastrophic`; an empty evaluation set
abstains.

### E. `decisionReport` and `formatDecision` (validated)

`decisionReport` emits `schema: 'nl.decision.v1'` with the six blocks (training / edge / concentration /
economics / family / nextRun); the verdict carries the candidate id and reasons; the label policy is reported as
both the referent's (`conservative`) and the run's (`optimistic`, R28); and every block that has no input is an
explicit `{ available:false, reason }` — `family.seedDistribution`, `family.varianceComponents`,
`family.pairedVarianceRatio` all state their reason rather than reading as a healthy zero, and a bare
`decisionReport({})` still renders. `formatDecision` prints the header (`keep-off (cand)`), the label-policy
referent line and the concentration/nextRun blocks.

### F. `restateReportAtPolicy` carries a stale `foldInputs`, so a policy-restated report mixes two bases (L10-cn)

`restateReportAtPolicy` replaces `folds` with metrics rebuilt from the **restated positions** but returns
`foldInputs: report.foldInputs` **unchanged** (the deliberate P2 chaining: the journal is kept so a restated
report can be restated again). `foldConcentration`, however, reads its two halves from **different** inputs —
`grossTotal`/`topKs`/signed sums from `folds.metrics.grossPnl`, and `deleteOneCluster`/`marginal` from
`foldInputs.signals`:

| handed to `foldConcentration` | gross half describes | Sharpe half describes |
| --- | --- | --- |
| a **cost**-restated report (`restateReportAtCost`) | same positions | same positions (**agree**) |
| a **policy**-restated report (`restateReportAtPolicy`) | **restated** positions | **original** positions (**mix**) |

On the fixture the policy-restated pooled net Sharpe is **−5.201698358740081** while the Sharpe
`foldConcentration` derives from the carried `foldInputs` is **−3.5204429235768973** — the block's two halves
describe two different position series, and the restated gross is a third basis (−0.013520135124205322).
The **shipped** `--decision` path is a COST-only restatement (`restate = restateReportAtCost(report, costBps,
{trials: trialsActive})`, whose `folds` were built at the same `costBps` `foldConcentration` re-costs the
signals at), so both halves agree there — verified by `costRestatementStaysOnOneBasis`
(**−3.877740023296727** on both halves). The mix is reached only by the documented "restate a restated report"
chain (a policy or cadence sweep) feeding `foldConcentration`, which the shipped call does not do. LATENT /
export-level.

### G. Scope

`decision.js` computes no new strategy statistic — every block is a restatement of already-scored data — so
L10-cn cannot move a scored number, and the shipped `--decision` call restates at cost only. No golden moves
and **no fold-back row**.

## What is now false that used to be believed

* **"A restated report is a drop-in input for every consumer of a report."** It is for cost/cadence restatements
  that keep the position series, but `restateReportAtPolicy` changes the positions while carrying the original
  `foldInputs`, so a consumer that re-derives net returns from `foldInputs` (as `foldConcentration` does) reads
  the pre-policy positions beside the post-policy gross.

## Ledger effects

* **F-79** is added: `decision.js` is **validated** against its documented contract (10/10 checks) with one
  registered row — **L10-cn** (`restateReportAtPolicy` replaces `folds` with restated-position metrics but
  carries the original `foldInputs`, so a policy-restated report handed to `foldConcentration` mixes two
  position-series bases). Latent; no fold-back row.
* `e71_decision_audit.js` is the register's **eighteenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e70`). `run_all` is now **79 steps, 48 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T10:35:32Z**).
* **No pure, lab-consumed analysis module remains un-audited** — `decision.js` was the last. Future cycles open
  new leads (the shipped CLI/`observer`/`hivemind` layers, data-file joins) or extend an open one.

## Next

* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded), **L10-cn** (the restated-basis mix).
* No pure analysis module is left; open a new lead (e.g. `observer/legion_metrics.js`, the `hivemind/` modules,
  the `analyze.js` CLI wiring) for CYCLE-064.

## Run

No repo file is touched. Full regeneration: `run_all` → **79 steps, 48 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T10:35:32Z** (`e71` 34 ms; `e70` 30 ms; `e0d` the slowest; total **1313 s** this run).
