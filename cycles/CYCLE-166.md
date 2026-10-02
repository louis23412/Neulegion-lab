# CYCLE-166 — Mechanism + trust test: decay is measurement-regime change

**Date:** 2026-10-02
**Goal:** answer CYCLE-165's open question ("which book is truthful?") with
measurements, AI-side only.

## Chain (each link measured, not inferred)

1. **Divergence localized:** base-vs-honest per-bar Sharpe differs only in
   2020–2023 (deltas 0.45/0.26/0.31/0.16); 2024+ agree to 0.000.
2. **Coverage explains the locus:** shipped-mark fraction by year from the
   funding files is 0% / 0% / 0% / 17% / 100% / 100% / 100%.
3. **Mechanism read from code:** `fin(null) = 0` — null-basis rows earn
   funding-only. Base early years = funding carry without the basis leg.
4. **Trust test passes:** 24 overlap rows (ext vs shipped, 8 symbols) agree
   to 0.004% mean / 0.04% max / zero bias. (One self-caught harness bug on
   the way: funding timestamps are ISO strings, not epoch ms — `Date.parse`
   before grid alignment; the 0-overlap first attempt was the tell.)
5. **Verdict:** honest book (6.25, flat) truthful; base early strength
   (0.66 in 2020 on zero marks) is funding-without-basis illusion. The
   "decay" is a measurement-regime change mid-sample, not strategy decay.

## Plan consequences (recorded in repo §82)

* G5 scores honest or states why not; MRP goes on the honest series.
* 118 prep must check midcap funding coverage before choosing the marks
  leg — **measured after filing: zero shipped marks in every midcap year
  (2024–26).** Honesty gate now concrete in TODO 118: harvest midcap mark
  klines first, or pre-register funding-only.
