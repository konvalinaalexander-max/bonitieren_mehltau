# Quelldateien des Leitfadens

Aus diesen Dateien entsteht `docs/Leitfaden_Mehltau-Bonitur.pdf`.

- `chapters/*.html`: Kapitel als HTML-Fragmente (Reihenfolge in `build.py`)
- `style.css`, `fonts/`, `title_art.svg`: Gestaltung und Titelbild
- `STYLE.md`: erlaubte HTML-Bausteine und Schreibregeln für Kapitel
- `build.py`: setzt alles zusammen und erzeugt das PDF in zwei Durchläufen
  (der zweite trägt die Seitenzahlen ins Inhaltsverzeichnis ein)
- `preview.py`: zeigt ein einzelnes Kapitel als PNG-Seiten zur Kontrolle

## PDF neu erzeugen

Voraussetzungen: Node.js mit `playwright` (Chromium), Python 3 mit `pypdf`,
`pypdfium2` und `pillow`.

```bash
cd docs/leitfaden-quelle
NODE_PATH=$(npm root -g) python3 build.py
```

Das PDF landet in `docs/Leitfaden_Mehltau-Bonitur.pdf`. Wenn sich Zahlen oder
Entscheidungen ändern, zuerst `docs/SPEZIFIKATION.md` anpassen, dann die
betroffenen Kapitel, dann neu erzeugen.

Schriften: Source Sans 3, Source Serif 4 und Source Code Pro (SIL Open Font
License 1.1).
