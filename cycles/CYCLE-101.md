# CYCLE-101 — Round 68: vol-target sizing risk plugin

**Date:** 2026-09-29
**Goal:** wire the measured sizing payoff into the V2 risk layer: the W4c-z scaler as a `RiskPolicy#sizing` plugin, ported (not imported) per the V2.1 precedent.

## Landed (repo, round 68)

* `plugins/risk/vol-target.js` (new): `volTargetRisk` — `position` is the shipped clamp bit-identical to cap-band; `sizing` vendors the `applyVolTargetScaling` arithmetic loop verbatim (import law forbids analysis/ imports); `sizingForSleeve` applies per-sleeve caps from `VOL_TARGET_SPECS` with the target caller-supplied (a cap is policy, a target is a measurement — documented in the file).
* Composition root carries it UNTESTED, `defaultStack: false`; the default roster is untouched.
* Ten §O checks (`contracts` 191 → 201, ledger 3048 → 3058); G manifest check updated to the 11-plugin stack; one lock-registry module row, one plugin-register row (`risk:vol-target`, UNTESTED) and one citation (`corsi2009har` — also closing the registry-side vol citation gap); node mirror re-pinned to 201. Harness green (201/0; locks 41/0 re-verified).
* Two self-caught failures during the round: the guards check compared reason STRINGS across layers (they differ by design — `(vol-target)` vs `(W4c-z)` suffixes), and the lab file imported `validatePlugin` from the risk contract instead of the base contract — both fixed, neither was a code bug.

## Measured (lab)

* `e105_voltarget_verify.js` (5/5, 1 s): plugin sizing bit-identical to the analysis scaler on all 6058 carry-book bars; plugin-sized DD **7.96% → 2.70%**, Sharpe **3.58 → 7.63** (F-115 — the F-106 trailing arm, now callable behind the contract).

## Decision

The sizing payoff is wired: any composer behind the V2 seam can now size a book through `RiskPolicy#sizing` instead of reimplementing the loop. The plugin ships UNTESTED/off-roster until a gate scores a sized sleeve book (G2/G5). CLI wiring (`--sleeve-sizing`) is the documented next step, not this round — it touches the driver's report shape and needs its own checks. Remaining: CLI wiring, W5 venues (operator data), W6 L10-co/cp/cq/cr (golden-adjacent), G5 gate runs. Hand to `npm test`.
