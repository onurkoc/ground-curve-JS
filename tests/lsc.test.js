// Single-stage LSC after Gschwandtner (2010), Masterarbeit Montanuniversität Leoben:
// Kap. V-4.1.5 (Stauchelemente), Anhang B 2.6/2.7 (parameters), Anhang D Gl. 2-10 D (p_i = F / r_m).
// Only source-based values are checked here. Equilibrium values for F_LSC > 0 are a regression
// baseline from the app itself (tests/golden/lscForce*.json, lscLongPlateau.json), not source values.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run, DEFAULTS } from './helpers.js'

// Anhang B: r_0 5,50 m (D 11 m), γ 25 kN/m³, overburden 200 m, c 0,382 MPa, φ 27,35°, E 846 MPa,
// ν 0,35; shotcrete β 25 MPa, E 15000 MPa, ν 0,2, d 0,15 m; LSC stage 1: F 600 kN, l 70 mm.
// Anhang B gives no installation distance; d_face 2 m is used (does not affect the checked values).
const ANHANG_B = {
    gamma: 25, H: 200, D: 11, c: 382, phi: 27.35, E: 846, nu: 0.35,
    f_ck: 25, E_c: 15000, nu_c: 0.2, t_c: 0.15, dis_sup: 2, advance_rate: 2,
    t_bf: 0, s_l: 1, s_r: 1, d_b: 0.02, l_b: 10,
    l_yield: 7, F_LSC: 600
}

test('Anhang B: p_LSC, yield path and p_max (source values)', () => {
    const { obj } = run(ANHANG_B)
    const [u_io, u_lsc, u_end, u_top] = obj.supportCurve.x
    const [y0, y1, y2, y3] = obj.supportCurve.y
    const rows = [
        // key, target, tolerance (half a unit of the last given digit), app value
        ['p_LSC = F/r_m [MPa]', 0.1106, 0.00005, obj.lsc.p_LSC],
        ['Δu = 70 mm / 2π [mm]', 11.14, 0.005, (u_end - u_lsc) * 1000],
        ['p_max [MPa]', 0.6725, 0.00005, y3]
    ].map(([key, target, tol, app]) => ({ key, target, app: Number(app.toPrecision(6)), dev: Number((app - target).toPrecision(3)), tol, ok: Math.abs(app - target) <= tol }))
    console.table(rows)
    for (const r of rows) assert.ok(r.ok, `${r.key}: target ${r.target}, app ${r.app}`)

    // Shape: [u_io, 0] -> [u_io + p_LSC/K, p_LSC] -> [+ Δu, p_LSC] -> [u_iy + Δu, p_max]
    assert.equal(y0, 0)
    assert.equal(y1, obj.lsc.p_LSC)
    assert.equal(y2, obj.lsc.p_LSC)
    assert.ok(u_io < u_lsc && u_lsc < u_end && u_end < u_top)
    const K = (y3 - y2) / (u_top - u_end)
    assert.ok(Math.abs((y1 - y0) / (u_lsc - u_io) - K) / K < 1e-9, 'same stiffness before and after the plateau')
})

test('F_LSC = 0 keeps the open-slot curve', () => {
    const { obj } = run({ ...DEFAULTS, l_yield: 20, F_LSC: 0 })
    assert.equal(obj.supportCurve.x.length, 4)
    assert.deepEqual(obj.supportCurve.y.slice(0, 2), [0, 0])
    assert.equal(obj.lsc.inPlateau, false)
})

test('Equilibrium on the LSC plateau: FS (shotcrete) and remaining yield path', () => {
    const { obj, intersection, safetyFactor } = run({ ...DEFAULTS, t_bf: 0, l_yield: 20, F_LSC: 2400 })
    const { lsc } = obj
    assert.equal(lsc.inPlateau, true)
    assert.ok(Math.abs(intersection.y - lsc.p_LSC) < 1e-9)
    const p_max = obj.supportCurve.y[3]
    assert.ok(Math.abs(lsc.FS_shotcrete - p_max / lsc.p_LSC) < 1e-12)
    assert.ok(Math.abs(Number(safetyFactor) - lsc.FS_shotcrete) < 0.001)
    const expected = (obj.supportCurve.x[2] - intersection.x) * 2 * Math.PI * 1000
    assert.ok(lsc.remainingYieldPath > 0 && Math.abs(lsc.remainingYieldPath - expected) < 1e-9)
    console.table([{ F_LSC: 2400, p_LSC: lsc.p_LSC, u_eq: intersection.x, FS_shotcrete: lsc.FS_shotcrete, remainingYieldPath_mm: lsc.remainingYieldPath }])
})

test('F_LSC at or above the lining capacity: element never yields, no gap', () => {
    const { obj } = run({ ...DEFAULTS, t_bf: 0, l_yield: 20, F_LSC: 10000 })
    assert.equal(obj.lsc.u_gap, 0)
    assert.equal(obj.supportCurve.x.length, 5)
})
