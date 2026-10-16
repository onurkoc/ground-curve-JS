// Equilibrium edge cases with LSC (D 11 m, shotcrete and bolts after Gschwandtner Anhang B):
//   Fall A: support capacity below the ground pressure -> no equilibrium
//   Fall B: equilibrium after the shotcrete has reached p_max,SpC, bolts still rising
// Values are a regression baseline from the app itself, the "no crossing" check is independent.
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
const NO_EQ = 'no equilibrium – support capacity insufficient'
const LIMIT = 'shotcrete at p_max (plastic) – limit state'

// Ground curve pressure at displacement u (ground curve: p ascending, u descending)
function groundAt(g, u) {
    for (let i = 0; i < g.x.length - 1; i++) {
        if ((g.x[i] - u) * (g.x[i + 1] - u) <= 0) return g.y[i] + (g.y[i + 1] - g.y[i]) * (u - g.x[i]) / (g.x[i + 1] - g.x[i])
    }
    return null
}

// Plots built by updateGraphic(): { graph, graphBasic }
function plots(inputs) {
    calls.length = 0
    updateGraphic(...ARG_ORDER.map(k => inputs[k]), {})
    return Object.fromEntries(calls.map(c => [c.id, c]))
}
const names = plot => plot.data.map(t => t.name)

test('Fall A: no crossing, the support capacity is below the ground pressure', () => {
    const { obj, intersection, safetyFactor } = run(FALL_A)
    assert.deepEqual(intersection, { x: [], y: [] })
    assert.equal(safetyFactor, 0)
    assert.ok(!obj.LDP && !obj.actualStress && !obj.utilisationSpC)
    // Independent: at every break point of the support curve (without the flat display end piece)
    // the ground pressure is higher, and the ground only falls to p_max,total beyond the curve
    const sc = obj.supportCurve
    const p_max_total = sc.y[sc.y.length - 1]
    sc.x.slice(0, -1).forEach((u, i) => assert.ok(groundAt(obj.groundCurve, u) > sc.y[i], `u ${u}`))
    assert.ok(Math.abs(p_max_total - (0.6725206611570265 + 0.173)) < 1e-12)
    console.table([{ p_max_total, u_end: sc.x[sc.x.length - 2], p_ground_at_u_end: groundAt(obj.groundCurve, sc.x[sc.x.length - 2]) }])
})

test('Fall A: message instead of empty plots, FS shown as "–"', () => {
    const { graph, graphBasic } = plots(FALL_A)
    for (const plot of [graph, graphBasic]) assert.ok(names(plot).includes('FS (total) = –'))
    // GRC, LDP, μ_SpC and stress panels carry the message; the Basic GRC as well
    assert.deepEqual(graph.layout.annotations.map(a => a.text), [NO_EQ, NO_EQ, NO_EQ, NO_EQ])
    assert.deepEqual(graph.layout.annotations.map(a => a.yref), ['y domain', 'y2 domain', 'y3 domain', 'y4 domain'])
    assert.deepEqual(graphBasic.layout.annotations.map(a => a.text), [NO_EQ])
    for (const hidden of ['New LDP', 'Stress (actual)', 'μ_SpC [%]', 'Org. LDP', 'Stress (target)']) {
        assert.ok(!names(graph).includes(hidden), hidden)
    }
})

test('Fall B: equilibrium after p_max,SpC is found on the rising bolt segment, FS (shotcrete) = 1', () => {
    const { obj, intersection, safetyFactor } = run(FALL_B)
    const { shotcrete, bolts } = obj.supportComponents
    const p_max_spc = shotcrete.y[shotcrete.y.length - 1]
    const u_spc_top = shotcrete.x[shotcrete.x.length - 1], u_bolt_top = bolts.x[1]
    // on the segment where only the bolts still rise, not on the flat display end piece
    assert.ok(intersection.x > u_spc_top && intersection.x < u_bolt_top)
    const p_bolt = bolts.y[1] * (intersection.x - bolts.x[0]) / (u_bolt_top - bolts.x[0])
    assert.ok(Math.abs(intersection.y - (p_max_spc + p_bolt)) < 1e-12)
    assert.equal(obj.lsc.FS_shotcrete, 1)
    assert.ok(Math.abs(obj.lsc.boltUtilisation - p_bolt / bolts.y[1]) < 1e-12)
    assert.ok(obj.lsc.boltUtilisation < 1)
    assert.equal(Number(safetyFactor), 1.042)
})

test('Fall B: legend and Basic tab flag the shotcrete limit state; not on the LSC plateau (case C)', () => {
    const { graph, graphBasic } = plots(FALL_B)
    for (const plot of [graph, graphBasic]) assert.ok(names(plot).includes(LIMIT))
    assert.equal(graph.layout.annotations, undefined)
    const caseC = plots({ ...FALL_A, D: 8, f_ck: 30, E_c: 31000, t_c: 0.2, l_yield: 20, F_LSC: 2400, t_bf: 250, s_l: 2, s_r: 1.5, d_b: 0.034, l_b: 3 })
    assert.ok(!names(caseC.graph).includes(LIMIT))
})
