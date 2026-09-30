# CYCLE-112 — Round 84b: bucket skill screens out the timed book (e116)

**Date:** 2026-09-30
**Goal:** close the model track's payoff branch honestly: e115's 1h skill must
survive to the 8h book grid to become a timing overlay — or the timed book
(e117) stays unbuilt per the pre-registered gate.

## Measured (lab, read-only on the repo)

* `e116_bucket_bigmove.js` (3/3, `results/e116_bucket_bigmove.json`): bucket
  big-move skill **−0.0105**, 8/24 positive (F-128 NEGATIVE). One self-caught
  bug (bucket-major spotRet transposition). The e117 timed book is screened
  OUT. Recent-split positivity (7/8 at split 0.7) recorded, not chased.
* Registered in `run_all.js`.

## Decision

Model track ledger after round 84: directional CLOSED (e114 −0.0069, three-way
with F-110 + 2603.16886); 1h magnitude SUPPORTED but not book-actionable
(e115 +0.0246); 8h magnitude CLOSED (e116 −0.0105). The timed-book branch is
dead; TODO 111 reranked toward HAR-residual skill (does the model beat the
linear vol reference — the only remaining book-actionable model question) and
1h-horizon execution uses. No repo change.

## Operator commands (none — lab + docs only)

No commands, no uploads. `npm test` NOT needed (repo untouched).
