# CYCLE-016 — Short-horizon reversal: the last open mechanism (L13)

**Date:** 2026-10-05
**Goal:** close L13, the top of the open frontier. The project's P3 reversal family is PARK on taker
cost, and the lab's long-sample break-evens (0.5–2.6 bps) sit an order of magnitude below the 5–10 bps
taker assumption — so *is the reversal gross edge real*, and at what break-even? Two things made this
cycle worth running as its own unit: (a) the lead's own status was stale (below), and (b) every prior
reversal measurement in the lab was either time-series per-stream (`e2`'s `reversal-1`) or basis
reversion (F-10/F-25, a *different* object — the perp-spot spread, not the price). The lab's two working
cross-sectional sleeves (carry dispersion F-24, toptrader fade F-29) are **dollar-neutral weight books**,
and nobody had built one on price reversal.

## Work

1. **`experiments/e24_reversal.js`** (new, registered in `run_all` as `e24_reversal_1h` /
   `e24_reversal_15m`), four parts, at both 1h and 15m on the full history:
   * **0 — mechanism, model-free:** lag-k autocorrelation, the variance ratio
     `VR(k) = Var(k-bar)/(k·Var(1-bar))`, and the **cross-sectional decay profile** (per-period
     cross-sectional IC of the past return against the forward h-bar return, h = 1…64).
   * **A — the repo's P3 arms** (`reversal`, `reversalWindow` 2/4/8, `reversalVol`, a new pure-sign
     variant, `crossSectionalReversal`) through the *same* `positionsOfFast` pipeline as `e2`, with
     block stability, per-year, the last-600-bar (F-01) reading, and the F-11 controls in the same call.
   * **B — the new shape:** a dollar-neutral cross-sectional reversal **book**
     (`w_j = −(pastReturn_j − mean)/Σ|·|`, `Σw = 0`) at windows 1/2/4/8/16, level and rank weights,
     both signs, audited by `e16#audit`.
   * **C — guards:** a 40-seed cross-sectional signal-shuffle placebo, and a
     next-bar-vs-contemporaneous (L10-q) causality index.
2. **Refactor:** `e12#statsOf` and `e16#audit` take an optional `periodsPerYear` (default unchanged), so
   a bar-grid book can be audited on the ledger's 252 basis. Verified **byte-identical** against the
   stored `e16`/`e17`/`e13`/`e21` artefacts before any new number was believed.
3. Everything here is round-trip-safe (pure functions, seeded RNG) and reproducible from `run_all`.

## A stale board, found by reading the artefacts instead of the lead

L13's status line said **"Owner experiments: — (to build: `e13_reversal.js`)"** and `leads/INDEX.md`
said "not yet measured". But `e2_arm_sweep.js` has scored the shipped `sig-reversal` (`reversal-1`) at
**both** 1h and 15m since CYCLE-001, and `run_all` regenerates both artefacts. The number has been in
`results/e2_arm_sweep_{1h,15m}.json` the whole time (1h +0.057 / 15m +0.113) and was simply never
surfaced. `e24#rev-1` reproduces it to 4 decimals, which is the check that the new file measures the same
object. **L13's per-stream half was already answered; the board was stale.**

## Result — F-32: reversal is a real gross cross-sectional edge, and it is unrescuable

**(0) The mechanism is present and fast.** Cross-sectional IC of the past 1-bar return against the
forward 1-bar return: **−0.049 (1h) / −0.046 (15m)**, i.e. reversal, and it decays to ~0 by 16–32 bars
(w1 profile, 1h: −0.049, −0.042, −0.030, −0.020, −0.009, −0.003, −0.002 at h = 1…64). Time-series
lag-1 autocorrelation −0.0133 (1h) / −0.0138 (15m), negative in **7 of 8** symbols; VR(2/4/8/16) all
0.93–0.99. So mean reversion is real, small, and short-lived — the *cross-sectional* part is ~3.5× the
time-series part.

**(A) The repo's P3 arms (mean full-history Sharpe, break-even, positive streams, block stability):**

