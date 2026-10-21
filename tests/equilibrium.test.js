// Equilibrium edge cases with LSC (D 11 m, shotcrete and bolts after Gschwandtner Anhang B).
// Decision (b): shotcrete reaching p_max,SpC fails, no equilibrium after it, not even with bolts.
//   Fall A: even the sum of all p_max is below the ground pressure -> "support capacity insufficient"
//   Fall B: bolts alone would reach the ground curve after p_max,SpC -> "shotcrete fails"
// The "no crossing" checks are independent of the app's intersection search.
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
const NO_CAPACITY = 'no equilibrium – support capacity insufficient'
const SPC_FAILS = 'no equilibrium – shotcrete fails (p_max reached)'

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

// Full sum of shotcrete and bolt pressure at u (both curves, bolts also beyond p_max,SpC)
function sumAt({ shotcrete, bolts }, u) {
    const at = c => {
        if (u <= c.x[0]) return 0
        for (let i = 0; i < c.x.length - 1; i++) {
            if (u <= c.x[i + 1]) return c.y[i] + (c.y[i + 1] - c.y[i]) * (u - c.x[i]) / (c.x[i + 1] - c.x[i])
        }
        return c.y[c.y.length - 1]
    }
    return at(shotcrete) + at(bolts)
}

test('Fall A: no crossing even with the sum of all p_max', () => {
    const { obj, intersection, safetyFactor } = run(FALL_A)
    assert.deepEqual(intersection, { x: [], y: [] })
    assert.equal(safetyFactor, 0)
    assert.equal(obj.noEquilibrium, 'capacity')
    assert.ok(!obj.LDP && !obj.actualStress && !obj.utilisationSpC)
    // Independent: at every break point of shotcrete and bolt curve the ground pressure is above the
    // full sum, and the ground only falls to the sum of all p_max beyond both curves
    const c = obj.supportComponents
    const u_all = Math.max(c.shotcrete.x[c.shotcrete.x.length - 1], c.bolts.x[1])
    for (const u of [...c.shotcrete.x, ...c.bolts.x]) assert.ok(groundAt(obj.groundCurve, u) > sumAt(c, u), `u ${u}`)
    const p_max_all = c.shotcrete.y[c.shotcrete.y.length - 1] + c.bolts.y[1]
    assert.ok(Math.abs(p_max_all - (0.6725206611570265 + 0.173)) < 1e-12)
    console.table([{ p_max_all, u_all, p_ground_at_u_all: groundAt(obj.groundCurve, u_all) }])
})

test('Fall A: message instead of empty plots, FS shown as "–"', () => {
    const { graph, graphBasic } = plots(FALL_A)
    for (const plot of [graph, graphBasic]) assert.ok(names(plot).includes('FS (total) = –'))
    // GRC, LDP, μ_SpC and stress panels carry the message; the Basic GRC as well
    assert.deepEqual(graph.layout.annotations.map(a => a.text), Array(4).fill(NO_CAPACITY))
    assert.deepEqual(graph.layout.annotations.map(a => a.yref), ['y domain', 'y2 domain', 'y3 domain', 'y4 domain'])
    assert.deepEqual(graphBasic.layout.annotations.map(a => a.text), [NO_CAPACITY])
    for (const hidden of ['New LDP', 'Stress (actual)', 'μ_SpC [%]', 'Design limit (80%)']) {
        assert.ok(!names(graph).includes(hidden), hidden)
    }
    assert.ok(!names(graph).some(n => /overloaded/.test(n ?? '')))
    // independent of the equilibrium: still shown
    for (const shown of ['Org. LDP', 'Stress (target)']) assert.ok(names(graph).includes(shown), shown)
})

