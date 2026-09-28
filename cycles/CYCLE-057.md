# CYCLE-057 — The stream design layer: the resampler and the Kish design-effect identities are exact, but a zero-variance stream is counted as a full unit of effective breadth, and `maxStreams <= 0` means "unlimited" (L10-ca…L10-cb)

**Date:** 2028-06-20
**Goal:** `analysis/streams.js` is the shipped "buying effective independence, not bars" layer (round 26, R26-6):
`resampleCandles` builds a second bar interval from the same candles, `designEffectOfStreams` measures the
panel's Kish (1965) design effect, and `selectStreams` greedily orders candidates by their marginal effective
bars per raw bar. `analyze.js` imports all four functions and prints them in the run report. The layer is
documented as a **diagnostic/design** quantity (it never enters the scored arithmetic), but it is shipped and it
is what the report says about the panel's breadth — so it deserves the synthetic-ground-truth treatment.

## Work

New experiment `experiments/e65_streams_audit.js` (registered; **73 steps, 42 gated, 0 fails**; 16 ms in the
suite; **9 checks, all pass**). The audit verifies the resampler against a hand recompute and the OHLCV
invariants, the design effect against the Kish identities and the degenerate panels, the fold-Share method
selection against an independent segmentation, the selector's contract (determinism, tie-break, monotonicity,
marginal arithmetic) and the formatter; then it pins two defects. Two findings followed.

## Results

### A. The resampler is exact (validated)

`resampleCandles` reproduces a **hand recompute** (reading the source bars directly, a different code path) to
1e-12 for factors 2, 3, 4 and 7 × `keepIncomplete` false/true on a 23-bar fixture, and the OHLCV invariants hold
against the original bars (open = first open, close = last close, high = max finite high, low = min finite low,
volume = sum, timestamp = first). It **never mutates its input** (snapshot-identical), `factor === 1` is a
**shallow copy** (new array, same bar objects), a trailing partial group is **dropped** unless `keepIncomplete`
(10 bars / factor 4 → 2 groups, keep → 3; 3 bars → 0 / 1), and a bad factor (`0, −1, 1.5, NaN, '2'`) or a
non-array throws. The documented non-finite fallbacks are exact:

| group | open | close | high | low | volume |
| --- | --- | --- | --- | --- | --- |
| both bars missing high/low | 10 | 11 | **11** = max(open,close) | **10** = min(open,close) | **6** (one missing volume counted as 1) |
| one bar supplies high 15 / low 9 | 10 | 11 | **15** | **9** | 6 |

### B. The Kish design effect satisfies every identity (validated)

For a 3-stream panel: `rawBars = K·T` (720), `designEffect = 1 + (K−1)·rbar` (2.9458671265),
`effectiveBars = rawBars/DE` (244.4102…), `effectiveStreams = K/DE` (1.0183758707),
`effectiveBarsPerBar = 1/DE` — all exact, and `rbar` (0.9729335633) equals an independent mean pairwise
correlation to 1e-15. The closed forms: K = 1 is the trivial panel (DE 1, effectiveStreams 1,
`effectiveBars = rawBars = T`); two identical streams are one bet (rbar **1**, DE **2**, effectiveStreams **1**);
three identical streams DE **3**; different lengths align on **T = min length** (long 240 / short 120 → T 120,
K 2, rawBars 240); and the documented degenerates abstain (a hedging pair, a < 3-bar window, a missing series,
an empty panel). The fold-Share method is chosen **iff the fold tiles T** (`foldLength` 20 on T = 200 →
`fold-sharpe`, rbar 0.2657996327 = an independent segmentation; 21 → `raw-returns`).

### C. The selector is exact and deterministic (validated)

`selectStreams` is deterministic, returns `order` = the curve labels, is monotone in effective bars, and
`marginalBars`/`marginalEfficiency = marginalBars/addedBars` recompute exactly. A fully redundant pool
(three copies of one stream) collapses to a single pick with the **label tie-break** (`['x']`), a diversifying
stream is kept, and a positive `maxStreams` is honoured. `formatStreamSelection` renders the documented header
and the `unavailable`/`null` branches.

### D. A zero-variance stream is counted as a full unit of effective breadth (L10-ca)

