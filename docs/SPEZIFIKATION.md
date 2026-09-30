# Spezifikation: Mehltau-Bonitur per Handy

Verbindliche Zahlen, Entscheidungen und technische Vorgaben für das Projekt.
Claude liest diese Datei vor jeder Arbeit. Grundlage ist der Leitfaden
`docs/Leitfaden_Mehltau-Bonitur.pdf`; bei Abweichungen gilt diese Datei.
Änderungen an Zahlen und Grenzwerten immer hier eintragen, mit Datum.

Stand: 30.09.2026

---

## Regeln für die Arbeit an diesem Projekt

- Der Projektinhaber programmiert nicht. Erklärungen in einfachem Deutsch, ohne
  Fachbegriffe oder mit kurzer Erklärung.
- Kleine Schritte: ein Baustein (B1–B9) pro Sitzung, danach Pull Request.
- Keine echten Betriebsdaten ins Repository, außer den Referenzbildern in
  `referenzbilder/` (mit `referenzbilder.xlsx`). Personen nur als Kürzel.
- Ausgabe der App heißt immer „sichtbare Symptome (von oben)“, keine
  Mehltau-Diagnose.
- Jede Änderung, die Ergebnisse verschieben kann (Rechenweg, Schwellwerte,
  Notentabelle), erhöht die Algorithmus-Version und wird hier eingetragen.

---

## Entscheidungen Etappe 0

*Noch offen – wird in Etappe 0 ausgefüllt (Leitfaden Kapitel 3).*

| Punkt | Entscheidung | Datum |
|---|---|---|
| Boniturskala | – | – |
| Box-Handy (Modell, Android-Version) | – | – |
| Sorten im Pilot (nur grüne) | – | – |
| Topf- und Pflanzenmaße A–G (cm) | – | – |
| Repository öffentlich/privat, Hosting | – | – |
| Pilot-Bonitur: Person A / B (Kürzel), Zeitraum | – | – |
| Datenablage (Ort, Hauptordner) | – | – |

Maße A–G: A Topf oben (Außenkante Rand) · B Topf unten · C Topfhöhe (ca. 11) ·
D größter Pflanzendurchmesser (bis ca. 25) · E Pflanzenhöhe über Topfrand
(bis ca. 25) · F Tisch bis höchste Blattspitze (bis ca. 36) · G Stängel-Büschel
über der Erde (Loch Abdeckscheibe ca. 3). Prüfung: 70 cm − F muss größer als D sein.

---

## Projektüberblick

Topfbasilikum mit Falschem Mehltau (*Peronospora belbahrii*). Topf in eine
Fotobox mit festem Licht, Foto von oben mit einem festen Android-Handy. Die
Software misst Pflanzenfläche und Anteil grün/gelb/braun, berechnet Befall %
und eine Note und exportiert alles nach Excel.

Befall beginnt laut Beratungsliteratur an den unteren Blättern; die Kamera
sieht ihn von oben spät. Vergilbung kann andere Ursachen haben. Rote/violette
Sorten werden nicht unterstützt.

### Etappen

| Etappe | Leitfaden | Inhalt | grobe Dauer |
|---|---|---|---|
| 0 | Kap. 3 | Vorbereitung & Entscheidungen | ca. 1 Woche |
| 1 | Kap. 4 | Fotobox bauen (erst Karton, dann fest) | 1–3 Wochen |
| 2 | Kap. 5 | Box-Handy einrichten | 1 Tag |
| 3 | Kap. 6 | Pilot: Fotos + Sicht-Bonitur, 100–200 Töpfe | 1–2 Wochen |
| 4 | Kap. 8 | Pilot auswerten (Analyse-Werkstatt), Go/No-Go | ca. 1 Woche |
| 5 | Kap. 9 | Handy-App bauen, Bausteine B3–B9 | 3–6 Wochen |
| 6 | Kap. 10 | Kalibrieren & prüfen, 100–200 neue Töpfe | 2–4 Wochen |
| 7 | Kap. 11 | Betrieb | laufend |

