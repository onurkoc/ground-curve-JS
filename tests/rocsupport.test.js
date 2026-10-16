// RocSupport Verification Manual, Problem 5 (Duncan-Fama): plastic radius r_pm for p_i = 0.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { run } from './helpers.js'

// D = 2 m, E = 10000 MPa, nu = 0.2, phi = 30°. p0 = gamma*H with gamma = 20 kN/m³.
const BASE = { D: 2, E: 10000, nu: 0.2, phi: 30, gamma: 20 }
const CASES = [
    // c [kPa], p0 [kPa], r_pm target [m]
    [3450, 30000, 1.74],
    [3450, 20000, 1.47],
    [5000, 30000, 1.49],
    [5000, 20000, 1.29]
]
// Source gives two decimals: tolerance half a unit (0.005 m). The additional 1e-5 m only absorbs
// floating-point noise at the rounding boundary (case 1: app 1.734998 m vs. 1.74 m).
const TOL = 0.005 + 1e-5

test('RocSupport Problem 5: plastic radius (Duncan-Fama)', () => {
    const rows = CASES.map(([c, p0, target]) => {
        const { obj } = run({ ...BASE, c, H: p0 / BASE.gamma })
        const value = obj.plasticRadius.y[0]
        return { c_MPa: c / 1000, p0_MPa: p0 / 1000, target, app: Number(value.toFixed(6)), dev: Number((value - target).toFixed(6)), ok: Math.abs(value - target) <= TOL }
    })
    console.table(rows)
    for (const r of rows) assert.ok(r.ok, `c ${r.c_MPa} MPa, p0 ${r.p0_MPa} MPa: target ${r.target}, app ${r.app}`)
})
