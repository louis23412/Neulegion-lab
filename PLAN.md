# PLAN — the trackable next-step plan (post-116)

**Maintained across iterations:** each step has owner / gate / effort /
status. When a step moves, update its status line here AND the linked record
— future iterations pick up from this file + `STATUS.md`.

## Director rule (locked 2026-10-02 — operator directive, hardened CYCLE-192)

The director (AI) decides: what stays, what gets parked/archived, what
locks/unlocks, and the push toward a model with potential edge. The operator
runs commands and uploads proof — never asked to make project-direction
decisions. Open items are resolved by the director, in-session when possible.
ONLY LIVE TRACK: the model (HiveMind/Legion core code). The allocation track
is CLOSED (S6e L≤5 stands, no further work). NO data harvests, NO operator
uploads owed — S6f PARKED (harvest cancelled, script kept unused), M3 builds
PARKED data-blocked (spec kept, nothing asked). Purge record: CYCLE-192.

## Where we are (2026-10-02)

TODO 116 done natively: 16-panel gh + cadenced/exposure + test=10 all
keep-off; breadth half-gate passed (vol effStreams 3.73, pooled DSR 0.9706);
87 acceptance met (neutral 10/15/20); test=10 shift twice-measured. Full
readout: repo `RUN-ANALYSIS.md` §84, lab CYCLE-171/172.
TODO 122 done AI-side (CYCLE-173); 122b native test owed (operator commands
below). Research synced 10q.

## Numbered findings from the 116 deep-dive (CYCLE-172)

* **D-01 — the sign gap is measurement, not alpha.** 15-bar fold Sharpes are
  heavy-tailed and zero-inflated (t15: std 4.1, range −12.5..+10.2; baseline
  median exactly 0, positiveFraction 0.36). Mean-of-Sharpes ≠ pooled Sharpe;
  signals win MORE folds (0.48–0.50 vs 0.36) with LOWER mean ⇒ fatter left
  tail. Promotion math must name its aggregation (TODO 122a → TODO 85 datum).
* **D-02 — network is the orthogonal arm, not the strong one.** Highest
  within-stream corr (0.40) but lowest excess-corr with other signals; lowest
  effStreams (2.30) yet most independent. Breadth ≠ independence — track both.
* **D-03 — exposure-match is often inconstructible.** 89% vs 46% nonzero;
  matched deadZone 0.50 vs 0.055, tolerance missed on all arms. Datum for the
  TODO 85 decision: prefer quote-only-at-matched-exposure (rescaling the
  policy is worse), and accept that some comparisons have no matched quote.
* **D-04 — power is time-bound.** Paired clusters 36 (need 125) at test=15,
  54 (need 331) at test=10. Symbols cannot buy clusters, only trim
  per-window se — this is the quantitative case for parking 117.
* **D-05 — TIA 4h funding is benign.** 4931×4h rows bucket into 2466×8h with
  summed rates (correct 8h carry) — no re-harvest for 118.
* **D-06 — run.json provenance gap.** `--cadences`/`--exposure-match` not
  recorded — FIXED CYCLE-173 (keys + native test; native owed).
* **D-07 — cost ladder shape.** BE 8.08/7.99/4.50/5.81 (mom/vol/blend/net);
  +5 bps leaves mom/vol barely positive pooled (0.19/0.20); +10 kills all.
* **D-08 — 122c closes 117.** Wave-2 buys ~8% paired-se trim under measured
  correlations (closest t 1.36→1.47, still ns). Revisit condition is a
  number: an arm at one-sided p≲0.07.
* **D-09 — honesty haircut, now exact (CYCLE-177).** e123 funding-only 18.11
  vs honest mid-8 flat 8.16 ⇒ 9.95/yr illusion (55%); honest retains 45%.
  Funding-only numbers stay unquotable.
* **D-10 — band dividend on mid-8 (CYCLE-177).** Net +0.40 (8.16→8.56),
  turnover ÷2.1 (11.09→5.22), BE ×2.0 (34.2→69.6) — smaller net gain than
  stacked (+0.63) but the same BE-doubling shape. The band is a cost
  mechanism, not a panel one.
