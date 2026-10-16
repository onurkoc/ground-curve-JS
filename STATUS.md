# Status

Stand: 2026-10-16, Branch `web` (nicht gemergt).

## Erledigt

- Electron vollständig entfernt; reine Vite-Web-App (`npm run dev | build | preview | test`), Ausgabe `dist/`.
- Prüffälle mit `node --test` (`npm run test`, 18 Tests grün):
  - Hoek, *Rock-Support Interaction* Fig. 4/6/7/13 (D 10 m, c 1500 kPa, φ 23°, E 1800 MPa, ν 0,3, p0 7 MPa, d_face 5 m):
    alle Sollwerte innerhalb der Rundung der Quelle; u_if/u_im 0,2625 vs. 0,2622 (Hoek dividiert durch gerundetes u_im).
  - RocSupport Verification Manual Problem 5 (r_pm, 4 Fälle): Abweichungen ≤ 0,005 m.
  - Gschwandtner Anhang B (LSC): p_LSC 0,1106 MPa, Δu 11,14 mm, p_max 0,6725 MPa.
  - Golden Values unter `tests/golden/`: Standard und Vortrieb 0,5 m/d unverändert seit Einführung (ohne LSC);
    `lsc` (Anker + 20 cm offener Schlitz) seit „Anker unabhängig vom Stauchweg" geändert;
    Regressionsstand für F_LSC > 0 (`lscForce600`, `lscForce2400Plateau`, `lscLongPlateau`) –
    Werte aus der App selbst, keine Quellenwerte.
- Parameter-Tab, optionale Large-strain-Kurve (nur Darstellung), `public/_headers`, Favicon.
- Handy-Layout (≤ 768 px): Seitenleiste einklappbar, Diagramm volle Breite, Legende unter dem Diagramm,
  keine Plotly-Werkzeugleiste, Enhanced-Tab mit vier untereinander liegenden Diagrammen (scrollbar).
  Desktop unverändert (Basic/Enhanced bei 1400 px pixelgleich).
- LSC einstufig nach Gschwandtner (2010):
  - Eingabe **F_LSC [kN/m]** (Ringnormalkraft je m Tunnel während der Stauchung),
    p_LSC = F_LSC / r_m, r_m = D/2 − t_c/2 (Anhang D Gl. 2-10 D); Stauchen nur, wenn p_LSC < p_max,SpC.
  - Spritzbeton- und Ankerkennlinie getrennt ab u_io, Anker nicht um u_gap verschoben, Summe der Drücke
    bei gleichem u (Gl. V-50, Abb. V-51).
  - Ausgaben: FS (total), FS (shotcrete), Anker-Auslastung, im Plateau verbleibender Stauchweg (tangential, mm).
  - Rate-of-Flow: konstante Spannung σ_N = F_LSC / t_c von u_io bis Ende Stauchweg (S. 56), danach weiter ab σ_N;
    Kriechen, Schwinden und Temperatur zählen ab Belastungsbeginn.
- Schnittpunktsuche über alle Segmente der Ausbaukennlinie ab Index 0: FS > 10 wird gefunden
  (Hoek-Fall mit d_face 12 m: vorher FS 0, jetzt FS 14,46).

## Offene Punkte

1. **LSC mehrstufig** (Quelle: 3 Stufen, Anhang B: 600 / 700 / 1000 kN, 70 / 60 / 50 mm).
2. **Stahlbögen nach Hoek**: noch nicht in der App. Vor Umsetzung klären, ob K_ss nach Gl. 15
   (Hoek, *Rock-Support Interaction*) mit Fig. 13 übereinstimmt.
3. **Prüfung auf echtem Handy** (bisher nur Browser-Emulator 390 × 844).

Weitere Hinweise:

- Bei großer Mobilisierungskraft ist der junge Spritzbeton überlastet: Standard ohne Anker, LSC 20 cm,
  F_LSC 2400 kN/m → σ_N 12 MPa, μ_SpC 100 % (begrenzt) bis 0,60 d.
- Ungenutzte Abhängigkeiten `regression`, `@turf/helpers`, `@turf/line-intersect`.
- Bündelgröße ~1,8 MB (Plotly), Vite-Warnung „chunk larger than 500 kB".
