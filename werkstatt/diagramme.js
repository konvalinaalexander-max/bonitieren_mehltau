// Diagramme als SVG-Text (ohne Bibliothek).

const FARBEN = { gut: '#2F6B3A', mittel: '#D9A400', schlecht: '#C0392B', linie: '#C9D2C6', text: '#1F2A24', grau: '#6B7570' };

function esc(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function streuung(text) {
  let h = 0;
  for (const c of String(text)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 0.36;
}

/**
 * Streudiagramm App-Befall % (y) gegen Menschen-Note (x, Mittel aus A und B).
 * punkte: [{ id, topf, x, befall, appNote }]; skala: { noten, grenzen }
 */
export function streudiagramm(punkte, skala) {
  const B = 760; const H = 470; const l = 56; const r = 150; const o = 20; const u = 82;
  const noten = skala.noten;
  const yMax = Math.max(60, Math.ceil(Math.max(0, ...punkte.map((p) => p.befall)) / 10) * 10);
  const xs = (x) => l + ((x - noten[0]) / (noten[noten.length - 1] - noten[0] || 1)) * (B - l - r);
  const ys = (y) => H - u - (y / yMax) * (H - o - u);
  const teile = [`<svg viewBox="0 0 ${B} ${H}" role="img" aria-label="Streudiagramm App-Befall gegen Menschen-Note" font-family="Segoe UI, system-ui, sans-serif" font-size="12">`];
  for (let y = 0; y <= yMax; y += 10) {
    teile.push(`<line x1="${l}" x2="${B - r}" y1="${ys(y)}" y2="${ys(y)}" stroke="#EEF2EC"/><text x="${l - 8}" y="${ys(y) + 4}" text-anchor="end" fill="${FARBEN.grau}">${y}</text>`);
  }
  noten.forEach((n) => teile.push(`<line x1="${xs(n)}" x2="${xs(n)}" y1="${o}" y2="${H - u}" stroke="#EEF2EC"/><text x="${xs(n)}" y="${H - u + 18}" text-anchor="middle" fill="${FARBEN.grau}">${n}</text>`));
  skala.grenzen.forEach((g, i) => {
    if (g > yMax) return;
    teile.push(`<line x1="${l}" x2="${B - r}" y1="${ys(g)}" y2="${ys(g)}" stroke="#2B5D8C" stroke-dasharray="6 4" stroke-width="1.3"/>`);
    teile.push(`<text x="${B - r + 6}" y="${ys(g) + 4}" fill="#2B5D8C">Grenze ${noten[i]}|${noten[i + 1]}: ${String(g).replace('.', ',')} %</text>`);
  });
  teile.push(`<line x1="${l}" x2="${l}" y1="${o}" y2="${H - u}" stroke="${FARBEN.text}"/><line x1="${l}" x2="${B - r}" y1="${H - u}" y2="${H - u}" stroke="${FARBEN.text}"/>`);
  teile.push(`<text x="${(l + B - r) / 2}" y="${H - u + 40}" text-anchor="middle" fill="${FARBEN.text}">Note der Menschen (Mittel aus Person A und B)</text>`);
  teile.push(`<text transform="translate(16 ${(o + H - u) / 2}) rotate(-90)" text-anchor="middle" fill="${FARBEN.text}">App-Befall %</text>`);
  for (const p of punkte) {
    const abw = Math.abs(p.appNote - p.x);
    const farbe = abw <= 0.5 ? FARBEN.gut : abw <= 1 ? FARBEN.mittel : FARBEN.schlecht;
    let j = streuung(p.topf);
    if (p.x <= noten[0]) j = Math.abs(j); else if (p.x >= noten[noten.length - 1]) j = -Math.abs(j);
    const x = xs(p.x + j);
    teile.push(`<circle data-id="${p.id}" cx="${x.toFixed(1)}" cy="${ys(Math.min(p.befall, yMax)).toFixed(1)}" r="5" fill="${farbe}" fill-opacity="0.8" stroke="#fff" stroke-width="1"><title>${esc(`${p.topf}: App ${String(p.befall).replace('.', ',')} % (Note ${p.appNote}), Menschen ${String(p.x).replace('.', ',')}`)}</title></circle>`);
  }
  let lx = l; const ly = H - 8;
  teile.push(`<text x="${lx}" y="${ly}" fill="${FARBEN.text}" font-weight="600">App-Note gegenüber Mensch:</text>`);
  lx += 205;
  [['gleich (±0,5)', FARBEN.gut], ['eine Stufe daneben', FARBEN.mittel], ['mehr als eine Stufe', FARBEN.schlecht]].forEach(([t, f]) => {
    teile.push(`<circle cx="${lx + 6}" cy="${ly - 4}" r="5" fill="${f}"/><text x="${lx + 16}" y="${ly}" fill="${FARBEN.text}">${t}</text>`);
    lx += 150;
  });
  teile.push('</svg>');
  return teile.join('');
}
