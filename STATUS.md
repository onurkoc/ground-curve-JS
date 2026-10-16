# Status

Stand: 2026-10-16, Branch `web` (nicht gemergt).

## Erledigt

- Electron vollständig entfernt; reine Vite-Web-App (`npm run dev | build | preview | test`), Ausgabe `dist/`.
- Prüffälle mit `node --test` (`npm run test`, 15 Tests grün):
  - Hoek, *Rock-Support Interaction* Fig. 4/6/7/13 (D 10 m, c 1500 kPa, φ 23°, E 1800 MPa, ν 0,3, p0 7 MPa, d_face 5 m):
    alle Sollwerte innerhalb der Rundung der Quelle; u_if/u_im 0,2625 vs. 0,2622 (Hoek dividiert durch gerundetes u_im).
  - RocSupport Verification Manual Problem 5 (r_pm, 4 Fälle): Abweichungen ≤ 0,005 m.
  - Gschwandtner Anhang B (LSC): p_LSC 0,1106 MPa, Δu 11,14 mm, p_max 0,6725 MPa.
  - Golden Values unter `tests/golden/`: Standard, LSC 20 cm, Vortrieb 0,5 m/d (unverändert seit Einführung);
    zusätzlich Regressionsstand für F_LSC > 0 (`lscForce600`, `lscForce2400Plateau`, `lscLongPlateau`) –
    Werte aus der App selbst, keine Quellenwerte.
- Parameter-Tab, optionale Large-strain-Kurve (nur Darstellung), `public/_headers`, Favicon.
- Handy-Layout (≤ 768 px): Seitenleiste einklappbar, Diagramm volle Breite, Legende unter dem Diagramm.
  Desktop unverändert (Screenshots 1400 px pixelgleich). Geprüft nur im Browser-Emulator (390 × 844).
- LSC einstufig nach Gschwandtner: neue Eingabe **F_LSC [kN/m]** (Ringnormalkraft je m Tunnel während der Stauchung),
  p_LSC = F_LSC / r_m, r_m = D/2 − t_c/2 (Anhang D Gl. 2-10 D). Gleichgewicht im Plateau:
  „FS (shotcrete) = p_max / p_LSC" und „remaining yield path" (tangential, mm).
- Schnittpunktsuche über alle Segmente der Ausbaukennlinie ab Index 0: FS > 10 wird gefunden
  (Hoek-Fall mit d_face 12 m: vorher FS 0, jetzt FS 14,46).

## Offene Punkte

1. **LSC mehrstufig** (Quelle: 3 Stufen, Anhang B: 600 / 700 / 1000 kN, 70 / 60 / 50 mm).
2. **Rate-of-Flow während der Stauchung**: Schale derzeit spannungsfrei bis Schlitzende; nach Quelle konstante
   Spannung σ = F_LSC / t_c. Liegt das Gleichgewicht im Plateau, wird das Schlitzende nie erreicht: die
   Rate-of-Flow-Rechnung sieht keine Verformung und liefert nur Schwind-/Temperatur-Zugspannung
   (Standard + LSC 20 cm, F_LSC 2400 kN/m: σ bis −4,19 MPa, μ_SpC ≤ 0). Bis zur Umsetzung nicht aussagekräftig.
3. **Anker unabhängig vom Stauchweg**: Ankerdruck und -steifigkeit werden noch mit der Spritzbetonkennlinie
   um u_gap verschoben (Anker während der Stauchung wirkungslos); nach Gl. V-50 / Abb. V-51 Drücke bei gleichem u addieren.
4. **Handy-Prüfung auf echtem Gerät** (bisher nur Emulator; Enhanced-Tab mit vier Achsen ist auf 390 px eng,
   Achsentitel überlappen teilweise).
5. **Stahlbögen nach Hoek**: noch nicht in der App. Vor Umsetzung klären, ob K_ss nach Gl. 15
   (Hoek, *Rock-Support Interaction*) mit Fig. 13 übereinstimmt.
6. Ungenutzte Abhängigkeiten `regression`, `@turf/helpers`, `@turf/line-intersect`.
7. Bündelgröße ~1,8 MB (Plotly), Vite-Warnung „chunk larger than 500 kB".
