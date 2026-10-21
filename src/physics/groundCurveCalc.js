import Plotly from 'plotly.js-cartesian-dist'
import calc_n_m from '../n_m_acc_to_Vermeer.js'

// ─── Utilities ───────────────────────────────────────────────────────────────

function linspace(start, end, num) {
    if (num <= 0) return []
    if (num === 1) return [start]
    const step = (end - start) / (num - 1)
    return Array.from({ length: num }, (_, i) => i === num - 1 ? end : start + i * step)
}

function arange(start, end, step) {
    const n = Math.ceil((end - start) / step)
    return Array.from({ length: n }, (_, i) => start + i * step)
}

// Analytic inverse of the Vlachopoulos LDP: given wall displacement u_scl,
// returns distance from face x (negative = ahead of face).
function ldpInverse(u_scl, u_im, u_if, r_pm, r_o) {
    if (u_scl <= 0 || u_im <= 0 || u_if <= 0 || u_scl >= u_im) return null
    if (u_scl < u_if) {
        return r_o * Math.log(u_scl / u_if)
    }
    const ratio = (1 - u_scl / u_im) / (1 - u_if / u_im)
    if (ratio <= 0) return null
    return -2 * r_pm / 3 * Math.log(ratio)
}

// ─── Geometry helpers ────────────────────────────────────────────────────────

function findIntersection(array) {
    const P1 = array[0], P2 = array[1], P3 = array[2], P4 = array[3]
    const x = ((P1.x * P2.y - P2.x * P1.y) * (P3.x - P4.x) - (P1.x - P2.x) * (P3.x * P4.y - P3.y * P4.x)) /
        ((P1.x - P2.x) * (P3.y - P4.y) - (P1.y - P2.y) * (P3.x - P4.x))
    const y = ((P1.x * P2.y - P2.x * P1.y) * (P3.y - P4.y) - (P1.y - P2.y) * (P3.x * P4.y - P3.y * P4.x)) /
        ((P1.x - P2.x) * (P3.y - P4.y) - (P1.y - P2.y) * (P3.x - P4.x))
    return { x, y }
}

// EPS absorbs round-off of the computed intersection on horizontal or vertical segments
// (e.g. the LSC plateau, where a.y === b.y).
const EPS = 1e-12
function isPointBetween(p, a, b) {
    return Math.min(a.x, b.x) - EPS <= p.x && p.x <= Math.max(a.x, b.x) + EPS &&
        Math.min(a.y, b.y) - EPS <= p.y && p.y <= Math.max(a.y, b.y) + EPS
}

// Walk the support curve segment by segment and return the first crossing with the ground curve
// as [point, segmentIndex], or [false, -1].
function findCurveIntersection(groundCurve, supportCurve) {
    for (let s = 0; s < supportCurve.length - 1; s++) {
        const P3 = supportCurve[s], P4 = supportCurve[s + 1]
        // An open slot (p = 0 on both ends) carries no pressure: no support equilibrium there
        if (P3.y === 0 && P4.y === 0) continue
        const point = findSegmentIntersection(groundCurve, [P3, P4])
        if (point) return [point, s]
    }
    return [false, -1]
}

// Value of a piecewise-linear curve at u: 0 before the first point, constant after the last.
function curveAt(xs, ys, u) {
    if (u <= xs[0]) return 0
    for (let i = 0; i < xs.length - 1; i++) {
        if (u <= xs[i + 1]) {
            const dx = xs[i + 1] - xs[i]
            return dx > 0 ? ys[i] + (ys[i + 1] - ys[i]) * (u - xs[i]) / dx : ys[i + 1]
        }
    }
    return ys[ys.length - 1]
}

// Gschwandtner Gl. V-50 / Abb. V-51: pressures of support curves acting together add up at the
// same wall displacement. The sum keeps every break point of every curve.
function sumCurves(curves) {
    const xs = [...new Set(curves.flatMap(c => c.x))].sort((a, b) => a - b)
    return { x: xs, y: xs.map(u => curves.reduce((p, c) => p + curveAt(c.x, c.y, u), 0)) }
}

function findSegmentIntersection(firstCurve, secondCurve) {
    const P3 = secondCurve[0], P4 = secondCurve[1]
    for (let index = 0; index < firstCurve.length; index++) {
        if (index === firstCurve.length - 1) break
        const P1 = firstCurve[index], P2 = firstCurve[index + 1]
        const i1 = findIntersection([P1, P2, P3, P4])
        if (isPointBetween(i1, P1, P2) && isPointBetween(i1, P3, P4)) return i1
    }
    return false
}

// ─── Rate of flow (creep / shrinkage / thermal) ──────────────────────────────

