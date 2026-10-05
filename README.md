# Bonitieren Mehltau

Handy-App zur Bonitur von Falschem Mehltau an Basilikum: Topf in eine Fotobox
mit einheitlichem Licht stellen, von oben fotografieren – die App misst
Pflanzenfläche und Anteil gesund-grüner, gelblicher und brauner Blattfläche
und leitet daraus eine Befallsnote ab (sichtbare Symptome von oben, keine
Mehltau-Diagnose).

**Stand (05.10.2026):** Analyse-Kern, Analyse-Werkstatt, Handy-App, Druckseite
für Topf-Karten und die Pilot-Vorlagen sind vorab gebaut und mit künstlichen
Fotos getestet. Als Nächstes: Entscheidungen aus Etappe 0, Fotobox bauen,
Pilot. Details in [docs/FORTSCHRITT.md](docs/FORTSCHRITT.md).

## Programme

| Was | Wo | Wofür |
|---|---|---|
| Handy-App | [`app/`](app/) | am Box-Handy: Sitzungen, Fotos, Analyse, Export |
| Analyse-Werkstatt | [`werkstatt/`](werkstatt/), als Einzeldatei [`dist/analyse-werkstatt.html`](dist/analyse-werkstatt.html) | am PC: Pilot auswerten, Einrichten, Schwellen, Go/No-Go |
| Druckseite | [`etiketten/`](etiketten/) | Topf-Karten mit QR-Code, Maßstab-Karte |
| Vorlagen | [`vorlagen/`](vorlagen/) | Topf-Karten P001–P200, Pilot-Excel, Bonitur-Bogen |

Nach dem Einschalten von GitHub Pages (Quelle „GitHub Actions“) erscheinen App,
Werkstatt und Druckseite unter `https://<konto>.github.io/bonitieren_mehltau/`.

## Unterlagen

- [docs/Leitfaden_Mehltau-Bonitur.pdf](docs/Leitfaden_Mehltau-Bonitur.pdf) – **Leitfaden:** Schritt für Schritt von der Fotobox bis zur fertigen App
- [docs/SPEZIFIKATION.md](docs/SPEZIFIKATION.md) – verbindliche Zahlen, Entscheidungen und technische Vorgaben
- [docs/FORTSCHRITT.md](docs/FORTSCHRITT.md) – Stand der Bausteine B1–B9
- [CLAUDE.md](CLAUDE.md) – Projektregeln und Aufbau für die Arbeit mit Claude
- [KONZEPT.md](KONZEPT.md) – Machbarkeit, Messprinzip, Fotobox, App, Fahrplan
- [RECHERCHE.md](RECHERCHE.md) – Selbst bauen oder fertige App? Marktüberblick mit Quellen

## Für Entwickler

```
npm ci        # einmalig (nur esbuild für die Einzeldatei der Werkstatt)
npm test      # alle automatischen Tests
npm run test:browser       # Ablauf von App, Werkstatt und Druckseite im Browser (Playwright)
node werkzeuge/bauen.mjs   # dist/analyse-werkstatt.html neu bauen
```

App und Werkstatt laufen ohne Build direkt aus den Ordnern, z. B. mit
`python3 -m http.server` im Hauptordner und `http://localhost:8000/app/`.
