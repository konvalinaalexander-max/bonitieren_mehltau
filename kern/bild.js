// Bildhilfen: deterministisches Verkleinern (Flächenmittelung), Ausschnitte.
// Bewusst eigene Umsetzung statt Browser-Skalierung: So liefert jeder Browser
// und jeder Test aus denselben Pixeln dieselben Werte.

/** Gewichte für eine Achse: je Zielpixel die überdeckten Quellpixel mit Anteil. */
function achsenGewichte(quelle, ziel) {
  const faktor = quelle / ziel;
  const liste = [];
  for (let i = 0; i < ziel; i++) {
    const a = i * faktor;
    const b = (i + 1) * faktor;
    const j0 = Math.floor(a);
    const j1 = Math.min(quelle - 1, Math.ceil(b) - 1);
    const idx = []; const gew = [];
    for (let j = j0; j <= j1; j++) {
      const w = Math.min(b, j + 1) - Math.max(a, j);
      if (w > 1e-9) { idx.push(j); gew.push(w / faktor); }
    }
    liste.push({ idx, gew });
  }
  return liste;
}

/**
 * Verkleinert ein RGBA-Bild so, dass die lange Kante höchstens `langeKante` Pixel hat.
 * Jedes Zielpixel ist der flächengewichtete Mittelwert der überdeckten Quellpixel.
 * Kleinere Bilder werden unverändert zurückgegeben.
 */
export function verkleinern(bild, langeKante = 1600) {
  const { width: W, height: H, data } = bild;
  const lang = Math.max(W, H);
  if (lang <= langeKante) return bild;
  const f = langeKante / lang;
  const dw = Math.max(1, Math.round(W * f));
  const dh = Math.max(1, Math.round(H * f));
  const gx = achsenGewichte(W, dw);
  const gy = achsenGewichte(H, dh);
  // Für jede Quellzeile: zu welchen Zielzeilen trägt sie mit welchem Gewicht bei?
  const zeilenBeitrag = Array.from({ length: H }, () => []);
  gy.forEach(({ idx, gew }, i) => idx.forEach((j, k) => zeilenBeitrag[j].push([i, gew[k]])));

  const akku = new Float32Array(dw * dh * 3);
  const zeile = new Float32Array(dw * 3);
  for (let y = 0; y < H; y++) {
    if (zeilenBeitrag[y].length === 0) continue;
    const basis = y * W * 4;
    for (let x = 0; x < dw; x++) {
      const { idx, gew } = gx[x];
      let r = 0; let g = 0; let b = 0;
      for (let k = 0; k < idx.length; k++) {
        const q = basis + idx[k] * 4; const w = gew[k];
        r += data[q] * w; g += data[q + 1] * w; b += data[q + 2] * w;
      }
      zeile[x * 3] = r; zeile[x * 3 + 1] = g; zeile[x * 3 + 2] = b;
    }
    for (const [ziel, w] of zeilenBeitrag[y]) {
      const o = ziel * dw * 3;
      for (let k = 0; k < dw * 3; k++) akku[o + k] += zeile[k] * w;
    }
  }
  const aus = new Uint8ClampedArray(dw * dh * 4);
  for (let p = 0, q = 0; p < dw * dh; p++, q += 3) {
    aus[p * 4] = Math.round(akku[q]);
    aus[p * 4 + 1] = Math.round(akku[q + 1]);
    aus[p * 4 + 2] = Math.round(akku[q + 2]);
    aus[p * 4 + 3] = 255;
  }
  return { width: dw, height: dh, data: aus };
}

/** Schneidet ein Rechteck (Pixel, wird auf das Bild begrenzt) aus. */
export function ausschnitt(bild, x, y, w, h) {
  const x0 = Math.max(0, Math.floor(x)); const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(bild.width, Math.ceil(x + w)); const y1 = Math.min(bild.height, Math.ceil(y + h));
  const bw = Math.max(0, x1 - x0); const bh = Math.max(0, y1 - y0);
  const aus = new Uint8ClampedArray(bw * bh * 4);
  for (let yy = 0; yy < bh; yy++) {
    const q = ((y0 + yy) * bild.width + x0) * 4;
    aus.set(bild.data.subarray(q, q + bw * 4), yy * bw * 4);
  }
  return { width: bw, height: bh, data: aus, x0, y0 };
}
