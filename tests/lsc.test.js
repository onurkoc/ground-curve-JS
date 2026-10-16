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
    // (the curve is evaluated point by point when summed, so compare within round-off)
    assert.equal(y0, 0)
    assert.ok(Math.abs(y1 - obj.lsc.p_LSC) < 1e-12)
    assert.ok(Math.abs(y2 - obj.lsc.p_LSC) < 1e-12)
    assert.ok(u_io < u_lsc && u_lsc < u_end && u_end < u_top)
    const K = (y3 - y2) / (u_top - u_end)
    assert.ok(Math.abs((y1 - y0) / (u_lsc - u_io) - K) / K < 1e-9, 'same stiffness before and after the plateau')
})

test('F_LSC = 0 keeps the open-slot curve (shotcrete only)', () => {
    const { obj } = run({ ...DEFAULTS, t_bf: 0, l_yield: 20, F_LSC: 0 })
    assert.equal(obj.supportCurve.x.length, 4)
    assert.deepEqual(obj.supportCurve.y.slice(0, 2), [0, 0])
    assert.equal(obj.lsc.inPlateau, false)
})

// Gschwandtner Gl. V-50 / Abb. V-51: the bolt curve starts at u_io and is not shifted by the yield
// path; the support curve is the sum of shotcrete and bolt pressures at equal u.
test('Bolts act independently of the LSC yield path', () => {
    const inputs = { ...DEFAULTS, l_yield: 20, F_LSC: 2400 }
    const { obj } = run(inputs)
    const { shotcrete, bolts } = obj.supportComponents
    const u_io = obj.supportCurve.x[0]
    assert.equal(bolts.x[0], u_io)
    assert.equal(shotcrete.x[0], u_io)
    // p_max,bolt = T_bf / (s_l s_r), K_bolt = E_s π d_b² / (4 l_b s_l s_r)
    const p_bmax = inputs.t_bf / (1000 * inputs.s_l * inputs.s_r)
    const K_b = 207000 * Math.PI * inputs.d_b ** 2 / (4 * inputs.l_b * inputs.s_l * inputs.s_r)
    assert.ok(Math.abs(bolts.y[1] - p_bmax) < 1e-12)
    assert.ok(Math.abs(bolts.x[1] - (u_io + p_bmax / K_b)) < 1e-12)
    // Every break point of both curves is in the sum, and the sum adds the pressures
    for (const u of [...shotcrete.x, ...bolts.x]) assert.ok(obj.supportCurve.x.includes(u))
    const at = (c, u) => {
        if (u <= c.x[0]) return 0
        for (let i = 0; i < c.x.length - 1; i++) {
            if (u <= c.x[i + 1]) return c.y[i] + (c.y[i + 1] - c.y[i]) * (u - c.x[i]) / (c.x[i + 1] - c.x[i])
        }
        return c.y[c.y.length - 1]
    }
    obj.supportCurve.x.slice(0, -1).forEach((u, i) => {
        assert.ok(Math.abs(obj.supportCurve.y[i] - (at(shotcrete, u) + at(bolts, u))) < 1e-12)
    })
    // On the plateau: FS (shotcrete) = p_max,SpC / p_LSC, bolt utilisation = p_bolt(u_eq) / p_max,bolt
    const p_max_spc = shotcrete.y[shotcrete.y.length - 1]
    assert.equal(obj.lsc.inPlateau, true)
    assert.ok(Math.abs(obj.lsc.FS_shotcrete - p_max_spc / obj.lsc.p_LSC) < 1e-12)
    assert.ok(obj.lsc.boltUtilisation > 0 && obj.lsc.boltUtilisation <= 1)
})

// Gschwandtner S. 56: the shell rises elastically until the element yields (u_lsc = u_io + p_LSC/K),
// then carries the constant stress σ_N = F_LSC / t_c while the element yields.
test('Rate of flow: rise to u_lsc, constant σ_N = F_LSC / t_c during the yield path', () => {
    // Equilibrium on the plateau: rise from 0 (rate of flow, limited to σ_N), then σ_N to the end
    const plateau = run({ ...DEFAULTS, t_bf: 0, l_yield: 20, F_LSC: 2400 }).obj
    const sigma_N = 2400 / 1000 / DEFAULTS.t_c
    const p = plateau.actualStress.y
    const k = p.findIndex(v => Math.abs(v - sigma_N) < 1e-12)
    assert.ok(k > 1, 'elastic rise before the yield path')
    assert.equal(p[0], 0)
    p.slice(0, k).forEach((v, i) => assert.ok(v < sigma_N && (i === 0 || v >= p[i - 1]), `rise at ${i}: ${v}`))
    assert.ok(p.slice(k).every(v => Math.abs(v - sigma_N) < 1e-12))

    // Yield path used up before equilibrium: rise, σ_N over the yield path, then rate of flow
    // continues from σ_N (the shell is loaded further, no drop back towards 0)
    const { obj } = run({ ...DEFAULTS, t_bf: 0, l_yield: 20, F_LSC: 600 })
    const sN = 600 / 1000 / DEFAULTS.t_c
    const s = obj.actualStress.y
    const a = s.findIndex(v => Math.abs(v - sN) < 1e-12)
    const n = a + s.slice(a).findIndex(v => Math.abs(v - sN) > 1e-12)
    assert.ok(a > 1 && n > a && n < s.length)
    assert.ok(s.slice(0, a).every(v => v < sN))
    assert.ok(s[n] >= s[n - 1], `drop at end of yield path: ${s[n - 1]} -> ${s[n]}`)
    // rateOfFlow() returns σ = 0 for the first two points (as without LSC)
    assert.ok(s.slice(2).every(v => v > 0))
})

test('μ_SpC is not capped at 100 % (overloaded young shotcrete)', () => {
    const { obj } = run({ ...DEFAULTS, l_yield: 20, F_LSC: 2400 })
    const mu = obj.utilisationSpC.y
    assert.ok(Math.max(...mu) > 100)
    // once the shotcrete has gained strength the shell under σ_N = 12 MPa is below 100 % again
    assert.ok(mu.at(-1) < 100)
})

test('Shotcrete capacity decides whether the LSC yields (bolts not included)', () => {
    // p_LSC between p_max,SpC (1.4625 MPa) and p_max,SpC + p_max,bolt (1.5458 MPa): never yields
    const r_m = DEFAULTS.D / 2 - DEFAULTS.t_c / 2
    const { obj } = run({ ...DEFAULTS, l_yield: 20, F_LSC: 1.5 * 1000 * r_m })
    assert.equal(obj.lsc.u_gap, 0)
})

test('Equilibrium on the LSC plateau: FS (shotcrete) and remaining yield path', () => {
    const { obj, intersection, safetyFactor } = run({ ...DEFAULTS, t_bf: 0, l_yield: 20, F_LSC: 2400 })
    const { lsc } = obj
    assert.equal(lsc.inPlateau, true)
    assert.ok(Math.abs(intersection.y - lsc.p_LSC) < 1e-9)
    const p_max = obj.supportCurve.y[3]
    assert.ok(Math.abs(lsc.FS_shotcrete - p_max / lsc.p_LSC) < 1e-9)
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