Reihenfolge: Das Risiko (funktioniert die Farbauswertung von oben?) wird zuerst
geprüft. B1 (Analyse-Kern) und B2 (Analyse-Werkstatt) entstehen für Etappe 4;
die Handy-App nutzt denselben Kern. Bei No-Go wird die Handy-App ohne
automatische Analyse gebaut (digitale Sicht-Bonitur mit Referenzfotos je
Notenstufe, Foto-Archiv, Excel-Export).

---

## Boniturskala

Eigene Skala des Betriebs, falls vorhanden. Sonst Vorschlag 0–4, angelehnt an
Ben Naim et al. 2025 (*Planta*):

| Note | Bedeutung |
|---|---|
| 0 | keine sichtbaren Symptome |
| 1 | bis 10 % der Blattfläche befallen |
| 2 | über 10 bis 25 % |
| 3 | über 25 bis 50 % |
| 4 | über 50 % oder starke Nekrosen |

---

## Fotobox

- Innenmaß 50 × 50 cm, Höhe 70 cm. Handy liegt auf dem Deckel, Hauptkamera (1×)
  ca. 70 cm über dem Boden, genau über der Topfmitte. Faustregel: Abstand ≈
  Bildbreite an der kurzen Bildseite.
- Rahmen: Holzleisten 20 × 20 mm oder Alu-Profil 2020; 4 × 70 cm, 8 × 46–50 cm;
  8 gedruckte Eckverbinder.
- Wände und Deckel matt weiß (Forex 3–5 mm oder Kapa 5 mm), Vorderwand als
  Klappe (Magnete/Scharniere). Boden matt schwarz oder dunkelgrau.
- Deckel mit Kameraloch ca. 3 cm, gedruckter Handyhalter für genau das Box-Handy.
- 3D-Druckteile (OpenSCAD, parametrisch): Eckverbinder, Handyhalter,
  LED-/Diffusor-Halteleisten, Zentrierring (Maß B), Abdeckscheibe (matt schwarz,
  Durchmesser A + ca. 1 cm, Schlitz bis zur Mitte, Mittelloch ca. 3 cm),
  Farbkarten-Halter (flach, parallel zur Kamera, Bodenecke), Etikettenhalter
  (Schlitz für die Topf-Karte, gegenüberliegende Ecke).
- Licht: 5-V-USB-LED-Streifen, CRI/Ra ≥ 90, 5000–6500 K, ca. 2 m, rundum oben,
  indirekt oder hinter Diffusor. Nicht dimmen.
- Farbkarte: 24 Felder, Calibrite ColorChecker Classic Mini. Karten ab Nov. 2014
  haben neue Sollwerte (Herstellerdaten verwenden).
- Maßstab-Karte: 10 × 10 cm, matt, auf Sockel in typischer Blatthöhe, einmal
  fotografiert → „Pixel je cm²“ (nur ungefähre cm²).
- Kosten ca. 150–250 € ohne Handy; gebrauchtes Handy ca. 80–150 €.

---

## Box-Handy

- Android 10 oder neuer, Hauptkamera ≥ 12 MP, aktueller Chrome, Open Camera muss
  „Camera2-API“ anbieten. Kein iPhone (Open Camera nur Android; Browser kann dort
  Belichtung/Weißabgleich nicht sicher festhalten).
- Open Camera (Leitfaden Tabelle 5.1): Camera2-API · Foto-Modus Standard, ohne
  Blitz · Weißabgleich manuell (Kelvin passend zu den LEDs, z. B. 5500) · ISO fest
  (z. B. 100) · Verschlusszeit fest · Fokus manuell oder gesperrt · ca. 8 MP, 4:3
  (z. B. 3264 × 2448) · JPEG 95 %, kein RAW · Timer 2 s oder Lautstärketaste ·
  Speicherort `DCIM/Bonitur`, Präfix `BOX_` (Dateiname `BOX_JJJJMMTT_hhmmss.jpg`)
  · Ausrichtung Querformat gesperrt · Auto-Level, Gesichtserkennung, Stempel,
  Geotagging aus.

