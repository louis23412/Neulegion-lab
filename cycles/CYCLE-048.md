# CYCLE-048 — The labelling module, audited against closed forms: five contract warts, one false docstring, and only one shipped consumer (L10-ai…L10-ap)

**Date:** 2028-04-18
**Goal:** CYCLE-046/047 closed the split-contract thread by pointing at `analysis/labels.js` — the module
that *owns* the label spans the split contract turns on (`tripleBarrierLabels` returns `t1`, the
realisation index, which the repo's own test feeds straight into `uniqueness`). This cycle turns the
synthetic-ground-truth technique (`e53`→F-61, `e54`→F-62, `e55`→F-63) on that module: give each primitive
an input with a **known** answer and assert the closed form.

The pre-registered read (in the experiment header) was: PASSES if the first-touch / binomial /
CUSUM-reset / NaN-warm-up contracts hold *exactly*, while (i) the pt-before-sl tie-break is unreachable
for positive vol yet degenerate at `vol ≤ 0`, (ii) the default event set emits a zero-horizon bet, (iii)
`cusumFilter` ignores its `events` argument and its `lastEmit` guard is dead, (iv) the weights' auto-window
docstring is false, and (v) the shipped `fracDiffAt` equals the weights convolution. *All 23 guards pass.*

## Work

New experiment `experiments/e56_labels_audit.js` (registered in `run_all`; **64 steps, 32 gated, 0 fails**;
77 ms). It imports the repo module directly and audits each primitive against an independent closed form:

* **First-touch (`tripleBarrierLabels`).** Monotone paths have a closed form — the first crossing is
  `ceil(level / step)` — and the opposite barrier is unreachable on a monotone path. 192 monotone cases
  (2 directions × 4 steps × 3 barrier pairs × 2 vol × 4 horizons) all match. Then 60 seeded random paths
  (with occasional gaps) are checked against the *contracts*, asserted exactly: the touched index is the
  **first** bar satisfying either condition; `ret = prices[touched] − entry`; `label 1 ⇒ ret ≥ ptMult·v`,
  `label −1 ⇒ ret ≤ −slMult·v`, `label 0 ⇒ −slMult·v < ret < ptMult·v` and `touched = min(n−1, e+H)`.
* **The tie-break.** A bar can satisfy both conditions iff `ptLevel ≤ slLevel` iff
  `(ptMult + slMult)·vol ≤ 0`. Measured over `vol ∈ {2.7, 1.4, 0.3, 0, −0.5, −2}`.
* **The default event set.** `events = null` expands to *every* index, including `n − 1`.
* **CUSUM (`cusumFilter`).** An **independent** formulation — the drawup/drawdown of the cumulative-sum
  path since the last reset, `sPos = S_j − min_{v≤j} S_v` — which is a different algorithm *and* carries no
  `lastEmit` guard, so an exact match also demonstrates the guard is dead. Plus monotone closed forms
  (`k = floor(thr/step) + 1`), the `events` argument, and threshold strictness.
* **Fractional differentiation.** The weights are `w_k = (−1)^k C(d, k)`: checked for integer `d` against
  the exact multiplicative binomial and for non-integer `d` against an **independent Lanczos log-gamma**
  (with the reflection sign restored — `lgamma` returns `log|Γ|`). Then the auto-window rule, `d=1`/`d=0`,
  `size=1`, the NaN warm-up, and the **shipped consumer** (`features.js#fracDiffAt`/`fracMomentum`).

## Results

### A. The module is correct on its stated contracts

| contract | closed form | measurement |
| --- | --- | --- |
| the repo's three pinned cases | `t1 = 2`/label 1, `t1 = 1`/label −1, `t1 = 3`/label 0 | reproduced |
| first crossing on a monotone path | `ceil(level/step)`, opposite barrier unreachable | **192/192** match |
| the three-way `ret` contract | `ret ≥ ptMult·v` / `ret ≤ −slMult·v` / `−slMult·v < ret < ptMult·v` | 60/60 paths, every row, to **1e−12** |
| the touched index is the **first** | no earlier bar satisfies either condition | 60/60 paths |
| CUSUM reset rule | the drawup/drawdown of the cumulative path since the last reset | **160/160** (40 walks × 4 thresholds) |
| CUSUM monotone closed form | emits at `k, 2k, 3k…`, `k = floor(thr/step)+1` | **12/12** |
| weights, integer `d` | `(−1)^k C(d,k)`, zero for `k > d` | `d ∈ {0…5}`, exact to **1e−12** |
| weights, non-integer `d` | `(−1)^k C(d,k)` via Lanczos `Γ` | max rel. error **2.3e−14…4.1e−14** (`d ∈ {0.4,0.5,0.7,1.5,2.5,−0.5}`) |
| `d = 1`, `size = 0` | the first difference | exact; constant on a linear series |
| `size = 1` | the identity, for any `d` | exact |
| NaN warm-up | NaN iff `t < width − 1`, `width = min(w.length, series.length)` | 5/5 configs |
| the **shipped** consumer | `Σ_k w_k·log(closes[t−k])` | 54 configs + momentum, exact |

**But `ret` is a realised price change, not the barrier magnitude.** In the random grid the touch bar
overshoots the barrier level **1362** times (a gap through the level), so `ret > ptMult·v` strictly on
those rows. `ret` is `prices[touched] − entry` (a *price difference*, not a fraction, and not scaled by
`vol`), so a consumer who reads it as "the label's P&L in vol units" is wrong on every gapped touch. The
docstring does not define `ret`; the contract above is the code's actual one.

### B. Five contract warts (all latent — see D)

**1. The pt-before-sl tie-break is dead for `vol > 0`, and degenerate for `vol ≤ 0` (L10-ak).** The loop
checks `p >= ptLevel` before `p <= slLevel`, so a bar satisfying both reads **+1**. Both can only hold if
`ptLevel ≤ slLevel`, i.e. `(ptMult + slMult)·vol ≤ 0`:

| `vol` | `ptLevel` | `slLevel` | bars satisfying both (of 6) | label at `e=0` |
| ---: | ---: | ---: | ---: | ---: |
| 2.7 | 102.7 | 97.3 | **0** | 0 (timeout) |
| 1.4 | 101.4 | 98.6 | **0** | 0 (timeout) |
| 0.3 | 100.3 | 99.7 | **0** | 1 |
| **0** | 100.0 | 100.0 | **3** | 1 |
| −0.5 | 99.5 | 100.5 | **6** | 1 |
| −2.0 | 98.0 | 102.0 | **6** | 1 |

So the ordering is a **no-op on the entire sane domain** (`vol > 0`, positive multipliers), and becomes
observable only when the barriers coincide or invert. At `vol = 0` the triple barrier **collapses to a
one-bar sign label**: over 12 monotone cases (both directions, `H ∈ {1, 5, 30}`) the label is exactly
`sign(prices[e+1] − prices[e])` and the touch is always `e + 1`, independent of the horizon; on a flat
series **11 of 12** events label **+1 at `ret = 0`** (the entry price itself "touches" the profit level),
the 12th being the zero-horizon row. A rolling vol that reaches 0 — a pegged or constant-price window —
therefore labels *every* bet +1, i.e. a 100 % "profit-take" sample. (This also resolves the handoff's
candidate read: the docstring's "1 = profit-take touched first" is not false for a tie on the sane
domain, because a tie cannot occur there.)

**2. The default event set emits a zero-horizon bet (L10-al).** With `events = null` on `n = 30`,
`H = 10`: **30** rows, of which exactly one is `{event: 29, t1: 29, label: 0, ret: 0}` — `t1 = min(n−1,
n−1+H) = n−1 = event`, the loop is empty, and the row is a **`label 0` indistinguishable from a genuine
vertical-barrier timeout** with a zero-length holding period. Exactly `H` events (`n−H … n−1`) get a
truncated vertical barrier, which is correct behaviour but means the last `H` rows' horizon is *not*
`maxHolding`. The repo's own test asserts only `t1 >= event` (which permits the degenerate row) and builds
its uniqueness spans as `[event, t1]` — so a point span can enter `averageUniqueness`/`effectiveSampleSize`
unnoticed.

**3. `cusumFilter` accepts an `events` argument it never reads (L10-ai).** `cusumFilter({prices, threshold,
events: [0, 5, 999]})` returns output **byte-identical** to the two-argument call. The parameter is in the
signature and absent from the body — an advertised option that does nothing (the L10-af class).

**4. `cusumFilter`'s `lastEmit` guard is dead (L10-aj).** `lastEmit` is only ever assigned the loop index
`t`, and `t` strictly increases, so `t !== lastEmit` is **always true** — the guard can never suppress an
emission. The proof is constructive: the independent reference (no such guard) matches the repo function
exactly on all **160** grid rows and **12** monotone cases. Harmless, but it is code that says it does
something it cannot do.

**5. The weights' auto-window docstring is false (L10-am).** The docstring says "`size <= 0` uses
DEFAULT_FD_WINDOW". The code expands until `|w| < 1e−12` (capped at `DEFAULT_FD_WINDOW = 100`), which
happens to be 100 for `d = 0.4` — the one `d` the repo's own test samples — but is much shorter wherever
the binomial tail vanishes exactly:

| `d` | 0 | 1 | 2 | 3 | 0.1 | 0.4 | 0.5 | −0.5 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| auto window (`size = 0`) | **1** | **2** | **3** | **4** | 100 | 100 | 100 | 100 |

The stated rule is false for `d ∈ {0, 1, 2, 3}`, and the repo's test (`fractionalDiffWeights(0.4, 0)`
must be 100) is exactly the case that cannot catch it (the L10-ag lesson: a test-ledger claim is a claim).

