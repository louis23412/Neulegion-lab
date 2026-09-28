# CYCLE-058 — The audited evaluation world: the shock and the view are exact, but a missing `streamIndex` makes the cross-sectional look-ahead audit vacuous, and `maxBars <= 0` flips the slice (L10-cc…L10-cd)

**Date:** 2028-06-27
**Goal:** `analysis/world.js` (round 23, N0) is the module that gives `auditNoLookahead` its teeth. The audit can
only certify causality for information it can **reach**, and the shipped model reads the candle series, not the
return array, so a returns-only perturbation never touched its input and the audit passed **vacuously**
(BUGS.md #22). `world.js` builds the view a candle-driven model actually consumes: `shockCandles` scales every
bar after the probe point by a bounded, deterministic, non-uniform factor, and `makeCandleViewFor` re-derives
`view.returns` from the (possibly shocked) closes. It is **shipped** — `analyze.js` imports
`makeCandleViewFor`/`worldFromCandles`/`DEFAULT_SHOCK`, and `fold_worker.js` builds its view through
`makeCandleViewFor` — and it is load-bearing for every causality certificate the project issues.

## Work

New experiment `experiments/e66_world_audit.js` (registered; **74 steps, 43 gated, 0 fails**; 49 ms in the
suite; **7 checks, all pass**). The audit verifies the shock factors' bounds and phase shift, the candle shock's
identity/scaling/non-uniformity, the view's base and probe contracts (self-consistency, past-unchanged,
future-moved), the panel attachment, and `worldFromCandles`' alignment and last-N contract; then it pins two
defects. Two findings followed.

## Results

### A. The shock is exact, bounded, non-uniform and phase-shifted (validated)

`shockFactor`/`volumeShockFactor` are **exactly 1** at and before `after` and strictly inside `[1, 1+2·probe]`
after it (probe 0.07 → max 1.14), so a shocked price path is always positive and cannot explode; they are
deterministic, **non-uniform** across `t`, and phase-shifted from each other (at `t = after+2`, price 1.0494 vs
volume 1.1369), so a volume-based strategy is reachable too. `probe: 0` is a no-op (factor 1).

### B. `shockCandles` is exact (validated)

`perturb = null` returns the **same array** (the base pass uses the real candles); every bar at or before `after`
is the **same object** (untouched); each bar after `after` gets a **new object** with OHLC scaled by one factor
`f(t)` and volume by its own `fv(t)`; the input is never mutated; the result is deterministic; the shocked path
stays positive; and the shock changes the **shape**, not just the level (the close ratio spans 1.0001–1.0993), so
a scale-invariant model cannot normalise it away.

### C. The view is self-consistent and causal (validated)

`makeCandleViewFor(candles)(null, null)` returns the real candles (`candles` identity), the real closes/volumes,
and `returns = barReturns(closes)`; a caller-supplied returns array is used verbatim. On a probe pass the view is
**self-consistent** — `view.returns` equals `barReturns(view.closes)` exactly — the past is **bit-unchanged**
(every `t <= after` matches the base closes *and* base returns), **all** bars after `after` move (19/19), and
`perturb` echoes `{after, probe}`.

### D. The panel's own-stream slot is replaced only when `streamIndex` matches (L10-cc)

With a panel `{streamIndex: 1, ...}` the base and probe passes both replace slot 1 with the view's own `returns`
and leave the other streams untouched — correct. But `panelFor` is
`returnsByStream.map((rs, i) => i === panel.streamIndex ? own : rs)`, so **if `streamIndex` is absent the
comparison is never true and NO slot is replaced**:

| panel | probe pass: `returnsByStream` | `view.returns` |
| --- | --- | --- |
| `{streamIndex: 1}`, T = 40, after = 20 | slot 1 = the **shocked** own; 0, 2 untouched | shocked |
| `{streamIndex: undefined}` | **every slot is the unperturbed original** | shocked |
| `{streamIndex: 7}` (out of range) | every slot is the unperturbed original | shocked |

So a cross-sectional candidate (`sig-reversal-xs`, `sig-network-momentum`) reads its own stream **unshocked** on
a probe pass and the look-ahead audit is **vacuous** for it — the exact trap `world.js` was built to close. It is
the same root cause as **L10-bu** (`features.js`'s `networkMomentum` self-skip) in a different module, with the
opposite consequence: there a wrong feature value, here a **green audit that cannot fail**. LATENT (`analyze.js`
always sets `streamIndex`).

### E. `worldFromCandles`' `maxBars` guard flips the slice for `<= 0` (L10-cd)

The guard is `maxBars && candles.length > maxBars ? candles.slice(-maxBars) : candles.slice()`. On a 30-bar
fixture:

| `maxBars` | bars returned | what it should mean |
| --- | --- | --- |
| `5` | 5 (last 5) | last 5 ✓ |
| `0` | **30** (all) | none — `0` is falsy |
| `−5` | **25** (`slice(5)` — the first 5 **dropped**) | none/error — the sign flip |
| `7.5` | 7 (silently truncated) | 7 or 8 |

`maxBars <= 0` is reachable from the CLI (`analyze.js`: `num('bars', 300)`), so a mis-set `--bars` produces a
plausible-looking series from the **wrong end** rather than an error. LATENT.

### F. Scope

`world.js` is shipped and load-bearing for every causality certificate, but both findings are latent:
`analyze.js`'s panel always sets `streamIndex`, and its `maxBars` comes from a positive/defaulted `--bars`. No
golden moves and `no fold-back row`.

## What is now false that used to be believed

* **"On a probe pass, the view's panel carries this stream's perturbed series."** It does only when
  `panel.streamIndex` matches a real index; with `streamIndex` absent or out of range **no** slot is replaced, so
  a cross-sectional candidate reads its own unperturbed series and its audit cannot fail.
* **"`worldFromCandles(…, {maxBars})` keeps the last `maxBars` bars."** Only for a positive value: `0` returns
  **all** bars, a negative value **drops the first |maxBars| bars** (`slice(-maxBars)`), and a fractional value
  truncates silently.
* **"A shocked candle object is perturbed in every field."** Only `open/high/low/close` (one factor) and
  `volume` (its own) are scaled — the rest of the bar is copied through, which is correct for the shipped candle
  schema but bounds the perturbation's reach to the OHLCV field set.

## Ledger effects

* **F-74** is added: `world.js` is **validated** against its documented contract (7/7 checks) with two registered
  rows — **L10-cc** (`panelFor` skips the own-stream replacement without `streamIndex`; the cross-sectional
  look-ahead audit is vacuous) and **L10-cd** (`maxBars <= 0` returns all bars / drops the first |maxBars|; 0 and
  negatives reachable from `--bars`). Both latent; no fold-back row.
* `e66_world_audit.js` is the register's **thirteenth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e65`). `run_all` is now **74 steps, 43 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T08:44:14Z**).

## Next

* Remaining pure modules: **`holding.js`** (the turnover policy grid), then `decision.js` / `parallel.js` /
  `replication.js` / `dependence.js`.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded), and the growing **L10-a*** / **L10-b*** / **L10-c*** families.

## Run

No repo file is touched. Full regeneration: `run_all` → **74 steps, 43 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T08:44:14Z** (`e66` 49 ms; `e65` 16 ms; `e0d` the slowest; total **855 s** this run).
