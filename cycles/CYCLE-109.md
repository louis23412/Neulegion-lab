# CYCLE-109 — Round 82: native gate closes TODO 110 + positioning follow-ups (e113)

**Date:** 2026-09-30
**Goal:** close the TODO 110 native gate from the operator's two uploaded runs
(read-only), expand the positioning edge lab-side (e113), and open the next
foundations target (`src/analyze.js` recon — the biggest module left).

## Research sync
No new sweep this cycle; the evidence is the operator's native confirmations
plus e113. Standing grounding: 2607.27461 (return-rank unforecastable, vol-rank
forecastable — the F-122/F-125 composite rule), `voltarget2603` (open-loop
turnover spike — F-119/F-125 sizing reads), 2605.05089/2502.06028 (TODO 95
collateral/borrow legs, still open).

## Measured (lab, read-only on the repo)
* Native gate (read-only artefacts `src/runs/20260930T012415-seed1-sleeve`,
  `20260930T012431-seed1-sleeve` + npm 132/132): oi 0.670/197.11/11.40, DSR
  0.9305, G5 (dsr,decay,unseen); fade 1.054/7.93/185.13, DSR 0.9664, G5
  (decay,unseen). Both reproduce e112 to the printed digit — cross-machine
  determinism of the sleeve path. F-124.
* `e113_positioning_followup.js` (14/14, artefact
  `results/e113_positioning_followup.json`): ladder oi dies 8→16 bps, fade
  survives (1.078→0.985); carry×fade corr +0.02 but no composite (carry 9.43
  vs fade 1.05 on overlap; RP blend 7.34; naive 1.26 on a 47x vol mismatch);
  fade sizing adaptive 0.66/42.5x, drawdown-governor 0.02/35.4x — sizing does
  not transfer to fade. F-125 (MIXED).
* Round-81 loose end fixed: e112 was imported in `run_all.js` but never
  stepped — e112 + e113 steps now registered.

## Decision
TODO 110 **closes** (native gate passed as predicted). No composite, no fade
sizing (measured-and-rejected beside rolling blends and scalar targets). Fade
is the second sleeve, one attestation pair (decay/unseen) from a G5 claim.
Next: Round 83 — `src/analyze.js` split (3674 lines, ~45 exports; node-only
imports isolated in the CLI-main part), then `npm test`.

## Operator commands (none — lab + docs only, no repo code changed)
No commands, no uploads. `npm test` is NOT needed this round (repo untouched;
e112/e113 re-verified AI-side through the harness in Round 83's checks).
