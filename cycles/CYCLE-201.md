# CYCLE-201 — C2 firewall green, post-delete identity check owed (director)

## Firewall so far

1. `npm test` post-delete: golden-only failures, exactly the 8
   trajectory-derived fingerprints (hm:diagnostics/predictions/
   memberCounts/broadcast/postReloadPrediction, ctl:finalSignal/
   signalTrajectory/accuracyTotals). Untouched as predicted: hm:translate,
   ctl:signalCount, ctl:lastTrainingStep — mechanism and counts intact.
2. Re-bless applied (`test/browser/entries/golden.test.js` EXPECTED + Was-
   provenance). Golden suite re-run: PASS.
3. Full `npm test`: **134/134 green**.

## Owed now

Post-delete `bash scripts/c2-optimizer-ablation.sh all` — EXPECT
plain_vs_stock BIT-IDENTICAL (meanDiff=0, p=1, favored=null): new stock IS
the proven plain arm (global clip + frozen LR). adamw_vs_stock should
stay ns-or-worse. Any deviation from identity = delete bug → reopen C2.

## On identity proof

C2 CLOSED. C3 opens: upgrades-into-live-reader or delete-broadcast
(CYCLE-193 framing: `_retrieveTopRelevantProtos` already the live scored
reader via `_contextAwareAttention`; wire multiprobes/querymod into IT or
delete `broadcastMemory`). Coherency check first.
