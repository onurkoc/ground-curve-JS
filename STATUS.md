# Status

Stand: 2026-10-21, Branch `web` (nicht gemergt).

## Erledigt

- Electron vollständig entfernt; reine Vite-Web-App (`npm run dev | build | preview | test`), Ausgabe `dist/`.
- Prüffälle mit `node --test` (`npm run test`, 28 Tests grün):
  - Hoek, *Rock-Support Interaction* Fig. 4/6/7/13 (D 10 m, c 1500 kPa, φ 23°, E 1800 MPa, ν 0,3, p0 7 MPa, d_face 5 m):
    alle Sollwerte innerhalb der Rundung der Quelle; u_if/u_im 0,2625 vs. 0,2622 (Hoek dividiert durch gerundetes u_im).
  - RocSupport Verification Manual Problem 5 (r_pm, 4 Fälle): Abweichungen ≤ 0,005 m.
  - Gschwandtner Anhang B (LSC): p_LSC 0,1106 MPa, Δu 11,14 mm, p_max 0,6725 MPa.
  - RocSupport-Vergleich nur Spritzbeton (D 11 m, siehe unten): u_eq 81,76 mm wie RocSupport.
  - Golden Values unter `tests/golden/`: Werte aus der App selbst, keine Quellenwerte; zuletzt mit Entscheid 2
    (ideal-plastisch) neu erzeugt.
- Parameter-Tab, optionale Large-strain-Kurve (nur Darstellung), `public/_headers`, Favicon.
- Handy-Layout (≤ 768 px): Seitenleiste einklappbar, Diagramm volle Breite, Legende unter dem Diagramm,
  keine Plotly-Werkzeugleiste, Enhanced-Tab mit vier untereinander liegenden Diagrammen (scrollbar).
- LSC einstufig nach Gschwandtner (2010):
  - Eingabe „LSC force" (F_LSC [kN/m], Ringnormalkraft je m Tunnel während der Stauchung) und „LSC"
    (Stauchweg) mit Hilfetext in der Seitenleiste; p_LSC = F_LSC / r_m, r_m = D/2 − t_c/2 (Anhang D Gl. 2-10 D);
    Stauchen nur, wenn p_LSC < p_max,SpC.
  - Ausgaben: FS (total), FS (shotcrete), Anker-Auslastung, im Plateau verbleibender Stauchweg (tangential, mm).
  - Rate-of-Flow kraftgesteuert in drei Phasen: Anstieg ab 0 mit der Fließratenmethode (wie ohne LSC), bis
    σ(t) = σ_N = F_LSC / t_c; ab diesem Punkt u_ys konstant σ_N (S. 56) bis u_ys + u_gap, beides in der
    Zeitreihe bestimmt (nicht aus u_lsc bzw. Ende Stauchweg der 28-Tage-Kennlinie); danach Fließratenmethode
    weiter ab σ_N. Wird σ_N nie erreicht, staucht das Element nicht. Beginn/Ende { t, u } in
    `lsc.yieldRateOfFlow`. Kriechen, Schwinden und Temperatur zählen ab Belastungsbeginn (siehe *Zu prüfen* unten).
  - Der Hinweis „FS aus 28-Tage-Kennlinie, σ(t)/μ_SpC aus Fließratenmethode" steht im README unter LSC.
- μ_SpC nicht bei 100 % begrenzt; rote Strichlinie bei 100 %, rotes Band darüber, Legende
  „> 100 %: overloaded (max … %)", Achse in ganzen Prozent.
- Ausbaukennlinie und Gleichgewicht nach Entscheid 2 (siehe unten): Spritzbeton und Anker ideal-plastisch mit
  unbegrenztem Plateau, Überlagerung bei gleichem u, FS (total) nach Hoek Gl. (13), Legende „shotcrete yielding" /
  „bolts yielding", FS (total) < 1,35 rot.
- Kein Gleichgewicht nur, wenn die Gebirgskennlinie auf ganzer Länge über der Gesamtkurve liegt (praktisch nur
  ohne Ausbau): FS „–", Meldung „no equilibrium – support capacity insufficient" im Basic- und Enhanced-Tab;
  New LDP, Stress (actual), μ_SpC und die 80-%-/100-%-Linien ausgeblendet, Org. LDP und Stress (target) bleiben.
- Schnittpunktsuche über alle Segmente der Ausbaukennlinie ab Index 0, Plateaus eingeschlossen: FS > 10 wird
  gefunden (Hoek-Fall mit d_face 12 m: FS 14,46).
