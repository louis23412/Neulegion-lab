# CYCLE-081 — Round 48: six W6 analysis-layer hardening fixes (backfilled)

**Date:** 2026-09-29 (note written 2026-09-30 — no contemporaneous lab cycle file was
kept for rounds 48–49; this bridge reconstructs them from `docs/RUNBOOK.md` so the
numbering stays gap-free. No lab experiment belongs to this round; the rows below were
audited earlier by `e65`/`e67`/`e69`/`e71`.)

**Goal:** land the six W6 rows whose fix is provably behavior-identical at shipped
defaults — the rounds-34/35 pattern (a claim in a comment is auditable code).

## Landed (repo, round 48; `RUNBOOK.md` §6)

* `designEffectOfStreams` fails closed on a constant stream (L10-ca); `selectStreams`
  validates `maxStreams` (L10-cb); `normaliseConcurrency` validates `max` (L10-ce);
  `makeFoldExecutor` throws on malformed `confidence`/`stats` instead of nulling (L10-cf);
  `interquartileMean` documents its rank-slice semantics plus the additive `rliableIqm`
  reference (L10-cj); `restateReportAtPolicy` carries restated signals so
  `foldConcentration` mixes no bases (L10-cn). Pinned by ten §AP checks. No golden moves;
  one new export (`rliableIqm`).

## Decision

Fixes before new numbers, ledger updated in the same change. Nothing measured lab-side;
the audit evidence is the earlier `e65`/`e67`/`e69`/`e71` steps in `run_all.js`.
