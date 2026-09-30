"""Assemble chapter fragments into the final PDF (two passes for TOC page numbers).
Usage: python3 build.py [output.pdf]"""
import os, re, sys, html, subprocess, unicodedata
from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ['k01-03', 'k04', 'k05-06', 'k07-08', 'k09', 'k10-11', 'anh']
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'Leitfaden_Mehltau-Bonitur.pdf')
NODE_PATH = subprocess.check_output(['npm', 'root', '-g'], text=True).strip()

TITLE_ART = open(os.path.join(HERE, 'title_art.svg'), encoding='utf-8').read()


def strip_tags(s):
    return html.unescape(re.sub(r'<[^>]+>', '', s)).strip()


def norm(s):
    s = unicodedata.normalize('NFKC', s)
    s = s.replace('­', '').replace('-\n', '').replace('‑', '-')
    return re.sub(r'\s+', '', s).lower()


def load_chapters():
    body, heads = [], []
    for key in ORDER:
        frag = open(os.path.join(HERE, 'chapters', key + '.html'), encoding='utf-8').read()
        counter = [0]

        def repl(m):
            level, attrs, inner = int(m.group(1)), m.group(2) or '', m.group(3)
            counter[0] += 1
            idm = re.search(r'id="([^"]+)"', attrs)
            hid = idm.group(1) if idm else f'{key}-h{level}-{counter[0]}'
            if not idm:
                attrs += f' id="{hid}"'
            heads.append((level, hid, strip_tags(inner)))
            return f'<h{level}{attrs}>{inner}</h{level}>'

        frag = re.sub(r'<h([12])((?:\s[^>]*)?)>(.*?)</h\1>', repl, frag, flags=re.S)
        body.append(frag)
    return '\n'.join(body), heads


def toc_html(heads, pages):
    items = []
    for i, (level, hid, text) in enumerate(heads):
        pg = pages.get(i, '00')
        items.append(f'<li class="l{level}"><span class="tt">{html.escape(text)}</span>'
                     f'<span class="dots"></span><span class="pg">{pg}</span></li>')
    return ('<section class="toc"><p class="kicker">Übersicht</p><h1 class="toc-title">Inhalt</h1><ol>'
            + '\n'.join(items) + '</ol></section>')


def page_html(heads, pages, body):
    title = f'''<section class="titlepage">
  <div class="tp-top">
    <p class="tp-kicker">Leitfaden · Eigene Lösung</p>
    <h1>Mehltau-Bonitur<br>per Handy</h1>
    <p class="tp-sub">Von der Fotobox bis zur fertigen App: Schritt für Schritt zur automatischen Bonitur
    von Falschem Mehltau an Topfbasilikum</p>
  </div>
  <div class="tp-art">{TITLE_ART}</div>
  <div class="tp-meta">Stand: 30. September 2026 · erstellt mit Claude<br>
    Projekt-Repository: github.com/konvalinaalexander-max/bonitieren_mehltau</div>
</section>'''
    return ('<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Leitfaden Mehltau-Bonitur</title>'
            f'<link rel="stylesheet" href="{HERE}/style.css"></head><body>'
            + title + toc_html(heads, pages) + body + '</body></html>')


def render(doc_html, pdf_path):
    tmp = os.path.join(HERE, '_build.html')
    open(tmp, 'w', encoding='utf-8').write(doc_html)
    subprocess.run(['node', os.path.join(HERE, 'render.js'), tmp, pdf_path], check=True,
                   env=dict(os.environ, NODE_PATH=NODE_PATH), timeout=300)


def find_pages(pdf_path, heads):
    reader = PdfReader(pdf_path)
    texts = [norm(p.extract_text() or '') for p in reader.pages]
    # skip title + toc pages: start searching after the page containing the TOC title of chapter 1 body
    pages, start = {}, 0
    # TOC occupies the first pages; find first page where chapter-1 heading appears *with* its kicker text
    first_body = None
    for idx, t in enumerate(texts):
        if norm('Einstieg') in t and norm(heads[0][2]) in t and idx > 0 and norm('Inhalt') not in t[:40]:
            first_body = idx
            break
    start = first_body if first_body is not None else 2
    cur = start
    missing = []
    for i, (level, hid, text) in enumerate(heads):
        key = norm(text)
        found = None
        for idx in range(cur, len(texts)):
            if key in texts[idx]:
                found = idx
                break
        if found is None:
            # try shorter key (first 25 chars) for headings broken oddly
            k2 = key[:25]
            for idx in range(cur, len(texts)):
                if k2 in texts[idx]:
                    found = idx
                    break
        if found is None:
            missing.append(text)
            continue
        pages[i] = found + 1
        cur = found
    return pages, missing, len(reader.pages)


if __name__ == '__main__':
    body, heads = load_chapters()
    tmp_pdf = os.path.join(HERE, '_pass1.pdf')
    render(page_html(heads, {}, body), tmp_pdf)
    pages, missing, n1 = find_pages(tmp_pdf, heads)
    render(page_html(heads, pages, body), OUT)
    n2 = len(PdfReader(OUT).pages)
    print(f'headings: {len(heads)}  located: {len(pages)}  pages pass1={n1} pass2={n2}')
    if missing:
        print('NOT LOCATED:', missing)
    print(OUT)
