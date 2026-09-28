# CYCLE-064 — The hivemind numeric kernels: activations, linalg, RMSNorm/RoPE, sampling and the statistics helpers are exact on the finite path — but a non-finite guard kills the +∞ activation, a `|| 1` family replaces a legitimate zero, and the vector helpers disagree on a length mismatch (L10-co…L10-cr)

**Date:** 2028-08-08
**Goal:** the lab has audited the **analysis** layer exhaustively; this cycle turns the
synthetic-ground-truth technique on the **model itself** — the five pure numeric kernel bags under
`hivemind/kernels/` that `hivemind.js` installs onto `HiveMind.prototype` (via `internal/mixins.js`). They are
the mathematical primitives every transformer step is built from, they are **shipped**
(`hivemind/training/gradients.js` calls `_computeSpectralNorm`/`_computeGradientNorm`/`_computeVariance`/
`_computeFractalDimension`/`_computeNTKStability`/`_computePercentile`/`_computeDynamicPercentile`/
`_computeSparseThreshold` in the per-step training hot path; `hivemind/transformer/*` calls the activation,
linalg and normalization kernels), and they are **pure** (no I/O), so each method audits in isolation via
`.call(fakeThis, …)`. The golden suite (`test/browser/entries/golden.test.js`) pins their finite-path numerics.

## Work

New experiment `experiments/e72_hivemind_kernels_audit.js` (registered; **80 steps, 49 gated, 0 fails**; 18 ms in
the suite; **11 checks, all pass**). It rebuilds each closed form by hand, exercises every documented degenerate
contract, and pins four defects.

## Results

### A. Activations are exact on the finite path — but `+∞` maps to probability 0 (L10-co)

`_silu(x) = x·σ(x)` and `_siluDerivative(x) = σ(x)·(1 + x·(1−σ(x)))` match the closed form to **1e-12** on
`x ∈ {−5…5}`; `_sigmoid(x) = 1/(1+e^−x)` to **1e-15** and is monotone; `_softmax` matches `exp(a−max)/Σ` to
1e-12, sums to 1, returns the uniform distribution on a non-finite element, returns `[]` for `[]`, and writes
into a supplied `out`. **L10-co:** the guard `isFiniteNumber(x) ? … : 0` runs **before** the internal
`Math.min(Math.max(x, −100), 100)` clamp, so it short-circuits for `±Infinity` — and it returns **0** for both
tails. `_sigmoid(+∞) = 0` (the mathematical limit is 1) and `_silu(+∞) = 0` (the limit is +∞); the saturation
clamp that was presumably added to tame large inputs is **unreachable** for the non-finite values it would have
handled. A maximally-positive logit therefore reads as a probability of **0** — a symmetric-looking guard that
fails on exactly one tail. `isFiniteNumber` also accepts numeric strings (`_silu('2') = 1.7616`,
`_sigmoid('2') = 0.8808`) while `_softmax` uses `Number.isFinite`, so the two activation paths disagree about
what a "valid input" is.

### B. Linalg (validated)

`_fastVectorDot`/`_vectorDot` (dot), `_fastVectorAdd` (coeff combination), `_fastVectorScale`, `_vectorSub`,
`_vectorNorm([3,4]) = 5`, `_cosineSimilarity` (the documented `+1e-8` denominator guard), `_weightedMean`
(size-weighted, `1:3` → 0.25) and `_projSimilarity` (1 on identical projections) all match to 1e-9.

### C. RMSNorm, RoPE and semantic normalization (validated)

`_rmsNorm(x, 1) = x / √(mean(x²)+1e-6)` to 1e-12 and returns zeros on a wrong length. `_applyRoPE` is the
identity at position 0 and rotates each interleaved `(x,y)` pair by `θ = pos·10000^(−2i/headDim)` at position 1
to 1e-12. `_normalizeSemantic` clamps a proto mean whose RMS exceeds `maxMeanRMS = 1.8 + 2.2·protoCapacity`
(measured new RMS **2.9000000953** vs the target 2.9) and scales the proto variance by the squared clamp.

### D. Sampling (validated)

`_randomNormal` is the **Irwin-Hall(12)** approximation (sum of 12 uniforms − 6), mean ≈ 0 and variance ≈ 1 by
construction (measured mean −0.0065, var 1.0069 over 20 000 draws) and honours `(mean, stdDev)`. `_sampleDirichlet`
returns `count` positive weights summing to 1 and `[]` for `count < 1`. `_generateProjectionMatrix` is
`_hiddenSize × _lowDim` bounded by `6/√lowDim`. `_generateLshHyperplanesLow` returns unit-norm hyperplanes.

### E. The statistics helpers are exact on the finite path — and a `|| 1` family eats legitimate zeros (L10-cp)