- **Fehler korrigiert: LDP unter Stützdruck, Zeitreihe endete vor u_eq.**
  - Fehler: u_im(p_i) der LDPs für die Zeitzuordnung (`u_im_updated`, `u_im_inc`) hatte den zweiten Term
    −(1 − 2ν)·p_o (nur für p_i = 0 gültig). Die LDP lag um r_o(1 + ν)(1 − 2ν)·p_i / E unter der
    Gebirgskennlinie; `ldpInverse()` gab für die letzten Schritte null zurück, die Zeitreihe endete
    0,18 mm (Standard) bis 0,59 mm vor u_eq. Folge: Phase 3 der LSC-Zeitreihe wurde bei F_LSC 600 kN/m,
    LSC 20 cm nicht erreicht.
  - Korrektur: Hoek, *Rock-Support Interaction*, Gl. (7) (S. 4): −(1 − 2ν)(p_o − p_i). Zeitreihe bis
    |u − u_eq| < 0,01 mm (Schlusspunkt bei u_eq − 0,005 mm), höchstens x = 100 m; letzter Punkt bei der
    Unterabtastung immer erhalten. u_im bei p_i = 0 (Gebirgskennlinie, Original-LDP) unverändert.
  - Bitgleich geblieben: FS, u_eq, p_eq, Gebirgs- und Ausbaukennlinie, Hoek- und RocSupport-Prüfgrößen.
  - Desktop v1.8.1 (Tag `v1.8.1`, Commit 50780c8) hat denselben Fehler
    (`src/physics/groundCurveCalc.js` Z. 240–241 und 251–252).
- Screenshots unter `docs/screenshots/web/` auf dem Stand von Entscheid 2 (Standard Desktop/Handy, mit Large
  strain, Fälle A, B, C, RocSupport-Vergleich mit/ohne Anker); `desktop_parameter.png`, `phone_parameter.png`
  und `phone_sidebar_open.png` unverändert.

## Entscheide Onur

### Entscheid 1 (2026-10-21, nach Vergleich mit RocSupport)

- **(a) Kombination Spritzbeton + Anker:** immer getrennte Kurven ab u_io, Drücke bei gleichem u addiert
  (Gschwandtner Gl. V-50), auch ohne LSC. Der alte Pfad „p_max und K addieren, ein gemeinsamer Fließpunkt"
  ist entfallen. RocSupport kombiniert anders; kombinierte Ergebnisse sind nicht vergleichbar. *Gilt weiter.*
- ~~**(b) Spritzbeton bei p_max,SpC versagt:** kein Gleichgewicht danach, auch nicht mit Ankern; Ausbaukennlinie
  endet bei p_max,SpC; FS (total) = Ausbaudruck bei p_max,SpC / p_eq.~~ **Ersetzt durch Entscheid 2** (2026-10-21).
- **(c) σ(t) aus der Fließratenmethode wird nicht auf die Festigkeit begrenzt;** Überlastung (μ_SpC > 100 %)
  wird nur angezeigt. *Gilt weiter.*

### Entscheid 2 (2026-10-21, ersetzt Entscheid 1 (b))

- **(a)** Spritzbeton und Anker linear-elastisch / ideal-plastisch nach Hoek (Fig. 8, Fig. 14): nach p_max
  waagerechtes Plateau, unbegrenzt (dargestellt bis zum Ende der Gebirgskennlinie). Kein Versagen bei p_max.
- **(b)** Kombination: Überlagerung beider Kennlinien bei gleichem u (Gschwandtner Gl. V-50), jede Komponente
  mit eigenem Plateau; Gesamtkurve stückweise linear bis zur Summe aller p_max, danach waagerecht.
- **(c)** FS nach Hoek Gl. (13): FS (total) = p_max,gesamt / p_eq (Summe aller p_max); FS (shotcrete) =
  p_max,SpC / p_SpC(u_eq); Anker-Auslastung = p_Anker(u_eq) / p_max,Anker. Komponente auf dem Plateau:
  Legende „shotcrete yielding" bzw. „bolts yielding". FS (total) < 1,35 in der Legende rot (nur Darstellung).
- **(d)** Gilt auch für reinen Spritzbeton- bzw. reinen Ankerausbau und mit LSC (Plateau des Spritzbetons nach
  dem letzten Anstieg).

Auswirkung, Stand 2bd77d8 (Entscheid 1 (b)) → Entscheid 2
(u_eq [mm] / p_eq [MPa] / FS (total) / FS (shotcrete) / Anker-Auslastung):

