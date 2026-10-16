import { groundCurve } from '../src/physics/groundCurveCalc.js'

// Argument order of groundCurve()
export const ARG_ORDER = ['gamma', 'H', 'nu', 'E', 'D', 'c', 'phi', 'f_ck', 'E_c', 'nu_c', 't_c',
    'dis_sup', 'advance_rate', 't_bf', 's_l', 's_r', 'd_b', 'l_b', 'l_yield']

// App default inputs (src/App.vue)
export const DEFAULTS = {
    gamma: 20, H: 500, nu: 0.30, E: 1050, c: 1000, phi: 28, D: 8,
    f_ck: 30, E_c: 31000, nu_c: 0.2, t_c: 0.2, dis_sup: 2, advance_rate: 2, l_yield: 0,
    t_bf: 250, s_l: 2, s_r: 1.5, d_b: 0.034, l_b: 3
}

export function run(inputs) {
    const p = { ...DEFAULTS, ...inputs }
    const [obj, intersection, safetyFactor] = groundCurve(...ARG_ORDER.map(k => p[k]))
    return { obj, intersection, safetyFactor }
}

// sigma_cm and k are not exported by groundCurve(). Recover them from the exported
// p_cr and r_pm by solving p_cr = (2 p_o - sigma_cm)/(1+k) together with
// r_pm/r_o = [2 (p_o (k-1) + sigma_cm) / ((1+k) sigma_cm)]^(1/(k-1)) for k (bisection).
export function backSolveStrength(p_o, p_cr, rpmRatio) {
    const f = k => {
        const s = 2 * p_o - p_cr * (1 + k)
        return (2 * (p_o * (k - 1) + s) / ((1 + k) * s)) ** (1 / (k - 1)) - rpmRatio
    }
    let lo = 1.0001, hi = Math.min(20, 2 * p_o / p_cr - 1 - 1e-9)
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2
        if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid; else hi = mid
    }
    const k = (lo + hi) / 2
    return { k, sigma_cm: 2 * p_o - p_cr * (1 + k) }
}

// Derive the Hoek check quantities from the public output of groundCurve().
// Units: pressures MPa, displacements m, stiffness MPa/m.
export function hoekMetrics(inputs) {
    const { obj, intersection, safetyFactor } = run(inputs)
    const p_o = inputs.gamma * inputs.H / 1000
    const r_o = inputs.D / 2
    const p_cr = obj.criticalPoint.y[0]
    const r_pm = obj.plasticRadius.y[0]
    const u_im = obj.groundCurve.x[0]              // p_i = 0
    const u_if = obj.u_if.u_if
    const sc = obj.supportCurve                    // no LSC: [u_io, a, a, u_iy, 1.01 u_iy]
    const u_io = sc.x[0]
    const u_iy = sc.x[3]
    const p_max = sc.y[3]
    const K = p_max / (u_iy - u_io)
    const { k, sigma_cm } = backSolveStrength(p_o, p_cr, r_pm / r_o)
    return {
        sigma_cm, k, p_cr, u_im, rpm_r0: r_pm / r_o, u_if, u_if_u_im: u_if / u_im, u_io,
        p_max, K, u_iy, FS: Number(safetyFactor),
        p_eq: intersection.y, u_eq: intersection.x
    }
}
