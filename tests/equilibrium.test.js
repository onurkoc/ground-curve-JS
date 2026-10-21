// Equilibrium with shotcrete and bolts, decision of 2026-10-21 (second, replaces "shotcrete fails at
// p_max"): both supports are linear-elastic / ideal-plastic after Hoek (Fig. 8, Fig. 14) with an
// unlimited plateau at p_max; the curves are added at equal displacement (Gschwandtner Gl. V-50);
// FS (total) = p_max,total / p_eq (Hoek Gl. 13).
// Cases with D 11 m (shotcrete and bolts after Gschwandtner Anhang B):
//   Fall A: equilibrium with both supports on their plateau (FS 1.00)
//   Fall B: equilibrium with the shotcrete on its plateau, bolts still rising
//   comparison cases with RocSupport (shotcrete only, shotcrete + bolts), no LSC
// The equilibrium checks are independent of the app's intersection search.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run, ARG_ORDER } from './helpers.js'
import { updateGraphic } from '../src/physics/groundCurveCalc.js'
import { calls } from './stubs/plotly.js'

const FALL_A = {
    gamma: 20, H: 500, nu: 0.3, E: 1050, c: 1000, phi: 28, D: 11,
    f_ck: 25, E_c: 15000, nu_c: 0.2, t_c: 0.15, dis_sup: 2, advance_rate: 2,
    l_yield: 7, F_LSC: 600, t_bf: 173, s_l: 1, s_r: 1, d_b: 0.02, l_b: 10
}
const FALL_B = { ...FALL_A, gamma: 18.3, H: 443 }
// RocSupport comparison cases (no LSC)
const ROC_SPC = { ...FALL_B, l_yield: 0, F_LSC: 0, t_bf: 0 }
const ROC_SPC_BOLTS = { ...ROC_SPC, t_bf: 400 }
const NO_CAPACITY = 'no equilibrium – support capacity insufficient'

// Ground curve pressure at displacement u (ground curve: p ascending, u descending)
function groundAt(g, u) {
    for (let i = 0; i < g.x.length - 1; i++) {
        if ((g.x[i] - u) * (g.x[i + 1] - u) <= 0) return g.y[i] + (g.y[i + 1] - g.y[i]) * (u - g.x[i]) / (g.x[i + 1] - g.x[i])
    }
    return null
}
// Displacement where the ground curve has pressure p
function groundU(g, p) {
    for (let i = 0; i < g.y.length - 1; i++) {
        if ((g.y[i] - p) * (g.y[i + 1] - p) <= 0) return g.x[i] + (g.x[i + 1] - g.x[i]) * (p - g.y[i]) / (g.y[i + 1] - g.y[i])
    }
    return null
}

// Plots built by updateGraphic(): { graph, graphBasic }
function plots(inputs) {
    calls.length = 0
    updateGraphic(...ARG_ORDER.map(k => inputs[k]), {})
    return Object.fromEntries(calls.map(c => [c.id, c]))
}
const names = plot => plot.data.map(t => t.name ?? '')
const has = (plot, re) => names(plot).some(n => re.test(n))

test('Total curve: each component with its own plateau, horizontal at the sum of all p_max', () => {
    const { obj } = run(FALL_B)
    const { shotcrete, bolts } = obj.supportComponents
    const u_end = obj.groundCurve.x[0]
    for (const c of [shotcrete, bolts]) {
        assert.equal(c.x[c.x.length - 1], u_end)
        assert.equal(c.y[c.y.length - 1], c.y[c.y.length - 2])
    }
    const sc = obj.supportCurve
    const p_sum = shotcrete.y[shotcrete.y.length - 1] + bolts.y[bolts.y.length - 1]
    assert.equal(sc.x[sc.x.length - 1], u_end)
    assert.ok(Math.abs(sc.y[sc.y.length - 1] - p_sum) < 1e-12)
    assert.ok(Math.abs(sc.y[sc.y.length - 2] - p_sum) < 1e-12)
})

test('Fall A: equilibrium with shotcrete and bolts on their plateau, FS (total) 1.00', () => {
    const { obj, intersection, safetyFactor } = run(FALL_A)
    const p_sum = 0.6725206611570265 + 0.173
    assert.ok(Math.abs(intersection.y - p_sum) < 1e-9)
    assert.ok(Math.abs(intersection.x - groundU(obj.groundCurve, p_sum)) < 1e-6)
    assert.equal(Number(safetyFactor), 1)
    assert.deepEqual(obj.yielding, { shotcrete: true, bolts: true })
    assert.ok(Math.abs(obj.lsc.FS_shotcrete - 1) < 1e-12 && Math.abs(obj.lsc.boltUtilisation - 1) < 1e-12)
    const { graph, graphBasic } = plots(FALL_A)
    for (const plot of [graph, graphBasic]) assert.ok(has(plot, /^shotcrete yielding$/) && has(plot, /^bolts yielding$/))
})

