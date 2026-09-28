// E0c - pipeline equivalence guard.
//
// The sweeps use `positionsOfFast` (O(n)) instead of `positionsOf` (faithful, but
// O(n * zWindow * window)). Before ANY sweep number is trusted, this asserts the
// two agree to numerical noise on real data for a representative arm set,
// including a cross-sectional arm (which reads the panel).
//
// Pass condition: maxAbsDiff < 1e-9 for every arm.

import { buildPanel, positionsOf, positionsOfFast, validatePositions, SYMBOLS } from '../lib/lab.js';
import { momentum, reversal, volScaledMomentum } from '../../NeuLegion-master/NeuLegion-master/src/analysis/features.js';
import { xsMomentum } from '../prototypes/signals.js';

export async function run({ tf = '15m', n = 4000 } = {}) {
    const panel = await buildPanel({ symbols: SYMBOLS, tf, n });
    const series = panel[0];
    const arms = [
        { name: 'mom-16', fn: momentum, window: 16 },
        { name: 'mom-168', fn: momentum, window: 168 },
        { name: 'reversal-1', fn: reversal, window: 1 },
        { name: 'volmom-16', fn: volScaledMomentum, window: 16 },
        { name: 'xs-mom-16', fn: xsMomentum, window: 16 },
    ];
    const rows = arms.map((a) => ({ name: a.name, ...validatePositions(a.fn, series, { window: a.window, params: a.params || null }, n) }));
    return {
        config: { tf, bars: series.n, validatedBars: n },
        rows,
        pass: rows.every((r) => r.maxAbsDiff < 1e-9),
    };
}
