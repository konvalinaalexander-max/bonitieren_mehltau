# CLAUDE.md – Projektregeln „Mehltau-Bonitur“

Diese Datei liest Claude vor jeder Arbeit. Sie beschreibt, wie wir zusammenarbeiten,
wie das Projekt aufgebaut ist und worauf beim Ändern zu achten ist.

## Worum es geht

Topfbasilikum wird in einer Fotobox (einheitliches Licht, Farbkarte, Handy oben) von oben
fotografiert. Das Programm misst Pflanzenfläche und den Anteil grüner, gelber und brauner
Blattfläche und macht daraus über eine Notentabelle eine Befallsnote. Gemessen werden
**sichtbare Symptome von oben – keine Mehltau-Diagnose**.

Grundlagen: `docs/Leitfaden_Mehltau-Bonitur.pdf` (Schritt für Schritt), `docs/SPEZIFIKATION.md`
(verbindliche Zahlen; bei Abweichungen gilt sie), `KONZEPT.md`, `docs/FORTSCHRITT.md` (Stand B1–B9).

## Zusammenarbeit

- Der Projektinhaber programmiert nicht. Alles in **einfachem Deutsch** erklären, Fachbegriffe
  vermeiden oder kurz erklären.
- **Erst Plan (5–10 Zeilen), dann auf OK warten.** Kleine Schritte, ein Baustein je Sitzung.
- Zu jeder Funktion Tests schreiben und **alle** Tests laufen lassen (`npm test`).
- Doku aktuell halten: `docs/FORTSCHRITT.md`, `docs/SPEZIFIKATION.md`, diese Datei.
- Zum Schluss Pull Request mit einfacher Erklärung: was gemacht wurde und wie man es
  **am Box-Handy bzw. am Firmen-PC** prüft.
- Darf Claude Dateien in `.github/workflows/` nicht hochladen: Zweig, Dateiname und Inhalt
  nennen und erklären, wie der Inhaber sie selbst anlegt.

## Daten und Datenschutz

- **Keine echten Betriebsdaten ins Repository** – einzige Ausnahme: `referenzbilder/`
  (mit `referenzbilder.xlsx`). Keine Pilot-Excel, keine Exporte, keine Fotos aus dem Betrieb.
- Personen nur als **Kürzel**, nie mit Namen (auch nicht in Excel-Dateieigenschaften).
- Die **PIN** der App-Einstellungen wird nur am Handy festgelegt (als Hash gespeichert),
  nie ins Repository.
- Die veröffentlichte Seite (GitHub Pages) enthält nur `app/`, `kern/`, `bibliotheken/`,
  `werkstatt/`, `etiketten/`, `dist/`, `vorlagen/` und `index.html` – nie `referenzbilder/`,
  `docs/` oder `tests/` (siehe `werkzeuge/seite-zusammenstellen.sh`).

## Technik

- Reines HTML/CSS/JavaScript (ES-Module), **kein Build-Schritt** für App und Werkstatt;
  Nutzer installieren nichts. Läuft in Chrome auf Android und in Chrome/Edge am PC.
- Bibliotheken liegen als Dateien in `bibliotheken/` (Lizenzen in `bibliotheken/lizenzen/`),
  **nie aus dem Internet laden**: jsQR (QR lesen), qrcode-generator (QR erzeugen),
  SheetJS (Excel), JSZip (ZIP). Nur für Tests: jpeg-js-Decoder in `werkzeuge/`.
- Einzige Ausnahme vom „kein Build“: `dist/analyse-werkstatt.html` – die Werkstatt als eine
  Datei für Doppelklick ohne Server. Nach Änderungen an `werkstatt/` oder `kern/` neu bauen:
  `node werkzeuge/bauen.mjs` und mit einchecken (die Tests in GitHub Actions prüfen das).
- Die schwere Rechnung läuft in einem Web Worker (`kern/analyse-worker.js`), damit die
  Oberfläche nicht hängt. **Werkstatt und App nutzen denselben Kern** – nie kopieren.

## Ordner

