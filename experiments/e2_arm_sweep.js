// E2 - arm sweep: which arms have a *stable* edge, not a recent-window one?
//
// E0b showed the headline `sig-momentum` number is a 600-bar window artefact
// (last-600 bars Sharpe +1.27, full-history +0.11). This experiment sweeps a
// horizon/construction grid over the full sample AND a ladder of disjoint blocks,
// so every arm is scored on
//   (1) full-sample mean net Sharpe + break-even cost,
//   (2) block stability (fraction of disjoint blocks with positive Sharpe),
//   (3) the panel readout (design effect / effective streams / pooled dsrAdjusted).
//
// An arm with a *real* edge must survive (2) - otherwise its pooled DSR is a
// statement about one regime, not about the strategy.

import { buildPanel, positionsOfFast, score, netSeries, panelReadout, stats, SYMBOLS, PERIODS_PER_YEAR } from '../lib/lab.js';
import {
    momentum, acceleration, reversal, rangeLocation, momentumAgreement,
    volScaledMomentum, blendedMomentum, regimeGatedMomentum, networkMomentum,
} from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { xsMomentum, xsVolScaledMomentum, xsMomentumRank } from '../prototypes/signals.js';
import { sharpeRatio } from '../../NeuLegion-master/NeuLegion-master/src/analysis/performance.js';

export const ARMS = [
    { name: 'mom-4', fn: momentum, window: 4, note: 'TSMOM 4 bars' },
    { name: 'mom-8', fn: momentum, window: 8, note: 'TSMOM 8 bars' },
    { name: 'mom-16', fn: momentum, window: 16, note: 'TSMOM 16 bars (the shipped sig-momentum)' },
    { name: 'mom-32', fn: momentum, window: 32, note: 'TSMOM 32 bars' },
    { name: 'mom-48', fn: momentum, window: 48, note: 'TSMOM 48 bars' },
    { name: 'mom-96', fn: momentum, window: 96, note: 'TSMOM 96 bars' },
    { name: 'mom-168', fn: momentum, window: 168, note: 'TSMOM 168 bars (~1 week at 1h)' },
    { name: 'accel-16', fn: acceleration, window: 16, note: 'shipped sig-accel' },
    { name: 'reversal-1', fn: reversal, window: 1, note: 'shipped sig-reversal' },
    { name: 'range-32', fn: rangeLocation, window: 32, note: 'shipped sig-range (PARK)' },
    { name: 'agree-32', fn: momentumAgreement, window: 32, note: 'shipped sig-agreement (PARK)' },
    { name: 'volmom-16', fn: volScaledMomentum, window: 16, note: 'shipped sig-vol-momentum (G-H)' },
    { name: 'blend-32', fn: blendedMomentum, window: 32, params: { lenses: [8, 16, 32] }, note: 'shipped sig-blend-momentum (G-H)' },
    { name: 'regime-16', fn: regimeGatedMomentum, window: 16, params: { gateWindow: 32, gateZ: 2 }, note: 'shipped sig-regime-momentum (G-H)' },
    { name: 'netmom-16', fn: networkMomentum, window: 16, params: { lag: 1 }, note: 'shipped sig-network-momentum (G-H)' },
    { name: 'xs-mom-16', fn: xsMomentum, window: 16, note: 'NEW cross-sectional momentum (relative trend)' },
    { name: 'xs-mom-48', fn: xsMomentum, window: 48, note: 'NEW cross-sectional momentum, slower' },
    { name: 'xs-mom-168', fn: xsMomentum, window: 168, note: 'NEW cross-sectional momentum, weekly' },
    { name: 'xs-volmom-16', fn: xsVolScaledMomentum, window: 16, note: 'NEW vol-scaled cross-sectional momentum' },
    { name: 'xs-rankmom-48', fn: xsMomentumRank, window: 48, note: 'NEW rank-based cross-sectional momentum' },
];

export function blockStability(netByStream, blocks = 6) {
    // Per-stream Sharpe in each of `blocks` disjoint trailing blocks; a stable arm
    // has a high fraction of positive block-Sharpes.
    const n = netByStream[0].length;
    const size = Math.floor(n / blocks);
    const perBlockMean = [];
    for (let b = 0; b < blocks; b++) {
        const from = n - (blocks - b) * size;
        const vals = netByStream.map((s) => sharpeRatio(s.slice(from, from + size), { periodsPerYear: PERIODS_PER_YEAR }));
        perBlockMean.push(vals.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0) / vals.length);
    }
    return { blockSharpes: perBlockMean, positiveFraction: perBlockMean.filter((v) => v > 0).length / perBlockMean.length, min: Math.min(...perBlockMean), max: Math.max(...perBlockMean) };
}

export async function run({ tf = '1h', costBps = 0, blocks = 6, maxBars = 9600, maxClusters = 192, recent = 600 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf });
    const total = panel[0].n;
    const rc = Math.min(recent, total);
    const out = { config: { tf, bars: total, streams: panel.length, costBps, blocks, recent: rc }, arms: {} };
    for (const arm of ARMS) {
        const signals = panel.map((s) => positionsOfFast(arm.fn, s, { window: arm.window, params: arm.params || null }));
        const per = panel.map((s, i) => {
            const m = score(s.returns, signals[i], { costBps });
            return { netSharpe: m.netSharpe, breakEvenCostBps: m.breakEvenCostBps, turnoverPerBar: m.turnover / m.bars, nonZeroFraction: m.nonZeroFraction };
        });
        const netByStream = panel.map((s, i) => netSeries(s.returns, signals[i], costBps));
        const rd = panelReadout(netByStream, { maxBars, maxClusters, label: arm.name });
        const stab = blockStability(netByStream, blocks);
        // The verdict window: what the acceptance batch (`--bars=600`, "most recent
        // 600 bars per stream") would read for this arm.
        const recentPer = panel.map((s, i) => {
            const m = score(s.returns.slice(-rc), signals[i].slice(-rc), { costBps });
            return { netSharpe: m.netSharpe, breakEvenCostBps: m.breakEvenCostBps };
        });
        out.arms[arm.name] = {
            note: arm.note,
            meanSharpe: stats(per.map((p) => p.netSharpe)),
            meanBreakEvenCostBps: stats(per.map((p) => p.breakEvenCostBps)).mean,
            turnoverPerBar: stats(per.map((p) => p.turnoverPerBar)).mean,
            nonZeroFraction: stats(per.map((p) => p.nonZeroFraction)).mean,
            positiveStreams: per.filter((p) => p.netSharpe > 0).length,
            stability: stab,
            dependence: rd.dependence,
            pooled: rd.pooled,
            verdictWindow: {
                bars: rc,
                meanSharpe: stats(recentPer.map((p) => p.netSharpe)),
                meanBreakEvenCostBps: stats(recentPer.map((p) => p.breakEvenCostBps)).mean,
                positiveStreams: recentPer.filter((p) => p.netSharpe > 0).length,
            },
        };
    }
    return out;
}