test('Fall B: shotcrete reaches p_max before the ground curve, no equilibrium with the bolts', () => {
    const { obj, intersection, safetyFactor } = run(FALL_B)
    assert.deepEqual(intersection, { x: [], y: [] })
    assert.equal(safetyFactor, 0)
    assert.equal(obj.noEquilibrium, 'shotcrete')
    const c = obj.supportComponents
    const u_spc_top = c.shotcrete.x[c.shotcrete.x.length - 1]
    // The support curve ends at p_max,SpC (no horizontal end piece), below the ground pressure there
    const sc = obj.supportCurve
    assert.equal(sc.x[sc.x.length - 1], u_spc_top)
    assert.ok(sc.y[sc.y.length - 2] < sc.y[sc.y.length - 1])
    assert.ok(groundAt(obj.groundCurve, u_spc_top) > sumAt(c, u_spc_top))
    // With the bolts still rising the full sum would cross the ground curve before the bolts reach p_max
    assert.ok(groundAt(obj.groundCurve, c.bolts.x[1]) < sumAt(c, c.bolts.x[1]))
})

// Decision (a): separate curves also without LSC. Comparison case D 11 m, T_bf 400 kN, no LSC: the
// shotcrete reaches p_max,SpC long before the bolts (K_b 6.5 MPa/m vs K_SpC 78.6 MPa/m).
test('Without LSC: separate curves, shotcrete fails before the bolts help (comparison case)', () => {
    const inputs = { ...FALL_B, l_yield: 0, F_LSC: 0, t_bf: 400 }
    const { obj, intersection } = run(inputs)
    const c = obj.supportComponents
    assert.equal(c.shotcrete.x.length, 2)
    assert.equal(c.shotcrete.x[0], c.bolts.x[0])
    const p_spc = c.shotcrete.y[1], u_spc_top = c.shotcrete.x[1]
    const K_spc = p_spc / (u_spc_top - c.shotcrete.x[0])
    const K_b = 207000 * Math.PI * 0.02 ** 2 / (4 * 10 * 1 * 1)
    assert.ok(Math.abs(c.bolts.y[1] / (c.bolts.x[1] - c.bolts.x[0]) - K_b) < 1e-9)
    // support curve = sum up to p_max,SpC, no end piece
    const sc = obj.supportCurve
    assert.deepEqual(sc.x, [c.shotcrete.x[0], u_spc_top])
    const p_bolt_top = K_b * (u_spc_top - c.bolts.x[0])
    assert.ok(Math.abs(sc.y[1] - (p_spc + p_bolt_top)) < 1e-12)
    assert.ok(groundAt(obj.groundCurve, u_spc_top) > sc.y[1])
    assert.deepEqual(intersection, { x: [], y: [] })
    assert.equal(obj.noEquilibrium, 'shotcrete')
    console.table([{ K_spc, K_b, u_spc_top, p_spc, p_bolt_top, p_ground: groundAt(obj.groundCurve, u_spc_top) }])
})

// App defaults (shotcrete + bolts, no LSC): the shotcrete reaches p_max after 3.53 mm, the bolts only
// after 3.99 mm. Up to p_max,SpC the sum is the old combined line (K_SpC + K_b), so u_eq is unchanged;
// FS (total) refers to the pressure at p_max,SpC (bolts not yet at p_max: 1.5362 instead of 1.5458 MPa)
test('Without LSC: equilibrium on the summed curve, FS (total) from the pressure at p_max,SpC', () => {
    const { obj, intersection, safetyFactor } = run({})
    const c = obj.supportComponents
    const u_spc_top = c.shotcrete.x[1]
    assert.ok(c.bolts.x[1] > u_spc_top && intersection.x < u_spc_top)
    const p_top = c.shotcrete.y[1] + c.bolts.y[1] * (u_spc_top - c.bolts.x[0]) / (c.bolts.x[1] - c.bolts.x[0])
    assert.ok(Math.abs(obj.supportCurve.y[obj.supportCurve.y.length - 1] - p_top) < 1e-12)
    assert.equal(Number(safetyFactor), Number((p_top / intersection.y).toFixed(3)))
})

test('Fall B: message "shotcrete fails", no limit-state legend entry', () => {
    const { graph, graphBasic } = plots(FALL_B)
    assert.deepEqual(graph.layout.annotations.map(a => a.text), Array(4).fill(SPC_FAILS))
    assert.deepEqual(graphBasic.layout.annotations.map(a => a.text), [SPC_FAILS])
    for (const plot of [graph, graphBasic]) {
        assert.ok(names(plot).includes('FS (total) = –'))
        assert.ok(!names(plot).some(n => /limit state/.test(n ?? '')))
    }
})
