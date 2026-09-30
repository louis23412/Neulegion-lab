# CYCLE-111 — Round 84: the model track opens (e114 baseline, e115 first skill)

**Date:** 2026-09-30
**Goal:** per the operator's reprioritisation (HiveMind demoted but NOT
research-only — build it into a working model), open the model track: measure
the shipped model's skill honestly, then aim the upgrade where the literature
says predictability lives (magnitude, not sign).

## Research sync (sweep 2026-09ad, q-fin-scoped, 4 noted)

* 2603.16886 (918 controlled DL-vs-DLinear-vs-TCN experiments, crypto/4h/24h):
  directional accuracy ≈50% for ALL MSE-trained models at hourly resolution;
  ModernTCN best, architecture >> seed. The directional door is shut from the
  outside too — matches F-110 and e114.
* 2502.09079 (crypto ≈ Brownian noise univariate; naive beats complex): the
  G-A thesis with complexity-theoretic backing.
* 2508.15922 (probabilistic crypto-vol forecasting; linear-on-log-vol + QRS
  stacking beats fancier alternatives): the vol target with the right
  complexity class — frames e116's payoff test and any later learner port.
* 2606.27670 (CryptoGAT: temporal models fail on pure-price crypto; cross-asset
  graph framing wins): independent support for the project's structural
  cross-sectional sleeves over temporal modelling.

## Measured (lab, read-only on the repo)

* `e114_hivemind_skill.js` (4/4, `results/e114_hivemind_skill.json`): live
  HiveMind next-bar-sign skill **−0.0069**, 6/24 cells (F-126 NEGATIVE — the
  honest model baseline; one self-caught bug: driver FEATURE_LEN is 6, not the
  walkforward entry's local 12).
* `e115_hivemind_bigmove.js` (5/5, `results/e115_hivemind_bigmove.json`):
  big-move skill **+0.0246**, 19/24 cells, 7/8 symbols; lagged-state
  persistence **−0.67** (anti-persistent states — the model isn't free-riding
  lag-1). First positive shipped-model skill (F-127 SUPPORTED). One self-caught
  design bug (constant-state ≠ persistence reference).
* Both registered in `run_all.js`.

## Decision

The model track is TODO 111: e116 payoff test next (big-move-timed exposure
scaling on the carry/fade books — skill must become net), then a V2.3-slot
vol-learner port only if e116 pays. No directional work anywhere (e114 +
2603.16886 + F-110 close that door three ways). No repo change this round.

## Operator commands (none — lab + docs only)

No commands, no uploads. `npm test` NOT needed (repo untouched).
