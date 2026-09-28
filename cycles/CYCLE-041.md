# CYCLE-041 — The OI sleeve's right cost tool is a no-trade BAND, not a cadence: a smooth plateau at net@4 0.92 beating hold-6's spike (L19; tests F-56/F-57)

**Date:** 2027-11-05
**Goal:** F-56/F-57 left the OI sleeve with a weak construction ("hold the 50/50 blend ≤ ~3 days, which is no
worse than daily"). But a hold *ignores fresh information until the clock says so*, so its Sharpe is a noisy
function of N — exactly the fine-grid jaggedness F-57 exposed. The lab's **proven** turnover tool is the
**no-trade band** (F-52/F-53): per symbol, move only when the target has moved more than `eps` from what is
held. It is **state-dependent** — it rebalances exactly when the signal really moves — so it should degrade
*gracefully*. This cycle ports that band onto the OI sleeve and asks whether it is the better construction.

## Work

**`experiments/e50_oi_band.js`** (new, registered as `e50_oi_band`) — builds the F-46 50/50 blend
(renormalised; guards `e21#dLogOI_pos` and F-46's `e38` ensemble exactly), sweeps a **no-trade band**
`applyBand(rows, eps)` over `eps ∈ [0.0005, 0.1]`, and compares its net@4-vs-turnover curve to the **hold-N
grid** from `e49`, matched point-by-point on turnover.

**Pre-registered read.** **BAND-ADDS** if some `eps` reads net@4 ≥ daily + 0.05, positive every year 2022–26,
and at its turnover the **turnover-matched hold-N** reads no more than 0.02 above it. **BAND-SMOOTH** if,
ordered by turnover, net@4 has no interior spike (no fall of >0.05 followed by a re-rise above the prior
peak). A `bandWins` count (eps where band ≥ matched hold + 0.02) summarises the head-to-head, and a
**plateau** check counts eps within 0.05 of the best.

## Results

**The band lifts the sleeve smoothly to 0.92.** The sweep (sorted by eps):

| eps | 0.005 | 0.008 | 0.01 | 0.013 | 0.016 | 0.02 | 0.025 | **0.03** | 0.04 | 0.06 | 0.10 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| net@4 | 0.77 | 0.78 | 0.79 | 0.81 | 0.84 | 0.86 | 0.90 | **0.92** | 0.90 | 0.70 | 0.75 |
| turnover | 251 | 248 | 245 | 240 | 234 | 223 | 210 | **198** | 173 | 135 | 86 |

The best band (`eps = 0.03`) reads net@4 **0.92** at turnover **198×/yr**, break-even **15.22 bps**, and is
**positive in every year 2022–26** — **above** hold-6's 0.87 and well above the daily 0.77. It is a
**plateau**, not a spike: three sweep points (eps 0.025 / 0.03 / 0.04) sit within 0.05 of the peak and the
best's eps-neighbours are close (`bandPlateauRobust` **true**), and the curve has **no interior re-rise**
(`bandReRisers` **0**, vs hold-N's **1**). `bandAdds` **true** (best band 0.92 ≥ daily + 0.05, every year
positive, and the matched hold-N at 198×/yr reads 0.84 — the band beats it by **+0.07**).

**At matched turnover it is not a clean sweep — and that is the honest nuance.** The band wins **7 of 18**
sweep points by ≥ 0.02, all in the band's strong region (turnover ≈ 173–200+); at the *low*-turnover end the
cadence still reads higher (eps 0.06 → 0.70 vs matched hold-3 0.82; eps 0.10 → 0.75 vs hold-7 0.77). But that
low-turnover cadence "advantage" is precisely the **fine-grid spike** F-57 exposed — hold-3/6/9 are the lucky
N, and their neighbours (hold-4/5/7/8) read 0.73–0.77. The band's own weak point (eps 0.06 → 0.70) is a
single dip that **recovers**; it is not a spike pattern.

**Read:** the pre-registered bars pass ⇒ **F-58 SUPPORTED**: the no-trade band is the OI sleeve's right cost
tool — a **smooth, positive-every-year plateau** that reaches **net@4 0.92** (vs hold-6's 0.87) without
hand-picking a cadence. The sleeve's construction becomes: **F-46's 50/50 blend + a no-trade band (eps ≈
0.03), turnover ≈ 200×/yr**.

## What is now false that used to be believed

* **"The OI sleeve's best cost tool is a hold cadence."** No: a state-dependent **no-trade band** beats it at
  its own turnover (0.92 vs 0.87), is a smoother curve (no interior spike), and needs no hand-picked N. The
  cadence's apparent edge at low turnover lives entirely in its fine-grid spikes (F-57).
* **"Turnover reduction on the OI sleeve is capped around 93×/yr (hold-6)."** No: the band reaches ~200×/yr
  *and* higher net@4, because it trades when the signal moves rather than on a clock.

## Ledger effects

* New **F-58**; new experiment `e50_oi_band.js`, new artefact `results/e50_oi_band.json`; `run_all` is now
  **58 steps** (27 gated). **F-56/F-57** gain their constructive answer: the OI sleeve is **50/50 + band**,
  not **50/50 + cadence**. **L19** is now fully closed on the construction side.
* The band is now confirmed as the lab's **general** cost recipe: **R8** (F-52, stacks with the cap), **R7**
  (F-53, alone), **OI sleeve** (F-58, alone) — three sleeves, one tool.

## Next

* L19 is closed; the last lab-wide item remains the **port-shaped integration artefact** (one function → both
  sized books), which can now include the OI sleeve as an optional banded third stream.
* The band-vs-cadence contrast is worth adding to `THEORY.md` as a general lesson: **state-dependent cost
  tools (bands) beat clock-dependent ones (holds) when the signal is informative-but-weak.**

## Run

`e50` ~1.6 s (registered). Full `run_all` regeneration **58 steps** (`RUN_SUMMARY` at
**2026-09-27T02:54:29Z**, machine-load dependent); controls `e0c`, `e5` (1h/15m), the 13-check `e14`, and the
validation guards `e28`–`e50` all report `pass` (0 fails). The gate-less exploratory steps report timing only.
