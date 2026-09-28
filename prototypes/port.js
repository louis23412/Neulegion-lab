// Lab prototype: the PORT-SHAPED BOOK POST-PROCESSOR.
//
// The lab's three deployable books (R8 cross-sectional carry dispersion, R7 toptrader fade, and the
// standalone OI sleeve) share ONE weight post-processing chain. Every finding that fixed a sleeve spec
// (F-27/F-39/F-50 for R8; F-40/F-51 for R7; F-58/F-59 for OI) reproduced the chain ad hoc inside its own
// experiment. This module extracts that chain as a single pure primitive, so the port is "one module, three
// sleeves" rather than three hand-rolled copies. It is validated book-for-book in `experiments/e52_port_artefact.js`.
//
// Contract (prototype rules, PROTOCOL §4): PURE and POINT-IN-TIME. Each function takes weight ROWS
// (`[[w_j per symbol], ...]` in time order) and returns new rows; it reads nothing else, and row `t` depends
// only on rows `<= t`. No renormalisation is ever applied (the lab's cap/band conventions clip-and-hold).
//
// WHY THIS SHAPE. The reusable recipe the repo lacks is not a signal — it is the *book hygiene* that made the
// weak streams tradable: (1) a strict per-symbol CAP (`1/k`, F-27/F-50) that is a tail winsorisation
// (F-54) and a concentration/capacity tool (F-52), and (2) a per-symbol NO-TRADE BAND (F-52/F-53/F-58) that
// cuts churn by trading only when the target actually moves. Caps and bands are signal-agnostic, so they
// belong in one place.
//
// The final port specs (FOLD-BACK.md) — pinned, no walk-forward:
//   R8  carry dispersion : ewma 0.02  + cap 1/k=0.125 + band   (band stacks on the cap, F-52)
//   R7  toptrader fade   : ewma 0.05  + cap 1/k=0.125 + (no band; the band does not stack, F-53)
//   OI  standalone       : 50/50 (ewma 0.1, ewma 0.25) + band eps=0.03 (no cap; F-58)
//
// FROZEN-PARAMETER RULE (F-49/F-55 for λ, F-59 for the OI band's eps): any frozen parameter must be chosen on
// >= ~2.3 years (2555 8h-periods) of trailing data; shorter windows pick a fast λ / the largest band. The
// default epochs below encode that minimum so a port cannot silently train on too little history.

export const MIN_TRAIN_PERIODS = 2555; // ~2.3 y at the lab's 8h grid (3 periods/day)

// Strict per-symbol cap (F-27): clip and HOLD -- NO renormalisation (exactly e30#applyCap). At cap = 1/k this
// is the structural "no symbol may be more than an equal share" constraint.
export function clipWeights(weightRows, cap) {
    if (cap == null) return weightRows;
    return weightRows.map((w) => w.map((x) => (x > cap ? cap : x < -cap ? -cap : x)));
}

// Per-symbol no-trade band (F-52/F-53): move symbol j only when its target has moved more than `eps` from
// what is held; otherwise keep the held weight. Stateful in TIME only (row t reads rows <= t).
export function bandWeights(weightRows, eps) {
    if (eps == null) return weightRows;
    let held = weightRows[0].slice();
    return weightRows.map((w) => {
        const out = w.map((x, j) => (Math.abs(x - held[j]) > eps ? x : held[j]));
        held = out;
        return out;
    });
}

// The chain. Order matters: CAP first, then BAND (F-52 found the band stacks on the capped book; a band on the
// raw book recovers almost none of the cap's benefit).
export function cleanBook(weightRows, { cap = null, bandEps = null } = {}) {
    return bandWeights(clipWeights(weightRows, cap), bandEps);
}

// The final specs as data, so callers cannot forget a piece.
export const SLEEVE_SPECS = {
    R8: { name: 'carry dispersion', cap: 0.125, bandEps: 0.005 },        // band eps chosen to match ~6x/yr (F-52)
    R7: { name: 'toptrader fade', cap: 0.125, bandEps: null },            // band does not stack (F-53)
    OI: { name: 'OI-change 50/50', cap: null, bandEps: 0.03 },            // F-58: pin eps; needs >=2.3y if fitted (F-59)
};

export function cleanForSleeve(weightRows, sleeve) {
    const spec = SLEEVE_SPECS[sleeve];
    if (!spec) throw new Error(`unknown sleeve: ${sleeve}`);
    return cleanBook(weightRows, { cap: spec.cap, bandEps: spec.bandEps });
}
