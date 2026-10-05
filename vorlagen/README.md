# Vorlagen

Druck- und Excel-Vorlagen für Pilot und Betrieb. Sie enthalten keine Betriebsdaten.

| Datei | Wofür | Hinweise |
|---|---|---|
| `topfkarten_pilot.pdf` | Topf-Karten P001–P200 (85 × 55 mm, 10 je A4-Seite, 20 Seiten) | große Nummer und QR-Code mit der Topf-ID; die Werkstatt ordnet Fotos damit auch ohne Dateinamen zu |
| `massstab_karte.pdf` | Maßstab-Karte 10 × 10 cm (2 je Seite, eine als Ersatz) | gemessen wird die äußere Kante des schwarzen Rahmens |
| `pilot_bonitur_vorlage.xlsx` | Excel für den Pilot: Blätter „Bonitur“, „Wiederholung“, „Lichttest“, „Anleitung“ | Spalten wie in `docs/SPEZIFIKATION.md`; Auswahllisten für Noten (0–4), ja/nein, Zeitpunkt, Hallenlicht |
| `bonitur_bogen_pilot.pdf` | Kopiervorlage Bonitur-Bogen (Leitfaden 6.8) | je Person und Sitzung ein Bogen |
| `projekttagebuch.xlsx` | Projekttagebuch (Leitfaden 1.6) | nach jedem Arbeitsschritt eine Zeile: Datum, Erledigtes, Entscheidungen, offene Fragen |

## Drucken

- Im Druckdialog **„Tatsächliche Größe“ bzw. „100 %“** wählen, nicht „An Seite anpassen“.
- Danach das Kontrollmaß oben auf der Seite nachmessen: genau 50 mm. Eine Karte nachmessen: 85 × 55 mm.
- Mattes Papier oder dünnen Karton verwenden, nicht glänzend laminieren (Spiegelungen).

## Andere Nummern drucken

Die Druckseite [`etiketten/`](../etiketten/) erzeugt Karten für beliebige Nummern (Bereich, Liste
oder aus Excel), wahlweise mit oder ohne QR-Code, mit Satz und Sorte in kleiner Schrift.
Im Browser öffnen → Nummern eintragen → „Drucken …“ (oder „Als PDF speichern“).

## Neu erzeugen

- Excel und Bonitur-Bogen: `python3 werkzeuge/vorlagen-erzeugen.py` (braucht `openpyxl` und `pypdf`).
- Topf-Karten und Maßstab-Karte: Druckseite `etiketten/?praefix=P&von=1&bis=200&stellen=3` bzw.
  `etiketten/?art=massstab` im Browser öffnen und als PDF drucken.