---

## Pilot

- 100–200 Töpfe, je Notenstufe mind. 15–20 (Note 0: 20–40).
- Zwei Personen bonitieren unabhängig: Note, geschätzter Befall %, Sporenrasen
  auf der Blattunterseite ja/nein. Pflanzen trocken fotografieren, keine Blätter
  entfernen.
- Topf-Karte mit groß gedruckter Nummer (später QR) im Etikettenhalter im Bild.
- `pilot_bonitur.xlsx`:
  - Blatt „Bonitur“: `topf_nr`, `datum`, `sorte`, `satz`, `behandlung`,
    `note_A`, `note_B`, `prozent_A`, `prozent_B`, `sporen_unten`, `foto_datei`,
    `bemerkung`
  - Blatt „Wiederholung“: `topf_nr`, `durchgang` (1–5), `foto_datei`, `bemerkung`
  - Blatt „Lichttest“: `topf_nr`, `zeitpunkt` (morgens/mittags/abends),
    `hallenlicht` (an/aus), `foto_datei`, `bemerkung`
- Wiederholbarkeit: 5 Töpfe je 5× (jedes Mal herausnehmen, neu einsetzen).
  Lichttest: 1 Topf morgens/mittags/abends, Hallenlicht an/aus (6 Fotos).
- Referenzbilder: ca. 45–55 Fotos (je Notenstufe 4–6 + 25 Wiederholungsfotos)
  in `referenzbilder/`, dazu `referenzbilder.xlsx` (Blätter „Bonitur“ und
  „Wiederholung“). Alle anderen Pilotfotos bleiben auf dem Firmen-PC.
- Ordner beim Betrieb: `Bonitur/Pilot/` (Excel), `Bonitur/Pilot/fotos/JJJJ-MM-TT/`,
  `Bonitur/Pilot/referenzbilder/`, `Bonitur/Kalibrierung/`,
  `Bonitur/JJJJ/JJJJ-MM-TT_SatzNN/`, `Bonitur/Auswertungen/`.

---

## Analyse

Startwerte, werden im Pilot eingestellt.

1. Bild auf ca. 1600 Pixel lange Kante verkleinern.
2. Farbkorrektur: Farbkarten-Position einmal eingestellt (4 Ecken). Mittelwert
   der 24 Felder (Feldmitte) → 3×3-Farbmatrix per Ausgleichsrechnung auf die
   Sollfarben → auf das ganze Bild. Qualität: Restabweichung ΔE; Warngrenze legt
   Claude fest und dokumentiert sie hier.
3. Auswertekreis um die Topfmitte (einmal eingestellt).
4. HSV: Farbton H 0–360°, Sättigung S 0–1, Helligkeit V 0–1.
5. Pflanzen-Maske: H 15–170°, S ≥ 0,20, V ≥ 0,15. Glanzlicht (V > 0,90 und
   S < 0,15) ignorieren. Kleine Einzelflecken entfernen (Mindestgröße legt Claude
   fest und dokumentiert sie hier).
6. Klassen: grün H ≥ 80° · gelb 45–80° · braun 15–45°.
7. Kennzahlen: `flaeche_px`, `flaeche_cm2_ca` (über Maßstab-Karte), `gruen_pct`,
   `gelb_pct`, `braun_pct`, `befall_pct` = gelb + braun, `gruenwert` (mittlerer
   Farbton in Grad), `note_app`.
8. Umrechnungstabelle (Startwerte, Skala 0–4): 0 unter 2 % · 1: 2–10 % ·
   2: über 10–25 % · 3: über 25–50 % · 4: über 50 %.
