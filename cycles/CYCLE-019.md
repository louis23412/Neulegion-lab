# CYCLE-019 — Decay on the two working sleeves: L12's cost margin is gone, L18's is not (L12, L18)

**Date:** 2026-11-14
**Goal:** CYCLE-018 (F-35) closed the last open alpha lead, so the lab's only live objects are its two
validated cross-sectional sleeves — and both carry an open decay risk. F-24 recorded that the carry
dispersion edge "has decayed since 2024"; F-31 found its second-half net@4 is negative and that a 25 %
allocation to the toptrader fade fixes it. But no cycle had *characterised* the decay: was the signal
dying, or the economics? And had the fade itself decayed? This cycle measures both explicitly, with a
pre-registered trend test.

## Work

1. **`experiments/e27_decay.js`** (new, registered in `run_all` as `e27_decay`): rebuilds the `e23`
   dispersion / fade / 25 %-mix books on the same aligned grid (2021-12 → 2026-09, 5 246 8h periods),
   then reports per calendar year, per contiguous 8-block, in rolling 12-month windows, and with a
   **permutation-null trend test** (block net@4 Sharpe vs block index; 5 000 shuffles of the block
   values). It also reports each half's turnover and **break-even** (mean gross / mean L1 turnover), which
   is the number that turns out to matter.
2. **Validation guard (e25-style).** `e27` must reproduce `e23`'s stored gross Sharpes — it does exactly
   (carry **4.417**, fade **0.834**), so the decay numbers are on the *same construction* as
   F-24/F-30/F-31, not a re-implementation.
3. **Falsifier (pre-registered):** no decay if the last-third block Sharpe is within one block-SE of the
   first third *and* the trend permutation p > 0.05; decay if the recent net@4 ≤ 0 *and* the trend test is
   significant.

## Results

**(a) The carry dispersion book (L12/F-24) has decayed — and it is the break-even, not the gross edge.**

| block start | 21-12 | 22-07 | 23-02 | 23-09 | 24-04 | 24-11 | 25-07 | 26-02 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| gross Sharpe | 9.9 | 4.7 | 11.1 | 13.6 | 8.0 | 8.4 | 6.3 | 5.5 |
| **net@4 Sharpe** | 6.0 | 4.0 | 6.8 | 9.0 | 1.6 | 1.1 | **−1.0** | **−2.1** |
| break-even (bps) | 10.2 | 28.7 | 10.3 | 12.0 | 5.0 | 4.6 | **3.4** | **2.9** |
| turnover (×/yr) | 81 | 75 | 80 | 75 | 87 | 93 | 92 | 98 |

Net@4 by year: **2021 5.93, 2022 3.45, 2023 5.32, 2024 5.41, 2025 −0.01, 2026 −1.88.** Net trend
**ρ = −0.79, p = 0.023** (significant); **gross** trend **ρ = −0.35, p = 0.39** (not). Last-12-months
net@4 **−1.37**; second-half break-even **3.93 bps** vs first-half **15.15 bps**, i.e. below the 4 bps fee.
The mechanism is precise: the per-period gross edge shrank while turnover *rose* (75 → 98×/yr), so the
return per unit of turnover collapsed from 10–29 bps to ~3 bps.

**(b) The toptrader fade (L18/F-30) has NOT decayed.** Net@4 by year: 2021 1.90, 2022 **−0.18**, 2023 1.98,
2024 0.05, 2025 1.24, 2026 1.27; **last-12-months +1.91** (above its full-sample 0.79); net trend
**ρ = 0.19, p = 0.68**; break-even stays 47–202 bps. Per-block net is noisy with no drift.

**(c) The 25 % mix is still net-positive recently — because the fade carries it.** Net@4 by year: 2024 0.48,
2025 1.24, 2026 1.04; **last-12-months +1.76**; halves 1.88/+0.75; net trend ρ = −0.31, **p = 0.47** (not
significant). F-31's insurance claim now holds *out of sample in time*.

## What is now false that used to be believed

* **"The carry dispersion edge decayed" (F-24's caveat) is too vague.** It is not (mainly) the *signal*:
  the gross Sharpe trend is flat (p 0.39) and the gross edge is still positive. It is the **cost margin**:
  the break-even fell to 2.9–3.4 bps, below a 4 bps fee. The sleeve is now a gross fact rather than a
  tradable one, and the F-24/F-26/F-27 break-even and capacity numbers (12.8 bps, $27 M) are stale
  full-sample figures.
* **"The toptrader fade's validation is an in-sample artefact that will decay like carry."** Measured, it
  has not: recent net@4 is *higher* than the full sample and the trend test is null. The two sleeves decayed
  differently because they are different objects (a fast rebalancing funding-rank book vs a slow one).
* **"The mix's positive second half is one split."** It now holds on the rolling 12-month window too
  (+1.76), in the exact window where the carry sleeve died — so the F-31 mix is a working hedge, not a
  statistical accident, and it is the lab's only currently net-positive book.

## Ledger effects

* New **F-36**; new experiment `e27_decay.js`, new artefact `results/e27_decay.json`.
* **L12** stays SUPPORTED as a gross/sleeve fact but gains a **decayed-net** annotation (its tradable
  window is 2021–2024). **L16/L17** (its low-turnover/capacity constructions) inherit it. **L18** is
  confirmed **not decayed**. **FOLD-BACK R8** now states its economics on the recent window.
* No shipped number moves; `e14` unchanged (13 checks). `RUNNER.md` records the decay-test convention.

## Next

* The lab's only currently net-positive book is the **fade** (or the mix). The fade is small (Sharpe ~0.8,
  OI-bound to tens of millions) and the carry sleeve that used to dominate is no longer tradable at 4 bps.
  So the next natural questions are: (i) is there a **lower-turnover form of the dispersion book whose
  break-even clears 4 bps on the recent window** (the F-24 trick, re-tuned for the decayed regime), and
  (ii) can the **fade be made larger/cheaper** (its capacity and turnover are the binding constraints)?
* L07's liquidation-print half is still untested but is now the *only* unmeasured mechanism in E-C.

## Run

`e27` runs in ~2 s and is registered in `run_all` (now 35 steps). Controls `e0c`, `e5` (1h/15m), the
13-check `e14`, `e25`'s validation guard and `e27`'s `e23` cross-check all report `pass`.
