# Cycles

Work in the lab happens in **cycles** (see `PROTOCOL.md` §1). A cycle is one closed unit: goal,
hypotheses, code, measurements, ledger updates, next step. Each gets a file `CYCLE-<NNN>.md`.

Rules:

* numbers are file names, never reused, never deleted;
* a cycle that changes a number regenerates its artefact, updates the affected `leads/L*.md`, updates
  `FINDINGS.md`, and records what is now *false* that used to be believed;
* a later cycle that reverses an earlier one says so and links back;
* `CYCLE-000.md` is the founding session (F-01…F-12).

| cycle | title |
| --- | --- |
| [000](CYCLE-000.md) | Founding sweep — the measured frontier |
| [001](CYCLE-001.md) | The lead library |
| [002](CYCLE-002.md) | Challenging L01 through the repo's own aggregation |
| [003](CYCLE-003.md) | Order flow (L07 probe 1) |
| [004](CYCLE-004.md) | Volatility predictability and sizing (L09) |
| [005](CYCLE-005.md) | Cross-sectional carry dispersion (L12) |
| [006](CYCLE-006.md) | Extending the carry window through the crashes — and auditing the marks |
| [007](CYCLE-007.md) | Is the carry complex tradable, or a mark-price construction? (L14) |
| [008](CYCLE-008.md) | Cost audit: can the carry complex be traded, or only measured? |
| [009](CYCLE-009.md) | Low-turnover dispersion: can the rank signal be harvested cheaply? (L16) |
| [010](CYCLE-010.md) | Does smoothing rescue the reversion book too? (L11) |
| [011](CYCLE-011.md) | Capacity/impact: what size can the carry complex carry? (L15) |
| [012](CYCLE-012.md) | Capacity-aware weighting: can the dispersion capacity be raised? (L17) |
| [013](CYCLE-013.md) | Open interest: a signal, and the flat book's size limit (L07 probe 2) |
| [014](CYCLE-014.md) | Validating the toptrader fade: held-out, cost, confound, capacity (L18) |
| [015](CYCLE-015.md) | Combining the two independent cross-sectional streams (L18 × L12) |
| [016](CYCLE-016.md) | Short-horizon reversal: the last open mechanism (L13) |
| [017](CYCLE-017.md) | Execution realism: can a passive fill rescue the short-horizon family? (L08) |
| [018](CYCLE-018.md) | Meta-labelling: is "will this rule's trade pay?" predictable? (L06) |
| [019](CYCLE-019.md) | Decay on the two working sleeves: L12's cost margin is gone, L18's is not (L12, L18) |
| [020](CYCLE-020.md) | Re-tuning the dispersion book for the decayed regime: slowness is the fix, and it is a rule (L12, L16) |
| [021](CYCLE-021.md) | Sizing the retuned dispersion book: the binding limit switches to open interest (L15, L17) |
| [022](CYCLE-022.md) | R8 capstone: a joint walk-forward spec that survives a 10 bps fee (L12, L15, L16, L17) |
| [023](CYCLE-023.md) | Does the cost-aware-slowness lesson transfer to the fade? (L18 × F-37) |
| [024](CYCLE-024.md) | Is the OI capacity bound a mean or a distribution? (L07, L15, L17, L18, L10) |
| [025](CYCLE-025.md) | Is the OI capacity a number or a schedule? (L07, L15, L17, L18, L10) |
| [026](CYCLE-026.md) | Does the mix survive the re-spec, and do the two sleeves' capacities add? (L12, L18, L15, L17) |
| [027](CYCLE-027.md) | What is the exact joint OI frontier? (L12, L18, L15, L17) |
| [028](CYCLE-028.md) | Is the OI-change signal unrescuable, or was it F-23 again? (L07 → L19) |
| [029](CYCLE-029.md) | Is the OI-change signal a 2024–26 artefact? (L19, its own falsifier) |
| [030](CYCLE-030.md) | Does the L19 OI stream add to R8? (L19 × L12 × L18 × L15/L17) |
| [031](CYCLE-031.md) | Does a fixed cross-scale blend beat R8's walk-forward λ? (L12, L16) |
| [032](CYCLE-032.md) | Is F-48's "fixed blend replaces the λ rule" robust, or hindsight? (L12, L16) |
| [033](CYCLE-033.md) | Is R8's cap rule removable too? Frozen (λ, cap) vs the joint walk-forward (L12, L16, L17) |
| [034](CYCLE-034.md) | Is the fade's spec pinned too? The F-48/49/50 chain on R7 (L18) |
| [035](CYCLE-035.md) | What is the cap actually doing — concentration limit or no-trade band? (L17 × L16) |
| [036](CYCLE-036.md) | Does the cap-mechanism transfer to the fade? Concentration vs turnover on R7 (L18 × L17) |
| [037](CYCLE-037.md) | Why does clipping help? Tail winsorisation vs a hard constraint (L16 × L17) |
| [038](CYCLE-038.md) | Is the "frozen λ matches the pinned book" conclusion split-point robust? (L12 × L16) |
| [039](CYCLE-039.md) | L19's construction thread: hold-N cadence or a non-equal two-scale mix, without fitting a λ? (L19) |
| [040](CYCLE-040.md) | Stressing F-56: is hold-6 a plateau, and does it survive a drift-aware backtest? (L19) |
| [041](CYCLE-041.md) | What is the OI sleeve's right cost tool — a hold cadence or a no-trade band? (L19) |
| [042](CYCLE-042.md) | Is the OI band robust out of sample, and is its eps stable? (L19) |
| [043](CYCLE-043.md) | Can one module reproduce all three sleeves' books? (L12 × L18 × L19) |
| [044](CYCLE-044.md) | Does the shipped carry grid join handle sub-8h funding? (L10; new lead via bug hunt) |
| [045](CYCLE-045.md) | Does the dependence/DSR backbone mean what it says? (L10; audits the estimator against closed forms) |
| [046](CYCLE-046.md) | Does the split family purge/embargo as claimed? (L10; audits the purge/embargo contract) |
| [047](CYCLE-047.md) | Does F-63's leak reach the shipped controller? (L10-ag follow-up; scoping F-63 to latent) |
| [048](CYCLE-048.md) | Does `analysis/labels.js` (triple barrier / CUSUM / fractional diff) mean what it says? (L10; audits the labelling module against closed forms) |
| [049](CYCLE-049.md) | Does `analysis/overfitting.js` (PBO / CSCV) mean what it says — and is its calibration a measurement? (L10; audits the module against closed forms + a seeded ensemble) |
| [050](CYCLE-050.md) | Does `analysis/reality_check.js` (the resampling hub) mean what it says? (L10; audits the bootstrap / Newey-West / RC-SPA / subsampling identities against an independent reference port) |
| [051](CYCLE-051.md) | Does `analysis/forecast.js` (Brier / Murphy / Diebold-Mariano / MCS) mean what it says? (L10; audits the scoring layer against closed forms and the repo's own second Murphy implementation) |
| [052](CYCLE-052.md) | Does `analysis/race.js` (successive-halving racing) mean what it says? (L10; tests the "a racing budget does not change the decided set" requirement against a budget-dependent evaluator) |
| [053](CYCLE-053.md) | Does `analysis/benchmark.js` (the P1 model-class benchmark) mean what it says? (L10; audits the shipped ridge/MLP/base-rate forecasters, incl. the output map) |
| [054](CYCLE-054.md) | Does the measurement layer (`analysis/backtest.js` + its instrument `analysis/performance.js`) mean what it says? (L10; audits the hit-rate criterion, the fold scorer's lag, and the instrument's error bounds) |
| [055](CYCLE-055.md) | Does the causal signal family (`analysis/features.js`) mean what it says? (L10; audits the causality + abstain contracts and the 16 candidates' arithmetic against closed forms; settles L10-e) |
| [056](CYCLE-056.md) | Does sample uniqueness (`analysis/uniqueness.js`) mean what it says? (L10; audits the average uniqueness, the ESS identities, and the sequential bootstrap's draw law against an independent AFML ch.4 reference) |
| [057](CYCLE-057.md) | Does the stream design layer (`analysis/streams.js`) mean what it says? (L10; audits the resampler, the Kish design-effect identities, and the greedy selector, incl. a constant stream and `maxStreams <= 0`) |
| [058](CYCLE-058.md) | Does the audited evaluation world (`analysis/world.js`) mean what it says? (L10; audits the shock, the candle view and the panel attachment, incl. a missing `streamIndex` and `maxBars <= 0`) |
| [059](CYCLE-059.md) | Does the order-preserving scheduler (`analysis/parallel.js`) mean what it says? (L10; audits the queue contract, the failure semantics and the fold executor, incl. a bad `max` and a silently-nulled `confidence`) |
| [060](CYCLE-060.md) | Does the turnover policy grid (`analysis/holding.js`) mean what it says? (L10; audits the grid, the restatement surfacing and the promotion readout, incl. a dead `costBps`, an unreachable audit hurdle and a shallow frozen default) |
| [061](CYCLE-061.md) | Does the seed-replication layer (`analysis/replication.js`) mean what it says? (L10; audits the IQM, the stratified bootstrap, the variance split and the CRN criterion, incl. an IQM that is not the cited estimator and a CI label that can lie) |
| [062](CYCLE-062.md) | Does the cluster-inference module (`analysis/dependence.js`) mean what it says? (L10; audits the correlations, the jackknife, the Student-t tails and the exact sign test, incl. a stability flag that drops half its rule and a sign test that underflows) |

| [063](CYCLE-063.md) | Does the decision-grade report (`analysis/decision.js`) mean what it says? (L10; new L10-cn) |
| [064](CYCLE-064.md) | Do the hivemind numeric kernels (`hivemind/kernels/*`) mean what they say? (L10; new L10-co…L10-cr) |
| [065](CYCLE-065.md) | The operator's uploaded local run corpus (`src/runs/`) vs the ledger (read-only; confirms F-01/F-03/F-32/F-69/F-71/F-74/F-77 in production; new L10-cs — the funding sleeve enters the paired promotion test) |
| [066](CYCLE-066.md) | Does the REPO's V2 sleeve layer reproduce the lab's published books? (port verification; all three books bit-for-bit; new L10-ct — the two shells disagree about the book grid) |
The authoritative table (with outcomes) lives in `../INDEX.md`.