test('Fall B: shotcrete on its plateau, bolts rising (FS 1.042, FS (shotcrete) 1.00, bolts 80 %)', () => {
    const { obj, intersection, safetyFactor } = run(FALL_B)
    const { shotcrete, bolts } = obj.supportComponents
    const p_max_spc = shotcrete.y[shotcrete.y.length - 1]
    const K_b = bolts.y[1] / (bolts.x[1] - bolts.x[0])
    // on the segment where only the bolts rise: p = p_max,SpC + K_b (u - u_io), equal to the ground
    assert.ok(intersection.x > shotcrete.x[shotcrete.x.length - 2] && intersection.x < bolts.x[1])
    assert.ok(Math.abs(intersection.y - (p_max_spc + K_b * (intersection.x - bolts.x[0]))) < 1e-12)
    assert.ok(Math.abs(groundAt(obj.groundCurve, intersection.x) - intersection.y) < 1e-6)
    assert.equal(Number(safetyFactor), Number(((p_max_spc + bolts.y[1]) / intersection.y).toFixed(3)))
    assert.equal(Number(safetyFactor), 1.042)
    assert.ok(Math.abs(obj.lsc.FS_shotcrete - 1) < 1e-12)
    assert.equal(Number(obj.lsc.boltUtilisation.toFixed(2)), 0.80)
    assert.deepEqual(obj.yielding, { shotcrete: true, bolts: false })
    const { graph } = plots(FALL_B)
    assert.ok(has(graph, /^shotcrete yielding$/) && !has(graph, /^bolts yielding$/))
    assert.equal(graph.layout.annotations, undefined)
})

// RocSupport (shotcrete only): u_eq 81.76 mm, FS 0.64. RocSupport extends the elastic support line
// to the ground curve when the support yields and gives FS = p_max / p there; the app (Hoek Gl. 13)
// uses the equilibrium on the plateau: FS = p_max / p_eq = 1.
test('RocSupport comparison, shotcrete only: u_eq 81.76 mm; FS 1.00 (app) vs 0.64 (RocSupport rule)', () => {
    const { obj, intersection, safetyFactor } = run(ROC_SPC)
    assert.equal(obj.supportComponents, null)
    assert.ok(Math.abs(intersection.x * 1000 - 81.76) <= 0.005, `u_eq ${intersection.x * 1000} mm`)
    assert.equal(Number(safetyFactor), 1)
    assert.deepEqual(obj.yielding, { shotcrete: true, bolts: null })
    // RocSupport rule, computed independently: elastic line p = K (u - u_io) extended to the ground
    const [u_io, u_top] = obj.supportCurve.x
    const p_max = obj.supportCurve.y[1]
    const K = p_max / (u_top - u_io)
    const g = obj.groundCurve
    let p_ext = null
    for (let i = 0; i < g.x.length - 1 && p_ext === null; i++) {
        const f0 = g.y[i] - K * (g.x[i] - u_io), f1 = g.y[i + 1] - K * (g.x[i + 1] - u_io)
        if (f0 * f1 <= 0) p_ext = g.y[i] + (g.y[i + 1] - g.y[i]) * f0 / (f0 - f1)
    }
    assert.ok(Math.abs(p_max / p_ext - 0.64) <= 0.005, `RocSupport rule FS ${p_max / p_ext}`)
    console.table([{ u_eq_mm: intersection.x * 1000, FS_app: Number(safetyFactor), p_ext, FS_rocsupport_rule: p_max / p_ext }])
    const { graph, graphBasic } = plots(ROC_SPC)
    for (const plot of [graph, graphBasic]) assert.ok(has(plot, /^shotcrete yielding$/))
})

// RocSupport (shotcrete + bolts): u_eq 86.89 mm, FS 1.92 with another combination rule; for
// information only, the app values are a regression baseline.
test('RocSupport comparison, shotcrete + bolts: app u_eq 76.22 mm, FS 1.322 (different rule)', () => {
    const { obj, intersection, safetyFactor } = run(ROC_SPC_BOLTS)
    assert.equal(Number((intersection.x * 1000).toFixed(2)), 76.22)
    assert.equal(Number(safetyFactor), 1.322)
    assert.ok(Math.abs(obj.lsc.FS_shotcrete - 1) < 1e-12)
    assert.deepEqual(obj.yielding, { shotcrete: true, bolts: false })
})

// App defaults: equilibrium on the elastic part of both supports, FS (total) = sum of all p_max / p_eq
test('Without LSC: equilibrium on the summed elastic line, FS (total) = sum of p_max / p_eq', () => {
    const { obj, intersection, safetyFactor } = run({})
    const { shotcrete, bolts } = obj.supportComponents
    assert.ok(intersection.x < shotcrete.x[1] && intersection.x < bolts.x[1])
    const p_sum = shotcrete.y[1] + bolts.y[1]
    assert.equal(Number(safetyFactor), Number((p_sum / intersection.y).toFixed(3)))
    assert.deepEqual(obj.yielding, { shotcrete: false, bolts: false })
    assert.ok(!has(plots({}).graph, /yielding/))
})

// "no equilibrium" only if the ground curve lies above the total curve over its whole length; with
// unlimited plateaus that leaves practically only the case without any support
test('No support at all: message instead of empty plots, FS shown as "–"', () => {
    const inputs = { ...ROC_SPC, t_c: 0, t_bf: 0 }
    const { obj, intersection, safetyFactor } = run(inputs)
    assert.deepEqual(intersection, { x: [], y: [] })
    assert.equal(safetyFactor, 0)
    assert.equal(obj.noEquilibrium, 'capacity')
    const { graph, graphBasic } = plots(inputs)
    for (const plot of [graph, graphBasic]) assert.ok(names(plot).includes('FS. –'))
    assert.deepEqual(graph.layout.annotations.map(a => a.text), Array(4).fill(NO_CAPACITY))
    assert.deepEqual(graphBasic.layout.annotations.map(a => a.text), [NO_CAPACITY])
    for (const hidden of ['New LDP', 'Stress (actual)', 'μ_SpC [%]', 'Design limit (80%)']) {
        assert.ok(!names(graph).includes(hidden), hidden)
    }
    for (const shown of ['Org. LDP', 'Stress (target)']) assert.ok(names(graph).includes(shown), shown)
})
