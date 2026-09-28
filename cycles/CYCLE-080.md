# CYCLE-080 — Round 47: three W6 claim-true fixes (L10-cl/cm/ck, all default-identical)

**Date:** 2026-09-29
**Goal:** close the three W6 rows whose fix is provably behavior-identical at shipped defaults — the rounds-34/35 pattern (claim in a comment is auditable code).

## Triage (the rest of the W6 second line, explicitly deferred with reasons)

* L10-ca (constant stream buys breadth): real shipped-path number change — needs verdict-neutrality proof only native runs can give. Deferred to a native-verified round.
* L10-cb/ce (unvalidated limits): latent, shipped callers pass valid values; the "fix" would be a semantics choice, not a truth. Deferred.
* L10-cf/cj/cn: latent/claim-level (fold_worker posts plain arrays; rank-slice IQM is self-consistent prose; mixed-basis needs the P2-chaining investigation). Deferred.
* L10-co/cp/cq/cr (kernels): hot path under BIT_EXACT goldens — any change is a deliberate re-freeze needing native proof. Deferred to a golden round.

## Landed (repo, round 47)

* `dependence.js#clusterStability` (L10-cl): enforces the documented AND (`fractionPositive >= minFraction - eps && worst.delta > minDelta`). At shipped defaults (1, 0) the second conjunct is implied (fraction 1 of n≥2 ⟺ every delta > 0), so default reports byte-identical; only loosened thresholds change — which is exactly the shipped-reachable hole (`minStableFraction`).
* `replication.js#formatSeedReplication` (L10-ck): prints the level the interval was built at (`dist.ci.alpha`, formatter alpha the fallback). Shipped path (build + print at 0.05) byte-identical.
* `dependence.js#signTest` (L10-cm): fail-closed past the exact-walk range (2^-n underflows at n≥~1075 → NaN + reason instead of certain-significance). In-range untouched. `signTestFloor` left alone (0 correctly represents a below-range floor).
* Six `analysis` §AO checks: the e70 witness, defaults pin, both conjuncts' governance, the CI level (90 vs 95), the fail-closed. Two self-caught arithmetic slips in fixtures (worst-delta identity, an impossible "fraction-rejects-what-delta-accepts" case — the AND only ever adds rejections) fixed before the freeze.
* Ledger: **2859 → 2865**. No golden moves; no new exports (locks untouched).

## Verification

* `analysis` **697/0** green in-harness at the freeze (existing R26-7/§AD/R26-13 checks all survive — the default-identity proof).

## Lab effects

* L10-cl/cm/ck rows annotated FIXED (round 47) in `leads/L10-bug-hunt.md`; PLAN-round31 W6 list updated. No new experiment (the witnesses are e70/e69, already registered) and no FINDINGS row (fixes make code match existing findings — nothing new measured).

## Next

* Native `npm test` — now THREE rounds (45–47) since the 132/132 confirmation, including analysis-layer math changes. No further landings until green.
