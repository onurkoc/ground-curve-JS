// Rheological shotcrete functions of the Flow-Rate Method against Entfellner (2024), Diss. TU Graz,
// Kap. 6.4.4.3, S. 136-138, Gl. 6.14-6.17, Tab. 6.4, Abb. 6.16 (references/Diss.-Entfellner.pdf).
// Target values are read from Abb. 6.16; tolerances follow the reading accuracy of the plots.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RHEOLOGY, viscousStrain, shrinkageStrain, temperatureStrain } from '../src/physics/groundCurveCalc.js'

const near = (value, target, tol, what) =>
    assert.ok(Math.abs(value - target) <= tol, `${what}: ${value} vs. ${target} ± ${tol}`)

test('Tab. 6.4: rheological parameters', () => {
    assert.deepEqual(RHEOLOGY, { A: 0.000045, B: 10, Q: 0.000100, C_d_inf: 0.000090, eps_sh_inf: 0.001250 })
})

// Abb. 6.16 a: A = 0.000045, t1 = 3.6 h; at 28 d the curve ends at about 0.00023 MPa⁻¹
// (y grid 0.0001, reading ± 0.00001)
test('Abb. 6.16 a: viscous strain C(28 d) ≈ 0.00023 MPa⁻¹ (Gl. 6.14, t1 = 3.6 h)', () => {
    const C = viscousStrain(28 * 24, 3.6)
    near(C, 0.00023, 0.00001, 'C(28 d)')
    // the app uses t1 = 0: same formula, C(28 d) only slightly higher
    assert.ok(viscousStrain(28 * 24) > C && viscousStrain(28 * 24) - C < 0.000001)
})

// Abb. 6.16 c: ε_sh,∞ = 0.00125, B = 10 d; at 28 d about 0.00092 (y grid 0.0004, reading ± 0.00002)
test('Abb. 6.16 c: shrinkage strain ε_sh(28 d) ≈ 0.00092 (Gl. 6.16)', () => {
    near(shrinkageStrain(28), 0.00092, 0.00002, 'ε_sh(28 d)')
    assert.equal(shrinkageStrain(0), 0)
})

// Abb. 6.16 d: maximum ≈ 60·10⁻⁶ at ≈ 0.25-0.3 d, ≈ 0 at 4 d (y grid 20·10⁻⁶, reading ± 2·10⁻⁶)
test('Abb. 6.16 d: temperature strain maximum ≈ 60·10⁻⁶ at 0.25-0.3 d, ≈ 0 at 4 d (Gl. 6.17)', () => {
    let tMax = 0, eMax = 0
    for (let t = 0; t <= 4; t += 0.001) {
        const e = temperatureStrain(t)
        if (e > eMax) { eMax = e; tMax = t }
    }
    near(eMax, 60e-6, 2e-6, 'ε_t,max')
    assert.ok(tMax >= 0.25 && tMax <= 0.3, `t(ε_t,max) = ${tMax} d`)
    near(temperatureStrain(4), 0, 2e-6, 'ε_t(4 d)')
    // Gl. 6.17 in hours with the factor 113, angle in degrees, gives the same curve; the app's factor
    // 250 for days is 113 · 24^0.25 = 250.1 rounded (difference < 0.1·10⁻⁶)
    for (const tDays of [0.1, 0.27, 1, 2, 3.5]) {
        const h = tDays * 24
        const e113 = (-Math.cos(h ** 0.25 * 113 * Math.PI / 180) + 1) * 30e-6
        near(temperatureStrain(tDays), e113, 0.1e-6, `ε_t(${tDays} d), 113 · t_h^0.25`)
    }
})
