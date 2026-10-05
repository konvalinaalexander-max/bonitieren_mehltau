"""Baut ein PDF im Stil des Leitfadens aus einem Quellordner mit inhalt.html und meta.json.

Aufruf:  python3 docs/pdf-bauen.py docs/so-geht-es-weiter
         python3 docs/pdf-bauen.py docs/stand-und-fragen
Braucht Node.js mit playwright (Chromium) und Python mit pypdf.

meta.json: { "ausgabe": "../Datei.pdf", "fusszeile": "...", "kicker": "...", "titel": "...",
             "untertitel": "...", "stand": "5. Oktober 2026" }
"""
import html
import json
import os
import re
import subprocess
import sys
import unicodedata

from pypdf import PdfReader

DOCS = os.path.dirname(os.path.abspath(__file__))
LEITFADEN = os.path.join(DOCS, 'leitfaden-quelle')
TITELBILD = open(os.path.join(LEITFADEN, 'title_art.svg'), encoding='utf-8').read()

EXTRA_CSS = """
@page :first { @bottom-left { content: none; } @bottom-right { content: none; } }
.bilder { display: flex; gap: 4mm; align-items: flex-start; margin: 3mm 0 2mm; break-inside: avoid; }
.bilder img { width: 100%; border: 1px solid var(--line); border-radius: 2px; }
.bilder figure { flex: 1; margin: 0; }
img.breit { width: 100%; border: 1px solid var(--line); border-radius: 2px; }
.frage { border: 1px solid var(--line); border-left: 4px solid var(--yellow); background: #FFFDF6; padding: 3mm 4mm 1mm; margin: 0 0 3.5mm; break-inside: avoid; border-radius: 0 3px 3px 0; }
.frage .nr { font-weight: 700; color: #8a6d0f; margin-right: 1.5mm; }
.frage p.titel { font-weight: 700; margin-bottom: 1mm; }
.frage ul.checklist { margin: 1.5mm 0 1.5mm; }
.vorschlag { display: inline-block; font-size: 8pt; font-weight: 700; color: #fff; background: var(--dgreen); border-radius: 2mm; padding: 0 1.8mm; margin-left: 1.5mm; vertical-align: 1px; }
.linie { display: inline-block; min-width: 38mm; border-bottom: 1px solid var(--ink); height: 1em; vertical-align: -2px; }
.linie.kurz { min-width: 16mm; }
.linie.lang { min-width: 80mm; }
table.formular td { height: 6mm; padding-top: 1.2mm; padding-bottom: 1.2mm; }
table.formular td.leer { min-width: 22mm; }
figure.handy { margin: 2mm 0 3mm; }
figure.handy svg { width: 72%; margin: 0 auto; }
.teile { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 3mm; margin: 3mm 0 1mm; break-inside: avoid; }
.teile figure { margin: 0; text-align: center; }
.teile img { width: 100%; border: 1px solid var(--line); border-radius: 2px; background: #F8F8F8; }
.teile figcaption { font-size: 8pt; margin-top: 0.5mm; color: var(--ink); }
.kernsatz { font-family: 'Source Serif 4', serif; font-size: 15pt; line-height: 1.3; color: var(--dgreen); border-left: 4px solid var(--green); padding: 2mm 0 2mm 5mm; margin: 4mm 0 6mm; break-inside: avoid; }
table.excel { border-collapse: collapse; width: 100%; font-size: 8.4pt; margin: 2mm 0 4mm; font-family: 'Source Sans 3', sans-serif; break-inside: avoid; }
table.excel th { background: #E3EFDD; color: var(--ink); font-weight: 700; border: 1px solid #B9C8B3; padding: 1mm 1.5mm; text-align: left; }
table.excel td { border: 1px solid #D5DED2; padding: 0.9mm 1.5mm; }
table.excel td.z { text-align: right; font-variant-numeric: tabular-nums; }
table.excel caption { caption-side: top; text-align: left; font-size: 8.5pt; color: var(--grey); padding-bottom: 1mm; }
.blatt { display: inline-block; background: #2F6B3A; color: #fff; font-size: 8pt; font-weight: 700; padding: 0.4mm 2mm; border-radius: 1.5mm 1.5mm 0 0; margin-top: 2mm; }
table.vorher { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 2mm 0 5mm; }
table.vorher th { background: var(--dgreen); color: #fff; text-align: left; padding: 1.6mm 2.4mm; }
table.vorher td { padding: 1.5mm 2.4mm; border-bottom: 1px solid var(--line); vertical-align: top; }
table.vorher td.weg { color: var(--grey); }
table.vorher tr { break-inside: avoid; }
.ja { color: var(--dgreen); font-weight: 700; }
.nein { color: var(--grey); }
"""