9. Kontrollbild: Foto mit eingefärbten Klassen (grün/gelb/braun), Warnungen.
10. Qualitätschecks: Farbkarte gefunden & ΔE ok · Belichtung ok · Pflanze gefunden
    (Mindestfläche) · Topf-ID gelesen.

Technik: reines JavaScript im Browser, keine Installation. Bibliotheken lokal
im Repository: jsQR (QR lesen), SheetJS (Excel), JSZip (ZIP). Ideen aus
LeafScan (MIT-Lizenz) dürfen genutzt werden. Algorithmus-Version beginnt bei
`A-1.0`.

---

## Analyse-Werkstatt

Webseite im PC-Browser (Chrome/Edge). Ordner mit Fotos + Bonitur-Excel wählen,
alles wird lokal ausgewertet (Fotos verlassen den PC nicht). Einrichtung:
4 Ecken der Farbkarte, Auswertekreis, Maßstab-Karte. Ergebnis: Ergebnis-Excel,
Kontrollbilder, Streudiagramm (App-Befall % gegen Menschen-Note),
Übereinstimmung (gewichtetes Kappa, Spearman), Wiederholbarkeit, „unsichtbarer
Befall“, Regler für die Schwellwerte mit sofortiger Wirkung. Einstellungen
lassen sich als Einstellungsdatei speichern und in der App laden.

---

## Go/No-Go

Vorschlag. Kappa = quadratisch gewichtetes Kappa. Kappa App–Menschen = Mittel
aus Kappa App–A und App–B.

- **GO:** Kappa App–Menschen ≥ 0,6 · höchstens 0,1 unter Kappa A–B · Streuung
  (Standardabweichung) von Befall % bei den 5×-Fotos ≤ 2 Prozentpunkte je Topf ·
  Farbkarte in ≥ 95 % der Fotos erkannt.
- **NACHBESSERN:** Kappa 0,4–0,6, Wiederholbarkeit schlecht, beim ersten
  Durchgang auch Kappa unter 0,4, oder Go knapp verfehlt → Licht, Abdeckscheibe,
  Schwellen, evtl. Schrägfoto; Teil-Pilot mit 30–50 Töpfen.
- **NO-GO:** Kappa unter 0,4 auch nach Nachbessern, oder zu viele Töpfe mit
  Sporen unten, aber App-Befall unter 1 % (Grenze vorher festlegen) → Handy-App
  ohne automatische Analyse.

---

## Handy-App

- PWA: HTML/CSS/JavaScript, offline nach dem ersten Öffnen, kein App Store.
- Hosting: GitHub Pages (kostenlos bei öffentlichem Repository; bei privatem
  Repository kostenpflichtiges GitHub-Abo). Alternativen: Cloudflare Pages,
  Netlify. HTTPS nötig für die Kamera.
- Bildschirme: (1) Start – Sitzung starten (Datum, Kürzel, Satz/Versuch), frühere
  Sitzungen, Export · (2) Aufnahme – Kamera-Vorschau mit Hilfslinien oder
  Foto-Import aus Open Camera · (3) Ergebnis – Kontrollbild, Kennzahlen, Note,
  Topf-ID (änderbar), Warnungen, Speichern/Wiederholen · (4) Übersicht – Tabelle,
  Mittelwerte je Satz/Behandlung, Verlauf · (5) Export – Excel + ZIP,
  Sicherungs-Erinnerung · (6) Einstellungen (geschützt) – Farbkarte,
  Auswertekreis, Schwellwerte, Notentabelle, QR-Etiketten, Versionen.
- Speicherung in IndexedDB, dauerhafter Speicher anfordern. Fotos erst nach
  bestätigtem Export löschen.
