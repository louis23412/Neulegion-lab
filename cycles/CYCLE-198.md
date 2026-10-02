# CYCLE-198 — C2 probe battery executed + native ablation shipped (2026-10-02)

C2 harness third executed same cycle (`experiments/c2_probes.js`,
artefact `scratch/c2_result.json`, all green). Native third ships as an
operator script this cycle (repo trainer needs better-sqlite3).

## Harness verdicts (pre-registered rules fire)

- **Scorer ROBUST.** Vendored twin bit-equal to the repo
  `_computeMemoryScoreFromProtos` (4.4e-16); ±20% single-weight + 20 joint
  perturbations → median keep-half flip 0.05, max 0.10 (< 0.20 bar). The
  consolidation constants are NOT arbitrary in effect — rankings survive.
  Scorer probe CLOSED, keep as-is.
- **Uniqueness (#54) NEUTRAL.** Weighted ≡ unweighted to 4dp (0.2494 /
  0.2494); DM p=0.026 significant with ZERO effect size → do not enable on
  significance alone. Default-off STANDS; #54 answered (no-use, not
  harmful-at-scale).
- **Ensemble ordering.** adamw 0.24925 < sgd 0.24992 (directional support
  for the C2 optimizer swap); distill-top30 ≡ distill-uniform ≡ sgd
  (0.24995 — teacher KD adds nothing at zero skill, supports deletion on
  native confirm); laggard-rescue ≡ sgd (rescue adds nothing, supports
  removal).

## Native ablation shipped (operator action, one command)

`scripts/c2-ablation.mjs` + `scripts/c2-optimizer-ablation.sh`
(gate|runs|all): stock stack vs global-clip-only vs script-side AdamW +
cosine on the REAL forceMin trainer, frozen folds from marks_8h.json.
Instance monkey-patches only — no locked edits, no goldens, no repo
writes. Pre-registered: plain~=stock → DELETE stack; adamw>stock
(DM p<0.05) → ADOPT AdamW; neither → keep stock, close C2.

## Research sync 11a/11b

11a (AdamW-vs-SGD titles): thin/off-topic, nothing taken.
11b: **2608.31046** (*Does On-Policy Distillation Really Distill?*):
noisy-teacher supervision is largely ignored by the student; gains come
from elsewhere — independent support for the uniform-teacher probe
framing (a no-skill teacher ≈ a noisy teacher; distilling toward it
cannot be the skill source). Raw `scratch/sweep-11a-optim.xml`,
`scratch/sweep-11b-teacher.xml`.

No repo files modified (additive scripts only — golden-safe). Operator
command issued below; proof-back unblocks the C2 delete/adopt decision.