`_computeVariance` is the **documented** (`src/README.md`: "dispersion (MAD proxy)") clamped median-absolute-
deviation **around the upper median**, not a variance — `[0,0,0,0,100]` reads **10** (true variance 2000), `[1,1,1,1]`
reads 0. `_computeEMA` is the standard recursion; `_computeGradientConformity` is the fraction of consecutive
same-sign steps (0.75 for a 5-point monotone run) floored at 0.5; `_computePercentile` is the lower nearest-rank
`sorted[floor(p·(n−1))]`; `_computeSparseThreshold` ∈ [1e-6, 1e-4]; `_computeDynamicPercentile` ∈ [0.75, 0.99];
`_computeGradientNorm([3,4,0]) = 5` and on a matrix `= 5`; `_computeSpectralNorm(diag(3,1,1)) = 3.0000` (power
iteration); the stateful `_detectSuddenDrop`/`_isStagnating` fire on fabricated histories (flat → 1.0, a 0.4 drop
→ 3.0, short history → 1.0; flat → stagnating, high-variance/trending → not). **L10-cp:** a falsy-zero family —
`_computeGradientNorm`, `_computeSpectralNorm` and `_computePercentile` all end in `… || 1` / `|| 1.0`, so a
**zero** gradient vector, a **zero** gradient matrix and a genuine **0** percentile all read **1**:

| call | code returns | mathematically correct |
| --- | --- | --- |
| `_computeGradientNorm([0,0,0])` | **1** | 0 |
| `_computeGradientNorm([[0,0],[0,0]], true)` | **1** | 0 |
| `_computeSpectralNorm([[0,0],[0,0]])` | **1** | 0 |
| `_computePercentile([0,1,2], 0)` | **1** | 0 |

These feed `gradients.js`'s threshold and percentile machinery, so a dead gradient (no update this step) enters
the norm pool as the value 1.

### F. The vector helpers abstain inconsistently on a length mismatch (L10-cq)

`_fastVectorDot(a, b)` has no guard — it iterates `a.length` and reads past `b`'s end, so a mismatch yields
**NaN**; `_vectorDot(a, b)` has an explicit guard and yields **0**; `_fastVectorAdd(a, b)` returns a **copy of
`a`**. Three helpers, three different answers to the same malformed call (and `_fastVectorAdd`'s fallback is
silent — the caller cannot tell the add was skipped).

### G. Dead clamps and a mis-named estimator (L10-cr)

`_computeDualEMA`'s `svrWeight = min(0.8, max(0.2, 0.5·(1 − v/(v+1))))` can never reach its **0.8** cap (the raw
value lies in `(0, 0.5]`). `_computeNTKStability`'s bandwidth floor `max(−0.1, …)` is unreachable (the argument
`−0.05/(1+lossVariance·median)` lies in `(−0.05, 0]`), so its effective range is `[−0.05, −0.01]`. And
`_computeFractalDimension` is an ad-hoc clamped dispersion (`|Σ log|Δ|| / log n`, clamped to [1,2]), not a
fractal dimension: a **constant** series (dimension 0) reads the **maximum 2**. These are the L10-by class
(an estimator that is not the one it names) plus two dead guards.

### H. Scope

Every defect is on a **non-finite / exactly-zero / degenerate-input** edge; the golden suite pins the finite-path
numerics, which are exact. No scored number moves and **no fold-back row**.

## What is now false that used to be believed

* **"A non-finite activation input is safely mapped to 0."** It is — but `+Infinity` is non-finite, so a
  maximally-positive logit reads as probability 0, and the `±100` saturation clamp is unreachable for exactly the
  values it was added to handle.
* **"`_computeGradientNorm`/`_computeSpectralNorm` return the norm; `_computePercentile` returns the percentile."**
  Each returns **1** for a legitimate zero.
* **"The vector helpers agree on a malformed call."** `_fastVectorDot` → NaN, `_vectorDot` → 0,
  `_fastVectorAdd` → a copy of `a`.

## Ledger effects

* **F-80** is added: the hivemind numeric kernels are **validated** on the finite path with four registered rows —
  **L10-co** (`_sigmoid`/`_silu` map `+Infinity` → 0; the saturation clamp is unreachable), **L10-cp** (the
  falsy-zero family: `_computeGradientNorm`/`_computeSpectralNorm`/`_computePercentile` return 1 for a zero),
  **L10-cq** (the vector helpers' length-mismatch divergence), **L10-cr** (two dead clamps + `_computeFractalDimension`
  not a fractal dimension). All latent; no fold-back row.
* `e72_hivemind_kernels_audit.js` is the register's **nineteenth synthetic-ground-truth experiment** and the
  **first outside `analysis/`** — the technique now covers the model's own primitives. `run_all` is now
  **80 steps, 49 gated, 0 fails** (`RUN_SUMMARY` at **2026-09-27T11:06:28Z**).

## Next

* The remaining kernel bags (`hivemind/memory/*`, `hivemind/transformer/*`, `hivemind/kernels` beyond these five)
  and the `observer/` metrics layer are the next un-audited pure surfaces.
* Remaining L10 rows: **L10-h** (golden movement for any R1–R9 port), **L10-ad** (the carry attribution lag),
  **L10-ae** (`effectiveBars` unbounded), **L10-cn** (the restated-basis mix).

## Run

No repo file is touched. Full regeneration: `run_all` → **80 steps, 49 gated, 0 fails**, `RUN_SUMMARY` at
**2026-09-27T11:06:28Z** (`e72` 18 ms; `e71` 34 ms; `e0d` the slowest; total **1505 s** this run).
