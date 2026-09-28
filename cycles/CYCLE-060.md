# CYCLE-060 — The turnover policy grid: the sweep reproduces the restatement exactly, but its `costBps` is dead, its audit hurdle is unreachable, and the default grid is only shallowly frozen (L10-cg…L10-ci)

**Date:** 2028-07-11
**Goal:** `analysis/holding.js` (round 26, R26-5) is the **turnover attack**: it restates the journaled raw
pre-policy confidence (R26-3) under a dead-zone × scale × entry/exit-hysteresis × minimum-holding grid and, for
each (candidate, policy), reports the restated turnover / gross / break-even cost / pooled Sharpe plus a **full
promotion decision**. It is **shipped** — `analyze.js` imports it as `runTurnoverSweep` behind `--turnover-sweep`
and calls it with the run's `costBps` and with `decisionOptions: { requireCleanAudit: audit, ...gateOptions }`.
It is pure post-processing: no model, no RNG, so it cannot move a scored number — which is exactly why its
readout has to be audited.

## Work

New experiment `experiments/e68_holding_audit.js` (registered; **76 steps, 45 gated, 0 fails**; 45 ms in the
suite; **8 checks, all pass**). The audit drives the sweep with synthetic journaled reports (a known baseline, a
known candidate) and checks the grid construction, the restatement surfacing, the ordering / `byId` / 
`bestTurnoverPolicy` contract, the two bail-outs and the formatter; then it pins three defects.

## Results

### A. The grid is the exact cartesian product (validated)

With `deadZones × scales × holdings` = `3 × 1 × 3`, `policies === 9` and `rows === 18` for two candidates. Each
row's `policy` is the merge `{...holding, deadZone, scale}` (a `null` holding collapses to `{deadZone, scale}`; a
holding's `enter`/`exit`/`minHold` survive). No policy object is shared between rows.

### B. Every row reproduces a direct restatement (validated)

For several policies, `row.turnover` / `row.grossPnl` / `row.netSharpe` / `row.breakEvenCostBps` equal a direct
`restateReportAtPolicy(candidate, policy, …)` recompute to **1e-9**. The sweep is exactly the restatement it
claims to be.

### C. Rows sort by break-even, `byId` and `bestTurnoverPolicy` behave (validated)

Rows are **non-increasing** in `breakEvenCostBps` with a missing value sorted last; `byId[id].best` is the
highest-break-even row for that id; `bestPromoting` is the highest-break-even **promoting** row (and `null` when
none promotes); `bestTurnoverPolicy` prefers `bestPromoting` and returns `null` for an unknown id. The two
bail-outs return `available:false` with a reason (a baseline with no fold inputs; a candidate with none), and
`formatTurnoverSweep` renders the unavailable reason and, when available, every id plus the target.

### D. `costBps` is accepted, echoed, and never applied (L10-cg)

`turnoverSweep` destructures `costBps`, writes it on every row — and then calls
`restateReportAtPolicy(report, policy, { periodsPerYear, trials })` **without it**. Every row's
`netSharpe`/`dsr`/`dsrAdjusted` and every promotion decision is therefore computed at **zero cost**:

| sweep | `costBps` echoed | row `netSharpe` (dz=0.1) | identical rows? |
| --- | --- | --- | --- |
| `{costBps: 0}` | 0 | **0.6864950785702724** | — |
| `{costBps: 25}` | 25 | **0.6864950785702724** | **yes** (apart from the echo) |

A **direct** `restateReportAtPolicy(candidate, policy, {costBps: 25})` gives `netSharpe` **−3.156645069841796**
versus **0.6864950785702724** at 0 bps — so the option would move the number if it were threaded. The shipped
caller passes the run's `costBps` (the `--cost-bps` flag), so a `--turnover-sweep --cost-bps=10` run prints
cost-free Sharpes under a header that says `costBps=10`. Only the cost-independent fields
(`turnover`/`grossPnl`/`breakEvenCostBps`) carry cost information. LATENT/report-level.

### E. The `requireCleanAudit` hurdle the sweep asks for is structurally inapplicable (L10-ch)