| arm | 1h Sharpe | 1h BE (bps) | 1h pos / stab | 15m Sharpe | 15m BE (bps) | 15m pos / stab |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rev-1` `-r[t]` | +0.057 | **0.47** | 7/8, 0.50 | +0.113 | **0.34** | 8/8, 0.63 |
| `rev-2` | +0.123 | 1.31 | 7/8, 0.63 | +0.137 | 0.58 | 8/8, **1.00** |
| `rev-4` | +0.069 | 1.02 | 7/8, 0.63 | +0.098 | 0.56 | 8/8, 0.88 |
| `rev-8` | −0.015 | −0.12 | 3/8, 0.50 | +0.080 | 0.61 | 7/8, 0.63 |
| `rev-vol16` | +0.045 | 0.38 | 5/8, 0.50 | +0.112 | 0.32 | 8/8, 0.63 |
| `rev-sign1` `-sign(r[t])` | +0.096 | 0.60 | 6/8, 0.75 | +0.143 | 0.35 | 8/8, 0.75 |
| `rev-xs` (1-bar xs) | **+0.162** | 1.02 | **8/8, 1.00** | +0.105 | 0.34 | 6/8, **1.00** |
| `mom-16` (ref) | +0.110 | 2.30 | 8/8, 0.75 | −0.037 | −0.37 | 1/8, 0.38 |
| `xs-mom-16` (ref) | −0.021 | −0.15 | 4/8, 0.38 | −0.065 | −0.63 | 2/8, 0.00 |

At 15m the reversal family is **uniformly positive across windows 1–8 and both constructions**, 7–8 of
8 streams positive — the broadest per-stream directional read in the ledger. At 1h it is positive but
weaker. `rev-xs` (per-stream, cross-sectionally demeaned 1-bar reversal) is the most *stable* arm the lab
has measured (8/8 streams AND 8/8 blocks positive at 1h, +0.162). Controls green in the same call:
oracle +12.25 (1h) / +13.19 (15m), anti-oracle the exact mirror, seeded random +0.06 / −0.03,
always-long +0.14 / +0.03.

**(B) The dollar-neutral book (the new shape) — real gross, but far too fast to trade.** Best configs:

| book | tf | gross Sharpe (252 basis) | turnover /yr | **break-even** | net@4 | halves (H1/H2) | mkt corr |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `rank_w1_rev` | 1h | **0.414** | 11 653× | **0.71 bps** | −1.92 | +0.52/+0.27 | −0.01 |
| `rank_w2_rev` | 15m | **0.583** | 33 510× | **0.50 bps** | −4.05 | +0.50/+0.72 | +0.07 |
| `rank_w1_rev` | 15m | 0.534 | 46 591× | 0.32 bps | −6.03 | +0.39/+0.75 | +0.08 |
| `level_w2_rev` | 15m | 0.500 | 35 768× | 0.50 bps | −3.50 | +0.39/+0.68 | +0.04 |

* The book is **causal**: its next-bar Sharpe is 0.41 (1h) / 0.58 (15m) against a contemporaneous twin
  of **−16.98 / −13.83** (magnitude ratio 0.024 / 0.042) — the L10-q / `e21` look-ahead signature would
  put the ratio above 1. The mirror (momentum) book reproduces the exact negation.
* It is **not a null**: a 40-seed cross-sectional signal-shuffle placebo puts it at **z = 5.5 (1h) /
  12.1 (15m)**, and it is positive in **both halves** at both timeframes.
* It is **market-neutral** (|corr| ≤ 0.08) and its edge is the cross-section, not the level — the
  momentum book at the same window is negative at every horizon ≤ 8 and positive only at 16.

**(C) Smoothing does not rescue it — reversal is the F-25 animal, not the F-24 one.** EWMA on the
weight vector (the F-24 rescue) cuts turnover but the gross Sharpe falls roughly in step, so the
break-even barely moves:

| `rank_w2_rev` (15m) | gross Sharpe | turnover /yr | break-even |
| --- | ---: | ---: | ---: |
| daily | 0.583 | 33 510× | 0.50 bps |
| EWMA 0.5 | 0.512 | 27 471× | 0.55 bps |
| EWMA 0.25 | 0.386 | 20 810× | 0.56 bps |
| EWMA 0.1 | 0.243 | 13 794× | 0.54 bps |
| EWMA 0.05 | 0.142 | 9 971× | 0.43 bps |

**The L13 falsifier is met.** It was: *"a full-history gross break-even below 1 bps … then reversal is
dead under any fill model and the lead closes."* Every arm and every book reads a break-even of
**0.32–1.31 bps**; the best book is 0.50 bps and the best per-stream arm 1.02 bps. Even a 4 bps VIP-maker
fee is 4–8× the break-even, and smoothing — the lever that rescued the carry dispersion — cannot lift it.
So **P3's PARK is confirmed on the full history at both bar sizes**, and this is now a 6.0-year (1h) /
2.3-year (15m) statement rather than a 25-day one. **L13 closes NEGATIVE** as a *trade*, while its
*gross* edge is proven to exist (unlike cross-sectional momentum, F-07).

## Result — F-33: the repo's "the edge lives in SIGNS rather than magnitudes" is not supported

The P3 feature note (`analysis/features.js`) justifies the family with *"the edge lives in SIGNS rather
than magnitudes"*. Measured directly: the per-symbol IC of the reversal signal against the next return is
**0.0133 (magnitude: `−r[t]`) vs 0.0062 (sign: `−sign(r[t])`) at 1h**, and **0.0138 vs 0.0094 at 15m** —
**magnitude carries about twice the information that sign does**, at both bar sizes. The claim as stated
is false. (The apparent paradox at the *arm* level — `rev-sign1` scores a higher Sharpe than `rev-1`,
+0.096 vs +0.057 at 1h — is explained: the arm pipeline z-scores the feature, and the z-score of a
magnitude series is dominated by fat tails, which costs Sharpe while adding IC. So the pure-sign arm is
better *as a position* but worse *as an information source*. Neither reading supports the repo's stated
reason.) No shipped behaviour depends on this — it is a documentation claim — so it is a ledger row in
L10, not a fold-back.

## What is now false that used to be believed

* **"The reversal family's fate is still open (L13)."** Its per-stream half was already measured in `e2`
  (stale board), and its break-even is 0.3–1.3 bps at 1h and 15m on the full history — the falsifier is
  met. Reversal is dead as a trade; PARK is confirmed on 6 years rather than 25 days.
* **"A cross-sectional construction rescues a fast signal."** It rescued the carry dispersion (F-24) and
  the toptrader fade (F-30). It does **not** rescue reversal: the break-even stays ≤ ~0.6 bps however the
  weights are smoothed. Demeaning adds *power* (F-03) but not *slowness*; a signal whose edge is a 1–2
  bar effect cannot be made cheap by construction. This is F-25's conclusion, now generalised to price
  reversal.
* **"The lab has no directional signal with any gross edge."** Reversal at 15m is positive in 7–8 of 8
  streams across four different windows, and the cross-sectional book is 5.5σ/12σ outside its shuffle
  null and positive in both halves. The edge is *real gross*; it is simply an order of magnitude too
  small to pay a fee. "No edge" and "no *tradeable* edge" are different statements and the ledger had
  been blurring them for the reversal family.

## Ledger effects

* New **F-32** (reversal: real gross, dead net, unsmoothable) and **F-33** (the sign-vs-magnitude claim
  is contradicted).
* **L13 → NEGATIVE (closed)** with both halves answered. **L10** gains the claim-audit row (L10-s) and a
  bookkeeping row (L10-t, the stale lead status). **L08**'s falsifier is sharpened: a maker model must
  deliver a net execution cost **< ~0.3 bps** to change the reversal verdict — which is the whole bar.
* **R**-queue unchanged. New experiment `experiments/e24_reversal.js` (+ `results/e24_reversal_{1h,15m}.json`).
* Shared-helper refactor (`e12#statsOf`, `e16#audit` optional `periodsPerYear`) — no existing number moved.

## Next

* L06 (meta-labelling) and L08 (maker fills) are the remaining open leads; L13's closure means L08 is the
  only thing that could still revive the short-horizon family, and only under an implausible <0.3 bps fill.
* The F-24 carry decay (2025–26) and the L18 post-2024 decay check remain open.
* Generalisable lesson to carry forward: **demeaning buys power, not tradability** — check the break-even
  of any new cross-sectional signal before believing the construction helped.

## Run

Full `run_all` regenerate after this cycle (30 steps: the 28 prior + `e24_reversal_1h` + `e24_reversal_15m`;
`e24` adds ~35 s (1h) + ~30 s (15m)). Controls `e0c`, `e5` (1h/15m), the 13-check suite `e14` and `e24`'s
own controls all report `pass`.
