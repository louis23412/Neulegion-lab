# CYCLE-039 — L19's construction thread: the OI mix is optimal at 50/50, but a 1–2 day HOLD cadence lifts net@4 0.77 → 0.87 (L19 → tests F-46)

**Date:** 2027-09-15
**Goal:** F-46's regime-robust OI book is a **fixed 50/50 blend** of two pre-registered EWMA scales
(λ∈{0.1, 0.25}) — chosen for *robustness*, not for being the best mix. L19's last open action was a
**construction** question: given that the signal is weak and churny, does a **cheaper cadence** (`hold-N`:
recompute the weights only every N periods) or a **non-equal two-scale mix** beat the 50/50 blend — still
**without fitting a single λ**? This cycle answers it with a pre-registered read.

## Work

**`experiments/e48_oi_construction.js`** (new, registered as `e48_oi_construction`) — builds the same
cross-sectional Δlog(OI) books (`xsBookImpl`, sign **+1**, `normalize:true`) and compares:

* **`blend(w)`** — a fixed mix putting weight `w` on λ=0.1 and `1−w` on λ=0.25, **renormalised** (the lab's
  blend convention from `e38`/`e39`/`e40`; the F-46 book is `w=0.5`);
* **`hold-N`** — recompute the (blend or single-λ) target every N periods and hold it in between
  (`HOLDS = {3, 6, 9, 18, 36}` periods ≈ 1 / 2 / 3 / 6 / 12 days);
* **`volblend`** — an inverse-trailing-vol mix `w` chosen on `[0, S)` **only** (no hindsight), scored on
  `[S, end)` with the F-49/F-55 freeze boundary `S = 2555` (~2.3 y).

**Pre-registered read.** The construction **ADDS** if it beats the F-46 50/50 blend's full net@4 (**+0.77**)
while keeping break-even ≥ 8 bps and staying positive in **every** calendar year 2022–26 — under a rule that
is either **unfitted** (hold-N) or **fitted only on `[0,S)`** (inverse-vol). A null closes the construction
thread with the honest answer: *F-46's fixed 50/50 blend is the best the weak OI signal supports.*

**Guards (two).** (i) the daily sign+1 book reproduces `e21#dLogOI_pos` (gross **0.9612** / turnover
**1501.11**); (ii) the renormalised 50/50 blend reproduces F-46's `e38` ensemble *exactly* (net@4 **0.77**,
break-even **11.33 bps**, turnover **254×/yr**). `validationPass` requires **both**.

## Results

**The mix does not improve on 50/50.**

| fixed blend w(λ0.1) / 1−w(λ0.25) | net@4 | break-even | turnover /yr | positive every year |
| --- | ---: | ---: | ---: | :---: |
| 0.3 / 0.7 | 0.76 | 10.30 | 299× | ✗ |
| 0.4 / 0.6 | 0.77 | 10.84 | 278× | ✓ |
| **0.5 / 0.5 (F-46)** | **0.77** | **11.33** | **254×** | **✓** |
| 0.6 / 0.4 | 0.74 | 11.90 | 226× | ✓ |
| 0.7 / 0.3 | 0.69 | 12.42 | 197× | ✓ |

Fixed non-equal mixes never beat **+0.77 better than 0.01** (`blendAdds` **false**), and a **no-hindsight**
inverse-vol mix is not better either: it picks `w = **0.51**` — i.e. *almost exactly the equal mix* — and its
out-of-sample net@4 (**1.18**) matches the 50/50 blend's (**1.19**) on `[2555, end)`
(`noHindsightBeats50` **false**). So the equal mix is **not** an arbitrary convention: it is what a
no-hindsight vol-balance would have chosen anyway.

**The cadence DOES add — but as fee saving, not signal.** Holding the 50/50 blend's target for a few periods:

| cadence | gross Sharpe | net@4 | turnover /yr | break-even | positive every year |
| --- | ---: | ---: | ---: | ---: | :---: |
| daily (F-46) | **1.18** | 0.77 | 254× | 11.33 | ✓ |
| hold-3 (~1 d) | 1.05 | 0.82 | 138× | 18.21 | ✓ |
| **hold-6 (~2 d)** | 1.03 | **0.87** | 93× | **27.03** | **✓** |
| hold-9 (~3 d) | 0.95 | 0.83 | 73× | 30.88 | ✗ (2024 −0.44) |
| hold-18 (~6 d) | 0.66 | 0.58 | 47× | 33.21 | ✗ |
| hold-36 (~12 d) | 0.69 | 0.64 | 28× | 58.73 | ✗ |

