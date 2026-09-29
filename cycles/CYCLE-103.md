# CYCLE-103 — Round 70: `--sleeve-sizing=adaptive` (the payoff mode)

**Date:** 2026-09-29
**Goal:** F-116 left the CLI's scalar mode a documented footgun (targets 18–73× above book vol lever to the cap). Wire the mode that actually carries the payoff: the trailing-mean target as a first-class `--sleeve-sizing=adaptive`.

## Landed (repo, round 70)

* `sleeve_score.js`: `adaptiveTargets` (the expanding causal mean of the vol forecast — NaN until the first finite-positive vol, which the plugin skips); `parseSleeveSizing` accepts `adaptive` in any case (window still validated, scalar errors unchanged); `scoreSleeveSized` routes `'adaptive'` through the expanding-mean array (scalar path untouched, pinned by a regression check) and records `target: 'adaptive'`. Help text documents `adaptive` as the F-115/F-117 payoff mode.
* Ten §Q checks (`contracts` 211 → 221, ledger 3068 → 3078); node mirror re-pinned to 221; the round-44 native CLI test gains an adaptive success run (same block). Harness green (221/0; locks 41/0; analyze 289/0; guards 65/0).
* No self-caught failures this round — the §P substring lesson (assert the open paren, not the closed one) was applied to the new format assertions up front.

## Measured (lab)

* `e107_adaptive_sizing.js` (5/5): repo adaptive targets proved prefix-identical on the real 6558-bar series; the repo path cuts DD **7.96% → 3.05%**, Sharpe **3.58 → 7.55**, mean scale 2.30 (bounded); the kept-bars accumulation variant reads **2.70%** (exactly e105) — the 0.35pp gap is the pre-WARMUP history in the repo mean, not an artefact (F-117).

## Decision

The sizing story is now complete and honest end to end: scalar mode (for book-scale-matched targets, with `bookVolMean` printed beside them) + adaptive mode (the payoff, one flag away). Both behind the contract, both measured, both gated by checks. Remaining: W5 venues (operator data), W6 L10-co/cp/cq/cr (golden-adjacent, need a re-freeze decision), G5 gate runs (native), forecast.js split (CYCLE-097 recipe — the next foundations candidate). Hand to `npm test`.