| Ordner | Inhalt |
|---|---|
| `kern/` | Analyse-Kern: Farbe (sRGB/Lab/ΔE2000), Farbkarte (24 Felder, 3×3-Korrektur), Verkleinern, Klassen grün/gelb/braun, Kennzahlen, Note, Kontrollbild, Histogramme, QR lesen, EXIF, Statistik (Kappa, Spearman, AUDPC), Einstellungen, Excel |
| `werkstatt/` | Analyse-Werkstatt für den PC (Pilot auswerten, Einrichten, Regler, Go/No-Go, Export); `demo.js` erzeugt einen künstlichen Pilot |
| `app/` | Handy-App (PWA): `app.js` Oberfläche, `db.js` Speicher (IndexedDB), `logik.js` Fachlogik ohne Oberfläche, `export.js` Excel/ZIP, `kamera.js`, `sw.js` Offline-Speicher, `version.js` |
| `etiketten/` | Druckseite Topf-Karten 85 × 55 mm (Nummer + QR) und Maßstab-Karte |
| `vorlagen/` | fertige PDFs und Excel-Vorlage für den Pilot |
| `druckteile/` | OpenSCAD-Dateien der 3D-Druckteile für die Fotobox |
| `bibliotheken/` | fremde Bibliotheken mit Lizenzen |
| `tests/` | automatische Tests (`node --test`), `hilfen.mjs` mit künstlichen Szenen |
| `werkzeuge/` | künstliche Testbilder (`synthetik.js`), Sollwerte der Referenzbilder, Bauen, Seite zusammenstellen, Vorlagen erzeugen |
| `referenzbilder/` | (kommt in Etappe 3) echte Referenzfotos + `referenzbilder.xlsx` |
| `docs/` | Leitfaden (PDF + Quelle), Spezifikation, Fortschritt |
| `dist/` | gebaute Einzeldatei der Werkstatt |
| `.github/workflows/` | `tests.yml` (Tests bei jedem Push/PR), `seite.yml` (GitHub Pages, optional Testversion unter `/vorschau/`) |

## Versionen – immer mitpflegen

- **`ALGORITHMUS_VERSION`** in `kern/einstellungen.js` (jetzt `A-1.0`): erhöhen bei jeder
  Änderung am Rechenweg, die Ergebnisse verschieben kann; dann auch die Sollwerte der
  Referenzbilder neu erzeugen (`node werkzeuge/sollwerte-erzeugen.mjs`) und in
  `docs/SPEZIFIKATION.md` eintragen.
- **Einstellungs-Kennung**: Stände aus der Werkstatt heißen `W1`, `W2` …, Änderungen am Handy
  `W3.H1`, `W3.H2` … – so bekommen Werkstatt und Handy nie dieselbe Kennung. Jede Ergebniszeile
  trägt `algorithmus_version` = Rechenweg/Kennung, z. B. `A-1.0/W3.H1`.
- **`APP_VERSION`** in `app/version.js` **und** `app/sw.js` (gleicher Wert, ein Test prüft das):
  bei jeder Änderung an der App erhöhen, sonst lädt das Handy die neue Fassung nicht.
- **Datenmodell** der App: neue Felder nur ergänzen (`messungErgaenzen` in `app/logik.js`),
  Schema-Änderungen nur als neue Stufe in `MIGRATIONEN` (`app/db.js`) – nie alte ändern.

## Tests

- `npm test` startet alle Tests in `tests/` (Node 22+, keine Installation außer `npm ci`).
- Künstliche Box-Fotos mit genau bekannten Anteilen (`werkzeuge/synthetik.js`): Farbkorrektur,
  Klassen, Befall, QR, Kameras mit Farbstich/Unterbelichtung.
- Rechenbeispiele aus dem Leitfaden: Kappa 0,69 (Tab. 8.1), AUDPC 208,5/88 und 182, SD 1,14,
  Notengrenzen.
- `tests/referenzbilder.test.mjs` vergleicht alle Referenzbilder mit gespeicherten Sollwerten;
  er wird übersprungen, solange `referenzbilder/` fehlt.
- Browser-Tests (Playwright, Ablauf der App und der Werkstatt) liefen in der Entwicklung mit
  künstlichen Fotos; sie sind noch nicht im Repository.

## Bekannte Fallstricke

- Verkleinern geschieht im Kern selbst (`kern/bild.js`), nicht im Browser – so liefern App,
  Werkstatt und Tests exakt dieselben Zahlen.
- Die Regler der Werkstatt bleiben in den Bereichen `BEREICHE` (`kern/einstellungen.js`),
  weil die schnelle Neuberechnung über Histogramme nur dort exakt ist.
- QR-Codes werden in voller Auflösung im Etikettbereich gelesen, sonst im ganzen Bild.
- Auf github.io teilen sich alle Seiten eines Kontos den Browser-Speicher: Datenbank und
  Offline-Speicher der Testversion (`/vorschau/`) sind deshalb getrennt benannt.
- CSS: `[hidden] { display: none !important; }` steht in allen Stylesheets – sonst
  überschreibt z. B. `display: flex` das `hidden`-Attribut.
