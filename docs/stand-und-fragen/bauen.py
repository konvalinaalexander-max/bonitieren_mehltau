"""Baut docs/Stand_und_Fragen.pdf aus inhalt.html (Gestaltung wie der Leitfaden).
Aufruf: python3 docs/stand-und-fragen/bauen.py   (braucht Node.js mit playwright und pypdf)"""
import html
import os
import re
import subprocess
import unicodedata

from pypdf import PdfReader

HIER = os.path.dirname(os.path.abspath(__file__))
LEITFADEN = os.path.join(HIER, '..', 'leitfaden-quelle')
AUS = os.path.join(HIER, '..', 'Stand_und_Fragen.pdf')
NODE_PATH = subprocess.check_output(['npm', 'root', '-g'], text=True).strip()
TITELBILD = open(os.path.join(LEITFADEN, 'title_art.svg'), encoding='utf-8').read()

EXTRA_CSS = """
@page { @bottom-left { content: "Mehltau-Bonitur · Stand und Fragen · 5. Oktober 2026"; } }
@page :first { @bottom-left { content: none; } @bottom-right { content: none; } }
.bilder { display: flex; gap: 4mm; align-items: flex-start; margin: 3mm 0 2mm; break-inside: avoid; }
.bilder img { width: 100%; border: 1px solid var(--line); border-radius: 2px; }
.bilder figure { flex: 1; margin: 0; }
img.breit { width: 100%; border: 1px solid var(--line); border-radius: 2px; }
.frage { border: 1px solid var(--line); border-left: 4px solid var(--yellow); background: #FFFDF6; padding: 3mm 4mm 1mm; margin: 0 0 3.5mm; break-inside: avoid; border-radius: 0 3px 3px 0; }
.frage .nr { font-weight: 700; color: #8a6d0f; margin-right: 1.5mm; }
.frage p.titel { font-weight: 700; margin-bottom: 1mm; }
.frage ul.checklist { margin: 1.5mm 0 1.5mm; }
.frage .vorschlag { display: inline-block; font-size: 8pt; font-weight: 700; color: #fff; background: var(--dgreen); border-radius: 2mm; padding: 0 1.8mm; margin-left: 1.5mm; vertical-align: 1px; }
.linie { display: inline-block; min-width: 38mm; border-bottom: 1px solid var(--ink); height: 1em; vertical-align: -2px; }
.linie.kurz { min-width: 16mm; }
.linie.lang { min-width: 80mm; }
table.formular td { height: 6mm; padding-top: 1.2mm; padding-bottom: 1.2mm; }
figure.handy svg { width: 88%; margin: 0 auto; }
table.formular td.leer { min-width: 22mm; }
.status-ok { color: var(--dgreen); font-weight: 700; }
.status-offen { color: #8a6d0f; font-weight: 700; }
"""


def ohne_tags(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


def norm(s):
    s = unicodedata.normalize('NFKC', s).replace('­', '').replace('-\n', '').replace('‑', '-')
    return re.sub(r'\s+', '', s).lower()


def kapitel_laden():
    teil = open(os.path.join(HIER, 'inhalt.html'), encoding='utf-8').read()
    koepfe = []
    zaehler = [0]

    def ersetzen(m):
        ebene, attr, innen = int(m.group(1)), m.group(2) or '', m.group(3)
        zaehler[0] += 1
        idm = re.search(r'id="([^"]+)"', attr)
        hid = idm.group(1) if idm else f'sf-h{ebene}-{zaehler[0]}'
        if not idm:
            attr += f' id="{hid}"'
        koepfe.append((ebene, hid, ohne_tags(innen)))
        return f'<h{ebene}{attr}>{innen}</h{ebene}>'

    teil = re.sub(r'<h([12])((?:\s[^>]*)?)>(.*?)</h\1>', ersetzen, teil, flags=re.S)
    return teil, koepfe


def verzeichnis(koepfe, seiten):
    zeilen = []
    for i, (ebene, hid, text) in enumerate(koepfe):
        zeilen.append(f'<li class="l{ebene}"><span class="tt">{html.escape(text)}</span>'
                      f'<span class="dots"></span><span class="pg">{seiten.get(i, "00")}</span></li>')
    return ('<section class="toc"><p class="kicker">Übersicht</p><h1 class="toc-title">Inhalt</h1><ol>'
            + '\n'.join(zeilen) + '</ol></section>')


def dokument(koepfe, seiten, inhalt):
    titel = f'''<section class="titlepage">
  <div class="tp-top">
    <p class="tp-kicker">Zwischenstand · Was ich von dir brauche</p>
    <h1>Mehltau-Bonitur:<br>Stand und Fragen</h1>
    <p class="tp-sub">Alles, was ohne dich ging, ist programmiert und getestet. Hier steht, was fertig ist,
    was du jetzt tun kannst und welche Entscheidungen und Maße ich von dir brauche.</p>
  </div>
  <div class="tp-art">{TITELBILD}</div>
  <div class="tp-meta">Stand: 5. Oktober 2026 · erstellt mit Claude<br>
    Projekt-Repository: github.com/konvalinaalexander-max/bonitieren_mehltau</div>
</section>'''
    return ('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Mehltau-Bonitur – Stand und Fragen</title>'
            f'<link rel="stylesheet" href="{LEITFADEN}/style.css"><style>{EXTRA_CSS}</style></head><body>'
            + titel + verzeichnis(koepfe, seiten) + inhalt + '</body></html>')


def drucken(doc, pdf):
    tmp = os.path.join(HIER, '_bau.html')
    open(tmp, 'w', encoding='utf-8').write(doc)
    subprocess.run(['node', os.path.join(LEITFADEN, 'render.js'), tmp, pdf], check=True,
                   env=dict(os.environ, NODE_PATH=NODE_PATH), timeout=300)
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
    inhalt, koepfe = kapitel_laden()
    zwischen = os.path.join(HIER, '_durchlauf1.pdf')
    drucken(dokument(koepfe, {}, inhalt), zwischen)
    seiten = seiten_finden(zwischen, koepfe)
    os.remove(zwischen)
    drucken(dokument(koepfe, seiten, inhalt), AUS)
    print(f'Überschriften: {len(koepfe)}, gefunden: {len(seiten)}, Seiten: {len(PdfReader(AUS).pages)}')
    print(os.path.abspath(AUS))
