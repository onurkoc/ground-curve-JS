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

function isPointBetween(p, a, b) {
    return ((a.x <= p.x && p.x <= b.x) || (a.x >= p.x && p.x >= b.x)) &&
        ((a.y <= p.y && p.y <= b.y) || (a.y >= p.y && p.y >= b.y))
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

function rateOfFlow(dispObj, rate) {
    const wall_disp = dispObj.x, dist_to_face = dispObj.y
    const arr_disp = wall_disp.map(item => item - wall_disp[0])
    const arr_dist_to_scl = dist_to_face.map(item => item - dist_to_face[0])
    const arr_days = arr_dist_to_scl.map(item => item / rate)
    const arr_hours = arr_days.map(item => item * 24)
    const del_eps = []
    arr_disp.slice(1).forEach((item, index) => del_eps.push(item - arr_disp.slice(0, -1)[index]))

    const E_28 = 31700, A = 0.000045, B = 10
    const eps_sh_inf = 0.001250, C_d_inf = 0.000090, Q = 0.000100
    const P_Ar1 = 1, P_Ar2 = 0.3, P_Ar3 = 0.2

    const C_t = arr_days.map(item => A * item ** (1 / 3))
    const theta = arr_days.map(item => item ** 0.25 * 250)
    const eps_t = theta.map(item => (-1 * Math.cos(Math.PI / 180 * item) + 1) * 30 / 1000000)
    const E_t = arr_days.map(item => E_28 * (item / (P_Ar1 + P_Ar2 * item)) ** P_Ar3)
    const eps_sh = arr_days.map(item => eps_sh_inf * item / (item + B))

    const sigma_2 = [0], eps_d = [0]
    for (let index = 0; index < arr_days.length; index++) {
        if (index === arr_days.length - 1) break
        if (index === 0) { eps_d.push(0); sigma_2.push(0) }
        else {
            const del_eps_sh = eps_sh[index] - eps_sh[index - 1]
            const del_eps_t = eps_t[index] - eps_t[index - 1]
            const del_C_t = C_t[index] - C_t[index - 1]
            const value_eps_d = (sigma_2[index - 1] * C_d_inf - eps_d[index - 1]) * (1 - Math.exp(-del_C_t / Q))
            eps_d.push(value_eps_d)
            const value_sigma_2 = ((del_eps[index] - del_eps_sh - del_eps_t +
                eps_d[index - 1] * (1 - Math.exp(-del_C_t / Q)) +
                sigma_2[index - 1] / E_t[index]) /
                (C_d_inf * (1 - Math.exp(-del_C_t / Q)) + del_C_t + (1 / E_t[index])))
            sigma_2.push(value_sigma_2)
        }
    }
    return [sigma_2, arr_hours]
}

// ─── Main ground curve calculation ───────────────────────────────────────────

export function groundCurve(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
    dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield) {

    // ensure all inputs are numbers
    ;[gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
        dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield] =
        [gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
            dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield].map(Number)

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

    let p_scmax_el, k_sc_el
    if (p_bmax_el !== 0) {
        p_scmax_el = p_scmax_conc + p_bmax_el
        k_sc_el = k_sc_conc + k_b_el
    } else {
        p_scmax_el = p_scmax_conc
        k_sc_el = k_sc_conc
    }

    // Shotcrete strength in time (Aldrian model)
    const time_672hours = arange(0, 28 * 24, 1)
    const time_28days = time_672hours.map(item => item / 24)
    const sigma = time_672hours.map(time =>
        time < 8 ? f_ck * 0.03 * time : f_ck * Math.sqrt((time - 5) / (45 + 0.925 * time)))
    const p_scmax = sigma.map(item => item / 2 * (1 - ((D / 2 - t_c) ** 2 / (D / 2) ** 2)))

    // Support curve (with LSC yield)
    const ratio_sc = p_scmax_el / k_sc_el
    const u_iy = u_io + ratio_sc
    const u_gap = (l_yield / 100) / (2 * Math.PI)

    // With LSC: zero stress from u_io until gap exhausted, then elastic rise.
    // Without LSC: small pre-yield elastic phase (10%) then full elastic rise.
    let x_support_el, y_support_el
    if (u_gap > 0) {
        x_support_el = [u_io, u_io + u_gap, u_iy + u_gap, u_iy * 1.01 + u_gap]
        y_support_el = [0, 0, p_scmax_el, p_scmax_el]
    } else {
        const a_yield = 0.1 * (u_iy - u_io) + u_io
        x_support_el = [u_io, a_yield, a_yield, u_iy, u_iy * 1.01]
        y_support_el = [0, 0.1 * p_scmax_el, 0.1 * p_scmax_el, p_scmax_el, p_scmax_el]
    }

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

    // Build point arrays for intersection
    const groundCurvePoints = x.map((xi, i) => ({ x: xi, y: y[i] }))
    const supportCurvePoints = []
    // With LSC: rising segment starts at index 1 (end of yield gap).
    // Without LSC: rising segment starts at index 2 (end of pre-yield elastic phase).
    const sccRisingStart = u_gap > 0 ? 1 : 2
    for (let index = sccRisingStart; index < x_support_el.length; index++) {
        supportCurvePoints.push({ x: x_support_el[index], y: y_support_el[index] })
    }

    // Segment intersection (used for actual equilibrium)
    let intersection = findSegmentIntersection(groundCurvePoints, supportCurvePoints)
    let safetyFactor
    if (intersection) {
        safetyFactor = (p_scmax_el / intersection.y).toFixed(3)
        const p_point = []
        x.forEach((item, index) => { if (item > intersection.x) p_point.push(p_i[index]) })
        const x_updated = linspace(-25, 80, p_point.length)
        const p_scl = linspace(u_io, intersection.x, p_point.length)
        const p_point_x = [], p_x_l = [], p_y_l = []

        const r_pl_sup = r_o * (2 * (p_o * (k - 1) + sigma_cm) / (1 + k) /
            ((k - 1) * Math.max(...p_point) + sigma_cm)) ** (1 / (k - 1))

        // Equilibrium LDP — used for distance-from-face mapping (guarantees monotone time axis)
        const u_im_updated = r_o * (1 + nu) / E *
            (2 * (1 - nu) * (p_o - p_cr) * (r_pl_sup / r_o) ** 2 - (1 - 2 * nu) * p_o)
        const u_if_updated = (u_im_updated / 3) * Math.exp(-0.15 * (r_pl_sup / r_o))

        const zip = (...rows) => [...rows[0]].map((_, c) => rows.map(row => row[c]))
        const zippedArray = zip(p_scl, p_point)

        zippedArray.forEach(item => {
            const [p_scl_inc, p_inc] = item
            const r_pl_sup_inc = r_o * (2 * (p_o * (k - 1) + sigma_cm) /
                (1 + k) / ((k - 1) * p_inc + sigma_cm)) ** (1 / (k - 1))
            const u_im_inc = r_o * (1 + nu) / E * (2 * (1 - nu) * (p_o - p_cr) *
                (r_pl_sup_inc / r_o) ** 2 - (1 - 2 * nu) * p_o)
            const u_if_inc = (u_im_inc / 3) * Math.exp(-0.15 * (r_pl_sup_inc / r_o))
            const u_ix_a_inc = x_updated.map(item => u_if_inc * Math.exp(item / r_o))
            const u_ix_b_inc = x_updated.map(item =>
                u_im_inc * (1 - (1 - u_if_inc / u_im_inc) * Math.exp((-3 * item / r_o) / (2 * r_pl_sup_inc / r_o))))
            const u_ix_inc = x_updated.map((item, index) => item < 0 ? u_ix_a_inc[index] : u_ix_b_inc[index])
            p_point_x.push(u_ix_inc)

            // Use per-step LDP for distance; ensure monotone by only pushing if x_at_scl > last pushed
            const x_at_scl = ldpInverse(p_scl_inc, u_im_inc, u_if_inc, r_pl_sup_inc, r_o)
            if (x_at_scl !== null && (p_y_l.length === 0 || x_at_scl > p_y_l[p_y_l.length - 1])) {
                p_x_l.push(p_scl_inc); p_y_l.push(x_at_scl)
            }
        })
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
        const p_x_l_ss = p_x_l.filter((_, i) => i % stride === 0)
        const p_y_l_ss = p_y_l.filter((_, i) => i % stride === 0)

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
        const arrROF = rateOfFlow({ x: p_x_l_spc, y: p_y_l_rof }, advance_rate)
        data_object.LDP = LDP
        // Offset actualStress time by t_gap_days so concrete age is correct for utilisation
        data_object.actualStress = { x: arrROF[1].map(item => t_gap_days + item / 24), y: arrROF[0] }

        // Utilisation μ_SpC(t) = σ_actual(t) / σ_capacity(t) × 100%
        const muY = data_object.actualStress.x.map((t, i) => {
            const idx = time_28days.findIndex(td => td >= t)
            if (idx <= 0) return 0
            const cap = sigma[idx - 1] + (sigma[idx] - sigma[idx - 1]) *
                (t - time_28days[idx - 1]) / (time_28days[idx] - time_28days[idx - 1])
            return cap > 0 ? Math.min(arrROF[0][i] / cap * 100, 100) : 0
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

export function updateGraphic(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
    dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield) {

    const data_array = groundCurve(gamma, H, nu, E, D, c, phi, f_ck, E_c, nu_c, t_c,
        dis_sup, advance_rate, t_bf, s_l, s_r, d_b, l_b, l_yield)
    const obj = data_array[0]
    const intersect = data_array[1]
    const safety = data_array[2]

    const trace1 = {
        x: obj.groundCurve.x, y: obj.groundCurve.y,
        mode: 'lines', type: 'scatter', name: 'Ground Curve',
        line: { color: 'blue' }, xaxis: 'x1', yaxis: 'y1', hoverinfo: 'x+y'
    }
    const trace1_1 = {
        x: obj.groundCurveLargeStrain.x, y: obj.groundCurveLargeStrain.y,
        mode: 'lines', type: 'scatter', name: 'Ground Curve LS**',
        line: { color: 'darkturquoise', dash: 'dashdot', opacity: 0.7 },
        xaxis: 'x1', yaxis: 'y1', hoverinfo: 'none'
    }
    const trace2 = {
        x: obj.supportCurve.x, y: obj.supportCurve.y,
        mode: 'lines', type: 'scatter', name: 'Support Curve',
        line: { color: 'red' }, xaxis: 'x1', yaxis: 'y1'
    }
    const trace3 = {
        x: [intersect.x], y: [intersect.y],
        mode: 'markers', type: 'scatter',
        name: `FS. ${Number(safety).toFixed(2)}`,
        marker: { color: 'green', size: 10 }, xaxis: 'x1', yaxis: 'y1'
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

    data.push({
        x: obj.originalLDP.x, y: obj.originalLDP.y,
        mode: 'lines', name: 'Org. LDP',
        line: { color: 'blue', width: 1.5, dash: 'dashdot' },
        hoverinfo: 'none', xaxis: 'x1', yaxis: 'y2'
    })
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
    }
    data.push({
        x: obj.targetStress.x, y: obj.targetStress.y,
        mode: 'lines', name: 'Stress (target)', line: { color: 'green' }, xaxis: 'x2', yaxis: 'y4'
    })

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
        yaxis3: { title: { text: 'Utilisation μ_SpC [%]', font: { family: 'Arial, sans-serif', size: 13 } }, color: 'black', tickformat: '.1f', range: [0, 110], domain: [0.55, 1], anchor: 'x2' },
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

    Plotly.newPlot('graph', data, layout, { displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d'] })
    Plotly.newPlot('graphBasic', dataBasic, layoutBasic, { displayModeBar: true, displaylogo: false, responsive: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d'] })
}