| Fall | 2bd77d8 | Entscheid 2 |
|---|---|---|
| Standard (Golden `defaults`, `rateOfFlow`) | 66,89 / 1,2869 / 1,194 / 1,19 / 74 % | 66,89 / 1,2869 / 1,201 / 1,19 / 74 % |
| Fall A | no equilibrium – capacity insufficient | 112,16 / 0,8455 / 1,000 / 1,00 / 100 %, beide yielding |
| Fall B | no equilibrium – shotcrete fails | 76,22 / 0,8112 / 1,042 / 1,00 / 80 %, shotcrete yielding |
| Fall C | 87,72 / 0,6987 / 2,212 / 2,38 / 100 % | unverändert (bolts yielding) |
| RocSupport-Vergleich nur Spritzbeton | no equilibrium – capacity insufficient | 81,76 / 0,6725 / 1,000 / – / –, shotcrete yielding |
| RocSupport-Vergleich mit Ankern (T_bf 400 kN) | no equilibrium – shotcrete fails | 76,22 / 0,8112 / 1,322 / 1,00 / 35 %, shotcrete yielding |
| Golden `lsc`, `lscForce600`, `lscForce2400Plateau` | 3,024 / 2,882 / 2,377 | FS unverändert, nur `supportCurve` (Plateau) |
| Golden `lscLongPlateau` | 9,506 | bitgleich (Spritzbeton erreicht p_max erst nach dem Ende der Gebirgskennlinie) |
| Hoek Spritzbeton / Anker / d_face 12 m | 3,35 / 1,015 / 14,463 | unverändert, Prüfgrößen bitgleich |
| RocSupport Problem 5 (r_pm geprüft; Ausbau = App-Standard) | FS 8,132 / 12,972 / 8,592 / 14,050 | FS 8,233 / 13,135 / 8,700 / 14,226 |

RocSupport-Vergleich (γ 18,3, H 443, ν 0,3, E 1050 MPa, c 1000 kPa, φ 28°, D 11 m, f_ck 25, E_c 15000, ν_c 0,2,
t_c 0,15, d_face 2, Vortrieb 2, ohne LSC):

- Nur Spritzbeton: RocSupport u_eq 81,76 mm, FS 0,64; App u_eq 81,76 mm, FS 1,00. Gleichgewicht auf dem Plateau
  (p_eq = p_max,SpC 0,6725 MPa). RocSupport verlängert bei fließendem Ausbau die elastische Gerade bis zur
  Gebirgskennlinie (p = 1,0455 MPa) und gibt FS = p_max / p = 0,643; die App nach Hoek Gl. (13)
  FS = p_max / p_eq = 1. Nachgerechnet in `tests/equilibrium.test.js`; im RocSupport-Handbuch nicht nachgelesen.
- Mit Ankern (T_bf 400 kN, s_l = s_r = 1 m, d_b 0,02 m, l_b 10 m): RocSupport u_eq 86,89 mm, FS 1,92; App
  u_eq 76,22 mm, FS 1,322 (andere Kombinationsregel, nur zur Information).


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
4. **Desktop v1.8.1** enthält den korrigierten u_im(p_i)-Fehler noch (siehe *Erledigt*); kein neues Release geplant.

   Ende der Zeitreihe vor/nach der Korrektur:

   | Fall | u_eq [m] | Ende alt u [m] / t [d] | Ende neu u [m] / t [d] |
   |---|---|---|---|
   | (a) Standard ohne LSC | 0,06689 | 0,06672 / 14,03 | 0,06689 / 13,74 |
   | (b) F_LSC 600, LSC 20 cm, ohne Anker | 0,09699 | 0,09640 / 14,22 | 0,09699 / 17,23 |
   | (c) Fall C | 0,08772 | 0,08714 / 16,72 | 0,08771 / 15,70 |

Weitere Hinweise:

- Fall C (App-Standard mit Ankern, LSC 20 cm, F_LSC 2400 kN/m, σ_N 12 MPa): u 0,08772 m, p 0,6987 MPa,
  FS 2,212, FS (shotcrete) 2,377, Anker 100 %. Stauchbeginn 28-Tage-Kennlinie u 0,06542 m / t 0,119 d,
  Fließratenmethode u 0,06577 m / t 0,147 d; Stauchende 0,09725 bzw. 0,09759 m, in beiden nicht erreicht
  (Gleichgewicht im Plateau). μ_SpC > 100 % von 0,011 bis 0,59 d, Maximum 375 % bei 0,145 d,
  Minimum 41,2 % bei 15,70 d (Ende der Zeitreihe, u 0,08771 m). Kein Spannungssprung am Stauchbeginn.
- Anker (App-Standard: T_bf 250 kN, s_l 2 m, s_r 1,5 m, d_b 0,034 m, l_b 3 m) erreichen p_max,bolt
  0,0833 MPa nach Δu = p_bmax_el / k_b_el = 0,0833 / 20,88 = 3,99 mm (nicht 0,2 mm).
- Ungenutzte Abhängigkeiten `regression`, `@turf/helpers`, `@turf/line-intersect`.
- Bündelgröße ~1,8 MB (Plotly), Vite-Warnung „chunk larger than 500 kB".