// sigma0: shell stress at the start of the series [MPa] (e.g. the LSC load carried before)
// tLoadDays: time since the start of loading at the start of the series [days]; creep, thermal
//   and shrinkage terms are counted from the start of loading
function rateOfFlow(dispObj, rate, E_c, t0Days = 0, sigma0 = 0, tLoadDays = 0) {
    const wall_disp = dispObj.x, dist_to_face = dispObj.y
    const arr_disp = wall_disp.map(item => item - wall_disp[0])
    const arr_dist_to_scl = dist_to_face.map(item => item - dist_to_face[0])
    const arr_days = arr_dist_to_scl.map(item => item / rate)
    const arr_hours = arr_days.map(item => item * 24)
    // time since the start of loading (equal to arr_days unless tLoadDays > 0)
    const load_days = tLoadDays > 0 ? arr_days.map(item => item + tLoadDays) : arr_days
    const load_hours = tLoadDays > 0 ? load_days.map(item => item * 24) : arr_hours
    const del_eps = []
    arr_disp.slice(1).forEach((item, index) => del_eps.push(item - arr_disp.slice(0, -1)[index]))

    const A = 0.000045, B = 10
    const eps_sh_inf = 0.001250, C_d_inf = 0.000090, Q = 0.000100

    // Eq. 6.14: C(t) = A * t_hours^0.25 (t measured from initial loading, in hours)
    const C_t = load_hours.map(item => A * item ** 0.25)
    const theta = load_days.map(item => item ** 0.25 * 250)
    const eps_t = theta.map(item => (-1 * Math.cos(Math.PI / 180 * item) + 1) * 30 / 1000000)
    // Gl. V-41 (Aldrian): E_SpC(t) = E_SpC(28d) * sqrt(t_hours / (4.2 + 0.85*t_hours)),
    // true concrete age in hours. Pairs with the Aldrian strength curve (Gl. V-42) used
    // for the target/capacity curve below.
    const t_real_hours = arr_hours.map(h => t0Days * 24 + h)
    const E_t = t_real_hours.map(h => E_c * Math.sqrt(h / (4.2 + 0.85 * h)))
    const eps_sh = load_days.map(item => eps_sh_inf * item / (item + B))

    const sigma_2 = [sigma0], eps_d = [0]
    for (let index = 0; index < arr_days.length; index++) {
        if (index === arr_days.length - 1) break
        if (index === 0) { eps_d.push(0); sigma_2.push(sigma0) }
        else {
            const del_eps_sh = eps_sh[index] - eps_sh[index - 1]
            const del_eps_t = eps_t[index] - eps_t[index - 1]
            const del_C_t = C_t[index] - C_t[index - 1]
            // Eq. 6.15: eps_d2 = (sigma_1 * Cd_inf - eps_d1) * (1 - exp(-dC/Q)) + eps_d1
            const value_eps_d = (sigma_2[index - 1] * C_d_inf - eps_d[index - 1]) * (1 - Math.exp(-del_C_t / Q)) + eps_d[index - 1]
            eps_d.push(value_eps_d)
            // Eq. 6.13: numerator uses the current-step eps_d2 just computed above
            const value_sigma_2 = ((del_eps[index] - del_eps_sh - del_eps_t +
                value_eps_d * (1 - Math.exp(-del_C_t / Q)) +
                sigma_2[index - 1] / E_t[index]) /
                (C_d_inf * (1 - Math.exp(-del_C_t / Q)) + del_C_t + (1 / E_t[index])))
            sigma_2.push(value_sigma_2)
        }
    }
    return [sigma_2, arr_hours, arr_disp]
}

// ─── Main ground curve calculation ───────────────────────────────────────────