`meanPairwiseCorrelation` **skips** every pair that cannot be correlated — so a constant stream contributes
nothing to `rbar` — but `designEffectOfStreams` still counts it in `K` and in `rawBars = K·T`. Because it does
not raise `rbar`, `designEffect` stays ≈ 1 and `effectiveStreams ≈ K`:

| panel (T = 240) | rbar | K | rawBars | designEffect | effectiveStreams | effectiveBars |
| --- | --- | --- | --- | --- | --- | --- |
| two independent streams | −0.0133166822 | 2 | 480 | 0.9866833178 | 2.0270 | 486.4783 |
| + one **constant** stream | **−0.0133166822** | **3** | **720** | 0.9733666357 | **3.0821** | 739.7007 |

`rbar` is **bit-identical** with and without the constant stream, so the third stream changes only `K` and
`rawBars` — and buys a full unit (slightly more) of "effective breadth" from a series that carries no
information. Meanwhile `selectStreams` **does** skip it (its candidate is unavailable, since a pair with a
constant partner is NaN), so the two shipped functions disagree about whether a flat stream is a stream.
LATENT (a flat/halted stream in the panel — the L10-l class) and diagnostic-only.

### E. `maxStreams <= 0` means "unlimited" (L10-cb)

The limit is `Number.isFinite(maxStreams) && maxStreams > 0 ? Math.floor(maxStreams) : all.length`, so
`maxStreams: 0` and `maxStreams: -3` both select the full greedy set instead of **none**. `e65`:
`{a,b}` with `maxStreams: 0` → `['a','b']`; with `−3` → `['a','b']`; with `2` → 2. The shipped check only
exercises `maxStreams: 2`, so it cannot see this. LATENT (the driver passes a positive value), and the same API
class as L10-bj (`successiveHalving` not validating `eta`/`minBudget`).

### F. Scope

`streams.js` is shipped — `analyze.js` imports `resampleCandles`/`designEffectOfStreams`/`selectStreams`/
`formatStreamSelection` — but the module docstring and the lock registry both state the design numbers are a
**diagnostic/design** quantity that never enters the scored arithmetic (the deflated Sharpe keeps `trials = K`).
Both findings are latent (a flat stream in the panel; a non-positive `maxStreams` the driver never passes), so
**no golden moves** and `no fold-back row`.

## What is now false that used to be believed

* **"The design effect measures the panel's effective breadth."** A stream that cannot be correlated
  (a constant/flat series) is dropped from `rbar` but kept in `K` and `rawBars`, so it is counted as a fully
  independent observation — the reported `effectiveStreams` can equal `K` while one stream carries no
  information.
* **"`selectStreams` honours `maxStreams`."** It honours it only when `maxStreams > 0`; `0` and negative values
  are treated as **no limit**.
* **"`designEffectOfStreams` and `selectStreams` agree on what a stream is."** They do not: the selector
  refuses a candidate that cannot be correlated, while the design effect counts it.

## Ledger effects

* **F-73** is added: `streams.js` is **validated** against independent references (9/9 checks) with two
  registered rows — **L10-ca** (a constant stream is skipped from `rbar` but counted in `K`/`rawBars`;
  effectiveStreams 2.027 → 3.082 with a bit-identical rbar) and **L10-cb** (`maxStreams <= 0` = unlimited). Both
  are diagnostic-layer/latent; no fold-back row.
* `e65_streams_audit.js` is the register's **twelfth synthetic-ground-truth experiment on a repo module**
  (after `e53`…`e64`). `run_all` is now **73 steps, 42 gated, 0 fails** (`RUN_SUMMARY` at
  **2026-09-27T08:27:23Z**).

## Next

* Remaining pure modules: **`holding.js`** (the turnover policy grid), **`world.js`** (the audited evaluation
  world — the L10-bu-class `panelFor` skip is a candidate), then `decision.js` / `parallel.js` /
  `replication.js` / `dependence.js`.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded).

## Run

No repo file is touched. Full regeneration: `run_all` → **73 steps, 42 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T08:27:23Z** (`e65` 16 ms; `e64` 77 ms; `e0d` the slowest; total **1256 s** this run).
