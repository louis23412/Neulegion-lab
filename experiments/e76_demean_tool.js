// E76 - THE DEMEAN-TOOL READ: does the REPO's R5 construction reproduce F-03?
//
// CYCLE-078. F-03 (e2, `xsMomentum` in `prototypes/signals.js`) measured that
// demeaning momentum across the basket collapses the design effect
// (4.92 -> 0.39-0.60, effective streams 1.47 -> 14-19) without manufacturing
// edge (|Sharpe| <= 0.033 — F-07). Round 45 ports the TOOL (never an arm) as
// `panelMean` + `demeanedFn` + `xsMomentum` in `analysis/features.js`. This
// experiment drives the REPO functions on the real 1h panel and checks the
// economics against the stored F-03 numbers. Read-only on the repo.
//
// PRE-REGISTERED READ. PASS iff:
//   (1) the raw momentum book reproduces the F-03 baseline (DE within 1.0 of
//       4.92, effective streams within 0.5 of 1.47, pooled Sharpe within 0.1
//       of +0.110 — same rig as e2: 1h panel, window 16, full history);
//   (2) the repo-demeaned book collapses dependence (DE within [0.3, 0.8],
//       effective streams >= 10);
//   (3) the demeaned Sharpe manufactures no edge (|pooled Sharpe| <= 0.15 —
//       the R5 falsifier direction: the tool buys power, not edge; gating
//       Sharpe >= raw would be laundering F-07's negative into a failure).
// A failure means the port is not the measured object and must NOT be called R5.

import { buildPanel, positionsOf, netSeries, panelReadout, SYMBOLS } from '../lib/lab.js';
import { momentum, xsMomentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';

const STORED = { rawDE: 4.92, rawEff: 1.47, rawSharpe: 0.110, xsDE: [0.39, 0.60], xsEffMin: 10 };

export async function run({ tf = '1h', maxBars = 9600, maxClusters = 192 } = {}) {
    const checks = [];
    const check = (name, pass, detail = '') => checks.push({ name, pass: !!pass, detail: String(detail) });

    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    check('e76: the 1h panel builds with 8 cross-sectioned streams',
        panel.length === 8 && panel.every((s) => s.panel && s.panel.returnsByStream && s.panel.returnsByStream.length === 8),
        `streams=${panel.length} bars=${panel[0].n}`);

    const rawSignals = panel.map((s) => positionsOf(momentum, s, { window: 16 }));
    const raw = panelReadout(panel.map((s, i) => netSeries(s.returns, rawSignals[i], 0)), { maxBars, maxClusters, label: 'momentum' });
    check('e76: the raw book reproduces the F-03 baseline',
        Math.abs(raw.dependence.designEffect - STORED.rawDE) <= 1.0 &&
        Math.abs(raw.dependence.effectiveStreams - STORED.rawEff) <= 0.5 &&
        Math.abs(raw.pooled.netSharpe - STORED.rawSharpe) <= 0.1,
        `DE=${raw.dependence.designEffect.toFixed(2)} eff=${raw.dependence.effectiveStreams.toFixed(2)} sharpe=${raw.pooled.netSharpe.toFixed(3)}`);

    const xsSignals = panel.map((s) => positionsOf(xsMomentum, s, { window: 16 }));
    const xs = panelReadout(panel.map((s, i) => netSeries(s.returns, xsSignals[i], 0)), { maxBars, maxClusters, label: 'xs-momentum' });
    check('e76: the repo-demeaned book collapses dependence into the F-03 band',
        xs.dependence.designEffect >= 0.3 && xs.dependence.designEffect <= 0.8 &&
        xs.dependence.effectiveStreams >= STORED.xsEffMin,
        `DE=${xs.dependence.designEffect.toFixed(2)} eff=${xs.dependence.effectiveStreams.toFixed(2)}`);
    check('e76: the demeaned Sharpe manufactures no edge',
        Math.abs(xs.pooled.netSharpe) <= 0.15,
        `sharpe=${xs.pooled.netSharpe.toFixed(3)}`);

    const failed = checks.filter((c) => !c.pass);
    return {
        config: { tf, symbols: panel.length, bars: panel[0].n },
        repo: {
            raw: { de: +raw.dependence.designEffect.toFixed(2), eff: +raw.dependence.effectiveStreams.toFixed(2), sharpe: +raw.pooled.netSharpe.toFixed(3) },
            xs: { de: +xs.dependence.designEffect.toFixed(2), eff: +xs.dependence.effectiveStreams.toFixed(2), sharpe: +xs.pooled.netSharpe.toFixed(3) },
        },
        stored: STORED,
        total: checks.length, failed: failed.length, failures: failed, checks,
        pass: failed.length === 0,
    };
}
