# Status

Stand: 2026-10-16, Branch `web` (nicht gemergt).

## Erledigt

- Electron vollständig entfernt; reine Vite-Web-App (`npm run dev | build | preview | test`), Ausgabe `dist/`.
- Prüffälle mit `node --test` (`npm run test`, 19 Tests grün):
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
  - Rate-of-Flow kraftgesteuert in drei Phasen: Anstieg ab 0 mit der Fließratenmethode (wie ohne LSC), bis
    σ(t) = σ_N = F_LSC / t_c; ab diesem Punkt u_ys konstant σ_N (S. 56) bis u_ys + u_gap, beides in der
    Zeitreihe bestimmt (nicht aus u_lsc bzw. Ende Stauchweg der 28-Tage-Kennlinie); danach Fließratenmethode
    weiter ab σ_N. Wird σ_N nie erreicht, staucht das Element nicht. Beginn/Ende { t, u } in
    `lsc.yieldRateOfFlow`. Kriechen, Schwinden und Temperatur zählen ab Belastungsbeginn (siehe *Zu prüfen* unten).
  - μ_SpC wird nicht mehr bei 100 % begrenzt; rote Strichlinie bei 100 %, rotes Band darüber,
    Legende „> 100 %: overloaded (max … %)", Achse in ganzen Prozent.
  - Enhanced-Tab bei F_LSC > 0 mit Untertitel: „FS from 28-day elastic support curve; σ(t) and μ_SpC from
    rate-of-flow method – yield path start/end can differ between both."
  - Screenshot Fall C: `docs/screenshots/web/desktop_enhanced_lsc_caseC.png` (Desktop 1400 px).
- Schnittpunktsuche über alle Segmente der Ausbaukennlinie ab Index 0: FS > 10 wird gefunden
  (Hoek-Fall mit d_face 12 m: vorher FS 0, jetzt FS 14,46).

## Zu prüfen: von Onur gegen Aldrian/Entfellner zu prüfen

**Kriechen, Schwinden und Temperatur ab Belastungsbeginn (nach Ende Stauchweg)** – eingeführt in
Commit 799116f ohne ausdrücklichen Auftrag.

- Was: Mit F_LSC > 0 läuft `rateOfFlow()` nach dem Stauchweg mit `tLoadDays = t_gap_days` weiter
  (t_gap_days = Zeit ab u_io bis Stauchende nach Fließratenmethode).
  Die Zeit in C(t) = A · t_h^0,25 (Kriechen), ε_sh(t) = ε_sh,∞ · t/(t + B) (Schwinden) und
  θ(t) = 250 · t^0,25 (Temperatur) läuft damit ab u_io (Einbau = Belastungsbeginn) weiter, nicht ab Ende Stauchweg.
  E_SpC(t) nutzte schon vorher das wahre Betonalter (Aldrian, Gl. V-41).
- Quelle: Schubert (1988), Umsetzung nach Entfellner (2024), Diss. TU Graz, Kap. 6, Gl. 6.13–6.15;
  im Code steht zu Gl. 6.14 „t measured from initial loading, in hours". **Entfellner liegt nicht in
  `references/`; die Aussage ist nicht am Original geprüft.** Aldrian (1991) liegt ebenfalls nicht vor.
- Begründung: Die Schale ist ab u_io belastet (Anstieg ab 0, dann σ_N, dann Fließratenmethode).
  Ein Neustart bei t = 0 am Ende des Stauchwegs ließe C(t) mit unendlicher Steigung neu beginnen;
  im ersten Schritt würde die Spannung σ_N fast vollständig relaxiert (Commit 799116f).
  Ohne LSC sind Belastungsbeginn und Einbau gleich (t = 0 bei u_io); dort ändert sich nichts.
- Offen: Gilt Schwinden und Temperatur ab Belastungsbeginn oder ab Betonalter 0? Im Modell fallen beide
  auf u_io zusammen; bei einem späteren Einbaualter (t0 > 0) wäre das zu unterscheiden.

## Offene Punkte

1. **LSC mehrstufig** (Quelle: 3 Stufen, Anhang B: 600 / 700 / 1000 kN, 70 / 60 / 50 mm).
2. **Stahlbögen nach Hoek**: noch nicht in der App. Vor Umsetzung klären, ob K_ss nach Gl. 15
   (Hoek, *Rock-Support Interaction*) mit Fig. 13 übereinstimmt.
3. **Prüfung auf echtem Handy** (bisher nur Browser-Emulator 390 × 844).

Weitere Hinweise:

- Fall C (App-Standard mit Ankern, LSC 20 cm, F_LSC 2400 kN/m, σ_N 12 MPa): u 0,08772 m, p 0,6987 MPa,
  FS 2,212, FS (shotcrete) 2,377, Anker 100 %. Stauchbeginn 28-Tage-Kennlinie u 0,06542 m / t 0,120 d,
  Fließratenmethode u 0,06576 m / t 0,149 d; Stauchende 0,09725 bzw. 0,09759 m, in beiden nicht erreicht
  (Gleichgewicht im Plateau). μ_SpC > 100 % von 0,011 bis 0,60 d, Maximum 371 % bei 0,148 d,
  Minimum 41,0 % bei 16,72 d. Kein Spannungssprung mehr am Stauchbeginn.
- Die Zeitreihe endet vor u_eq (LDP-Zuordnung, z. B. F_LSC 600 kN/m, LSC 20 cm, ohne Anker: letzte Stelle
  0,09640 m, u_eq 0,09699 m). Liegt das Stauchende nach Fließratenmethode dazwischen, endet die Zeitreihe
  im Plateau, obwohl die 28-Tage-Kennlinie das Gleichgewicht nach dem Stauchweg hat.
- Anker (App-Standard: T_bf 250 kN, s_l 2 m, s_r 1,5 m, d_b 0,034 m, l_b 3 m) erreichen p_max,bolt
  0,0833 MPa nach Δu = p_bmax_el / k_b_el = 0,0833 / 20,88 = 3,99 mm (nicht 0,2 mm).
- Ungenutzte Abhängigkeiten `regression`, `@turf/helpers`, `@turf/line-intersect`.
- Bündelgröße ~1,8 MB (Plotly), Vite-Warnung „chunk larger than 500 kB".
