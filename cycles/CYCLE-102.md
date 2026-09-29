# CYCLE-102 — Round 69: `--sleeve-sizing` (the sized sleeve book)

**Date:** 2026-09-29
**Goal:** wire the measured sizing payoff into the `--sleeve` run mode: score the sleeve book sized through the vol-target risk plugin behind the driver seam, with the target caller-supplied.

## Research sync

A targeted arXiv sync (`"volatility targeting" AND portfolio`, 5 hits) surfaced one load-bearing paper: **"Single-Asset Adaptive Leveraged Volatility Control" (arXiv 2603.01298)** — open-loop vol-targeting (scale inversely with a variance forecast, which is exactly our W4c-z scaler) suffers high turnover, leverage spikes, and estimation-error sensitivity; the authors propose feedback control instead. Raw response archived at `docs/research/raw/arxiv-sweep-2026-09t.json`; entered as `voltarget2603` in the lock-registry citations and cited on the `risk:vol-target` register row. It grounds the per-sleeve 4x cap (the guard against the documented spike) and records the follow-up: a feedback-control sizing rule, not built. (Also noted: 2511.08571 Forecast-to-Fill — vol-targeted + friction-aware sizing with cost awareness, tangential support; the RL vol-targeting papers are off-path.)

## Landed (repo, round 69)

* `sleeve_score.js`: `trailingBookVol` (causal strictly-before-t trailing RMS, the e105 convention), `parseSleeveSizing` (pure option parser: absent = unsized default path; present needs a positive per-bar vol target, window defaults 24 — BUGS.md #69 errors), `scoreSleeveSized` (base `scoreSleeve` book → plugin `sizingForSleeve` → skipped bars flat at scale 0 on returns AND weights so the re-score's turnover prices traded exposure → `scoreBookReturns` gate arithmetic + factor-neutral/stress/worstBlock + `bookVolMean`, the mean trailing vol over scored bars so the operator picks the target at the book's own scale).
* `runSleeveReport` gains `sizingTarget`/`sizingWindow`: absent → no `sized`/`sizing` keys (default path untouched, pinned); present → sized block + printable line. `analyze.js`: `runSleeveAnalysis` forwards both; CLI gains `--sleeve-sizing=<vol>` / `--sleeve-sizing-window=<n>` with #69 refusals; run.json/report.json record `sizing`; help text warns the target must sit at book scale.
* Ten §P checks (`contracts` 201 → 211, ledger 3058 → 3068); `voltarget2603` citation + register row; node mirror re-pinned to 211; the round-44 native CLI test extended (sized success run + two refusal rows, same block). Harness green (211/0; locks 41/0; analyze 289/0; guards 65/0).
* Two self-caught failures during the round: `worstBlock` needs ≥6 bars (NaN on the 6-bar K fixture — inherited gate arithmetic, the unsized leg behaves identically; checks assert stress on the short view and worstBlock on the 40-bucket report) and a substring assertion that the new `(w24, bookVol …)` format broke (`(w24)` with closing paren no longer occurs — fixed in both the §P and the native test).

## Measured (lab)

* `e106_sized_sleeve.js` (7/7): the repo forecast bit-identical to the lab RMS on all 6558 bars; plugin matches the scaler bar-for-bar — but the scalar grid does NOT reproduce F-115: every target levers the book to the cap (max 4.000, mean ~3.99; book vol 2.76e-4/bar vs targets 18–73× above it), DD worsens monotonically (7.96% → 13.57%/21.23%/25.99%) while Sharpe rises (3.58 → 6.09/4.38/3.76) (F-116).
* Verdict: F-115's DD cut is adaptive-target-specific (trailing-mean target ≈ book vol, mean scale ≈ 1). A scalar target at plugin-default scale is leverage, not timing. Recorded as a correction before any gate run could bank the misreading; follow-up is an `adaptive` sizing mode, documented not built.

## Decision

The sizing payoff is callable end to end (`--sleeve --sleeve-sizing=<vol>`), with the report telling the operator what target would be leverage-neutral. Remaining: `adaptive` sizing mode, W5 venues (operator data), W6 L10-co/cp/cq/cr (golden-adjacent, need a re-freeze decision), G5 gate runs, forecast.js split (CYCLE-097 recipe). Hand to `npm test`.
