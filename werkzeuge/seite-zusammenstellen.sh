#!/usr/bin/env bash
# Stellt die veröffentlichte Seite zusammen: nur App, Werkstatt, Kern, Bibliotheken,
# Druckseite und Vorlagen – nie referenzbilder/, docs/, tests/ oder Betriebsdaten.
# Aufruf: werkzeuge/seite-zusammenstellen.sh ZIEL [QUELLE]
set -euo pipefail
ZIEL="${1:?Zielordner fehlt}"
QUELLE="${2:-.}"
mkdir -p "$ZIEL"
for ordner in app kern bibliotheken werkstatt etiketten dist vorlagen; do
  if [ -d "$QUELLE/$ordner" ]; then cp -R "$QUELLE/$ordner" "$ZIEL/"; fi
done
cp "$QUELLE/index.html" "$ZIEL/"
touch "$ZIEL/.nojekyll"
# Sicherheitsnetz: diese Ordner dürfen nie veröffentlicht werden
for verboten in referenzbilder docs tests; do
  if [ -e "$ZIEL/$verboten" ]; then echo "Fehler: $verboten darf nicht veröffentlicht werden" >&2; exit 1; fi
done
echo "Seite zusammengestellt in $ZIEL:"
ls "$ZIEL"