`analyze.js` passes `decisionOptions: { requireCleanAudit: audit, … }`. But `turnoverSweep` restates each report
first, and `restateReportAtPolicy` **drops the `audit` block** — unlike its sibling `restateReportAtCost`, whose
comment explicitly says the audit "is cost-independent, so it carries over unchanged". `promoteDecision`'s guard
is `if (baseline.audit && !baseline.audit.clean)`, so with `audit === undefined` the hurdle is skipped:

| object | has `audit`? | `promote` |
| --- | --- | --- |
| sweep row (baseline+ candidate with `audit.clean = false`) | no (dropped) | **true** |
| manual `promoteDecision(restBase, {...restCand, audit: dirtyAudit})` | yes | **false** — reason `candidate failed the lookahead audit (1 violations)` |

So a candidate that **failed the run's look-ahead audit** still promotes in the sweep and can be named
`byId.bestPromoting` — the sweep reports a decision the run would not make. Reachable whenever a candidate's
audit is dirty; LATENT/report-level.

### F. `DEFAULT_TURNOVER_GRID` is only shallowly frozen (L10-ci)

`Object.freeze(DEFAULT_TURNOVER_GRID)` freezes the outer object but not its `deadZones`/`scales`/`holdings`
arrays (nor the holding objects):

| check | value |
| --- | --- |
| `Object.isFrozen(DEFAULT_TURNOVER_GRID)` | **true** |
| `Object.isFrozen(DEFAULT_TURNOVER_GRID.deadZones)` | **false** |
| default policies before / after `deadZones.push(0.9)` | **48 → 54** (one band × 1 scale × 6 holdings) |
| after `.pop()` (restored) | **48** |

So a caller can push a band onto the exported default and silently change the default grid for every later
default sweep in the process. LATENT (nobody mutates it today), but a "frozen" shared singleton is a hazard.

### G. Scope

`holding.js` only restates journaled inputs, so none of the three findings can move a scored number; they shape
the diagnostic `--turnover-sweep` block and one exported default. `costBps` **is** passed by the shipped caller
but dropped, so the reading is cost-free; the audit hurdle is requested but unreachable. No golden moves and
**no fold-back row**.

## What is now false that used to be believed

* **"`turnoverSweep` re-scores a policy at the requested cost."** It re-scores it at zero cost and merely
  *echoes* the requested `costBps`; the reported net Sharpe and the promotion decision are gross-of-cost, so two
  sweeps at different costs are byte-identical apart from the label.
* **"The sweep's promotion decision is the run's full decision."** The `requireCleanAudit` hurdle the caller
  passes can never fire, because the restatement discards the `audit` block before `promoteDecision` sees it — a
  dirty-audit candidate can read `promote: true`.
* **"`DEFAULT_TURNOVER_GRID` is frozen."** It is *shallowly* frozen: a push onto its `deadZones` is not blocked
  and changes every subsequent default sweep.
* **"The turnover grid is opaque / hard to audit."** It is a thin, pure wrapper over
  `restateReportAtPolicy` + `promoteDecision`, so its whole readout is reproducible offline (section B) — which
  is what let the three defects be pinned without any market data.

## Ledger effects

* **F-76** is added: `holding.js` is **validated** against its documented contract (8/8 checks) with three
  registered rows — **L10-cg** (`turnoverSweep` accepts and echoes `costBps` but never threads it into
  `restateReportAtPolicy`, so every net Sharpe and promotion decision is at zero cost), **L10-ch** (the
  `requireCleanAudit` hurdle is structurally inapplicable because `restateReportAtPolicy` drops `audit`), and
  **L10-ci** (`DEFAULT_TURNOVER_GRID` is only shallowly frozen). All latent; no fold-back row.
* `e68_holding_audit.js` is the register's **fifteenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e67`). `run_all` is now **76 steps, 45 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T09:16:57Z**).

## Next

* Remaining pure modules: `decision.js` (44 KB), `replication.js` (9.5 KB), `dependence.js` (22.6 KB; partially
  covered by `e54`) — the last of the lab-consumed analysis modules not yet given a dedicated synthetic audit.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded).

## Run

No repo file is touched. Full regeneration: `run_all` → **76 steps, 45 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T09:16:57Z** (`e68` 45 ms; `e67` 49 ms; `e0d` the slowest; total **927 s** this run).