// F_LSC: ring normal force carried by the LSC while it yields [kN per m tunnel], 0 = open slot
export function groundCurve(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
    dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield, F_LSC = 0) {

    // ensure all inputs are numbers
    ;[gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
        dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield, F_LSC] =
        [gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
            dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield, F_LSC].map(Number)

    E *= 1000 // E entered in MPa, internal pressure terms (p_o, c) are in kPa

    const p_o = gamma * H
    const Phi = phi * Math.PI / 180
    const p_i = linspace(0, p_o, 10000)
    const sigma_cm = 2 * c * Math.cos(Phi) / (1 - Math.sin(Phi))
    const k = (1 + Math.sin(Phi)) / (1 - Math.sin(Phi))
    const p_cr = (2 * p_o - sigma_cm) / (1 + k)
    const r_o = D / 2

    const u_ie = p_i.map(element => r_o * (1 + nu) / E * (p_o - element))

    const r_p = p_i.map(element =>
        r_o * (2 * (p_o * (k - 1) + sigma_cm) / (1 + k) /
            ((k - 1) * element + sigma_cm)) ** (1 / (k - 1)))

    const u_ip = p_i.map((element, index) =>
        r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) *
            (r_p[index] / r_o) ** 2 - (1 - 2 * nu) * (p_o - element)))

    const x = p_i.map((item, index) => item > p_cr ? u_ie[index] : u_ip[index])

    const xLargeStrain = p_i.map((item, index) => {
        if (item > p_cr) {
            return (1 - (1 / Math.sqrt(1 + 2 * u_ie[index] / r_o))) * r_o
        } else {
            return (1 - (1 / Math.sqrt(1 + 2 * u_ip[index] / r_o))) * r_o
        }
    })

    const y = p_i.map(x => x / 1000)

    const goal = p_cr
    const x_cr_p_i_value = p_i.reduce((prev, curr) =>
        Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev)
    const x_cr_index = p_i.indexOf(x_cr_p_i_value)
    const x_cr = u_ie[x_cr_index]

    // Longitudinal displacement profile
    const r_pm = r_o * ((2 * (p_o * (k - 1) + sigma_cm)) / ((1 + k) * sigma_cm)) ** (1 / (k - 1))
    const u_im = r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) * (r_pm / r_o) ** 2 - (1 - 2 * nu) * p_o)
    const u_if = (u_im / 3) * Math.exp(-0.15 * (r_pm / r_o))

    const x_ = arange(-25, 80, 0.1)
    const u_ix_a = x_.map(item => u_if * Math.exp(item / r_o))
    const u_ix_b = x_.map(item => u_im * (1 - (1 - u_if / u_im) * Math.exp((-3 * item / r_o) / (2 * r_pm / r_o))))
    const x_disp = x_.map((item, index) => item < 0 ? u_ix_a[index] : u_ix_b[index])

    // Displacement at support installation
    const u_io = u_im * (1 - (1 - u_if / u_im) * Math.exp((-3 * dis_sup / r_o) / (2 * r_pm / r_o)))

    // Support characteristic curve
    const p_scmax_conc = f_ck / 2 * (1 - ((D / 2 - t_c) ** 2 / (D / 2) ** 2))
    const k_sc_conc = E_c * ((D / 2) ** 2 - (D / 2 - t_c) ** 2) /
        (2 * (1 - nu_c ** 2) * (D / 2 - t_c) * (D / 2) ** 2)

    const p_bmax_el = t_bf / (1000 * s_l * s_r)
    const e_s = 207000
    const k_b_el = e_s * Math.PI * d_b ** 2 / (4 * l_b * s_l * s_r)


    // Shotcrete strength in time (Aldrian model)
    const time_672hours = arange(0, 28 * 24, 1)
    const time_28days = time_672hours.map(item => item / 24)
    const sigma = time_672hours.map(time =>
        time < 8 ? f_ck * 0.03 * time : f_ck * Math.sqrt((time - 5) / (45 + 0.925 * time)))
    const p_scmax = sigma.map(item => item / 2 * (1 - ((D / 2 - t_c) ** 2 / (D / 2) ** 2)))

    // Support curve (with LSC yield)
    // LSC after Gschwandtner (2010, Kap. V-4.1.5): while the element yields it carries a constant
    // ring force. Anhang D Gl. 2-10 D (σ_N = p_i·r_m/e_SpC) gives p_LSC = F_LSC / r_m.
    const r_m = D / 2 - t_c / 2
    const p_LSC = F_LSC > 0 && r_m > 0 ? F_LSC / 1000 / r_m : 0   // kN/m / m -> MPa
    // The element yields when the shotcrete ring reaches p_LSC. An element that only yields at or
    // above the shotcrete capacity never yields: no gap.
    const u_gap = p_LSC < p_scmax_conc ? (l_yield / 100) / (2 * Math.PI) : 0

    // Shotcrete and bolt curves are built separately, both starting at u_io, and added at equal wall
    // displacement (Gschwandtner Gl. V-50, Abb. V-51), with and without LSC. Only the shotcrete
    // curve has the yield path:
    //   no LSC:     elastic rise to p_max,SpC
    //   p_LSC > 0:  elastic rise to p_LSC, constant p_LSC over u_gap, elastic rise to p_max,SpC
    //   p_LSC = 0:  zero pressure over u_gap (open slot), then elastic rise to p_max,SpC
    // The bolt curve is not shifted by u_gap.
    const u_lsc = u_io + p_LSC / k_sc_conc                      // start of the yield path
    let shotcrete = null
    if (p_scmax_conc > 0 && k_sc_conc > 0) {
        if (u_gap === 0) {
            shotcrete = { x: [u_io, u_io + p_scmax_conc / k_sc_conc], y: [0, p_scmax_conc] }
        } else {
            const u_spc_top = u_lsc + u_gap + (p_scmax_conc - p_LSC) / k_sc_conc
            shotcrete = p_LSC > 0
                ? { x: [u_io, u_lsc, u_lsc + u_gap, u_spc_top], y: [0, p_LSC, p_LSC, p_scmax_conc] }
                : { x: [u_io, u_io + u_gap, u_spc_top], y: [0, 0, p_scmax_conc] }
        }
    }
    const bolts = p_bmax_el > 0 && k_b_el > 0
        ? { x: [u_io, u_io + p_bmax_el / k_b_el], y: [0, p_bmax_el] }
        : null
    const components = [shotcrete, bolts].filter(Boolean)
    const total = components.length ? sumCurves(components) : { x: [u_io], y: [0] }
    // Decision (b): shotcrete reaching p_max,SpC counts as failure (no ideal-plastic plateau), also
    // if bolts still rise. The support curve ends there (with LSC: at the end of the rise after the
    // yield path); without shotcrete it ends where the bolts reach p_max.
    const u_fail = shotcrete ? shotcrete.x[shotcrete.x.length - 1] : total.x[total.x.length - 1]
    const x_support_el = total.x.filter(u => u <= u_fail)
    const y_support_el = total.y.slice(0, x_support_el.length)
    // Components are shown (and FS (shotcrete) / bolt utilisation given) when there is more than
    // the shotcrete or the bolts alone, i.e. both supports or an LSC
    const lscCurves = (shotcrete && bolts) || u_gap > 0
        ? { shotcrete, bolts, yieldStart: u_gap > 0 ? u_lsc : null, yieldEnd: u_gap > 0 ? u_lsc + u_gap : null }
        : null

    const data_object = {
        groundCurve: { x, y },
        groundCurveLargeStrain: { x: xLargeStrain, y },
        supportCurve: { x: x_support_el, y: y_support_el },
        originalLDP: { x: x_disp, y: x_ },
        targetSupportPressure: { x: time_28days, y: p_scmax },
        targetStress: { x: time_28days, y: sigma },
        criticalPoint: {
            x: p_cr > 0 ? [x_cr] : [],
            y: p_cr > 0 ? [p_cr / 1000] : []
        },
        plasticRadius: { x: [0], y: [r_pm] },
        u_if: { u_if }
    }

    // Build point arrays for intersection. All segments of the support curve from index 0 up to
    // p_max,SpC are searched.
    const groundCurvePoints = x.map((xi, i) => ({ x: xi, y: y[i] }))
    const supportCurvePoints = x_support_el.map((xi, i) => ({ x: xi, y: y_support_el[i] }))

    // Segment intersection (used for actual equilibrium)
    let [intersection] = findCurveIntersection(groundCurvePoints, supportCurvePoints)
    // No equilibrium: 'shotcrete' if the full sum curve (bolts rising beyond p_max,SpC) would still
    // cross the ground curve, i.e. the shotcrete fails first; 'capacity' if even the sum of all p_max
    // is too small
    data_object.noEquilibrium = null
    if (!intersection) {
        const [beyond] = findCurveIntersection(groundCurvePoints, total.x.map((xi, i) => ({ x: xi, y: total.y[i] })))
        data_object.noEquilibrium = beyond ? 'shotcrete' : 'capacity'
    }

    // With LSC: separate safety measures for shotcrete and bolts at the equilibrium
    //   FS (shotcrete) = p_max,SpC / p_SpC(u_eq)   (on the plateau: p_max,SpC / p_LSC)
    //   bolt utilisation = p_bolt(u_eq) / p_max,bolt
    const p_max_total = y_support_el[y_support_el.length - 1]
    data_object.lsc = {
        F_LSC, p_LSC, r_m, u_gap, inPlateau: false,
        FS_shotcrete: null, boltUtilisation: null, remainingYieldPath: null,
        // start/end of yielding { t [d], u [m] } in the rate-of-flow time series (F_LSC > 0)
        yieldRateOfFlow: null
    }
    data_object.supportComponents = lscCurves
    if (intersection && lscCurves) {
        const u_eq = intersection.x
        const p_spc = lscCurves.shotcrete ? curveAt(lscCurves.shotcrete.x, lscCurves.shotcrete.y, u_eq) : 0
        data_object.lsc.FS_shotcrete = p_spc > 0 ? p_scmax_conc / p_spc : null
        if (lscCurves.bolts) {
            data_object.lsc.boltUtilisation = curveAt(lscCurves.bolts.x, lscCurves.bolts.y, u_eq) / p_bmax_el
        }
        // Equilibrium on the LSC plateau: the element is still yielding at p_LSC
        if (p_LSC > 0 && u_gap > 0 && u_eq >= lscCurves.yieldStart - EPS && u_eq <= lscCurves.yieldEnd + EPS) {
            data_object.lsc.inPlateau = true
            data_object.lsc.FS_shotcrete = p_scmax_conc / p_LSC
            // remaining tangential yield path of the element [mm] (radial u × 2π)
            data_object.lsc.remainingYieldPath = Math.max(lscCurves.yieldEnd - u_eq, 0) * 2 * Math.PI * 1000
        }
    }
    let safetyFactor
    if (intersection) {
        safetyFactor = (p_max_total / intersection.y).toFixed(3)
        const p_point = []
        x.forEach((item, index) => { if (item > intersection.x) p_point.push(p_i[index]) })
        const x_updated = linspace(-25, 80, p_point.length)
        const p_scl = linspace(u_io, intersection.x, p_point.length)
        const p_point_x = [], p_x_l = [], p_y_l = []

        const r_pl_sup = r_o * (2 * (p_o * (k - 1) + sigma_cm) / (1 + k) /
            ((k - 1) * Math.max(...p_point) + sigma_cm)) ** (1 / (k - 1))
        // The time series is mapped up to |u − u_eq| < U_TOL (0.01 mm), at most X_MAX behind the face
        const U_TOL = 1e-5, X_MAX = 100

        // Equilibrium LDP — used for distance-from-face mapping (guarantees monotone time axis).
        // Final displacement under the support pressure p_i: Hoek, Rock-Support Interaction, Gl. (7)
        // (references/, S. 4), second term −(1 − 2ν)(p_o − p_i). With −(1 − 2ν)·p_o (p_i = 0 only) the
        // LDP stayed below the ground curve and never reached u_eq.
        const p_sup = Math.max(...p_point)
        const u_im_updated = r_o * (1 + nu) / E *
            (2 * (1 - nu) * (p_o - p_cr) * (r_pl_sup / r_o) ** 2 - (1 - 2 * nu) * (p_o - p_sup))
        const u_if_updated = (u_im_updated / 3) * Math.exp(-0.15 * (r_pl_sup / r_o))

        const zip = (...rows) => [...rows[0]].map((_, c) => rows.map(row => row[c]))
        const zippedArray = zip(p_scl, p_point)

        // LDP for the support pressure p_inc: Hoek Gl. (7) with −(1 − 2ν)(p_o − p_inc), see above
        const ldpFor = p_inc => {
            const r_pl = r_o * (2 * (p_o * (k - 1) + sigma_cm) /
                (1 + k) / ((k - 1) * p_inc + sigma_cm)) ** (1 / (k - 1))
            const u_im_p = r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) *
                (r_pl / r_o) ** 2 - (1 - 2 * nu) * (p_o - p_inc))
            return { r_pl, u_im_p, u_if_p: (u_im_p / 3) * Math.exp(-0.15 * (r_pl / r_o)) }
        }
        const pushMapped = (u, x_at) => {
            if (x_at !== null && x_at <= X_MAX && (p_y_l.length === 0 || x_at > p_y_l[p_y_l.length - 1])) {
                p_x_l.push(u); p_y_l.push(x_at)
            }
        }

        zippedArray.forEach(item => {
            const [p_scl_inc, p_inc] = item
            const { r_pl: r_pl_sup_inc, u_im_p: u_im_inc, u_if_p: u_if_inc } = ldpFor(p_inc)
            const u_ix_a_inc = x_updated.map(item => u_if_inc * Math.exp(item / r_o))
            const u_ix_b_inc = x_updated.map(item =>
                u_im_inc * (1 - (1 - u_if_inc / u_im_inc) * Math.exp((-3 * item / r_o) / (2 * r_pl_sup_inc / r_o))))
            const u_ix_inc = x_updated.map((item, index) => item < 0 ? u_ix_a_inc[index] : u_ix_b_inc[index])
            p_point_x.push(u_ix_inc)

            // Use per-step LDP for distance; ensure monotone by only pushing if x_at_scl > last pushed.
            // Steps within U_TOL of u_eq are left to the closing point below (x grows without bound there).
            if (p_scl_inc > intersection.x - U_TOL) return
            pushMapped(p_scl_inc, ldpInverse(p_scl_inc, u_im_inc, u_if_inc, r_pl_sup_inc, r_o))
        })
        // Closing point: |u − u_eq| = U_TOL / 2 on the LDP of the last pressure step; if that lies beyond
        // X_MAX, the series ends at X_MAX
        if (p_point.length > 0) {
            const last = ldpFor(p_point[p_point.length - 1])
            const u_close = intersection.x - U_TOL / 2
            const x_close = ldpInverse(u_close, last.u_im_p, last.u_if_p, last.r_pl, r_o)
            if (x_close !== null && x_close <= X_MAX) {
                pushMapped(u_close, x_close)
            } else if (p_y_l.length === 0 || X_MAX > p_y_l[p_y_l.length - 1]) {
                const u_xmax = last.u_im_p * (1 - (1 - last.u_if_p / last.u_im_p) *
                    Math.exp((-3 * X_MAX / r_o) / (2 * last.r_pl / r_o)))
                if (p_x_l.length === 0 || u_xmax > p_x_l[p_x_l.length - 1]) pushMapped(u_xmax, X_MAX)
            }
        }
        const u_ix_a_updated = x_updated.map(item => u_if_updated * Math.exp(item / r_o))
        const u_ix_b_updated = x_updated.map(item =>
            u_im_updated * (1 - (1 - u_if_updated / u_im_updated) * Math.exp((-3 * item / r_o) / (2 * r_pl_sup / r_o))))
        const u_ix_updated = x_updated.map((item, index) =>
            item < 0 ? u_ix_a_updated[index] : u_ix_b_updated[index])

        const LDP = { grayDashed: { x: p_point_x, y: x_updated }, redIntersect: { x: p_x_l, y: p_y_l } }

        // Subsample to ≤ hourly resolution before rateOfFlow — prevents thermal formula
        // over-sampling which causes spurious oscillation in sigma_2
        const t_span = p_y_l.length > 1 ? (p_y_l[p_y_l.length - 1] - p_y_l[0]) / advance_rate : 1
        const n_target = Math.max(50, Math.ceil(t_span * 24))
        const stride = Math.max(1, Math.floor(p_x_l.length / n_target))
        // the last point (end of the series at u_eq) is always kept
        const keep = (_, i) => i % stride === 0 || i === p_x_l.length - 1
        const p_x_l_ss = p_x_l.filter(keep)
        const p_y_l_ss = p_y_l.filter(keep)

        data_object.LDP = LDP
        if (u_gap > 0 && p_LSC > 0) {
            // LSC with load (Gschwandtner S. 56), force-controlled in time, three phases:
            //   rise: rate of flow from 0 as without LSC, until σ(t) reaches σ_N = F_LSC / t_c
            //     (not at u_lsc of the 28-day support curve; the young shell is softer)
            //   yield path: constant σ_N from the start of yielding u_ys to u_ys + u_gap
            //   after the yield path: rate of flow continues from σ_N
            // If σ_N is never reached the element does not yield and the rise covers the whole series.
            const sigma_N = F_LSC / 1000 / t_c                    // kN/m / m -> MPa
            const t_of = i => (p_y_l_ss[i] - p_y_l_ss[0]) / advance_rate
            const rise = rateOfFlow({ x: p_x_l_ss, y: p_y_l_ss }, advance_rate, E_c)[0]
            let lscIdx = rise.findIndex(s => s >= sigma_N)
            if (lscIdx < 0) lscIdx = p_x_l_ss.length              // σ_N not reached: no yielding
            const yieldRof = { start: null, end: null }
            let endIdx = p_x_l_ss.length
            if (lscIdx < p_x_l_ss.length) {
                // start of yielding where σ crosses σ_N (linear between the neighbouring points)
                const i0 = Math.max(lscIdx - 1, 0)
                const f = lscIdx > 0 && rise[lscIdx] > rise[i0] ? (sigma_N - rise[i0]) / (rise[lscIdx] - rise[i0]) : 1
                const lerp = (a, b) => a + (b - a) * f
                const u_ys = lerp(p_x_l_ss[i0], p_x_l_ss[lscIdx])
                yieldRof.start = { t: lerp(t_of(i0), t_of(lscIdx)), u: u_ys }
                const found = p_x_l_ss.findIndex(u => u >= u_ys + u_gap)
                if (found >= 0) {
                    endIdx = found
                    const j0 = found - 1
                    const g = (u_ys + u_gap - p_x_l_ss[j0]) / (p_x_l_ss[found] - p_x_l_ss[j0])
                    yieldRof.end = { t: t_of(j0) + (t_of(found) - t_of(j0)) * g, u: u_ys + u_gap }
                }
            }
            data_object.lsc.yieldRateOfFlow = yieldRof
            const stressX = [], stressY = []
            for (let i = 0; i < lscIdx; i++) { stressX.push(t_of(i)); stressY.push(rise[i]) }
            for (let i = lscIdx; i < endIdx; i++) { stressX.push(t_of(i)); stressY.push(sigma_N) }
            if (endIdx < p_x_l_ss.length) {
                const t_gap_days = t_of(endIdx)
                // Remove the yield path from the wall displacement: only the rest strains the shell
                const u_spc = p_x_l_ss.slice(endIdx).map(u =>
                    u - Math.min(Math.max(u - yieldRof.start.u, 0), u_gap))
                // The shell has been loaded since u_io: creep, shrinkage and thermal terms count
                // from there, not from the end of the yield path
                const rof = rateOfFlow({ x: u_spc, y: p_y_l_ss.slice(endIdx) }, advance_rate, E_c,
                    t_gap_days, sigma_N, t_gap_days)
                rof[1].forEach((h, i) => { stressX.push(t_gap_days + h / 24); stressY.push(rof[0][i]) })
            }
            data_object.actualStress = { x: stressX, y: stressY }
        } else {
            // Skip yield phase for rateOfFlow: during LSC yielding the shotcrete is free,
            // so shrinkage/thermal terms must not generate tensile stress.
            // Start rateOfFlow only from the point where the gap is exhausted.
            let gapEndIdx = 0, t_gap_days = 0
            if (u_gap > 0 && p_x_l_ss.length > 0) {
                const found = p_x_l_ss.findIndex(u => u >= u_io + u_gap)
                if (found > 0) {
                    gapEndIdx = found
                    t_gap_days = (p_y_l_ss[found] - p_y_l_ss[0]) / advance_rate
                }
            }
            const p_x_l_rof = p_x_l_ss.slice(gapEndIdx)
            const p_y_l_rof = p_y_l_ss.slice(gapEndIdx)

            // Remove residual LSC gap from wall displacement (post-gap, full u_gap consumed)
            const p_x_l_spc = p_x_l_rof.map(u => u - Math.min(Math.max(u - u_io, 0), u_gap))
            const arrROF = rateOfFlow({ x: p_x_l_spc, y: p_y_l_rof }, advance_rate, E_c, t_gap_days)
            // Offset actualStress time by t_gap_days so concrete age is correct for utilisation
            data_object.actualStress = { x: arrROF[1].map(item => t_gap_days + item / 24), y: arrROF[0] }
        }
        const stressActual = data_object.actualStress.y

        // Utilisation μ_SpC(t) = σ_actual(t) / σ_capacity(t) × 100%, not capped: > 100 % = overloaded
        const muY = data_object.actualStress.x.map((t, i) => {
            const idx = time_28days.findIndex(td => td >= t)
            if (idx <= 0) return 0
            const cap = sigma[idx - 1] + (sigma[idx] - sigma[idx - 1]) *
                (t - time_28days[idx - 1]) / (time_28days[idx] - time_28days[idx - 1])
            return cap > 0 ? stressActual[i] / cap * 100 : 0
        })
        data_object.utilisationSpC = { x: data_object.actualStress.x, y: muY }
    } else {
        intersection = { x: [], y: [] }
        safetyFactor = 0.0
    }

    if (intersection.x.length !== 0) {
        const results = calc_n_m(gamma, H, D / 2, t_c, E_c, nu, E)
        const delta_force = (u_im - u_io) / u_im
        data_object.liningForces = {
            m: Number(delta_force) * Number(results.moment),
            n: Number(delta_force) * Number(results.normal_force)
        }
    } else {
        data_object.liningForces = { m: 0, n: 0 }
    }

    return [data_object, intersection, safetyFactor]
}

