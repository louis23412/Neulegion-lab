# CYCLE-079 — Round 46: the W4a memory-plugin design (contract + registry, engine untouched)

**Date:** 2026-09-29
**Goal:** land PLAN-round31 P0's W4a design half — the `MemoryBank` interface + registry with the default stack resolving to today's behavior by construction. No engine rewire (that is V2.3 with its own byte-identity gate).

## Landed (repo, round 46)

* `src/hivemind/memory/contract.js` (new): `BANK_CONTRACT_METHODS` (write/read/decay/merge/consolidate/stats), `BANK_IDS` (episodic/adaptive/semantic/core — the `hiveMind.js` state they own), `ENGINE_BANK_METHODS` (each bank grounded to its shipped methods: episodic → `_updateMemoryBanks`/`_pruneMemory`/`_retrieveTopRelevantProtos`, adaptive → `_updateMemoryBanks`, semantic → `_updateSemanticProtos`/`_consolidateSemanticProtos`/`_decayProtos`, core → `_createNewProto`/`_finalizeSemanticProto`), `validateBank`/`assertBank`, and the mechanical tournament protocol (`TOURNAMENT_TARGETS` in evidence order — directional prediction excluded by NL-MECH/NL-BENCH — plus `validateTournament`).
* `src/hivemind/memory/registry.js` (new): validated registration, duplicate/unknown-id throws (never a silent missing bank — the R27 lesson), deterministic `stackDigest`, `DEFAULT_STACK` = the 4 engine banks, `_clearRegistryForTests` seam (production registers once).
* Eight `modules` checks (contract accept/reject/throw, default-stack identity, engine grounding against `HiveMind.prototype`, registry mechanics, pinned default digest, swap-changes-digest-never-default, tournament gates). One self-caught typo in a check (`_clearRegistry halted`) fixed before the freeze.
* Deliberately NOT in `HIVEMIND_REGISTRY`/`component-manifest.js`: those pin mixin-bag installation 1:1 (`registry has no extra hivemind bags`), and these modules install nothing — precedent: `src/sleeve_score.js` carries contract checks with no registry key. The V2.3 binding will add the per-plugin golden entries.
* Ledger: **2851 → 2859** (RUNBOOK §6 table + round note, node mirror 51→59, ROADMAP suite line, PLAN-round31 status, `src/README.md` ledger). No golden moves (nothing on the scored path imports the new modules).

## Verification

* `modules` **59/0** green in-harness at the freeze.

## Lab effects

* None by rule: design-only, no numbers — no experiment, no FINDINGS row (same rule as e75's rewrite: do not manufacture readings).

## Next

* V2.3 engine binding (resolve the active stack through the registry; gate: default stack reproduces today's goldens byte-for-byte; then per-plugin fingerprints). Needs native `npm test` — golden work cannot be proven here.
