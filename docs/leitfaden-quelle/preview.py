"""Preview one chapter fragment (or a full html) as PNG pages.
Usage: python3 preview.py chapters/k4.html   -> preview/k4/page-01.png ...
Prints the PNG paths. Look at them with the Read tool to check layout and figures."""
import sys, os, subprocess, pypdfium2 as pdfium
HERE = os.path.dirname(os.path.abspath(__file__))
src = sys.argv[1]
name = os.path.splitext(os.path.basename(src))[0]
frag = open(src, encoding='utf-8').read()
html = ('<!doctype html><html lang="de"><head><meta charset="utf-8">'
        f'<link rel="stylesheet" href="{HERE}/style.css"></head><body>'
        # a dummy first page so chapter pages get footers like in the real document
        '<div style="height:10mm">Vorschau</div>' + frag + '</body></html>')
outdir = os.path.join(HERE, 'preview', name); os.makedirs(outdir, exist_ok=True)
for f in os.listdir(outdir): os.remove(os.path.join(outdir, f))
tmp_html = os.path.join(outdir, '_tmp.html'); open(tmp_html, 'w', encoding='utf-8').write(html)
pdf = os.path.join(outdir, '_tmp.pdf')
env = dict(os.environ, NODE_PATH=subprocess.check_output(['npm', 'root', '-g'], text=True).strip())
subprocess.run(['node', os.path.join(HERE, 'render.js'), tmp_html, pdf], check=True, env=env, timeout=180)
doc = pdfium.PdfDocument(pdf)
for i in range(1, len(doc)):  # skip dummy first page
    img = doc[i].render(scale=1.4).to_pil()
    path = os.path.join(outdir, f'page-{i:02d}.png'); img.save(path); print(path)
print(f'{len(doc)-1} pages')
