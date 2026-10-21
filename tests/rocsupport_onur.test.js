// Comparison cases computed by Onur with RocSupport v4.005 (Duncan-Fama solution, dilation 0,
// LDP Vlachopoulos & Diederichs 2009): references/RocSupport/Nr.1-3/Dilatation_Null
// (Output_SS_*.png). Tolerance = half a unit of the last digit given by RocSupport, plus 1e-9 to
// absorb floating-point noise exactly at the rounding boundary.
// FS is taken unrounded as p_max / p_eq (the app string has three decimals).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run, ARG_ORDER } from './helpers.js'
import { updateGraphic } from '../src/physics/groundCurveCalc.js'
import { calls } from './stubs/plotly.js'

const FALL_1 = {
    D: 10, gamma: 20, H: 350, E: 1800, nu: 0.3, c: 1500, phi: 23, dis_sup: 5, advance_rate: 2,
    l_yield: 0, F_LSC: 0, t_c: 0.3, f_ck: 35, E_c: 30000, nu_c: 0.2,
    t_bf: 0, s_l: 1, s_r: 1, d_b: 0.034, l_b: 3
}
const FALL_2 = { ...FALL_1, t_c: 0, t_bf: 354 }
const FALL_3 = {
    D: 8, gamma: 20, H: 500, E: 1050, nu: 0.3, c: 1000, phi: 28, dis_sup: 2, advance_rate: 2,
    l_yield: 0, F_LSC: 0, t_c: 0.2, f_ck: 30, E_c: 31000, nu_c: 0.2,
    t_bf: 0, s_l: 2, s_r: 1.5, d_b: 0.034, l_b: 3
}

// App quantities in RocSupport units (mm, m, MPa)
function quantities(inputs) {
    const { obj, intersection } = run(inputs)
    const p_max = Math.max(...obj.supportCurve.y)
    return {
        u_unsupported_mm: obj.groundCurve.x[0] * 1000,
        u_face_mm: obj.u_if.u_if * 1000,
        u_io_mm: obj.supportCurve.x[0] * 1000,
        r_p_m: obj.plasticRadius.y[0],
        p_cr: obj.criticalPoint.y[0],
        p_max,
        u_eq_mm: intersection.x * 1000,
        p_eq: intersection.y,
        FS: p_max / intersection.y
    }
}

// [key, RocSupport value, decimals given by RocSupport]
function check(name, inputs, expected) {
    const q = quantities(inputs)
    const rows = expected.map(([key, target, decimals]) => {
        const tol = 0.5 * 10 ** -decimals + 1e-9
        const app = q[key]
        return { case: name, key, rocsupport: target, app: Number(app.toPrecision(6)), dev: Number((app - target).toPrecision(3)), tol, ok: Math.abs(app - target) <= tol }
    })
    console.table(rows)
    for (const r of rows) assert.ok(r.ok, `${name} ${r.key}: RocSupport ${r.rocsupport}, app ${r.app}`)
}

test('RocSupport Fall 1 (Nr.1, shotcrete): D 10 m, p0 7 MPa, d_face 5 m', () => {
    check('Fall 1', FALL_1, [
        ['u_unsupported_mm', 42.65, 2], ['u_face_mm', 11.2, 1], ['u_io_mm', 30.39, 2],
        ['r_p_m', 7.96, 2], ['p_cr', 2.88, 2], ['p_max', 2.037, 3],
        ['u_eq_mm', 31.96, 2], ['p_eq', 0.61, 2], ['FS', 3.35, 2]
    ])
})

test('RocSupport Fall 2 (Nr.2, rock bolts): as Fall 1 with T_bf 354 kN, no shotcrete', () => {
    check('Fall 2', FALL_2, [
        ['p_max', 0.354, 3], ['u_eq_mm', 35.95, 2], ['p_eq', 0.35, 2], ['FS', 1.02, 2]
    ])
})

test('RocSupport Fall 3 (Nr.3, shotcrete): D 8 m, p0 10 MPa, d_face 2 m (app defaults without bolts)', () => {
    check('Fall 3', FALL_3, [
        ['u_face_mm', 32.66, 2], ['u_io_mm', 63.94, 2], ['r_p_m', 7.92, 2], ['p_max', 1.463, 3],
        ['u_eq_mm', 67.03, 2], ['p_eq', 1.28, 2], ['FS', 1.14, 2]
    ])
})

// Basic legend and hover at the equilibrium show the RocSupport output quantities (mm, 2 decimals)
test('RocSupport Fall 3: Basic legend u_face 32.66 / u_support 63.94 / u_final 67.03 mm, FS 1.14; full hover', () => {
    calls.length = 0
    updateGraphic(...ARG_ORDER.map(k => FALL_3[k]), {})
    const basic = calls.find(c => c.id === 'graphBasic')
    const names = basic.data.map(t => t.name ?? '')
    for (const entry of ['u_face: 32.66 mm', 'u_support: 63.94 mm', 'u_final: 67.03 mm', 'p_eq: 1.28 MPa']) {
        assert.ok(names.includes(entry), `${entry} in ${JSON.stringify(names)}`)
    }
    assert.ok(names.some(n => /FS\. 1\.14/.test(n)), 'FS 1.14')
    // hover target at the equilibrium (invisible, first trace) with the full values; the legend marker
    // itself does not hover
    const eq = basic.data.find(t => t.name === 'equilibrium')
    assert.equal(basic.data.indexOf(eq), 0)
    assert.equal(basic.data.find(t => /FS\. 1\.14/.test(t.name ?? '')).hoverinfo, 'skip')
    assert.equal(eq.hovertemplate, 'u_eq = 67.03 mm<br>p_eq = 1.282 MPa<br>FS = 1.14<extra></extra>')
    for (const c of calls) assert.equal(c.layout.hoverlabel.namelength, -1)
})