* **D-11 — BE inversion (CYCLE-177).** Breadth without band LOWERS the buffer
  (mid-flat BE 34.2 > stacked-flat BE 24.7) while raising net (8.16→8.87).
  Breadth is the net lever, the band is the BE lever — quote them as a pair.
* **D-12 — breadth decomposition at flat (CYCLE-177).** Majors 6.25 → mid-8
  8.16 (+1.91) → stacked-16 8.87 (+0.71 over mid-8). Midcap legs beat majors
  legs outright; stacking adds, diminishing but positive.
* **D-13 — decay is lane-independent (CYCLE-177).** Slopes −0.095…−0.128 and
  yearly shape 0.43–0.47 → 0.17–0.23 → 0.20–0.25 in ALL four lanes, incl. a
  universal 2025→2026 uptick (+0.02…+0.03). Regime shape, not policy
  artefact. S4 stands, strengthened (4 lanes).
* **D-14 — no lane dominates, CORRECTED CYCLE-178.** Best net =
  stacked-band (9.50); best BE = mid-band (69.6). Correction: `neutral` is
  the first-PC-hedged Sharpe of the same book (full-sample beta), NOT an
  equal-weight portfolio — the neutral−net gap (+0.08 mid / +0.45 stacked)
  is an in-sample hedge upper bound, not a portfolio to hold.
* **D-15 — trailing hedge FAILS, decided: no overlay (CYCLE-178, S6a).**
  `experiments/s6a_hedge_overlay.js` 7/7: implementable trailing-beta
  hedge (W270/W540, costed) trails the book on all 3 tested lanes
  (stkBand 9.50 → 9.10/7.41). Loss is bad-beta, not cost (mean|beta|
  ≈ 0.04 — book already near-pure; betaSd 0.027; stale W540 catastrophic).
* **D-16 — AI-side verification path works (CYCLE-178).** All 4 banked lanes
  reproduce to 1e-9 through the harness on workspace data (~10 s) — no tree
  drift; future S6 runs can be pre-verified AI-side before native spend.
* **D-17 — band is purely a cost story (CYCLE-178).** Per-bar means backed
  out of report arithmetic: mid gross −4.2% / cost −53% → net +2.2%;
  stacked gross −6.3% / cost −61.5% → net +4.4%. Breadth at flat: gross
  +12.3% / cost +55.7% → net +6.5% (the D-11 mechanism, quantified).
* **D-18 — decay bracket −0.09…−0.17/yr (CYCLE-178).** Bars-weighted OLS
  −0.091 (robust — 2025 dominates by bars) vs halves-implied
  −0.128…−0.172. S6c haircuts the bracket, never a point. Halves are
  seasonally balanced → primary; OLS has 3 points + seasonal mix.
* **D-19 — window-dependence + stabilizers (CYCLE-178).** Band dividend
  +0.18 lab full-history vs +0.40/+0.54/+0.63 this window. Worst-block
  breadth ×2.1–2.5. DE 8.75–10.81, lowered by band + breadth.
* **D-20 — S6c constraints (CYCLE-178).** neverBreach 11.5e6, OI-bound on
  LINK (F-41). Crash-robustness (F-17/F-21) is out-of-window — label it.
