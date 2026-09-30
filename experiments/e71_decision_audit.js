// E71 - THE DECISION-GRADE REPORT, AUDITED: `analysis/decision.js`. CYCLE-063 (L10-cn ...).
//
// `analysis/decision.js` (round 26, R26-8) turns the analysis layer's numbers into ONE artifact that answers the
// six questions the next cycle asks (training / edge / concentration / economics / family / nextRun), with every
// field either a real value or an explicit `{ available:false, reason }` — never a silent null. It computes NO new
// strategy statistic: every block is a restatement of data the walk-forward, dependence, cost-ladder, forecast and
// replication layers already produced. It is SHIPPED (`analyze.js` imports `foldConcentration`/`confidencePersistence`/
// `nextRunPlan`/`decisionReport`/`formatDecision`/`promotionAcrossCadences` behind `--decision`). Pure: no I/O, no RNG.
//
// PRE-REGISTERED READ. PASSES if: (i) `foldConcentration`'s top-K shares / signed sums / delete-one-cluster range /
// per-fold marginals reproduce a direct recompute of `folds` + `foldInputs` and abstain when the inputs are absent;
// (ii) `confidencePersistence` is the within-fold pooled lag-1 autocorrelation (no cross-fold pairs) and the
// `ln 0.5 / ln rho` half-life, abstaining on < 2 pairs / constant confidence; (iii) `pairedUnitsNeeded` (via
// `nextRunPlan`) computes the smallest cluster count whose one-sided cluster-t resolves a target, and its
// `reference.pairedMde95` is `tCritical(C-1, alpha)*se`; (iv) `nextRunPlan` carries the documented guards and the
// `cheapestFlip` kinds; (v) `promotionAcrossCadences` is majority-pass + catastrophic veto with `defaultCatastrophic`;
// (vi) `decisionReport` has the six blocks with the explicit-na discipline; (vii) `formatDecision` renders them.
//
// The DEFECTS are reported in `findings` (whatever the probes reveal).

