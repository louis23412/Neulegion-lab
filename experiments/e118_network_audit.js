// E118 - THE NETWORK-MOMENTUM AUDIT REACHABILITY PROBE (round 85, TODO W6 re-freeze evidence).
//
// WHY. `sig-network-momentum` is the strongest-looking price arm in the corpus
// (pooled Sharpe 1.3005, BE 15.29 bps — DROPPED.md) but its A/B audit is
// VACUOUS (reachable 0/288) with 8 look-ahead violations, so it cannot promote.
// The scored path is correct (e63: analyze.js always sets panel.streamIndex, the
// arm skips its own slot and reads lagged siblings). The vacuity is structural:
// the audit perturbs only the OWN stream's futures, and the arm never reads its
// own slot — so the probe cannot reach the arm's input by construction.
//
// WHAT. Rebuild the arm's scored + audit passes lab-side through the REPO's own
// functions (read-only), on the run's exact window (8x1h, last 600 bars,
// trainSize 60 / testSize 15, probe 0.05, 1 probe/fold — run 20260927T060215):
//   Run A: the production viewFor.
//   Run B: sibling-shocked viewFor (same own shock PLUS probe added to every
//          sibling return after t) — the audit the arm can actually feel.
// Pre-fix (round 85) Run A was vacuous 0/288 and Run B reached 288/288 with 0
// violations (F-130: the arm is causal, the probe was the defect). Post-fix
// (round 86: the sibling shock is production) Run A must equal Run B exactly.
// Pre-registered reading: Run B reachable + 0 violations => the arm is
// MEASURABLE and the fix is audit-layer (probe siblings for cross-sectional
// arms; scored path untouched, goldens unmoved) => recommend the re-freeze arc.
// Run B violations > 0 => the 1.3 carries look-ahead => close the question.
//
// PASS iff checks 1-5 hold (the falsifier is decisive either way; check 6
// records the direction in `verdict`, never smuggled into `pass`).

import { SYMBOLS, loadBasket } from '../lib/lab.js';
import { signalForCandidate, SIGUP_CANDIDATES } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { makeCandleViewFor } from '../../NeuLegion-master/NeuLegion-master/src/analysis/world.js';
import { barReturns } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward.js';
import { walkForwardSplit } from '../../NeuLegion-master/NeuLegion-master/src/analysis/splits.js';
import { auditNoLookahead } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward/audit.js';
import { confidenceToPosition } from '../../NeuLegion-master/NeuLegion-master/src/analysis/walkforward/returns.js';
import { positionsFromSignals } from '../../NeuLegion-master/NeuLegion-master/src/analysis/backtest.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';

const N = 600;
const TRAIN = 60;
const TEST = 15;
const PROBE = 0.05;
const E24_REF_SHARPE = 1.3005;

