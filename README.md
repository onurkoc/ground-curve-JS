# GroundCurve — Tunnel Ground Reaction Analysis (JavaScript)

A web application for analytical pre-design of tunnel support using the **Convergence-Confinement Method (CCM)**. This is the JavaScript reimplementation of the original Python version. It runs entirely in the browser (static site, hosted on Cloudflare Pages); no installation is needed.

## ⬇️ Letzte Desktop-Version v1.8.1

**[GroundCurve-win32-x64.zip](https://github.com/onurkoc/ground-curve-JS/releases/download/v1.8.1/GroundCurve-win32-x64.zip)** — last desktop (Electron) release, Windows x64, no installation required. Extract and run `GroundCurve.exe`. The desktop version is no longer developed; new features are only added to the web app.

---

## Screenshots

### Basic Tab — Ground Reaction Curve
![Basic GRC](docs/screenshots/web/desktop_basic.png)

### Enhanced Tab — Full CCM Dashboard
![Enhanced CCM](docs/screenshots/web/desktop_enhanced.png)

### Enhanced Tab — With LSC Yield Element (desktop v1.8.1)
![Enhanced with LSC](docs/screenshots/App_enhanced_yield.png)

---

## Features

- **Ground Reaction Curve (GRC)** — Mohr-Coulomb elasto-plastic solution (Hoek / Duncan-Fama formulation)
- **Large strain (optional display)** — sidebar checkbox *Large strain (Vrakas & Anagnostou 2015)* overlays the large-strain ground curve in the Basic and Enhanced charts. Display only: equilibrium, FS and LDP are always computed with the small-strain solution.
- **Longitudinal Displacement Profile (LDP)** — Vlachopoulos & Diederichs (2009)
- **Support Characteristic Curve (SCC)** — thick-walled cylinder shotcrete + rock bolt stiffness (Hoek)
- **LSC (Lining Stress Controller) support, single stage** — after Gschwandtner (2010). Inputs:
  - `LSC` = yield path l_yield [cm], tangential (sum over the ring); radial u_gap = l_yield / 2π
  - `F_LSC` = ring normal force carried while the element yields [kN per m tunnel], default 0.
    Support pressure on the plateau p_LSC = F_LSC / r_m with r_m = D/2 − t_c/2 (Anhang D, Gl. 2-10 D)

  Support curve: elastic rise to p_LSC → constant p_LSC over u_gap → elastic rise to p_max.
  F_LSC = 0 gives the former open-slot model (zero pressure until the gap is closed).
  If the equilibrium lies on the plateau, the legend shows *FS (shotcrete) = p_max / p_LSC* and the
  *remaining yield path* (tangential, mm). Background and test values: [docs/LSC-Analyse.md](docs/LSC-Analyse.md)
- **Rate-of-Flow stress model** — time-dependent shotcrete stress accounting for creep, shrinkage and thermal effects (Schubert 1988, Aldrian 1991)
- **Shotcrete utilisation μ_SpC(t)** — σ_actual(t) / σ_capacity(t) × 100 %, with 80 % design limit (γ_F = 1/1.35)
- **Safety factor FS** — at GRC ∩ SCC equilibrium (all support-curve segments are searched, so FS > 10 is found as well)
- **Parameter tab** — summary of all 20 input parameters with units
- **Phone layout** (≤ 768 px) — parameter sidebar behind a *Parameters* button, full-width charts, legend below the chart

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | Vue 3 + PrimeVue 4 (Aura theme) |
| Charts | Plotly.js (cartesian bundle) |
| Build | Vite 5 (static output in `dist/`) |
| Tests | Node.js built-in test runner (`node --test`) |
| Hosting | Cloudflare Pages (see [DEPLOY.md](DEPLOY.md)) |
| Font | Geist |

---

## Installation

Requires Node.js 20 or newer.

```bash
npm install
```

## Development

```bash
npm run dev        # Vite dev server with hot reload
```

## Build and preview

```bash
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
```

## Tests

```bash
npm run test
```

Runs the verification cases against published values (Hoek *Rock-Support Interaction*, RocSupport Verification Manual Problem 5, Gschwandtner Anhang B for the LSC force) and the golden regression baseline in `tests/golden/` (regenerate deliberately with `UPDATE_GOLDEN=1 npm run test`).

---

## Physics References

| Method | Reference |
|---|---|
| CCM (GRC), support curves | Hoek, E. (2007). *Practical Rock Engineering*, chapter "Rock-Support Interaction analysis for tunnels in weak rock masses" |
| Plastic radius check | Rocscience. *RocSupport Verification Manual*, Problem 5 (Duncan-Fama) |
| Large-strain correction | Vrakas, A. & Anagnostou, G. (2015). A simple equation for obtaining finite strain solutions from small strain analyses of tunnels with very large convergences. *Géotechnique* 65(11), 936–944 |
| LDP | Vlachopoulos, N. & Diederichs, M.S. (2009). Improved longitudinal displacement profiles for convergence confinement analysis of deep tunnels. *Rock Mechanics and Rock Engineering* 42(2), 131–146 |
| Lining forces | Möller, S.C. & Vermeer, P.A. (2005). Prediction of settlements and structural forces in linings due to tunnelling. Proc. 5th Int. Conf. of TC28 of the ISSMGE, Amsterdam |
| Shotcrete strength and stiffness (time) | Aldrian, W. (1991). *Beitrag zum Materialverhalten von früh belastetem Spritzbeton*. Dissertation |
| Rate-of-Flow / utilisation | Schubert, P. (1988). Beitrag zum rheologischen Verhalten von Spritzbeton. *Felsbau* 6(3), 150–153; implementation after Entfellner, M. (2024), Dissertation TU Graz, Chp. 6 |
| LSC (yielding elements) | Gschwandtner, G. G. (2010). Masterarbeit, Montanuniversität Leoben, Kap. V-4.1.5 (Stauchelemente), V-4.3, Anhang B, Anhang D Gl. 2-10 D (p_i = F / r_m) |

---

## Credits

Used works & special thanks to:

- **Gunter Gernot Gschwandtner** — MSc thesis
- **Manuel Entfellner** — MSc & PhD thesis
- **Nedim Radoncic** — PhD thesis

---

## License

[MIT](LICENSE) — © 2025 Onur Koc
