# CYCLE-200 — C2 verdict EXECUTED: stack DELETED (director)

## Operator proof received (runs stage = binding)

```
brier {"stock":0.25058,"plain":0.25033,"adamw":0.25268}
dm plain_vs_stock: n=800 meanDiff=-0.00025 p=0.856 favored=A
dm adamw_vs_stock: n=800 meanDiff=+0.00209 p=0.262 favored=B
dm adamw_vs_plain: n=800 meanDiff=+0.00234 p=0.388 favored=B
```

Gate (n=150) agreed (all ns). Pre-registered rule fires on the runs
stage: **plain~=stock (DM ns) → DELETE the stack**. adamw ns + nominally
worse → NO adopt. Neither-arm-keeps-stock branch not reached.

Side observation: all Briers ≈ 0.25 = chance level. The optimizer is moot
partly because nothing learns much on this frame — recorded, does not
change the rule outcome (the rule is about stack-vs-clip, and the stack
lost the chance to matter).

## Delete executed (repo edits, first locked-module change of the phase)

- `src/hivemind/training/gradients.js`: `_scaleGradients` body →
  global-norm clip thr 1.0 (the proven plain arm). `_scaleGradientMatrix` /
  `_scaleGradientVector` kept as manifest-contracted dead code with retired
  notes (component-manifest.js fails on dropped methods).
- `src/hivemind/ensemble/scores.js`: `_updateAdaptiveLearningRates` →
  rates frozen at `_learningRate`; opt-in homeostasis hook preserved
  (homeostasis.test.js part C requires enabled≠disabled and gain-0 no-op —
  both still hold: off=base, on=base×scale, gain-0=base).
- `test/lock-registry.js`: scores + gradients notes cite the C2 proof
  (shape-valid change; statuses/citations/proves untouched).

## Firewall (operator-executed, ordered)

1. `npm test` → expect golden failures ONLY on training-trajectory
   fingerprints (hm:diagnostics/predictions, ctl:*). Paste failures.
2. Re-bless: I write back the `got` hashes for explained entries only,
   operator re-runs to green.
3. `bash scripts/c2-optimizer-ablation.sh all` post-delete → EXPECT
   plain_vs_stock BIT-IDENTICAL (meanDiff=0, p=1): new stock IS the plain
   arm. Paste stdout. Any deviation = delete bug.
4. Then C2 CLOSED, C3 opens (upgrades-into-live-reader or delete-broadcast).

## Coherency

- Cycles 000…200 present; findings ledger gets F-184 (verdict) + F-185
  (delete) below. No repo behavior change outside the two methods +
  registry notes. c2-ablation.mjs needs NO change post-delete (plain arm
  becomes the identity check — by design).