`blend50_hold6` clears the pre-registered bar (**0.87 > 0.77 + 0.05**, break-even **27.03 ≥ 8**, positive
every year 2022–26: 0.70 / 0.98 / 1.16 / 0.77 / 2.23) ⇒ **`holdAdds` TRUE**. The mechanism is **cost**: the
gross Sharpe *falls* with the hold length (1.18 → 1.03 → 0.95 → 0.66), but turnover falls faster
(254× → 93× → 73× → 47×), so the net-of-4 bps Sharpe rises. This is the **opposite of the R7 no-trade band**
(F-53, where a turnover-matched band *dropped* the net) and the **same direction as the R8 band** (F-52):
when the gross signal is weak, turnover reduction is pure fee saving.

**The plateau is 1–3 days.** hold-3 and hold-6 both beat 0.77 and hold-9 ties; hold-18/36 fall below (the
staleness loss overtakes the fee saving). Single-λ holds agree (`ewma_0.25_hold6` 0.79, `hold9` 0.79) but do
not stay positive every year on their own, so the **blend + moderate hold** is the robust pairing.

## What is now false that used to be believed

* **"A non-equal mix of the two scales must beat equal capital."** No: none does (max **+0.77**, equal), and
  the only *unfitted* choice — an inverse-vol mix — collapses to **0.51**, i.e. the equal mix. 50/50 is
  **not** a lazy convention; it is the vol-balanced optimum.
* **"Holding the OI target longer can only hurt (staleness)."** For the **gross** signal, true (1.18 → 1.03
  at 2 d). For the **net@4** book it is false up to ~3 days: turnover 254× → 93× more than pays for the
  staleness, lifting net@4 **0.77 → 0.87**. The OI book's problem is cost, not decay.
* **"L19's construction thread is closed by null results."** It closes with a **positive**: a 1–2 day hold
  cadence (unfitted, no λ selected) is a genuine improvement on F-46's book.

## Caveats / carried forward

* `hold6` is the **maximum of a five-point grid** (`HOLDS` was pre-registered as {3,6,9,18,36}), so the
  **+0.10** should be read as an *upper bound*; the robust claim is the **1–3 day plateau** (0.82–0.87).
* The turnover measure is the lab's **target-change** turnover (`turnoverSeries`). Between hold updates the
  book still applies the frozen target each period, so inter-rebalance **drift-trading is not modelled** —
  for a *hold* policy this under-counts turnover slightly. **CYCLE-040 tests this directly** (drift-aware
  turnover + a finer hold grid) before the finding is treated as port-shaped.

## Ledger effects

* New **F-56**; new experiment `e48_oi_construction.js`, new artefact `results/e48_oi_construction.json`;
  `run_all` is now **56 steps**; `e48` carries the **two** guards (e21 daily + F-46 blend) in `validationPass`.
* **Lab-internal bug found & fixed while building:** the first draft of `blendRows` averaged weight vectors
  **without renormalising**, reading 0.70 / 10.75 / 220 instead of F-46's 0.77 / 11.33 / 254. Fixed to the
  `e38`/`e39` convention and pinned by guard (ii), so the discrepancy cannot recur silently.
* **F-46** refined (its mix is vol-optimal, not arbitrary); **F-45** refined (the churn has a **cadence**
  fix, not only an EWMA fix); **L19** construction thread **closed** with F-56.

## Next

* **CYCLE-040** — stress F-56: a **finer hold grid** (is 0.87 a spike or a plateau?) and a **drift-aware
  turnover** (does the fee saving survive realistic inter-rebalance trading?). If it holds, F-56 becomes the
  OI sleeve's final construction; if not, it is a turnover-accounting artefact and is retracted.
* The **port-shaped integration artefact** (one function → both sized books, R8/R7 + optional OI sleeve)
  remains the last packaging step.

## Run

`e48` ~2.5 s (registered). Full `run_all` regeneration **56 steps** (`RUN_SUMMARY` at
**2026-09-27T02:31:11Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and
the validation guards `e28`–`e48` all report `pass` (0 fails). The 30 gate-less exploratory steps report
timing only.