export async function run({} = {}) {
  const checks = [];
  const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

  const basket = await loadBasket(SYMBOLS, '1h');
  const okLen = basket.every((s) => s.n >= N);
  check('e118: 8x1h series loaded with >= 600 bars', basket.length === 8 && okLen, basket.map((s) => s.n).join('/'));
  const closes = basket.map((s) => s.close.slice(-N));
  const lensOk = closes.every((c) => c.length === N);
  check('e118: last-600 slice aligned on all streams', lensOk, closes.map((c) => c.length).join('/'));

  const cand = SIGUP_CANDIDATES.find((c) => c.id === 'sig-network-momentum');
  check('e118: repo roster carries sig-network-momentum (lagged, cross-sectional)', !!cand && cand.crossSectional === true && cand.params && cand.params.lag === 1, cand ? cand.note.slice(0, 80) : 'missing');
  const sig = signalForCandidate(cand);
  // The scored path maps the signed confidence through the run-level policy
  // (models.js#makeSignalForVariant; run 20260927T060215 positionPolicy
  // {deadZone 0.05, scale 1}) — the audit scores the same mapping.
  const signalForFold = (train, test, view) =>
    sig(view, test).map((c) => confidenceToPosition(c, { deadZone: 0.05, scale: 1 }));

  const candles = closes.map((c, j) => {
    const s = basket[j];
    const o = s.open.slice(-N); const h = s.high.slice(-N); const l = s.low.slice(-N); const v = s.volume.slice(-N);
    return c.map((close, i) => ({ open: o[i], high: h[i], low: l[i], close, volume: v[i] }));
  });
  const rets = closes.map((c) => barReturns(c));
  const labels = SYMBOLS.map((s) => s);

  const perStream = [];
  let allVacuousA = true;
  let reachFoldsA = 0;
  let reachFoldsB = 0;
  let violA = 0;
  let violB = 0;
  let baseEqual = true;
  const pooled = [];
  for (let si = 0; si < 8; si++) {
    const folds = walkForwardSplit({ n: N, trainSize: TRAIN, testSize: TEST });
    const panelBase = { streamIndex: si, label: labels[si], labels, returnsByStream: rets.map((r) => r.slice()) };
    const viewA = makeCandleViewFor(candles[si], { panel: panelBase });
    const viewB = (r, perturb) => {
      if (!perturb) return makeCandleViewFor(candles[si], { panel: panelBase })(r, null);
      const sib = panelBase.returnsByStream.map((rs, j) => {
        if (j === si) return rs;
        const cp = rs.slice();
        for (let i = perturb.after + 1; i < cp.length; i++) cp[i] += perturb.probe;
        return cp;
      });
      return makeCandleViewFor(candles[si], { panel: { ...panelBase, returnsByStream: sib } })(r, perturb);
    };
    if (JSON.stringify(viewA(rets[si], null)) !== JSON.stringify(viewB(rets[si], null))) baseEqual = false;
    const auditA = auditNoLookahead({ signalForFold, folds, returns: rets[si], probe: PROBE, viewFor: viewA, requireReachable: true, auditProbesPerFold: 1 });
    const auditB = auditNoLookahead({ signalForFold, folds, returns: rets[si], probe: PROBE, viewFor: viewB, requireReachable: true, auditProbesPerFold: 1 });
    if (!(auditA.vacuous === true && auditA.reachableFolds === 0)) allVacuousA = false;
    reachFoldsA += auditA.reachableFolds;
    reachFoldsB += auditB.reachableFolds;
    const nonReachA = auditA.violations.filter((v) => v.fold !== -1 || !/vacuous/.test(v.reason));
    violA += nonReachA.length;
    const nonReachB = auditB.violations.filter((v) => v.fold !== -1 || !/vacuous/.test(v.reason));
    violB += nonReachB.length;
    const base = [];
    for (const f of folds) {
      const pos = signalForFold(f.train, f.test, viewA(rets[si], null));
      // The driver's exact scoring (backtest.js#scoreFold): lag-1 positions on
      // the fold's own test bars, so every fold contributes all 15 bars.
      const held = positionsFromSignals(pos, { lag: 1 });
      f.test.forEach((t, k) => { pooled.push(held[k] * rets[si][t]); });
      base.push(pos);
    }
    perStream.push({ stream: SYMBOLS[si], folds: folds.length, vacuousA: auditA.vacuous, reachA: auditA.reachableFolds, reachB: auditB.reachableFolds, violB: nonReachB.length, firstViolB: nonReachB.slice(0, 2) });
  }
  const pooledSharpe = sharpeRatio(pooled, { periodsPerYear: 252 });
  check('e118: rebuilt pooled Sharpe matches the run (1.3005 +- 0.05)', Math.abs(pooledSharpe - E24_REF_SHARPE) < 0.05, 'pooled=' + pooledSharpe.toFixed(4) + ' n=' + pooled.length);
  check('e118: Run A reaches post-fix (the sibling shock is production now)', allVacuousA === false && reachFoldsA === 288 && violA === 0, 'vacuous8=' + allVacuousA + ' reach=' + reachFoldsA + '/288 viol=' + violA);
  check('e118: repo law equals the lab probe (A and B audits identical)', reachFoldsA === reachFoldsB && violA === violB, 'A ' + reachFoldsA + '/' + violA + ' vs B ' + reachFoldsB + '/' + violB);
  check('e118: probe-only difference (base views byte-equal A vs B)', baseEqual === true, baseEqual ? '8/8 identical' : 'BASE DIVERGED');
  check('e118: Run B reaches the arm (sibling shock moves later positions)', reachFoldsB > 0, 'reach=' + reachFoldsB + ' folds');
  const verdict = violB === 0 ? 'MEASURABLE' : 'LEAKED';
  check('e118: Run B decisive (verdict recorded: ' + verdict + ', ' + violB + ' violations)', true, verdict + ' viol=' + violB);

  const failed = checks.filter((c) => !c.pass);
  return {
    config: { bars: N, trainSize: TRAIN, testSize: TEST, probe: PROBE, probesPerFold: 1 },
    repo: {
      pooledSharpe252: +pooledSharpe.toFixed(4), refSharpe: E24_REF_SHARPE, pooledBars: pooled.length,
      runA: { vacuousAll8: allVacuousA, reachableFolds: reachFoldsA + '/288', violations: violA },
      runB: { reachableFolds: reachFoldsB, violations: violB },
      verdict, perStream,
    },
    total: checks.length, failed: failed.length, failures: failed, checks, pass: failed.length === 0,
  };
}
