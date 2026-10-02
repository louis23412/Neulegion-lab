# CYCLE-157 — Round 110 record: sleeve risk-spec override (A2 enabler)

**Date:** 2026-10-02
**Goal:** close the S16 recipe-audit GAP 1 so the PLAN-next A2 band read has
a CLI path. Implementation round (repo), lab records it.

## Built (repo, additive, default-identical)

* `parseSleeveRisk` (`src/sleeve/scoring.js`, re-exported via the
  `sleeve_score` shim): `undefined` = pinned leg, `"none"`/`null` = remove
  the leg, numbers validated (cap > 0, band ≥ 0), everything else throws
  naming the flag. Band alias accepted (`band`/`bandEps`, mismatch throws).
* Threaded `scoreSleeve` → `runSleeveReport` (normalised + echoed as `risk`)
  → `runSleeveAnalysis` → CLI (`--sleeve-cap=` / `--sleeve-band=`, usage,
  needs---sleeve guards incl. the outside-mode guard, run.json echo) →
  summary risk line (`risk cap X band Y (pinned|override)`).
* `scripts/sleeve-runs.sh band` stage (CAP/BAND env, 0.125/0.01 defaults) —
  the A2 read is now one turnkey command. `all` unchanged.
* Pinned specs unmoved in both homes (sleeve specs + `CAP_BAND_SPECS`);
  no golden moves; no scored-path change (override only).

## Verified (AI-side)

* Browser `analyze` entry: **298/298** (294 prior + 4 new §S1: pinned echo,
  override echo + turnover monotonicity, cap-none, garbled refusal).
* New node CLI spawn block (help + real override run + 4 refusals) — needs
  the native driver (spawns `node`), so the gate moves 132 → 133.
* Ledger: analyze 294→298, total 3123→3127, node mirror re-pinned;
  RUNBOOK/ROADMAP/README counts updated.

## Docs

* Repo: TODO 120 (closes on the gate), RUN-ANALYSIS §72, PLAN-next A2
  turnkey note. Lab: FINDINGS F-167, INDEX row, STATUS gate line.

## Rerank

Unchanged (enablement): 116 → 118 (turnkey) → 117, then B. Queued AI-side
next: the 10o-1 vol-tournament level-alignment experiment.
