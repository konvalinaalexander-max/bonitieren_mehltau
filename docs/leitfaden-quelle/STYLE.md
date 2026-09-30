# HTML-KONVENTIONEN für Kapitel-Fragmente (wird zu PDF, A4, via Chromium)

Liefere NUR ein HTML-Fragment (kein <html>, <head>, <body>, kein <style>, kein <script>).
Jedes Kapitel ist genau ein Element:

<section class="chapter" id="kap-N">            (Anhänge: id="anh-a", id="anh-b")
  <p class="kicker">Etappe 1 · ca. 1–3 Wochen</p>   (Erklärkapitel: z. B. "Hintergrund"; Anhang: "Anhang")
  <h1>4 Die Fotobox bauen</h1>                 (Nummer + Titel; Anhang: "A Glossar")
  <p class="lead">Ein bis zwei Sätze: worum es geht und was am Ende steht.</p>
  ...
</section>

Erlaubte Bausteine (nur diese Klassen verwenden):
- <h2>4.1 Titel</h2>, <h3>Untertitel</h3> (h3 ohne Nummer), <p>, <ul>, <ol>, <strong>, <em>, <code>.
- Etappen-Steckbrief direkt nach dem lead (nur Etappen-Kapitel):
  <table class="stage-meta">
    <tr><th>Ziel</th><td>…</td></tr>
    <tr><th>Dauer</th><td>…</td></tr>
    <tr><th>Du</th><td>…</td></tr>
    <tr><th>Claude</th><td>…</td></tr>
    <tr><th>Du brauchst</th><td>…</td></tr>
    <tr><th>Ergebnis</th><td>…</td></tr>
  </table>
- Hinweisboxen: <div class="box tip"><p class="box-title">Tipp</p><p>…</p></div>
  Varianten: tip (Tipp), warn (Achtung), info (Hintergrund/Wissen), decision (Entscheidung).
- Schritt-für-Schritt: <ol class="steps"><li><strong>Kurzer Schritt-Titel.</strong> Erklärung …</li></ol>
- Checkliste zum Abhaken: <ul class="checklist"><li>…</li></ul>  (Kästchen kommen per CSS)
- Tabelle: <table class="t"><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table>
  Tabellen-Überschrift optional davor: <p class="table-caption">Tabelle 4.1: …</p>
- Rollen-Marker im Fließtext: <span class="who du">Du</span> · <span class="who claude">Claude</span> ·
  <span class="who team">Team</span>
- Kopier-Prompt für Claude:
  <div class="prompt"><p class="prompt-title">Prompt für Claude – B1 Analyse-Kern</p><pre>… Text …</pre></div>
  (In <pre> Zeilen max. ca. 85 Zeichen, sonst läuft Text aus der Box – bitte manuell umbrechen.
   HTML-Sonderzeichen escapen: &lt; &gt; &amp;)
- Kopiervorlage (ganze Seite zum Ausdrucken): <div class="template"> … </div> (darin h3, table.t usw.)
  Davor ggf. <div class="page-break"></div> wenn die Vorlage auf eigener Seite beginnen soll.
- Abbildung mit Inline-SVG:
  <figure><svg viewBox="0 0 800 400" role="img" aria-label="…"> … </svg>
  <figcaption>Abb. 4.1: …</figcaption></figure>

SVG-Regeln:
- viewBox setzen, KEINE width/height-Attribute am <svg> (Breite kommt per CSS = 100 %).
- Nur inline, keine externen Bilder/Fonts/Skripte. font-family="Source Sans 3, sans-serif" an Texten
  oder am <svg>; Schriftgröße in viewBox-Einheiten 13–18 (bei viewBox-Breite 800), damit gedruckt lesbar.
- Farben (nur diese): Tinte #1F2A24 · Grau #6B7570 · Linie #C9D2C6 · Hintergrund hell #F3F6F1 ·
  Dunkelgrün #2F6B3A · Blattgrün #5B9A3C · Gelb #D9B32E · Braun #8A5A2B · Rot-Markierung #C0392B ·
  Blau (Technik/Claude) #2B5D8C · Weiß #FFFFFF.
- Einfach und klar: beschriftete Kästen, Pfeile (marker in <defs>, IDs mit Kapitelpräfix, z. B.
  id="k4-arrow", damit IDs im Gesamtdokument eindeutig sind), Maßlinien. Nichts Überladenes.
  Texte dürfen nicht über Kästen hinauslaufen: Kästen groß genug, Text ggf. auf 2 <tspan>-Zeilen.
- Maximal ca. 2–4 Abbildungen pro Kapitel, nur wo sie wirklich helfen.

Nummerierung: Abschnitte "4.1", Abbildungen "Abb. 4.1", Tabellen "Tabelle 4.1" – immer mit der
Kapitelnummer. Querverweise als Text („siehe Kapitel 7.3"), keine Links nötig; externe Links als
<a href="…">sichtbarer Text</a>.

Ton: Du-Form, freundlich, konkret, kurze Sätze, keine Füllwörter, kein Marketing. Fachbegriffe beim
ersten Auftreten kurz erklären (Glossar in Anhang A). Keine Emojis. Deutsche Anführungszeichen „…".
Zahlen: Dezimalkomma (0,6), Einheiten mit Leerzeichen (50 cm, 5 V). Schätzungen als solche kennzeichnen.
Nichts erfinden: Keine erfundenen Menüpfade, Preise oder Quellen. Wenn unsicher: allgemein formulieren
oder als „prüfen" kennzeichnen.
