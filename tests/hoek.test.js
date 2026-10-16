// Hoek, E.: Support for very weak rock associated with faults and shear zones /
// "Rock-Support Interaction" (Practical Rock Engineering), Fig. 4, 6, 7, 13.
// Elastic 28-day support curve only; rate-of-flow / Aldrian results are not checked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as helpers from './helpers.js'
const { hoekMetrics } = helpers

// D = 10 m, c = 1500 kPa, phi = 23°, E = 1800 MPa, nu = 0.3,
// p0 = gamma*H = 20 kN/m³ * 350 m = 7000 kPa = 7 MPa, support at 5 m behind face, no LSC.
const GROUND = { gamma: 20, H: 350, D: 10, c: 1500, phi: 23, E: 1800, nu: 0.3, dis_sup: 5, l_yield: 0, advance_rate: 2 }
const SHOTCRETE = { ...GROUND, t_c: 0.3, f_ck: 35, E_c: 30000, nu_c: 0.2, t_bf: 0, s_l: 1, s_r: 1, d_b: 0.034, l_b: 3 }
const BOLTS = { ...GROUND, t_c: 0, f_ck: 35, E_c: 30000, nu_c: 0.2, t_bf: 354, s_l: 1, s_r: 1, d_b: 0.034, l_b: 3 }

// [key, target, tolerance, note]. Tolerance = half a unit of the last digit given by the source,
// unless noted otherwise.
const GROUND_CHECKS = [
    ['sigma_cm', 4.53, 0.005, 'MPa'],
    ['k', 2.28, 0.005, '-'],
    ['p_cr', 2.88, 0.005, 'MPa'],
    ['u_im', 0.0427, 0.00005, 'm'],
    ['rpm_r0', 1.592, 0.0005, '-'],
    ['u_if', 0.011197, 0.0000005, 'm'],
    // Hoek divides by the rounded u_im = 0.0427 m: the rounding of u_im (±0.00005 m, ±0.12 %)
    // propagates into the ratio, so the tolerance is 0.12 % of 0.2622.
    ['u_if_u_im', 0.2622, 0.2622 * 0.00005 / 0.0427 + 0.00005, '-'],
    ['u_io', 0.0304, 0.00005, 'm']
]
const SHOTCRETE_CHECKS = [
    ['p_max', 2.037, 0.0005, 'MPa'],
    ['K', 387, 0.5, 'MPa/m'],
    ['u_iy', 0.03565, 0.000005, 'm'],
    ['FS', 3.4, 0.05, '-']           // "ca. 3.4"
]
const BOLT_CHECKS = [
    ['p_max', 0.354, 0.0005, 'MPa'],
    ['K', 63, 0.5, 'MPa/m'],
    ['u_iy', 0.03604, 0.000005, 'm'],
    ['FS', 1.0, 0.05, '-']           // "ca. 1.0"
]

function check(name, metrics, checks) {
    const rows = checks.map(([key, target, tol, unit]) => {
        const value = metrics[key]
        return { case: name, key, unit, target, app: Number(value.toPrecision(6)), dev: Number((value - target).toPrecision(3)), devPct: Number(((value - target) / target * 100).toFixed(3)), tol, ok: Math.abs(value - target) <= tol }
    })
    console.table(rows)
    for (const r of rows) assert.ok(r.ok, `${name} ${r.key}: target ${r.target}, app ${r.app}, deviation ${r.dev} > tolerance ${r.tol}`)
}

test('Hoek ground reaction curve and LDP (Fig. 4, 6, 7)', () => {
    check('ground', hoekMetrics(SHOTCRETE), GROUND_CHECKS)
})

test('Hoek shotcrete only, t_bf = 0 (Fig. 13)', () => {
    check('shotcrete', hoekMetrics(SHOTCRETE), SHOTCRETE_CHECKS)
})

test('Hoek rock bolts only, t_c = 0 (Fig. 13)', () => {
    check('bolts', hoekMetrics(BOLTS), BOLT_CHECKS)
})

// Formerly a known limitation: the intersection search started at 10 % of p_max, so an
// equilibrium with FS > 10 was missed (FS = 0). The search now starts at index 0.
// Case: Hoek ground + shotcrete, but support installed 12 m behind the face.
test('Equilibrium below 10 % of p_max is found (FS > 10, support at 12 m)', () => {
    const inputs = { ...SHOTCRETE, dis_sup: 12 }
    const { run } = helpers
    const { obj, intersection, safetyFactor } = run(inputs)

    // Independent check: intersect the full elastic support line from (u_io, 0) to (u_iy, p_max)
    // with the ground curve. An equilibrium exists, below 10 % of p_max.
    const [u_io, , , u_iy] = obj.supportCurve.x
    const p_max = obj.supportCurve.y[3]
    const K = p_max / (u_iy - u_io)
    const gx = obj.groundCurve.x, gy = obj.groundCurve.y     // p ascending, u descending
    let p_eq = null
    for (let i = 0; i < gx.length - 1; i++) {
        const f0 = gy[i] - K * (gx[i] - u_io), f1 = gy[i + 1] - K * (gx[i + 1] - u_io)
        if (f0 <= 0 && f1 >= 0) { p_eq = gy[i] + (gy[i + 1] - gy[i]) * (-f0) / (f1 - f0); break }
    }
    console.table([{ dis_sup: 12, u_io, p_max, K, p_eq, FS_independent: p_max / p_eq, app_p_eq: intersection.y, app_FS: Number(safetyFactor) }])
    assert.ok(p_eq > 0 && p_eq < 0.1 * p_max)
    assert.ok(p_max / p_eq > 10)
    // App and independent check agree within the ground-curve discretisation (10 000 points)
    assert.ok(Math.abs(intersection.y - p_eq) / p_eq < 1e-3, `app p_eq ${intersection.y} vs. ${p_eq}`)
    assert.ok(Number(safetyFactor) > 10)
})
