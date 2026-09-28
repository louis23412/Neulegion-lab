# CYCLE-040 — Stressing F-56: the drift caveat does NOT bite, but the hold-6 gain is a spike, not a plateau (L19; tests F-56)

**Date:** 2027-10-10
**Goal:** F-56 (CYCLE-039) claimed a **hold-6** (~2-day) cadence lifts the F-46 50/50 OI blend's net@4
**0.77 → 0.87**. It rested on a **five-point** grid ({3, 6, 9, 18, 36}), so hold-6 was the max of a coarse
choice, and its turnover measure (`turnoverSeries` = `Σ|target_t − target_{t−1}|`) **omits inter-rebalance
drift** — for a *hold* policy, the target is unchanged between updates, so the measure is ~0 there while a
real book's weights drift with returns. This cycle stress-tests both weaknesses with a **fine hold grid**
(N = 1…12, + 15/18/24/30/36) and a **drift-aware true-hold simulation**.

## Work

**`experiments/e49_hold_drift.js`** (new, registered as `e49_hold_drift`) — rebuilds the F-46 50/50 blend
(renormalised; guards `e21#dLogOI_pos` and F-46's `e38` ensemble exactly) and, for each N in the fine grid,
computes two books: **(a) the lab book** (fixed target applied each period, `turnoverSeries` turnover) and
**(b) the drift-aware book** — weights drift `w′ⱼ = wⱼ(1+rⱼ)/(1+R)` between updates, the book trades back to
the new target only at updates, and turnover counts only those trades.

**Pre-registered read (both must hold, else F-56's cadence claim is downgraded).**
**GRID-ROBUST** if ≥ 3 fine-grid holds (N > 1) beat the daily baseline by ≥ 0.05 net@4 **and** the best hold's
immediate grid neighbours are within 0.05 of it (no isolated spike). **DRIFT-ROBUST** if the best hold's
**drift-aware** net@4 still beats the drift-aware daily baseline by ≥ 0.05 and is positive every year 2022–26.

## Results

**The drift caveat is resolved — and it does not bite.** The drift-aware turnover is within **2×/yr** of the
target-change turnover at **every** N (`driftTurnoverMatches` **true**), so the lab's measure is *not*
under-counting a hold policy: the drift correction is negligible next to the target changes. If anything the
drift-aware net@4 is **higher** than the lab value (hold-6 **0.94** vs 0.87; daily 0.77 vs 0.77), because the
drifted weights happen to earn a little more. So F-56's fee saving is real, not an accounting artefact.

**But the hold-6 gain is a spike.** The fine grid (lab net@4):

| N | 1 | 2 | 3 | 4 | 5 | **6** | 7 | 8 | 9 | 10 | 12 | 15 | 18 | 24 | 30 | 36 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| net@4 | 0.77 | 0.84 | 0.82 | 0.75 | 0.74 | **0.87** | 0.77 | 0.73 | 0.83 | 0.65 | 0.61 | 0.57 | 0.58 | 0.57 | 0.26 | 0.64 |
| turnover | 254 | 176 | 138 | 120 | 105 | 93 | 86 | 79 | 73 | 70 | 62 | 52 | 47 | 38 | 31 | 28 |

The curve is **jagged**: 2/3 and 6 and 9 are high, but 4/5 and 7/8 dip to or below the daily baseline. The
best (hold-6) sits **+0.10** above its immediate neighbours (5 = 0.74, 7 = 0.77) — `gridRobust` **false**.
Only **4 of 15** fine holds clear the +0.05 bar (2, 3, 6, 9), and they are not contiguous. The **short-hold
region (2–9) averages 0.80** vs the daily 0.77 — a real but **+0.03** effect — while the **long region
(10–24) collapses to 0.60**. Drift-aware the picture is the same (best still N=6 at 0.94; short region a
touch higher), so the spike is not a drift artefact either.

**Read:** the pre-registered grid bar **fails**, so F-56's *cadence* claim is **scoped down**. What survives is
weaker but honest: **holding the 50/50 blend for up to ~3 days is cheaper (turnover 254 → 73×/yr) and no worse
than daily (short-hold mean 0.80 vs 0.77), and beyond ~3 days it degrades** — but the specific **+0.10 at
hold-6 is noise** (a coarse-grid selection artifact). The *mix* half of F-56 (50/50 is vol-optimal) is
untouched.

## What is now false that used to be believed

* **"A hold-6 cadence reliably lifts the blend's net@4 to 0.87."** No: on a fine grid hold-6 is an **isolated
  spike** (+0.10 over its neighbours); the short-hold region averages only **+0.03** over daily, and 11 of 15
  holds are ≤ the daily baseline or worse. The effect is **cadence-fragile** — F-55's "a five-point ladder is
  not robustness" applied to a *construction* rather than a split.
* **"The lab's target-change turnover is optimistic for a hold policy (drift-trading is unmodelled)."**
  Falsified: the drift-aware simulation gives turnover within 2×/yr at every N and a slightly *higher* net@4,
  so the fee saving is real. The caveat F-56 carried forward does **not** fire.

## Ledger effects

* New **F-57**; new experiment `e49_hold_drift.js`, new artefact `results/e49_hold_drift.json`; `run_all` is
  now **57 steps** (guards `e21` and F-46 unchanged). **F-56 amended** (cadence claim downgraded to
  "fee saving confirmed, specific cadence is noise"); **L19's construction thread stays closed** — the
  practical recipe is the **50/50 blend held ≤ ~3 days**.
* Methodology: the **drift-vs-target turnover** test is a reusable primitive — the lab's `turnoverSeries`
  is now *verified* adequate for hold/stale-target policies (not merely assumed).

## Next

* L19 is now fully closed (mix 50/50, cadence ≤ ~3 days, standalone, not ported). The remaining lab-wide
  packaging step is the **port-shaped integration artefact** (one function → both sized books, R8/R7 +
  optional OI sleeve), unless a new lead opens.
* F-55's lesson generalises once more: **any construction chosen from a coarse grid needs a fine-grid pass**
  before it is called a plateau — worth adding to `PROTOCOL.md` as a standing check.

## Run

`e49` ~1.3 s (registered). Full `run_all` regeneration **57 steps** (`RUN_SUMMARY` at
**2026-09-27T02:43:17Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e49` all report `pass` (0 fails). The gate-less exploratory steps report timing only.