def ohne_tags(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


def norm(s):
    s = unicodedata.normalize('NFKC', s).replace('­', '').replace('-\n', '').replace('‑', '-')
    return re.sub(r'\s+', '', s).lower()


def kapitel_laden(ordner):
    teil = open(os.path.join(ordner, 'inhalt.html'), encoding='utf-8').read()
    koepfe, zaehler = [], [0]

    def ersetzen(m):
        ebene, attr, innen = int(m.group(1)), m.group(2) or '', m.group(3)
        zaehler[0] += 1
        idm = re.search(r'id="([^"]+)"', attr)
        hid = idm.group(1) if idm else f'pdf-h{ebene}-{zaehler[0]}'
        if not idm:
            attr += f' id="{hid}"'
        koepfe.append((ebene, hid, ohne_tags(innen)))
        return f'<h{ebene}{attr}>{innen}</h{ebene}>'

    teil = re.sub(r'<h([12])((?:\s[^>]*)?)>(.*?)</h\1>', ersetzen, teil, flags=re.S)
    return teil, koepfe


def verzeichnis(koepfe, seiten):
    zeilen = [f'<li class="l{e}"><span class="tt">{html.escape(t)}</span><span class="dots"></span>'
              f'<span class="pg">{seiten.get(i, "00")}</span></li>' for i, (e, _, t) in enumerate(koepfe)]
    return ('<section class="toc"><p class="kicker">Übersicht</p><h1 class="toc-title">Inhalt</h1><ol>'
            + '\n'.join(zeilen) + '</ol></section>')


def dokument(meta, koepfe, seiten, inhalt):
    css = EXTRA_CSS + '@page { @bottom-left { content: "%s"; } }' % meta['fusszeile'].replace('"', '\\"')
    titel = f'''<section class="titlepage">
  <div class="tp-top">
    <p class="tp-kicker">{meta['kicker']}</p>
    <h1>{meta['titel']}</h1>
    <p class="tp-sub">{meta['untertitel']}</p>
  </div>
  <div class="tp-art">{TITELBILD}</div>
  <div class="tp-meta">Stand: {meta['stand']} · erstellt mit Claude<br>
    Projekt-Repository: github.com/konvalinaalexander-max/bonitieren_mehltau</div>
</section>'''
    return ('<!doctype html><html lang="de"><head><meta charset="utf-8">'
            f'<title>{ohne_tags(meta["titel"])}</title>'
            f'<link rel="stylesheet" href="{LEITFADEN}/style.css"><style>{css}</style></head><body>'
            + titel + verzeichnis(koepfe, seiten) + inhalt + '</body></html>')


def drucken(ordner, doc, pdf):
    tmp = os.path.join(ordner, '_bau.html')
    open(tmp, 'w', encoding='utf-8').write(doc)
    node_path = subprocess.check_output(['npm', 'root', '-g'], text=True).strip()
    try:
        subprocess.run(['node', os.path.join(LEITFADEN, 'render.js'), tmp, pdf], check=True,
                       env=dict(os.environ, NODE_PATH=node_path), timeout=300)
    finally:
        os.remove(tmp)


def seiten_finden(pdf, koepfe):
    texte = [norm(s.extract_text() or '') for s in PdfReader(pdf).pages]
    seiten, ab = {}, 2
    for i, (_, _, text) in enumerate(koepfe):
        k = norm(text)
        for idx in range(ab, len(texte)):
            if k in texte[idx] or k[:25] in texte[idx]:
                seiten[i] = idx + 1
                ab = idx
                break
    return seiten


if __name__ == '__main__':
    ordner = os.path.abspath(sys.argv[1])
    meta = json.load(open(os.path.join(ordner, 'meta.json'), encoding='utf-8'))
    aus = os.path.normpath(os.path.join(ordner, meta['ausgabe']))
    inhalt, koepfe = kapitel_laden(ordner)
    zwischen = os.path.join(ordner, '_durchlauf1.pdf')
    drucken(ordner, dokument(meta, koepfe, {}, inhalt), zwischen)
    seiten = seiten_finden(zwischen, koepfe)
    os.remove(zwischen)
    drucken(ordner, dokument(meta, koepfe, seiten, inhalt), aus)
    print(f'Überschriften: {len(koepfe)}, gefunden: {len(seiten)}, Seiten: {len(PdfReader(aus).pages)}')
    print(aus)