* **D-21 — full core map verdicts (CYCLE-184).** L0→L6 traced to file paths:
  WORKING = indicator math, fail-closed predict/train, QKV+FFN+RoPE numerics,
  persistence, pool/watchdog, analysis battery (weights update, learn nothing
  — target constraint). INCORRECT-AS-DESIGNED ×5: mean-pool readout is
  order-free at the decision layer (DLinear critique applies verbatim);
  ~60-bar from-scratch fitting cannot beat base rate (measured everywhere);
  distilling a negative-skill teacher concentrates noise; LSH upgrades serve
  a discarded broadcast (#44); six-boost consensus over negative-skill
  members. NEEDS-TESTING ×8 with concrete probes (context-attention leakage,
  score-reuse coupling, distill-vs-uniform, TODO 62 drain age, M4
  reachability, #54 sample-weights, A17 optimizer ablation, sandwich
  contribution). REPLACEABLE ×9 with groundings+gates (AdamW+cosine+clip;
  EARCP coherence gating; LoRA-frozen; linear/mixer-first then TSFM-probe;
  HAR-anchor+gated residual; denoise-first; Hankel-Toeplitz; TSFM-vs-HAR;
  Brier-skill consensus).
* **D-22 — regulation-layer mechanism + 10v deltas (CYCLE-185).** Spec-
  modulation rewards dispersion×performance → at zero skill amplifies
  confident noise into every projection (A17 sharpened: identity-spec +
  AdamW + clip ablation, delete on no-Brier-move). Broadcast builds a real
  candidate set then discards it (M4 acceptance: recall-measured route or
  PARK). RMSNorm/RoPE exact, keep. TSFM-probe 29/30 confirmed (M1 probe≥
  backbone expectation); EGGROLL-v2 adds M5 population rule; AdaRDiff queued
  as M1-ext (only if linear-wins); attention-pooling query nil (no claim).
* **D-23 — survival-cap decided (CYCLE-186).** Unit maxDD 0.072% (the Sharpe
  hides a ripple); maxDD-sizing voided (Ldd20 = 277× — same pathology as
  vol-target); governor inert in-window and slightly adverse under spike —
  credited nothing; gap ladder binds: operating L≤5 (100 bps/5% judgment),
  gross ≤$11.5M ⇒ equity ≤$2.3M. Research 10w (2607.23068: leverage is a
  variance question).
* **D-24 — M1 phase-1 verdict (CYCLE-187).** 53,316 pooled rows: linear arms
  0.24906 (skill +0.0038, DM p≈0.001, MCS-survive) — TARGET nearly-binding
  (whisper, not edge); MLP ≡ base (p=0.76, eliminated) — ARCHITECTURE
  constraint fires vs from-scratch small nets (converges NL-BENCH/G-A);
  persistence dies (0.344); denoise no-op. Phase 2 native-queued
  (TSFM-probe + controller arms).
* **D-25 — M4 wire-or-drop decided (CYCLE-188).** Hard-fixture recall:
  default 0.887, +multiprobe 0.987, +querymod 0.967 — lift exactly on the
  +0.10 boundary → PARK (rule as coded); mp recorded as the probe of choice
  for any future live-reader build; binaryPC stays default-off (live).
* **D-26 — M3 execution-uses spec delivered (CYCLE-189).** Same-venue L2
  (≥10 levels, ≤1 s) + trade prints (taker flag, exchange ts) + latency
  logs, ≥6 months overlapping the e115 window, exchange-ts sync; pre-
  registered E-a/E-b builds with bps-per-real-fill gates vs e25 baselines
  (+side-control); research 10x grounds both rules; build needs harvest.
* **D-27 — coherency sweep + S6f go-ahead (CYCLE-190).** All counts agree
  (190 cycles/rows, 174 finding rows, 146 = 139+6+1 experiment files,
  3/3 scratch artefacts); F-148…F-154 pipe fix; no repo touched → no
  re-gate owed. S6f GRANTED with exact harvest spec (8 mids, same
  source/grid/schema as oi_8h.json, header-dependent aggregator next).
* **D-28 — purge + unlock audit (CYCLE-192).** Allocation S0–S6e ARCHIVED
  (verdicts stand); S6f/M3-builds/M1p2 PARKED; operator queue CLOSED;
  leads L01–L19 ARCHIVED; speculative data pulls BANNED. Every core-code
  piece judged (record `cycles/CYCLE-192.md` §2): KEEP = L0/L1-shell/L2-
  shell/L3-numerics/L4-machinery/L5-P0/L6-pure/analysis battery; REDESIGN
  = C1 readout (FIRST) → C2 optimizer/spec + distillation probe → L5
  skill-weighting → C3 broadcast route-or-delete; PROBE = drain age,
  sandwich, context-attention leakage, score-reuse, #54; PARKED =
  homeostasis/surprise (off-proven), LSH upgrades, M5 (behind skill).
* **D-29 — map v2, code-verified (CYCLE-193).** Three corrections to prior
  record: C3 REFRAMED (live reader already live — wire upgrades into it or
  delete broadcast); sandwich = 1 scaled task + KD per window (simplify, no
  behavior change); optimizer is moment-free SGD (C2 is a class upgrade).
  scores.js pinned (Brier root diluted; dispersion reward; laggard-rescue;
  agreement herding → skill-gate/remove); legion pinned (confidence double-
  counted × six boosts, noise seeds, 1.4/0.6 prior); explorationRate to 2.25
  (PROBE). Research appendix banked; 3 new needs gated behind code.
* **D-30 — deep layer + fresh 10y/10z (CYCLE-194).** Dims = shape-packing
  (validation-chosen post-skill); tier>1 stream-disconnected by construction
  (skill PROBE — possible noise amplifier); quality exponents arbitrary;
  Brier ledger + dedup KEEP; `_hiveMemorySharing` is the live transfer;
  init KEEP. 10y/10z: 2610.01831 (uniform-pool beats learned-weighting →
  C1 = A/B/C, learned may lose) + 2510.03339 (read pre-C1) + 2308.15384 /
  2210.07169 (hedged combinations ground S7).
* **D-31 — final gap layer (CYCLE-195).** Prune mechanics KEEP;
  promotion-sign PROBE (worst archive most); bank architecture
  best-grounded, dynamics ungrounded; EMA-100 transient on 60-bar windows;
  leakage-audit recipe specified (pre-trust gate for post-C1 A/Bs). MAP
  COMPLETE — C2 absorbs promotion-sign + laggard-LR probes (same harness).
* **D-32 — pre-C1 homework (CYCLE-196).** Pooling-bounds abstract read
  (C1 A/B/C literature-shaped; full text = C1 step 1); consolidation
  scorer audited (all constants unvalidated → ±20% perturbation probe;
  sharpness asymmetry folded in); adaptive merge threshold KEEP. Standing
  probe pool = 10 same-harness + post-skill list.
* **D-33 — C1 executed + closed (CYCLE-197).** Execution phase opened;
  coherency green (197/197, 181 rows, 146 files). C1a: order irrelevant
  (p=0.925), learned≡uniform, MCS flatridge alone → C1 CLOSED with no repo
  edit. C2 QUEUED-FIRST.
* **D-34 — C2 probes + native ablation (CYCLE-198).** Harness: scorer
  ROBUST (keep), uniqueness NEUTRAL (off stands), adamw<sgd + distill/
  laggard add nothing. Native `c2-optimizer-ablation.sh` issued (one
  command owed); proof-back unblocks delete/adopt. Research 11b grounds
  the noisy-teacher framing.

## Decision log

| Item | State | Rationale |
|---|---|---|
| 116 | DONE | §84 |
| 117 (wave-2) | PARKED (director) | D-04 + D-08; revisit only at p≲0.07 boundary |
| 118 (midcap carry) | DONE (director, CYCLE-177, 4/4) | mid-flat 8.16/BE 34.2 closes e123 apples-to-apples; §85.2, D-09…D-14 |
| 84 / 87 | evidence banked | §84 readouts appended to both items |
| 85 | readout banked (§85 + §85.2) + S4 attestation decided + S6 scoped | unseen PASS / decay FAIL (4-lane); D-14 frontier is the S6 question |
| 122 (follow-ups) | DONE AI-side + DONE-NATIVE (director, CYCLE-180) | CYCLE-173 + operator 134/134 proof; canonical count now 134 |
| G5 honest-book | DECIDED (director, CYCLE-176) | unseen PASS (midcap legs); decay FAIL measured; g5verdict false |

## Sequenced next steps — allocation track ARCHIVED (CYCLE-192 purge)

Steps S0–S6e below are CLOSED history: verdicts stand, no further work, no
revisit conditions. Do not add rows here. Live work is the model track only.

| # | Step | Owner | Gate | Effort | Status |
|---|---|---|---|---|---|
| S0 | `test.sh analyze_cli` + `npm test` (122b native) | operator | none | ~8 min | DONE-NATIVE (CYCLE-180: operator proof 134/134, 0 fail — count drift 133→134 recorded) |
| S1 | midcap marks harvest → repo `src/data/marks_midcap_8h.json` | AI | none | in-session | DONE (CYCLE-174: 8/8, t0 shared, 2467 slots; stacked-16 merged) |
| S2 | 118 sleeve runs (8-midcap honest + stacked-16) | operator | S1 file lands | minutes | DONE (CYCLE-177: 4/4 — mid-flat 8.16/BE 34.2 closes the set) |
| S3 | 122a/b/c lab follow-ups | AI | none | in-session | DONE (CYCLE-173) |
| S4 | G5 honest-book decision | director | S2 | — | DECIDED (CYCLE-176, strengthened CYCLE-177: decay lane-independent, 4 lanes) |
| S5 | 117 revisit | director | p≲0.07 boundary | ~60 min | PARKED |
| S6a | trailing-beta hedge overlay (implementable neutral) | AI | none | ~10 s | DONE-DECIDED (CYCLE-178: hedge fails on all lanes — no overlay; D-14 corrected) |
| S6b | within-book allocation (blends over the D-14 frontier) | AI | S6a | ~2 s | DONE-DECIDED (CYCLE-179: frontier computed 5/5; operating blend a=0.25 mid-band — net 9.87/BE 62.0/worstBlock 0.141; fallback a=0.5) |
| S6c | carry-vs-cash sizing of the a=0.25 operating book | AI | S6b | ~2 s | DONE-DECIDED (CYCLE-181: scenarios FULL 9.87/RECENT 7.31/STRESS 4.67; vol-target L 25.6–27× is reference ceiling only; interim operating L≤10 (judgment, survival-pending); equity ≤ min($1.15M, cap-implied); OI covers 8/16 — mid leg unscored) |
| S6d | momentum weight | director | 117 revisit number (p≲0.07) | — | LINKED-PARKED (no unpark needed for S6a–c) |
| S6e | survival-cap run: maxDD-based leverage + scenario stress (funding-spike/basis-gap, cascade mechanics); grounded by 10s (2608.03616/2607.27070/2606.15715/2602.15182). DESIGN + standalone experiment AI-side | AI | S6c | in-session | DONE-DECIDED (CYCLE-186: unit maxDD 0.072% — maxDD sizing voided at 277×; governor inert 0.71 vs 0.72, adverse under spike 1.58 vs 1.55 — credited nothing; gap ladder binds: operating L≤5 at 100bps/5% judgment; gross ≤$11.5M ⇒ equity ≤$2.3M) |
| S6f | midcap OI harvest (unblocks F-42 schedule for the mid leg) | AI/operator | director go-ahead | TBD | PARKED (CYCLE-192 purge: no harvest, no operator load; script kept unused) |

## Model track — HiveMind/Legion CORE CODE (the ONLY live track, CYCLE-192 purge)

Goal restated: an evolutionary hivemind of small transformer controllers
that collectively trade a candle stream. Standing evidence: weights train
(170k steps, 0 warm errors), memory runs (≈ baseline), transformer runs
(wrong class per 09o/10t); direction CLOSED everywhere (controller
brierSkill −0.075; linear/MLP also ≤0); one open door — e115 1h big-move
+0.0246, DATA-BLOCKED on L2/fills/latency. Research: 10t (7 grounded).

| # | Step | Owner | Gate | Effort | Status |
|---|---|---|---|---|---|
| C1 | readout-head A/B/C (REFINED CYCLE-194 per 2610.01831: last-position vs uniform mean-pool (control) vs learned-pool on the same Llama block; learned may lose — read 2510.03339 first) | AI | none | repo edit + test script | CLOSED-NO-EDIT (CYCLE-197: lastpos≡meanpool DM p=0.925; learned≡uniform; MCS flatridge alone — readout not binding, goldens untouched) |
| C2 | A17 retire-test (identity-spec + plain AdamW + clip ablation; delete the trust/spec/fractal stack on no-Brier-move) | AI | none | lab probes DONE (CYCLE-198); native script ISSUED, proof owed | IN-FLIGHT (harness verdicts banked; delete/adopt gated on operator proof) |
| C3 | upgrades-into-live-reader or delete-broadcast (REFRAMED CYCLE-193: `_retrieveTopRelevantProtos` already IS the live scored reader via `_contextAwareAttention`; wire multiprobes/querymod into IT, or delete `broadcastMemory`) | AI | none | repo edit + test script | QUEUED (after C2) |
| M1p2 | controller-as-is + TSFM-probe arms (native/operator-gated; weights + better-sqlite3) | operator | code track progress | — | PARKED (nothing asked) |

| # | Step | Owner | Gate | Effort | Status |
|---|---|---|---|---|---|
| M1 | TODO 86 benchmark (CYCLE-183 spec, CYCLE-184 map+gates) | AI | none | in-session | PHASE-1 DONE (CYCLE-187: ARCHITECTURE fires vs small nets); PHASE-2 PARKED (see M1p2, nothing asked) |
| M2 | vol-track re-open (anchor-frozen + gated residual, linear first, quantile tails) | director | positive residual test (e117 keeps closed) | — | GATED |
| M3 | execution-uses data spec (exact L2/trade/latency needs + pre-reg bps/fill gate) | AI | none | in-session | DONE-spec + PARKED-builds (CYCLE-192 purge: E-a/E-b stay data-blocked, nothing asked, spec kept) |
| M4 | A24 wire-or-drop (LSH upgrades into scored path or PARK) | AI | none | in-session | DONE-DECIDED (CYCLE-188: hard-fixture recall def 0.887/mp 0.987/qm 0.967 — lift exactly on +0.10 boundary, rule-as-coded → PARK multiprobes+querymod; mp recorded as the choice if a live-reader build ever needs a probe; binarypc stays default-off) |
| M5 | evolve.js wire-up | director | positive-skill learner (M1/M2) + own A/B | — | GATED |
| M6 | ensemble size es | director | M1 skill (with 91/92) | — | ARCHIVED-RECOVERABLE |

Full per-module unlock checklist (KEEP/REDESIGN/PROBE/PARKED with research
groundings): `cycles/CYCLE-192.md` §2. Live queue is C1→C2→C3 only; each
code change ships with a test script and a golden re-freeze record if it
moves a golden value.

## Execution phase (authorized CYCLE-197 — director owns direction)

Future work targets model experiments and tests in iterative cycles:
C1 readout A/B/C → C2 optimizer retire-test (+10 same-harness probes) →
C3 upgrades-or-delete-broadcast, each gated by a coherency check before
the next step starts. AI moves freely between repo and lab. Tests the AI
cannot run ship as operator scripts (`bash scripts/<name>.sh`, one command
block per cycle with wall-time + what to paste/upload back); operator runs
+ uploads proof, never direction. Research re-syncs regularly (fresh
sweeps banked as `scratch/sweep-*.xml`, grounded in cycle records).
Bug + sanity checks every cycle; lab `run_all` stays green; repo goldens
move only with an intentional re-freeze record.

## Non-goals (locked CYCLE-192 — re-open needs a director decision + a number)

Data harvests/pulls of any kind · operator uploads · allocation/sleeve
sizing work · new leads · port/round-31/V2 work · directional tournaments,
meta-labelling, walk-forward λ, evolving noise. A step that changes no
weight, memory, readout, aggregation, or evolution does not belong in the
live plan.

## Budgets (measured, for planning)

16-panel gh ~95 min · cadenced ~100 min · test=10 ~140 min · sleeve scoring ~seconds (280 ms this leg — the "minutes" was script + test overhead).

## Operator command conventions (locked — do not drift)

* COMMANDS ARE SCRIPTS, never inline blocks. Every operator action ships as
  `bash scripts/<name>.sh <stage>` (stages like `port`|`gate`|`runs`|`all`,
  or the script's own verbs; default `all`); always `cd <repo-root>` first
  (the script itself also `cd`s to its root). An inline shell block is only
  ever a fallback when a script cannot exist yet — and writing the script
  is then the next action. (Locked CYCLE-191: inline blocks are an undesired
  format — the operator executes scripts.)
* One area: `bash scripts/test.sh <name>` (names listed by `bash scripts/test.sh`).
  Never present raw `npx node --test ...` — the test.sh form only.
* Structural gate: `bash scripts/test.sh quick`. Full gate: `npm test`
  (= `bash scripts/test.sh full`).
* Round scripts: `bash scripts/<round>-*.sh <stage>` (`port`|`gate`|`runs`|`all`),
  default `all`; always `cd <repo-root>` first.
* Present one command block per cycle, in run order, with expected
  wall-time and what to upload/paste back.
* Operator runs commands + uploads proof; direction decisions are the
  director's — never present an open decision to the operator.