import {
    foldConcentration, confidencePersistence, nextRunPlan, decisionReport, formatDecision,
    defaultCatastrophic, promotionAcrossCadences,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/decision.js';
import { sharpeRatio, normalInvCdf } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';
import { strategyReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { studentTCritical, studentTPValue } from '../../NeuLegion-master/NeuLegion-master/src/analysis/dependence.js';
import { restateReportAtPolicy, restateReportAtCost } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';

const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);
const close = (a, b, tol = 1e-9) => (a === b) || (Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol);
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// a deterministic per-fold fixture: fold i has a confidence ramp and a matching position series
const mkFold = (i, net) => {
    const n = 12;
    const confidence = [];
    const signals = [];
    for (let t = 0; t < n; t++) {
        const c = Math.sin((t + i) / 2.3) * 0.6;
        confidence.push(c);
        signals.push(c > 0.1 ? 1 : c < -0.1 ? -1 : 0);
    }
    const returns = [];
    for (let t = 0; t < n; t++) returns.push(net + Math.sin((t + 2 * i) / 1.7) * 0.01);
    return { confidence, signals, returns, _i: i };
};

export async function run() {
    const checks = {};
    const rows = {};

    const FOLD_N = 6;
    const foldInputs = Array.from({ length: FOLD_N }, (_, i) => { const f = mkFold(i, 0.001 * (i % 2 ? 1 : -1)); delete f._i; return f; });
    // explicit per-fold gross so the top-K share contract has a known positive total
    const grossVals = [8, 4, 3, -1, -2, -3];
    const folds = grossVals.map((g) => ({ testStart: 0, testEnd: 11, metrics: { grossPnl: g } }));

    // ============================== A. foldConcentration =============================================
    checks.foldConcentrationContract = (() => {
        const block = foldConcentration({ folds, foldInputs, costBps: 0, periodsPerYear: 252, topKs: [1, 3, 20] });
        // direct recompute
        const nets = foldInputs.map((fi) => strategyReturns({ returns: fi.returns, signals: fi.signals, costBps: 0 }).returns);
        const pooledAll = [].concat(...nets);
        const full = sharpeRatio(pooledAll, { periodsPerYear: 252 });
        const leaveOut = nets.map((_, i) => sharpeRatio([].concat(...nets.slice(0, i), ...nets.slice(i + 1)), { periodsPerYear: 252 }));
        const gross = folds.map((f) => f.metrics.grossPnl);
        const grossTotal = gross.reduce((a, b) => a + b, 0);
        const sorted = gross.slice().sort((a, b) => b - a);
        const okTop = block.topKs.length === 3
            && block.topKs[0].k === 1 && close(block.topKs[0].share, sorted.slice(0, 1).reduce((a, b) => a + b, 0) / grossTotal, 1e-12)
            && block.topKs[2].k === FOLD_N && close(block.topKs[2].share, 1, 1e-12); // top-n share is the whole gross
        const okSums = close(block.grossTotal, grossTotal, 1e-12)
            && close(block.positiveSum, gross.filter((g) => g > 0).reduce((a, b) => a + b, 0), 1e-12)
            && close(block.negativeSum, gross.filter((g) => g < 0).reduce((a, b) => a + b, 0), 1e-12);
        const loo = block.deleteOneCluster;
        const okLoo = loo.available === true && close(loo.full, full, 1e-12)
            && close(loo.min, Math.min(...leaveOut), 1e-12) && close(loo.max, Math.max(...leaveOut), 1e-12)
            && close(loo.range, Math.max(...leaveOut) - Math.min(...leaveOut), 1e-12)
            && loo.worstIndex === leaveOut.indexOf(Math.min(...leaveOut)) && loo.bestIndex === leaveOut.indexOf(Math.max(...leaveOut));
        const vals = nets.map((_, i) => full - leaveOut[i]);
        const okMarg = block.marginal.available === true && close(block.marginal.mean, mean(vals), 1e-12)
            && close(block.marginal.min, Math.min(...vals), 1e-12) && close(block.marginal.max, Math.max(...vals), 1e-12)
            && block.marginal.values.every((v, i) => close(v, vals[i], 1e-12));
        // a non-positive gross total makes a "share of gross" meaningless, so share is null (not a misleading 1.0)
        const negBlock = foldConcentration({ folds: folds.map((f) => ({ ...f, metrics: { grossPnl: -1 } })), foldInputs: null, topKs: [1, 3, 20] });
        const okNeg = negBlock.topKs.length === 3 && negBlock.topKs.every((t) => t.share === null) && negBlock.grossTotal === -FOLD_N;
        rows.foldConcentration = { okTop, okSums, okLoo, okMarg, okNeg, grossTotal, full, min: loo.min, max: loo.max, marginalMean: block.marginal.mean };
        return okTop && okSums && okLoo && okMarg && okNeg;
    })();

    checks.foldConcentrationGuards = (() => {
        const noFolds = foldConcentration({ folds: [], foldInputs });
        const noInputs = foldConcentration({ folds, foldInputs: null });
        const wrongLen = foldConcentration({ folds, foldInputs: foldInputs.slice(0, 3) });
        const badInputs = foldConcentration({ folds, foldInputs: foldInputs.map(() => ({ returns: [1], signals: [1, 2] })) });
        const naShape = (o) => o && o.available === false && typeof o.reason === 'string';
        rows.foldGuards = {
            noFoldsNa: naShape(noFolds),
            noInputsHasNa: noInputs.available === true && naShape(noInputs.deleteOneCluster) && naShape(noInputs.marginal),
            wrongLenHasNa: wrongLen.available === true && naShape(wrongLen.deleteOneCluster),
            badInputsHasNa: badInputs.available === true && naShape(badInputs.deleteOneCluster),
        };
        return rows.foldGuards.noFoldsNa && rows.foldGuards.noInputsHasNa && rows.foldGuards.wrongLenHasNa && rows.foldGuards.badInputsHasNa;
    })();

    // ============================== B. confidencePersistence =========================================
    checks.confidencePersistenceContract = (() => {
        // a single fold with a known AR(1)-like series: hand lag-1 across the within-fold adjacent pairs
        const c = [0, 1, 2, 1, 0, -1, -2, -1, 0, 1, 2, 1];
        const p = confidencePersistence({ foldInputs: [{ confidence: c }] });
        // hand: pairs (c[t-1], c[t]) for t=1..11
        const xs = c.slice(0, -1), ys = c.slice(1);
        const mx = mean(xs), my = mean(ys);
        const vx = mean(xs.map((x) => (x - mx) ** 2)), vy = mean(ys.map((y) => (y - my) ** 2));
        const cov = mean(xs.map((x, i) => (x - mx) * (ys[i] - my)));
        const lag1 = cov / Math.sqrt(vx * vy);
        const halfLife = lag1 > 0 && lag1 < 1 - 1e-12 ? Math.log(0.5) / Math.log(lag1) : null;
        const okLag = close(p.lag1, lag1, 1e-9) && close(p.halfLife, halfLife, 1e-9) && p.bars === c.length && p.pairs === c.length - 1;
        // NO cross-fold pairs: two folds whose boundary would otherwise look like a pair
        const split = confidencePersistence({ foldInputs: [{ confidence: [1, 1, 1] }, { confidence: [-1, -1, -1] }] });
        const noCross = split.pairs === 4 && close(split.lag1, 1, 1e-12); // 2 within-fold pairs per fold, each perfectly correlated
        const constant = confidencePersistence({ foldInputs: [{ confidence: [2, 2, 2, 2] }] });
        const constNote = constant.available === true && constant.lag1 === null && constant.halfLife === null && typeof constant.note === 'string';
        const guards = confidencePersistence({ foldInputs: [] }).available === false
            && confidencePersistence({ foldInputs: [{ confidence: [1] }] }).available === false;
        rows.persistence = { okLag, lag1: p.lag1, halfLife: p.halfLife, noCross, splitPairs: split.pairs, splitLag1: split.lag1, constNote, guards };
        return okLag && noCross && constNote && guards;
    })();

    // ============================== C. pairedUnitsNeeded / nextRunPlan ===============================
    const mkCandidate = () => ({
        id: 'cand', promote: false, reasons: ['minDsr: pooled DSR 0.9 < 0.95'], pooledMetrics: { breakEvenCostBps: 6.5 },
        promotionTest: { available: true, sharpeDifference: { value: 0.30, se: 0.08, df: 35, nClusters: 36, alpha: 0.05 }, stability: { available: true, stable: true } },
        gate: { requireSharpeDiff: 'applied' },
    });

    checks.pairedUnitsArithmetic = (() => {
        const plan = nextRunPlan({ power: { observedSharpe: 0.8, mdeSharpe: 0.5, barsToDetect1: 620 }, candidate: mkCandidate(), periodsPerYear: 252 });
        const pu = plan.pairedUnits;
        const se = 0.08, C = 36, obs = 0.30, alpha = 0.05;
        // brute force: smallest n >= 2 with tCritical(n-1,alpha)*se*sqrt(C/n) <= target
        const resolvable = (n) => studentTCritical(Math.max(1, n - 1), { alpha, twoSided: false }) * se * Math.sqrt(C / n);
        const brutes = {};
        for (const [name, target] of [['observed', obs], ['power80', null]]) {
            if (name === 'observed') {
                let n = 2; while (n < 100000 && resolvable(n) > target) n++;
                brutes.observed = n;
            }
        }
        const z80 = normalInvCdf(0.80);
        let n = 2; while (n < 100000 && resolvable(n) + z80 * se * Math.sqrt(C / n) > obs) n++;
        brutes.power80 = n;
        const ok = pu.available === true && pu.seScale === 'paired' && pu.needed.observed === brutes.observed
            && pu.neededForObserved === brutes.observed && pu.neededForObservedPower80 === brutes.power80
            && close(pu.reference.pairedMde95, studentTCritical(C - 1, { alpha, twoSided: false }) * se, 1e-12)
            && pu.reference.df === C - 1;
        rows.paired = { ok, needed: pu.needed.observed, brute: brutes.observed, p80: pu.neededForObservedPower80, bruteP80: brutes.power80, pairedMde95: pu.reference.pairedMde95, seScale: pu.seScale };
        return ok;
    })();

    checks.nextRunPlanContract = (() => {
        const plan = nextRunPlan({
            power: { observedSharpe: 0.8, mdeSharpe: 0.5, mdeSharpeDependent: 1.2, barsToDetect1: 620, underpowered: true, effectiveBars: 244 },
            dependence: { designEffect: 2.95, effectiveBars: 244, seCluster: 0.12, nClusters: 36 },
            candidate: mkCandidate(), levels: [0, 2, 5, 10], periodsPerYear: 252, durationMs: 600000, folds: 12, streams: 8,
            cadence: { trainSize: 60, testSize: 15, folds: 12 },
        });
        const ok = plan.available === true && plan.designEffect === 2.95 && plan.effectiveBars === 244
            && plan.mde95 === 0.5 && plan.underpowered === true && plan.underpoweredThreshold === 1.0
            && plan.barsToDetect1 === 620 && plan.barsToDetectDependent === Math.ceil(620 * 2.95)
            && plan.breakEvenBps === 6.5 && deepEq(plan.clearsBps, { 0: true, 2: true, 5: true, 10: false })
            && close(plan.measuredPerFoldMs, 50000, 1e-9) && plan.projected.folds === 24 && close(plan.projected.ms, 1200000, 1e-9)
            && plan.cadence && plan.scales && Array.isArray(plan.scales.paired);
        // breakEven < the cheapest level -> cheapestFlip kind 'cost'
        const losing = nextRunPlan({ candidate: { promote: false, reasons: ['x'], pooledMetrics: { breakEvenCostBps: -1 }, promotionTest: { available: true, sharpeDifference: { value: 0.1, se: 0.1, df: 5, nClusters: 6, alpha: 0.05 } }, gate: { requireSharpeDiff: 'applied' } }, levels: [0, 2, 5, 10] });
        const costKind = losing.cheapestFlip.kind === 'cost';
        // promoted -> kind 'none'
        const promoted = nextRunPlan({ candidate: { promote: true, reasons: [] } });
        const noneKind = promoted.cheapestFlip.kind === 'none';
        rows.nextRun = { ok, costKind, noneKind, barsDep: plan.barsToDetectDependent, clears: plan.clearsBps };
        return ok && costKind && noneKind;
    })();

    checks.cheapestFlipKinds = (() => {
        const base = { promote: false, reasons: ['binding reason'], pooledMetrics: { breakEvenCostBps: 25 }, gate: { requireSharpeDiff: 'applied' } };
        // stability: unstable -> kind 'stability'
        const unstable = nextRunPlan({ candidate: { ...base, promotionTest: { available: true, sharpeDifference: { value: 0.3, se: 0.08, df: 35, nClusters: 36, alpha: 0.05 }, stability: { available: true, stable: false, worstCluster: 4, worstDelta: -0.2 } } } });
        const stab = unstable.cheapestFlip.kind === 'stability' && unstable.cheapestFlip.reader.includes('window 4');
        // magnitude: stable but the paired difference is short -> kind 'magnitude' with the one-sided t reference
        const short = nextRunPlan({ candidate: { ...base, promotionTest: { available: true, sharpeDifference: { value: 0.10, se: 0.08, df: 35, nClusters: 36, alpha: 0.05 }, stability: { available: true, stable: true } } } });
        const mag = short.cheapestFlip.kind === 'magnitude' && short.cheapestFlip.scale === 'paired'
            && short.cheapestFlip.df === 35 && short.cheapestFlip.reference.includes('one-sided')
            && close(short.cheapestFlip.requiredSharpeDifference, studentTCritical(35, { alpha: 0.05, twoSided: false }) * 0.08, 1e-12)
            && short.cheapestFlip.factor > 0;
        // no promotionTest at all -> kind 'gate'
        const gate = nextRunPlan({ candidate: { promote: false, reasons: ['a hurdle failed'] } });
        const gateKind = gate.cheapestFlip.kind === 'gate' && gate.cheapestFlip.binding === 'a hurdle failed';
        const search = nextRunPlan({ candidate: { promote: false, reasons: [] } });
        const searchKind = search.cheapestFlip.kind === 'search';
        rows.flip = { stab, mag, gateKind, searchKind, magKind: short.cheapestFlip.kind, magRequired: short.cheapestFlip.requiredSharpeDifference };
        return stab && mag && gateKind && searchKind;
    })();

    // ============================== D. promotionAcrossCadences ========================================
    checks.cadencePromotion = (() => {
        const mk = (cadence, promote, netSharpe, reasons = []) => ({ cadence, promote, netSharpe, reasons });
        const majorityPass = promotionAcrossCadences({ evaluations: [mk(10, true, 1), mk(15, true, 2), mk(20, false, 0.5)] });
        const tied = promotionAcrossCadences({ evaluations: [mk(10, true, 1), mk(15, false, 0.5)] });
        const vetoed = promotionAcrossCadences({ evaluations: [mk(10, true, 1), mk(15, true, 2), mk(20, true, 3.5), mk(25, true, -0.1)] });
        const auditVeto = promotionAcrossCadences({ evaluations: [mk(10, true, 1), mk(15, true, 2), mk(20, true, 3, ['candidate failed the lookahead audit (1 violations)'])] });
        const okMajority = majorityPass.available && majorityPass.promote === true && majorityPass.passes === 2 && majorityPass.fails === 1;
        const okTie = tied.available && tied.promote === false && tied.majority === false; // 1/2 is not MORE than half
        const okVeto = vetoed.promote === false && vetoed.vetoed === true && vetoed.catastrophic.length === 1 && vetoed.catastrophic[0].cadence === 25;
        const okAudit = auditVeto.promote === false && auditVeto.vetoed === true;
        const okCatastrophic = defaultCatastrophic({ netSharpe: -0.01 }) === true && defaultCatastrophic({ netSharpe: 0.01 }) === false
            && defaultCatastrophic({ reasons: ['lookahead audit failed'] }) === true && defaultCatastrophic({ reasons: ['minDsr low'] }) === false
            && defaultCatastrophic({ catastrophic: true }) === true;
        const empty = promotionAcrossCadences({ evaluations: [] });
        rows.cadence = { okMajority, okTie, okVeto, okAudit, okCatastrophic, emptyAvailable: empty.available };
        return okMajority && okTie && okVeto && okAudit && okCatastrophic && empty.available === false;
    })();

    // ============================== E. decisionReport + formatDecision ===============================
    checks.decisionReportContract = (() => {
        const candidate = mkCandidate();
        const d = decisionReport({
            candidate, runMeta: { gate: 'dependence', seed: 1, trials: 3, labelPolicy: 'conservative', runLabelPolicy: 'optimistic', cadence: { testSize: 15 } },
            concentration: { available: true, topKs: [] }, nextRun: { available: true, effectiveBars: 244 },
            costLadder: { available: true }, forecast: { available: true },
        });
        const ok = d.schema === 'nl.decision.v1' && d.verdict.promote === false
            && d.verdict.candidateId === 'cand' && d.verdict.reasons.length === 1
            && d.training.labelPolicy === 'conservative' && d.training.runLabelPolicy === 'optimistic'
            && d.concentration.available === true && d.nextRun.available === true
            && d.family.seedDistribution.available === false && typeof d.family.seedDistribution.reason === 'string' // explicit na, not null
            && d.family.varianceComponents.available === false && d.family.pairedVarianceRatio.available === false
            && d.economics.breakEvenBps === 6.5;
        // every block states availability; a missing input is explicit
        const bare = decisionReport({});
        const bareOk = bare.edge.reader && bare.family.seedDistribution.available === false && typeof bare.reader === 'string';
        const text = formatDecision(d);
        const textOk = typeof text === 'string' && text.includes('keep-off') && text.includes('cand') && text.includes('label policy: referent=conservative run=optimistic')
            && text.includes('concentration') && text.includes('nextRun');
        rows.decisionReport = { ok, bareOk, textOk, sample: text.split('\n').slice(0, 3) };
        return ok && bareOk && textOk;
    })();

    // (FINDING PROBE) a RESTATED report carries the ORIGINAL foldInputs, so foldConcentration mixes bases.
    checks.restatedFoldInputsBasisMix = (() => {
        const rep = {
            id: 'r',
            foldInputs: foldInputs.map((fi) => ({ confidence: fi.confidence, signals: fi.signals, returns: fi.returns })),
            folds: folds.map((f) => ({ testStart: 0, testEnd: 11, metrics: { ...f.metrics } })),
            streamFoldLengths: [Array.from({ length: FOLD_N }, () => 12)],
            trials: 1,
        };
        const rest = restateReportAtPolicy(rep, { deadZone: 0.5 }, { periodsPerYear: 252, trials: 1 });
        const carriesOriginalInputs = rest.foldInputs === rep.foldInputs || deepEq(rest.foldInputs, rep.foldInputs);
        const foldsChanged = !deepEq(rest.folds.map((f) => f.metrics), rep.folds.map((f) => f.metrics));
        // the restated folds' gross differs, but the signals inside foldInputs are UNCHANGED (deadZone 0.5 never applied)
        const restatedGross = rest.folds.reduce((a, f) => a + (f.metrics.grossPnl || 0), 0);
        const block = foldConcentration({ folds: rest.folds, foldInputs: rest.foldInputs, costBps: 0, periodsPerYear: 252 });
        // the block's topKs use the RESTATED gross; post-hardening (L10-cn) its LOO/marginal use the RESTATED signals too
        const originalFull = sharpeRatio([].concat(...rep.foldInputs.map((fi) => strategyReturns({ returns: fi.returns, signals: fi.signals, costBps: 0 }).returns)), { periodsPerYear: 252 });
        const restatedFull = sharpeRatio([].concat(...rest.foldInputs.map((fi) => strategyReturns({ returns: fi.returns, signals: fi.signals, costBps: 0 }).returns)), { periodsPerYear: 252 });
        const looFromOriginalSignals = block.deleteOneCluster.available && close(block.deleteOneCluster.full, originalFull, 1e-12);
        const looFromRestatedSignals = block.deleteOneCluster.available && close(block.deleteOneCluster.full, restatedFull, 1e-12);
        const grossFromRestatedFolds = close(block.grossTotal, restatedGross, 1e-12);
        const restatedNetSharpe = rest.pooledMetrics.netSharpe;
        const baseMismatch = isFinite(restatedNetSharpe) && isFinite(originalFull) && !close(restatedNetSharpe, originalFull, 1e-9);
        rows.restateBasis = {
            carriesOriginalInputs, foldsChanged, grossFromRestatedFolds, looFromOriginalSignals, looFromRestatedSignals, baseMismatch,
            restatedNetSharpe, originalSignalSharpe: originalFull, restatedSignalSharpe: restatedFull, restatedGross,
            note: 'ROUND-94 UPDATE: hardened (L10-cn, round 48, R48-pinned) — restateReportAtPolicy now carries RESTATED inputs ({...input, signals: sig}), so foldConcentration on a policy-restated report stays on ONE basis (GROSS from restated folds, LOO/marginal from restated signals). Pre-hardening it carried foldInputs forward unchanged and the block mixed two position series.',
        };
        return !carriesOriginalInputs && foldsChanged && grossFromRestatedFolds && looFromRestatedSignals && baseMismatch;
    })();

    // (PRECISION) the SHIPPED path restates at COST only (same signals, same costBps), so foldConcentration's two
    // halves stay on ONE basis - the mix needs a POSITION-changing restatement (policy/cadence), not the shipped one.
    checks.costRestatementStaysOnOneBasis = (() => {
        const rep = {
            id: 'r',
            foldInputs: foldInputs.map((fi) => ({ confidence: fi.confidence, signals: fi.signals, returns: fi.returns })),
            folds: folds.map((f) => ({ testStart: 0, testEnd: 11, metrics: { ...f.metrics } })),
            streamFoldLengths: [Array.from({ length: FOLD_N }, () => 12)],
            trials: 1,
        };
        const COST = 5;
        const r = restateReportAtCost(rep, COST, { periodsPerYear: 252, trials: 1 });
        const block = foldConcentration({ folds: r.folds, foldInputs: r.foldInputs, costBps: COST, periodsPerYear: 252 });
        const restatedGross = r.folds.reduce((a, f) => a + (f.metrics.grossPnl || 0), 0);
        const signalsCarried = deepEq(r.foldInputs, rep.foldInputs);
        // both halves agree with the cost-restated report: gross from r.folds, Sharpe from re-costed (same) signals
        const sharpeAgrees = close(block.deleteOneCluster.full, r.pooledMetrics.netSharpe, 1e-9);
        const grossAgrees = close(block.grossTotal, restatedGross, 1e-12);
        const basisConsistent = sharpeAgrees && grossAgrees && signalsCarried;
        rows.costRestate = { signalsCarried, sharpeAgrees, grossAgrees, costBlockFull: block.deleteOneCluster.full, restatedNetSharpe: r.pooledMetrics.netSharpe };
        return basisConsistent;
    })();

    const findingRestate = rows.restateBasis;

    const resolved = {};
    for (const [k, v] of Object.entries(checks)) resolved[k] = (v && typeof v.then === 'function') ? await v : v;
    const validationPass = Object.values(resolved).every((x) => x === true);
    const failed = Object.entries(resolved).filter(([, v]) => v !== true).map(([k]) => k);

    const verdict = {
        note: 'L10-cn..: `analysis/decision.js` is the SHIPPED decision-grade report (round 26, R26-8; `analyze.js` composes it behind `--decision`). PASSES the pre-registered read: `foldConcentration` reproduces a direct recompute of `folds`+`foldInputs` (top-K shares, signed sums, delete-one-cluster range with the right worst/best index, per-fold marginals) and abstains with explicit na blocks when inputs are absent/mismatched (with a null share on a non-positive gross total); `confidencePersistence` is the within-fold pooled lag-1 autocorrelation (no cross-fold pairs) with the ln 0.5/ln rho half-life, abstaining on fewer than two pairs and stating the constant-confidence case; `pairedUnitsNeeded` (via `nextRunPlan`) returns the smallest cluster count whose one-sided cluster-t resolves a target (matching a brute-force search) with `reference.pairedMde95 = tCritical(C-1,alpha)*se` and the paired/single-series scale flag; `nextRunPlan` carries the documented guards and the `cheapestFlip` kinds (none/cost/stability/magnitude/gate/search) with the one-sided t reference; `promotionAcrossCadences` is the majority-pass + catastrophic veto rule with `defaultCatastrophic`; `decisionReport` has the six blocks with the explicit-na discipline; and `formatDecision` renders them. FINDINGS, RESTATED round 94 (hardened round 48, L10-cn): (0) `restateReportAtPolicy` now carries RESTATED inputs, so a POLICY-restated report handed to `foldConcentration` stays on ONE basis — the old two-series mix is closed. Latent/export-level: the shipped `--decision` path restates at COST only (`restateReportAtCost`, same signals, same costBps) where both halves agree (verified by `costRestatementStaysOnOneBasis`), so the mix needs a position-changing restatement (a policy/cadence sweep), not the shipped call. No golden moves and no fold-back row.',
        checks: resolved,
        validationPass,
        failed,
        findings: {
            restatedFoldInputsBasisMix: findingRestate,
        },
        scope: {
            shipped: ['analyze.js computes foldConcentration({ folds: featured.folds, foldInputs: featured.foldInputs, costBps }) on the SCORED featured report', 'confidencePersistence/nextRunPlan/decisionReport/formatDecision/promotionAcrossCadences are composed behind --decision'],
            why: 'decision.js computes no new strategy statistic (every block is a restatement of already-scored data, so the finding cannot move a scored number), and the shipped `--decision` path restates at COST only (same signals, same costBps) where both halves of `foldConcentration` agree (verified by `costRestatementStaysOnOneBasis`). The mix is reached only by chaining a POSITION-changing restatement (policy/cadence) into `foldConcentration`, which the shipped call does not do. No golden moves and no fold-back row is due.',
        },
    };

    return { config: { folds: FOLD_N, topKs: [1, 3, 20], cadences: 4 }, rows, validation: resolved, verdict };
}