- Datenfelder je Messung (Excel-Spalten): `mess_id`, `datum_zeit`, `mitarbeiter`,
  `sitzung_id`, `topf_id`, `satz`, `sorte`, `behandlung`, `tisch`, `foto_datei`,
  `flaeche_px`, `flaeche_cm2_ca`, `gruen_pct`, `gelb_pct`, `braun_pct`,
  `befall_pct`, `gruenwert`, `note_app`, `note_manuell`, `qualitaet`,
  `algorithmus_version`, `app_version`, `handy_modell`, `bemerkung`.
- Versionen: `app_version` zählt jede Änderung; `algorithmus_version` nur
  Änderungen, die Ergebnisse verschieben können.
- Repository-Aufbau (Vorschlag, genau festgelegt in B1 und `CLAUDE.md`):
  `kern/`, `werkstatt/`, `app/`, `bibliotheken/`, `tests/`, `referenzbilder/`,
  `docs/` (Spezifikation, `FORTSCHRITT.md`, Pilotbericht), `.github/workflows/`.
- Tests: Zu jedem Referenzbild ein gespeicherter Sollwert; GitHub Actions
  rechnet bei jedem Pull Request alle Referenzbilder neu.

### Bausteine

| Nr. | Inhalt | Etappe |
|---|---|---|
| B1 | Analyse-Kern + automatische Tests mit Referenzbildern, `CLAUDE.md`, `docs/FORTSCHRITT.md` | 4 |
| B2 | Analyse-Werkstatt | 4 |
| B3 | App-Grundgerüst, Hosting, offline (PWA) | 5 |
| B4 | Sitzungen & Stammdaten (Sätze, Sorten, Behandlungen, Kürzel) | 5 |
| B5 | Aufnahme/Import + Foto-Archiv | 5 |
| B6 | Analyse in der App, Kontrollbild, Qualitätschecks | 5 |
| B7 | QR-Etiketten drucken + QR aus dem Foto lesen | 5 |
| B8 | Export (Excel + ZIP) + Sicherungs-Erinnerung | 5 |
| B9 | Einstellungen/Kalibrierung, Übersicht, Verlauf, AUDPC | 5 |

---

## Kalibrieren

- 100–200 neue Töpfe (nicht die Pilot-Töpfe), zwei Personen, `note_manuell`.
- Schwellen und Umrechnungstabelle an der Übungshälfte einstellen, an der
  Prüfhälfte prüfen. Freigabe mit denselben Kriterien wie GO.
- Neu prüfen bei neuer Sorte, neuer Saison, neuem Handy, neuen LEDs, neuer
  Farbkarte, geändertem Algorithmus; zusätzlich vierteljährlich 20 Töpfe doppelt.
- Kontroll-Pflanze (Kunstpflanze) wöchentlich fotografieren; Werte müssen im
  Toleranzband bleiben.

---

## Betrieb

- Kurzanleitung an der Box (Leitfaden 11.2).
- Nach jeder Sitzung Excel + Foto-ZIP nach `Bonitur/JJJJ/JJJJ-MM-TT_SatzNN/`
  sichern. Browser-Speicher ist kein Archiv.
- Auswertung: Mittelwerte je Satz/Behandlung/Termin, Verlauf, AUDPC = Summe über
  aufeinanderfolgende Termine von (Befall₁ + Befall₂) / 2 × Tage dazwischen.
- Datenschutz: nur Kürzel.

---

## Quellen

- Ben Naim et al. 2025, *Planta*: https://pmc.ncbi.nlm.nih.gov/articles/PMC12122581/
- UMN Extension: https://extension.umn.edu/diseases/basil-downy-mildew
- Cornell: https://www.vegetables.cornell.edu/pest-management/disease-factsheets/basil-downy-mildew/
- LeafScan (MIT): https://github.com/LeonLenzo/leaf-scan
- PlantCV Farbkorrektur: https://docs.plantcv.org/en/latest/transform_correct_color/
- Open Camera: https://opencamera.org.uk/
- X-Rite/Calibrite Sollwerte ab 2014: https://www.xrite.com/en/service-support/new_color_specifications_for_colorchecker_sg_and_classic_charts
