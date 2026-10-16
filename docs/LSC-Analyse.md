# LSC (Stauchelemente): Abweichung App ↔ Quelle

Stand: 2026-10-16, Branch `web`. Reiner Analysebericht, **keine Codeänderung**.

Quelle: G. G. Gschwandtner, MSc-Arbeit „Kennlinienverfahren", Kap. V-4.1.5 (S. 56, Abb. V-43/V-44),
Kap. V-4.3 (S. 63, Abb. V-51, Gl. V-50/V-51), Anhang B (S. B 7), Anhang D (S. D 7/D 8, Gl. 2-4 D, 2-9 D, 2-10 D).

Vergleichsrechnungen mit dem unveränderten Rechenkern `groundCurve()` (28-Tage-Kennlinie, elastisch).
Die Quellen-Kennlinie wurde nur im Analyseskript aus den App-Ausgaben (u_io, K, p_max) aufgebaut.

## 1. Gegenüberstellung

| | App (Ist) | Quelle (Gschwandtner) |
|---|---|---|
| Ort | `src/physics/groundCurveCalc.js` Z. 191–206 (Kennlinie), Z. 226–228 (Schnittpunktsuche ab Index 1), Z. 290–305 (Rate-of-Flow erst ab Schlitzende) | Kap. V-4.1.5 S. 56, Abb. V-43/V-44; Kap. V-4.3 S. 63 |
| Verhalten während des Stauchwegs | offener Schlitz: p = 0 von u_io bis u_io + u_gap | Stauchelement mobilisiert eine Spannung, die über den Stauchweg **konstant** bleibt („unter dem Tragvermögen der Spritzbetonschale", S. 56) |
| Stufen | eine (nur Länge `l_yield`) | im Beispiel **dreistufig** (Anhang B 2.7, Abb. V-43): Plateaus ≈ 0,11 / 0,13 / 0,185 MPa |
| Vor der ersten Stufe | – | elastischer Anstieg der SpC-Kennlinie bis zur Mobilisierungsspannung (Abb. V-43: 0 → 0,11 MPa bis u ≈ 0,005 m) |
| Nach dem Stauchweg | elastischer Anstieg K bis p_max | elastischer Anstieg der Spritzbetonkennlinie bis p_max (Abb. V-43: bis 0,63 MPa bei u ≈ 0,040 m, zeitabhängig nach Aldrian) |
| Stauchweg radial | u_gap = l_yield / (2π) | identisch: Plateaulängen in Abb. V-43 ≈ 11 / 9,5 / 8 mm = 70 / 60 / 50 mm ÷ 2π |
| Spritzbetonspannung während der Stauchung | 0 (Rate-of-Flow übersprungen, „shotcrete is free") | konstant σ_N = F/e (Schale wird konstant belastet und gewinnt Zeit für die Festigkeitsentwicklung, S. 56) |
| Kombination mit Ankern | Anker-p_max und -K werden zur SpC addiert und **mit** um u_gap verschoben (Anker während des Schlitzes wirkungslos) | Abb. V-51 / Gl. V-50: Freispielanker + SpC → Drücke bei gleichem u addiert; Ankerkennlinie beginnt unabhängig vom Stauchelement. Stauchelement + SpC: Gl. V-51 (1/K = Σ 1/K_i → während des Fließens K = 0, also Plateau) |

Hinweis zur Benennung: Die Quelle nennt K_ges = Σ K_i „Serienschaltung" (Gl. V-50) und 1/K_ges = Σ 1/K_i
„Parallelschaltung" (Gl. V-51); mechanisch ist es umgekehrt. Die inhaltliche Zuordnung (Anker + SpC: Summe,
Stauchelement + SpC: harmonisch) ist stimmig.

## 2. Ausbaustützdruck aus der Mobilisierungsspannung (wie die Quelle)

Kap. V-4.1.5 nennt keine eigene Gleichung. Die Umrechnung folgt aus **Anhang D, Gl. 2-10 D** (Kesselformel der SpC-Schale):

```
σ_N = p_i · r_m / e_SpC      ⇒      p_i = σ_N · e_SpC / r_m = F / r_m
```

- σ_N: Normalspannung in der SpC-Schale = Mobilisierungsspannung des Stauchelements, bezogen auf den SpC-Querschnitt [MPa]
- e_SpC: Spritzbetondicke [m] (App: `t_c`)
- r_m: Wirkungsradius der inneren Kräfte im Ring = Mittelradius ≈ r_0 − e_SpC/2 [m]
- F = σ_N · e_SpC · 1 m: Ringnormalkraft je m Tunnellänge [kN/m] (Anhang B gibt die Laststufen als F in kN an)

Kontrolle mit Anhang B (r_0 = 5,50 m, e_SpC = 0,15 m → r_m = 5,425 m):

| Stufe | F [kN] | p_k = F/r_m [MPa] | σ_N = F/e [MPa] | Abb. V-43 (abgelesen) | l [mm] | Δu = l/2π [mm] | Abb. V-43 Plateaulänge |
|---|---|---|---|---|---|---|---|
| 1 | 600 | 0,1106 | 4,00 | ≈ 0,11 | 70 | 11,14 | ≈ 11 |
| 2 | 700 | 0,1290 | 4,67 | ≈ 0,13 | 60 | 9,55 | ≈ 9,5 |
| 3 | 1000 | 0,1843 | 6,67 | ≈ 0,185 | 50 | 7,96 | ≈ 8 |

Mit r_0 statt r_m ergäben sich 0,109 / 0,127 / 0,182 MPa; r_m trifft Abb. V-43 besser.
p_max der Schale nach Gl. V-40 bzw. 2-4 D: ½ · 25 · (1 − 5,35² / 5,50²) = **0,6725 MPa** (App identisch 0,6725 MPa; Abb. V-37 ≈ 0,67).

## 3. Auswirkung auf Gleichgewicht und FS

Liegen alle Stufen auf derselben Steifigkeit K, ist der Endast der Quellenkennlinie
p = K · (u − u_io − Σ Δu_k), also **dieselbe Gerade wie in der App**. Die App entspricht damit exakt dem
Quellenmodell mit Mobilisierungsspannung 0. Unterschiede entstehen nur, wenn

1. das Gleichgewicht **im Plateau** (oder in einem Zwischenanstieg) liegt. Quelle: p_eq = p_k bei kleinerem u.
   App: Schnittpunkt erst nach Schlitzende, mehr Verschiebung, weniger Druck, **FS der App zu hoch (auf der unsicheren Seite)**;
2. die Restkonvergenz kleiner ist als der Stauchweg. App findet **keinen** Schnittpunkt (FS = 0),
   Quelle: Gleichgewicht im Plateau;
3. zeitabhängig gerechnet wird (Rate-of-Flow, μ_SpC): Die Quelle belastet die Schale während der Stauchung konstant mit σ_N, die App mit 0;
4. Anker mitwirken: Die App schaltet die Anker während des Schlitzes ab (Verschiebung um u_gap), die Quelle nicht.

Vergleich (28-Tage-elastisch, Schnitt mit der App-Gebirgskennlinie; „Quelle" = Kennlinie nach Abschnitt 2):

| Fall | Eingaben | Stufen p_k [MPa] / Δu [mm] | App u_eq / p_eq / FS | Quelle u_eq / p_eq / FS_SpC |
|---|---|---|---|---|
| A1 | Anhang B: γ 25 kN/m³, H 200 m, D 11 m, c 382 kPa, φ 27,35°, E 846 MPa, ν 0,35; f_ck 25 MPa, E_c 15000 MPa, ν_c 0,2, t_c 0,15 m; T_bf 0; d_face 2 m (*); LSC 18 cm | 0,1106 / 11,1 · 0,1290 / 9,5 · 0,1843 / 8,0 | 0,0921 m / 0,339 MPa / 1,98 | 0,0921 m / 0,339 MPa / 1,98 (Endast) |
| A2 | wie A1, d_face 4 m | dto. | 0,1093 / 0,206 / 3,27 | 0,1093 / 0,206 / 3,27 (Endast) |
| A4 | wie A1, d_face 1 m | dto. | 0,0821 / 0,438 / 1,53 | 0,0821 / 0,438 / 1,53 (Endast) |
| B | App-Standard (γ 20, H 500, ν 0,3, E 1050, c 1000, φ 28, D 8, f_ck 30, E_c 31000, ν_c 0,2, t_c 0,2, d_face 2), T_bf 0, LSC 20 cm, F = 600 kN/m | 0,1538 / 31,8 | 0,0970 / 0,508 / 2,88 | 0,0970 / 0,508 / 2,88 (Endast) |
| C | wie B, F = 2400 kN/m (σ_N = 12 MPa) | 0,6154 / 31,8 | 0,0970 / 0,508 / **2,88** | 0,0916 / 0,615 / **2,38** (Plateau) |
| D | wie B, LSC 80 cm | 0,1538 / 127,3 | **kein Schnittpunkt, FS 0** | 0,1193 / 0,154 / 9,51 (Plateau) |

(*) Anhang B enthält keinen Einbauort. d_face = 2 m liefert u_io = 0,059 m, passend zum Beginn der SpC-Kennlinie in Abb. V-44 (≈ 0,06 m).
App-Gebirgskennlinie für Anhang B: u_im = 0,1496 m (Abb. V-44, Salençon: ≈ 0,15 m).

Im Plateau ist FS_SpC = p_max / p_k nur die Reserve der Schale. Das Stauchelement selbst ist ausgelastet;
maßgebend ist dann zusätzlich der verbleibende Stauchweg (Fall C: 0,0973 − 0,0916 m = 5,7 mm).

## 4. Benötigte Eingaben

| Größe | Symbol | Einheit | Bemerkung |
|---|---|---|---|
| Anzahl Stufen | n | – | 1 … 3 (Quelle: 3) |
| Mobilisierungsspannung je Stufe | σ_LSC,k | MPa | bezogen auf den SpC-Querschnitt; alternativ Ringkraft F_k in kN/m (F = σ · t_c · 1 m). Anhang B: 4,00 / 4,67 / 6,67 MPa bzw. 600 / 700 / 1000 kN |
| Stauchweg je Stufe (tangential, Summe im Ring) | l_k | cm | wie heute `l_yield`; Anhang B: 7,0 / 6,0 / 5,0 cm |

Umrechnung: p_k = σ_LSC,k · t_c / (D/2 − t_c/2), Δu_k = l_k / (2π).
σ_LSC = 0 reproduziert die heutige App exakt; die Golden Values bleiben dafür gültig.

## 5. Vorschlag Umsetzung (nach Freigabe)

1. **Einstufig**: neue Eingabe σ_LSC [MPa], Standard 0. Kennlinie
   [u_io, 0] → [u_io + p_1/K, p_1] → [+Δu, p_1] → [u_iy + Δu, p_max]. Schnittpunktsuche über alle Segmente
   ab Index 0, wenn σ_LSC > 0. Prüffälle: C und D oben, außerdem σ_LSC = 0 ⇒ Golden Values unverändert.
2. **FS-Ausgabe**: bei Gleichgewicht im Plateau FS_SpC = p_max / p_k und den verbleibenden Stauchweg anzeigen.
3. **Rate-of-Flow**: während der Stauchung konstante Spannung σ_LSC in der Schale statt 0 (μ_SpC ändert sich).
4. **Anker**: Ankerkennlinie nicht um u_gap verschieben, Drücke bei gleichem u addieren (Gl. V-50, Abb. V-51).
5. **Mehrstufig** (n ≤ 3). Prüffall Anhang B: Plateaus 0,1106 / 0,1290 / 0,1843 MPa, Δu 11,14 / 9,55 / 7,96 mm,
   p_max 0,6725 MPa; Gleichgewicht A1 (d_face 2 m): u 0,0921 m, p 0,339 MPa, FS 1,98.

Jeder Schritt mit eigenem Commit und Tests. Golden Values nur nach ausdrücklicher Freigabe neu erzeugen.

## Nebenbefund

Die Normalsteifigkeit der Quelle (Gl. V-40 bzw. 2-9 D: K_SN = E(r_A² − r_i²) / ((1 + ν)((1 − 2ν) r_A² + r_i²)), p = K_SN · u / r_A)
unterscheidet sich formal von Hoeks Gleichung in der App. Für Anhang B: Quelle 79,1 MPa/m, App 78,6 MPa/m (−0,6 %).
