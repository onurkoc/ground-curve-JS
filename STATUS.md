# Status

Stand: 2026-10-16, Branch `web` (nicht gemergt).

## Erledigt

- Electron vollständig entfernt; reine Vite-Web-App (`npm run dev | build | preview | test`), Ausgabe `dist/`.
- Prüffälle mit `node --test` (`npm run test`, 8 Tests grün):
  - Hoek, *Rock-Support Interaction* Fig. 4/6/7/13 (D 10 m, c 1500 kPa, φ 23°, E 1800 MPa, ν 0,3, p0 7 MPa, d_face 5 m):
    alle Sollwerte innerhalb der Rundung der Quelle; u_if/u_im 0,2625 vs. 0,2622 (Hoek dividiert durch gerundetes u_im).
  - RocSupport Verification Manual Problem 5 (r_pm, 4 Fälle): Abweichungen ≤ 0,005 m.
  - Golden Values (Standard, LSC 20 cm, Vortrieb 0,5 m/d) unter `tests/golden/`.
- Print-Tab → **Parameter**-Tab (nur Parameterliste, kein Druckfenster).
- Optionale Large-strain-Kurve (Vrakas & Anagnostou 2015), nur Darstellung.
- `public/_headers`, Favicon; Build lokal geprüft (Konsole ohne Fehler), Screenshots unter `docs/screenshots/web/`.
- Analyse LSC vs. Gschwandtner: [docs/LSC-Analyse.md](docs/LSC-Analyse.md).

## Offene Punkte

1. **LSC nach Gschwandtner** (wartet auf Freigabe): konstante Mobilisierungsspannung während des Stauchwegs statt
   offenem Schlitz, p_i = σ · t_c / r_m (Anhang D Gl. 2-10 D), ein- bis dreistufig; Anker nicht mit u_gap verschieben;
   Rate-of-Flow während der Stauchung mit konstanter Spannung. Umsetzungsplan in docs/LSC-Analyse.md, Abschnitt 5.
2. **Stahlbögen nach Hoek**: noch nicht in der App. Vor Umsetzung klären, ob die Steifigkeit K_ss nach Gl. 15
   (Hoek, *Rock-Support Interaction*) mit den Werten in Fig. 13 übereinstimmt.
3. **FS > 10**: Ohne LSC beginnt die Schnittpunktsuche bei Index 2 der Ausbaukennlinie (10 % von p_max).
   Liegt das Gleichgewicht darunter, wird kein Schnittpunkt gefunden und FS = 0 angezeigt.
   Beleg (Test in `tests/hoek.test.js`): Hoek-Gebirge + Spritzbeton (t_c 0,3 m, f_ck 35 MPa, E_c 30000 MPa),
   d_face 12 m → wahres Gleichgewicht p_eq 0,141 MPa, FS 14,5; App FS 0.
4. **Handy-Layout**: Seitenleiste fest 172 px, bei 390 px Breite bleibt für das Diagramm wenig Platz und der Tab
   „Parameter" ist angeschnitten (siehe `docs/screenshots/web/phone_*.png`).
5. Ungenutzte Abhängigkeiten `regression`, `@turf/helpers`, `@turf/line-intersect` (kein Import in `src/`).
6. Bündelgröße ~1,8 MB (Plotly), Vite-Warnung „chunk larger than 500 kB".