**Corrected candidate (no defect, L10-an).** The pre-registered candidate read "`fractionalDiffWeights(0,
0)` yields width 2 → position 0 NaN". **False**: `d = 0` auto returns `[1]` (width 1), because the
recurrence's very first step is `0` and the `|w| < 1e−12` break fires immediately; `fractionalDiff(series,
0, 0)` is therefore the **exact identity with no NaN**. The width-2 / NaN-at-0 behaviour belongs to
`d = 1`, where it is correct (the first difference has no value at position 0).

### C. Two calibration facts

**Only one of six exports is on the shipped path (L10-ao).** A trace of the repo's import sites: the
shipped A/B reaches `labels.js` **only** through `analysis/features.js:34` (`fracDiffAt`/`fracMomentum`,
the `sig-frac-momentum` candidate); `tripleBarrierLabels`, `cusumFilter`, `fractionalDiff`,
`fracDiffLogPrices` and `DEFAULT_FD_WINDOW` are consumed by **`test/browser/entries/analysis.test.js`
and `test/lock-registry.js` only**. The shipped controller implements its own barrier labelling in
`hivemind/controller/trades.js` (`optimistic`/`conservative`/`triple`). So every wart in §B is **latent**
on the shipped path — the same scoping discipline CYCLE-047 applied to F-63.

**The shipped FD window is 16 where the module's own rule is 100 (L10-ap).** The `sig-frac-momentum`
candidate carries `window: 16, params: {d: 0.4}` (`features.js:387`), while `fractionalDiffWeights(0.4, 0)`
— the module's own auto window, and the constant the repo's test pins — is **100**. At `d = 0.4` the
weight at `k = 16` is still **−5.64e−3** (vs the auto-stop threshold 1e−12), and the coefficients beyond
`k = 15` carry **6.27 %** of the first-100 window's total `|w|` mass (0.1188 of 1.8933); the 100-weight cap
itself omits a further **0.0845**. This is a deliberate window/warm-up trade-off (a 16-weight window is
usable from `t = 15`, a 100-weight one only from `t = 99`) on an arm the README already lists as DROPPED —
reported for calibration, not as a defect.

## What is now false that used to be believed

* **"`tripleBarrierLabels`' `pt`-before-`sl` ordering biases labels in a realistic case."** False: with
  `vol > 0` and positive multipliers `ptLevel > slLevel`, so no observation can satisfy both and the
  ordering is unobservable. It is a real degeneracy only at `vol ≤ 0`, where the *barriers* have already
  failed, not the tie-break.
* **"`fractionalDiffWeights(0, 0)` returns a width-2 window, so the `d = 0` identity is NaN at position
  0."** False (corrected before it was written down): `d = 0` auto-returns `[1]` and the identity is exact;
  width 2 belongs to `d = 1`.
* **"The `size <= 0` branch uses `DEFAULT_FD_WINDOW`."** False: that is only the *cap*; the branch stops at
  the first `|w| < 1e−12`, which is 1/2/3/4 weights for `d = 0/1/2/3`.
* **"`cusumFilter` takes an `events` filter and a consecutive-emission guard."** False: `events` is never
  read and `lastEmit` can never fire.
* **"The only consumer of `labels.js`'s barrier primitives is the shipped controller."** False: the
  controller has its own labelling; the module's barrier/event/CUSUM primitives are **test-only**.

## Ledger effects

* **F-64 is added** — the labels module audited synthetically: **correct on its stated contracts**, with
  five contract warts (L10-ai…L10-am), one corrected candidate (L10-an), and two scope/calibration rows
  (L10-ao, L10-ap). No shipped-path behaviour moves; **no new fold-back row** (nothing here reaches the
  A/B).
* `e56_labels_audit.js` is the register's **third synthetic-ground-truth experiment on a repo module**
  (after `e53`/F-61 and `e54`/F-62; `e55`/F-63 is the split contract). `run_all` is now **64 steps,
  32 gated, 0 fails** (`RUN_SUMMARY` at **2026-09-27T04:27:06Z**).

## Next

* The remaining pure-module audits: **`overfitting.js`** (PBO/CSCV), **`forecast.js`** (EWMA/HAR vol),
  **`race.js`** (arm ranking) — all now have three templates to copy (`e53`, `e54`, `e55`/`e56`).
* Remaining L10 rows: **L10-e** (the feature `closes` contract), **L10-h** (golden movement for any R1–R9
  port), **L10-ad** (the carry attribution lag — quantify before calling it a defect).
* A future **fixed-label offline** model behind `walkForwardSplit` would make F-63/F-64's label-span facts
  live; the `e55`/`e56` guards are the tripwire.

## Run

No repo file is touched. Full regeneration: `run_all` → **64 steps, 32 gated, 0 fails**,
`RUN_SUMMARY` at **2026-09-27T04:27:06Z** (`e56` 77 ms; `e0d` remains the slowest step at ~168 s).
