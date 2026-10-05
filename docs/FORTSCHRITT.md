# Fortschritt

Stand: 05.10.2026. Alle Bausteine sind **vorab gebaut und mit künstlichen Fotos getestet**
(automatische Tests und Browser-Durchläufe). Was noch fehlt, braucht echte Hardware, echte
Fotos oder Entscheidungen des Inhabers – das steht je Baustein unter „Offen“.

Legende: ✅ gebaut und getestet · 🟡 gebaut, Prüfung mit echter Box/echten Fotos offen · ⬜ offen

| Nr. | Baustein | Stand | Offen |
|---|---|---|---|
| B1 | Analyse-Kern und automatische Tests | 🟡 | Referenzbilder (Etappe 3) ins Repository, Sollwerte erzeugen, 4 Beispiel-Kontrollbilder echter Töpfe in `docs/beispiele/` |
| B2 | Analyse-Werkstatt | 🟡 | mit 5–10 echten Pilotfotos und der Pilot-Excel am Firmen-PC prüfen |
| B3 | App-Grundgerüst, Hosting, offline | 🟡 | Hauptzweig in `main` umbenennen, GitHub Pages einschalten (Quelle: GitHub Actions), App auf dem Box-Handy installieren, Flugmodus-Test |
| B4 | Sitzungen und Stammdaten | 🟡 | Neustart-Test am Box-Handy |
| B5 | Aufnahme, Foto-Import, Foto-Archiv | 🟡 | 10 Fotos aus Open Camera importieren; Hilfslinien in der Box prüfen; Kamera-Test-Seite am Box-Handy (Ergebnis ins Projekttagebuch) |
| B6 | Analyse in der App (+ No-Go-Variante Sicht-Bonitur) | 🟡 | Einstellungsdatei aus Etappe 4; App und Werkstatt mit 5 Referenzbildern vergleichen; Dauer am Box-Handy |
| B7 | QR-Etiketten drucken und lesen | 🟡 | 10 gedruckte Karten im Etikettenhalter fotografieren: alle 10 IDs gelesen? |
| B8 | Export und Datensicherung | 🟡 | Export einer Test-Sitzung (10 Töpfe) am Firmen-PC in Excel öffnen; Teilen an den Cloud-Ordner am Box-Handy ausprobieren |
| B9 | Einstellungen, Übersicht, Verlauf, AUDPC | 🟡 | PIN am Handy festlegen; Kontroll-Pflanze wöchentlich |

## Was es schon gibt

**B1 Analyse-Kern** (`kern/`): Verkleinern auf 1600 Pixel (lange Kante), Farbkorrektur mit allen
24 Feldern (3×3-Matrix in linearem RGB, Sollwerte ColorChecker ab Nov. 2014, Restfehler ΔE2000),
Auswertekreis, HSV, Pflanzenmaske mit Fleckenfilter, Klassen grün/gelb/braun, Glanzlichter,
Kennzahlen (`flaeche_px`, `flaeche_cm2_ca`, `gruen_pct`, `gelb_pct`, `braun_pct`, `befall_pct`,
`gruenwert`), Note über die Notentabelle, Kontrollbild, Qualitätschecks (Farbkarte, Helligkeit,
Kreis, keine Pflanze). Statistik: gewichtetes Kappa, Spearman, Standardabweichung, AUDPC.
Tests mit künstlichen Fotos (bekannte Anteile, Farbstich, Unterbelichtung, QR) und den
Rechenbeispielen des Leitfadens.

**B2 Analyse-Werkstatt** (`werkstatt/`, als Einzeldatei `dist/analyse-werkstatt.html`):
Fotos + Pilot-Excel laden, Einrichten (Farbkarte mit 24 Messquadraten, Topfkreis, Etikett,
Maßstab), Zuordnung über `foto_datei` mit QR-Rückfall, Auswertung, Kontrollbilder (sortiert nach
Abweichung), Streudiagramm, Kappa A–B/App–A/App–B, Spearman, Wiederholbarkeit, Lichttest,
Farbkarten-Quote, unsichtbarer Befall, Regler mit sofortiger Wirkung, Kalibrier-Modus
(Übungs-/Prüfhälfte, Vorschlag für Notengrenzen), Go/No-Go nach Tabelle 8.2, Export
(Ergebnis-Excel, Kontrollbilder-ZIP, Einstellungsdatei, Referenzbilder-Paket). Demo mit
künstlichem Pilot (71 Fotos) zum Ausprobieren.

**B3–B9 Handy-App** (`app/`): installierbar, offline, Hinweis bei neuer Version,
Speicheranzeige, dauerhafter Speicher. Sitzungen (Bonitur, Kontroll-Pflanze, Kalibrierung) mit
Stammdaten (auch als Excel). Foto-Import (mehrere auf einmal, Original unverändert) oder
Direktaufnahme mit Hilfslinien; Kamera-Test (Fähigkeiten, feste Werte, 5 Testfotos, Urteil).
Ergebnis mit Kontrollbild, Kennzahlen, Note, Warnungen, Topf-ID aus dem QR-Code, Hand-Note.
Sicht-Bonitur mit Referenzfotos (No-Go-Variante). Export als Excel + ZIP, Teilen, Löschen erst
nach bestätigter Sicherung. Einstellungen mit PIN, Schwellen/Notentabelle mit Kennung und
Änderungsprotokoll, Einrichten am Handy (Farbkarte, Topfkreis, Etikett, Maßstab). Übersicht je
Satz/Behandlung mit Verlauf und AUDPC, Regelkarte der Kontroll-Pflanze. Testversion unter
`/vorschau/` mit eigenen Daten.

**B7 Druckseite** (`etiketten/`) und **Vorlagen** (`vorlagen/`): Topf-Karten P001–P200,
Maßstab-Karte, Pilot-Excel mit Auswahllisten, Bonitur-Bogen.

**GitHub Actions**: Tests bei jedem Push/Pull Request (Rechnung und kompletter Ablauf im
Browser); Veröffentlichung auf GitHub Pages (nur App, Werkstatt, Kern, Bibliotheken,
Druckseite, Vorlagen).

## Etappen (Leitfaden Kapitel 2)

| Etappe | Inhalt | Stand |
|---|---|---|
| 0 | Entscheidungen, Material | ⬜ Entscheidungen des Inhabers offen (siehe Fragen-PDF) |
| 1 | Fotobox bauen | ⬜ Druckteile vorbereitet (`fotobox/`), Maße fehlen |
| 2 | Box-Handy einrichten | ⬜ |
| 3 | Pilot: Fotos und Sicht-Bonitur | ⬜ Vorlagen fertig |
| 4 | Pilot auswerten (Werkstatt) | ⬜ Werkstatt fertig |
| 5 | Handy-App | 🟡 vorab gebaut |
| 6 | Kalibrieren | ⬜ Werkzeuge fertig (Kalibrier-Modus, Kontroll-Pflanze) |
| 7 | Betrieb | ⬜ |