// ─── Build Plotly traces and render ──────────────────────────────────────────

// options.showLargeStrain: also plot the large-strain ground curve. Display only — equilibrium,
// FS and LDP always use the small-strain solution.
// options.legendBelow: horizontal legend under the chart (phone layout).
export function updateGraphic(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
    dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield, F_LSC, options = {}) {

    const data_array = groundCurve(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
        dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield, F_LSC)
    const obj = data_array[0]
    const intersect = data_array[1]
    const safety = data_array[2]
    // No crossing of ground and support curve up to p_max,SpC: either the shotcrete fails first
    // (bolts alone would still reach the ground curve) or the whole support capacity is too small.
    // FS, LDP, σ(t) and μ_SpC do not exist; the plots show a message instead of empty axes.
    const noEquilibrium = typeof intersect.x !== 'number'
    const NO_EQ_TEXT = obj.noEquilibrium === 'shotcrete'
        ? 'no equilibrium – shotcrete fails (p_max reached)'
        : 'no equilibrium – support capacity insufficient'

    const trace1 = {
        x: obj.groundCurve.x, y: obj.groundCurve.y,
        mode: 'lines', type: 'scatter', name: 'Ground Curve',
        line: { color: 'blue' }, xaxis: 'x1', yaxis: 'y1', hoverinfo: 'x+y'
    }
    const trace1_1 = {
        x: obj.groundCurveLargeStrain.x, y: obj.groundCurveLargeStrain.y,
        mode: 'lines', type: 'scatter',
        name: 'Ground Curve LS (Vrakas & Anagnostou 2015)<br>' +
            '<span style="font-size:12px">display only – design values from small-strain solution</span>',
        line: { color: 'darkturquoise', dash: 'dashdot' }, opacity: 0.7,
        xaxis: 'x1', yaxis: 'y1', hoverinfo: 'x+y'
    }
    const trace2 = {
        x: obj.supportCurve.x, y: obj.supportCurve.y,
        mode: 'lines', type: 'scatter', name: 'Support Curve',
        line: { color: 'red' }, xaxis: 'x1', yaxis: 'y1'
    }
    const fsText = noEquilibrium ? '–' : Number(safety).toFixed(2)
    const trace3 = {
        x: noEquilibrium ? [0] : [intersect.x], y: noEquilibrium ? [0] : [intersect.y],
        mode: 'markers', type: 'scatter',
        name: obj.supportComponents ? `FS (total) = ${fsText}` : `FS. ${fsText}`,
        marker: { color: 'green', size: 10 }, xaxis: 'x1', yaxis: 'y1',
        ...(noEquilibrium ? { opacity: 0, hoverinfo: 'none', showlegend: true } : {})
    }
    const trace3_1 = {
        x: obj.criticalPoint.x, y: obj.criticalPoint.y,
        mode: 'markers', type: 'scatter',
        name: obj.criticalPoint.x.length ? `P_cr: ${obj.criticalPoint.y[0].toFixed(2)} MPa` : '',
        marker: { color: 'red', size: 10 }, xaxis: 'x1', yaxis: 'y1'
    }
    const trace3_2 = {
        x: [0], y: [0], mode: 'markers', type: 'scatter',
        visible: true, showlegend: true, hoverinfo: 'none', opacity: 0,
        name: `R_p: ${obj.plasticRadius.y[0].toFixed(2)} m`
    }
    const trace3_4 = {
        x: [0], y: [0], mode: 'markers', type: 'scatter',
        visible: true, showlegend: true, hoverinfo: 'none', opacity: 0,
        name: `u_face: ${obj.u_if.u_if.toFixed(3)} m`
    }
    const trace3_3 = {
        x: [0], y: [0], mode: 'markers', type: 'scatter',
        visible: true, showlegend: true, hoverinfo: 'none', opacity: 0,
        name: `N: ${obj.liningForces.n.toFixed(2)} kN ***<br>M: ${obj.liningForces.m.toFixed(2)} kN/m ***`
    }

    const data = [trace1, trace2, trace3, trace3_1]
    const dataBasic = [trace1, trace2, trace3, trace3_1, trace3_2, trace3_4]
    if (obj.supportComponents) {
        // With LSC: show the shotcrete and bolt curves that make up the support curve, and the
        // separate safety measures at the equilibrium (legend-only entries)
        const { shotcrete, bolts } = obj.supportComponents
        const components = [{
            x: shotcrete.x, y: shotcrete.y, mode: 'lines', type: 'scatter',
            name: obj.lsc.u_gap > 0 ? 'Shotcrete + LSC' : 'Shotcrete',
            line: { color: 'red', width: 1, dash: 'dot' }, xaxis: 'x1', yaxis: 'y1'
        }]
        if (bolts) {
            components.push({
                x: bolts.x, y: bolts.y, mode: 'lines', type: 'scatter', name: 'Bolts',
                line: { color: 'darkorange', width: 1, dash: 'dot' }, xaxis: 'x1', yaxis: 'y1'
            })
        }
        const legendOnly = name => ({
            x: [0], y: [0], mode: 'markers', type: 'scatter',
            visible: true, showlegend: true, hoverinfo: 'none', opacity: 0, name
        })
        const { lsc } = obj
        const entries = []
        if (lsc.FS_shotcrete !== null) {
            entries.push(legendOnly(lsc.inPlateau
                ? `FS (shotcrete) = p_max,SpC / p_LSC = ${lsc.FS_shotcrete.toFixed(2)}`
                : `FS (shotcrete) = ${lsc.FS_shotcrete.toFixed(2)}`))
        }
        if (lsc.boltUtilisation !== null) {
            entries.push(legendOnly(`bolt utilisation: ${(lsc.boltUtilisation * 100).toFixed(0)} %`))
        }
        if (lsc.inPlateau) {
            entries.push(legendOnly(`remaining yield path: ${lsc.remainingYieldPath.toFixed(1)} mm`))
        }
        data.splice(3, 0, ...entries)
        dataBasic.splice(3, 0, ...entries)
        data.splice(2, 0, ...components)
        dataBasic.splice(2, 0, ...components)
    }
    if (options.showLargeStrain) {
        data.splice(1, 0, trace1_1)
        dataBasic.splice(1, 0, trace1_1)
    }

    let verticalLines = []
    if (Object.keys(obj).includes('LDP')) {
        obj.LDP.grayDashed.x.forEach((item, index) => {
            if (index % 50 === 0) {
                data.push({
                    x: item, y: obj.LDP.grayDashed.y,
                    mode: 'lines', line: { color: 'gray', width: 1, dash: 'dashdot' },
                    visible: true, showlegend: false, hoverinfo: 'none',
                    name: 'Diff. p_i', opacity: 0.4, xaxis: 'x1', yaxis: 'y2'
                })
            }
        })
        data.push({
            x: obj.LDP.grayDashed.x[obj.LDP.grayDashed.x.length - 1], y: obj.LDP.grayDashed.y,
            mode: 'lines', line: { color: 'green', width: 1.5, dash: 'dashdot' },
            visible: true, showlegend: false, hoverinfo: 'none',
            name: 'Diff. p_i', opacity: 1, xaxis: 'x1', yaxis: 'y2'
        })
        data.push({
            x: obj.LDP.redIntersect.x, y: obj.LDP.redIntersect.y,
            mode: 'lines', name: 'New LDP', line: { color: 'red', width: 2 },
            xaxis: 'x1', yaxis: 'y2'
        })
        data.push({
            x: obj.actualStress.x, y: obj.actualStress.y,
            mode: 'lines', name: 'Stress (actual)',
            line: { color: 'red', width: 1.5 },
            xaxis: 'x2', yaxis: 'y4'
        })

        const maxGRC = Math.max(...obj.groundCurve.y)
        for (const item of [obj.supportCurve.x[0], intersect.x]) {
            verticalLines.push(
                { type: 'line', xref: 'x1', yref: 'y2', x0: item, y0: 0, x1: item, y1: 80, line: { color: 'red', width: 1.5, dash: 'dashdot' }, opacity: 0.6 },
                { type: 'line', xref: 'x1', yref: 'y1', x0: item, y0: 0, x1: item, y1: maxGRC, line: { color: 'gray', width: 1.5, dash: 'dashdot' }, opacity: 0.3 }
            )
        }
    }

    if (!noEquilibrium) {
        data.push({
            x: obj.originalLDP.x, y: obj.originalLDP.y,
            mode: 'lines', name: 'Org. LDP',
            line: { color: 'blue', width: 1.5, dash: 'dashdot' },
            hoverinfo: 'none', xaxis: 'x1', yaxis: 'y2'
        })
    }
    if (obj.utilisationSpC) {
        data.push({
            x: obj.utilisationSpC.x, y: obj.utilisationSpC.y,
            mode: 'lines', name: 'μ_SpC [%]',
            line: { color: 'red', width: 2 },
            xaxis: 'x2', yaxis: 'y3'
        })
        data.push({
            x: [0, obj.utilisationSpC.x.at(-1)],
            y: [80, 80],
            mode: 'lines', name: 'Design limit (80%)', hoverinfo: 'none',
            line: { color: 'black', width: 1, dash: 'dot' },
            xaxis: 'x2', yaxis: 'y3'
        })
        // μ_SpC is not capped: above 100 % the young shotcrete is overloaded
        const muMax = Math.max(...obj.utilisationSpC.y)
        data.push({
            x: [0, obj.utilisationSpC.x.at(-1)],
            y: [100, 100],
            mode: 'lines', hoverinfo: 'none',
            name: muMax > 100
                ? `> 100 %: overloaded (max ${muMax.toFixed(0)} %)`
                : '> 100 %: overloaded',
            line: { color: 'red', width: 1.5, dash: 'dash' },
            xaxis: 'x2', yaxis: 'y3'
        })
        if (muMax > 100) {
            verticalLines.push({
                type: 'rect', xref: 'x2', yref: 'y3', x0: 0, x1: obj.utilisationSpC.x.at(-1),
                y0: 100, y1: muMax * 1.05, fillcolor: 'red', opacity: 0.08, line: { width: 0 }, layer: 'below'
            })
        }
    }
    const muRangeMax = obj.utilisationSpC ? Math.max(110, Math.max(...obj.utilisationSpC.y) * 1.05) : 110
    if (!noEquilibrium) {
        data.push({
            x: obj.targetStress.x, y: obj.targetStress.y,
            mode: 'lines', name: 'Stress (target)', line: { color: 'green' }, xaxis: 'x2', yaxis: 'y4'
        })
    }

    const maxX = Math.max(...obj.groundCurve.x)
    const maxY = Math.max(...obj.groundCurve.y)

    const layout = {
        title: { text: 'Ground Reaction Curve', font: { size: 18 } }, plot_bgcolor: '#f9f7f7', showlegend: true,
        margin: { l: 60, r: 30, b: 60, t: 50, pad: 4 },
        autosize: true, hovermode: 'closest',
        xaxis: { rangemode: 'normal', title: { text: 'Tunnel Wall Displacement [m]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', range: [0, maxX], tickformat: '.3f', domain: [0, 0.47], anchor: 'y2' },
        xaxis2: { title: { text: 'Time [days]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', tickformat: '.2f', domain: [0.55, 1], anchor: 'y4' },
        yaxis: { tickformat: '.1f', title: { text: 'Support Pressure [MPa]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', range: [0, maxY], domain: [0.55, 1], rangemode: 'nonnegative' },
        yaxis2: { title: { text: 'Distance from Tunnel Face [m]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', tickformat: 'd', range: [80, -25], domain: [0, 0.50], anchor: 'x1' },
        yaxis3: { title: { text: 'Utilisation μ_SpC [%]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', tickformat: '.0f', range: [0, muRangeMax], domain: [0.55, 1], anchor: 'x2' },
        yaxis4: { title: { text: 'Stress SpC [MPa]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', tickformat: '.2f', domain: [0, 0.50], anchor: 'x2', rangemode: 'nonnegative' },
        legend: { traceorder: 'normal', font: { family: 'arial', size: 16, color: '#000' }, bgcolor: '#E2E2E2', bordercolor: '#FFFFFF', borderwidth: 1.5 },
        shapes: verticalLines
    }

    const layoutBasic = {
        title: { text: 'Ground Reaction Curve', font: { size: 18 } }, plot_bgcolor: '#f9f7f7', showlegend: true,
        margin: { l: 60, r: 30, b: 60, t: 50, pad: 4 },
        autosize: true, hovermode: 'closest',
        xaxis: { rangemode: 'nonnegative', title: { text: 'Tunnel Wall Displacement [m]', font: { family: 'Arial, sans-serif', size: 14 } }, color: 'black', range: [0, maxX], tickformat: '.3f' },
        yaxis: { scaleratio: 0.4, tickformat: '.1f', title: { text: 'Support Pressure [MPa]', font: { family: 'Arial, sans-serif', size: 14 } }, color: 'black', range: [0, maxY], rangemode: 'nonnegative' },
        legend: { traceorder: 'normal', font: { family: 'Arial, sans-serif', size: 16, color: '#000' }, bgcolor: '#E2E2E2', bordercolor: '#FFFFFF', borderwidth: 1.7, x: 0.99, xanchor: 'right', y: 0.99 }
    }

    if (options.legendBelow) {
        const below = { orientation: 'h', x: 0, xanchor: 'left', y: -0.12, yanchor: 'top', font: { size: 11 } }
        Object.assign(layout.legend, below, { y: -0.06 })
        Object.assign(layoutBasic.legend, below, { y: -0.18 })
        layout.margin = { ...layout.margin, l: 50, r: 10 }
        layoutBasic.margin = { ...layoutBasic.margin, l: 50, r: 10 }
        layout.title.font = { size: 14 }
        layoutBasic.title.font = { size: 14 }
        // Enhanced: stack the four plots (GRC, LDP, μ_SpC, stress) instead of a 2 × 2 grid so the
        // axis titles do not overlap the neighbouring plot
        Object.assign(layout.xaxis, { domain: [0, 1] })
        Object.assign(layout.xaxis2, { domain: [0, 1] })
        layout.yaxis.domain = [0.79, 1]
        layout.yaxis2.domain = [0.555, 0.75]
        layout.yaxis3.domain = [0.27, 0.465]
        layout.yaxis4.domain = [0, 0.195]
        for (const axis of ['xaxis', 'xaxis2', 'yaxis', 'yaxis2', 'yaxis3', 'yaxis4']) {
            layout[axis].title.font = { ...layout[axis].title.font, size: 11 }
        }
    }
    if (noEquilibrium) {
        const message = (xref, yref, x, y, xanchor, yanchor) => ({
            xref, yref, x, y, xanchor, yanchor, text: NO_EQ_TEXT, showarrow: false,
            font: { family: 'Arial, sans-serif', size: options.legendBelow ? 11 : 13, color: '#b00000' },
            bgcolor: 'rgba(255,255,255,0.85)', bordercolor: '#b00000', borderwidth: 1, borderpad: 4
        })
        // GRC: top right, where the ground curve is low; LDP, μ_SpC and σ panels: centred, no traces
        layout.annotations = [
            message('x domain', 'y domain', 0.98, 0.95, 'right', 'top'),
            message('x domain', 'y2 domain', 0.5, 0.5, 'center', 'middle'),
            message('x2 domain', 'y3 domain', 0.5, 0.5, 'center', 'middle'),
            message('x2 domain', 'y4 domain', 0.5, 0.5, 'center', 'middle')
        ]
        for (const axis of ['xaxis2', 'yaxis2', 'yaxis3', 'yaxis4']) {
            Object.assign(layout[axis], { showticklabels: false, showgrid: false, zeroline: false })
        }
        // Plotly draws a subplot only if it holds a trace: invisible placeholders keep the empty panels
        for (const [xaxis, yaxis] of [['x1', 'y2'], ['x2', 'y3'], ['x2', 'y4']]) {
            data.push({ x: [0], y: [0], mode: 'markers', opacity: 0, showlegend: false, hoverinfo: 'none', xaxis, yaxis })
        }
        // Basic: legend sits top right, so the message goes to the lower middle
        layoutBasic.annotations = [message('x domain', 'y domain', 0.5, 0.3, 'center', 'middle')]
    }

    // Phone layout: no mode bar, so it cannot cover the chart title
    const config = {
        displayModeBar: !options.legendBelow, displaylogo: false, responsive: true,
        modeBarButtonsToRemove: ['select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d']
    }
    Plotly.newPlot('graph', data, layout, config)
    Plotly.newPlot('graphBasic', dataBasic, layoutBasic, config)
}
