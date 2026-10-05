// Kleiner EXIF-Leser für JPEG-Dateien: Ausrichtung, Aufnahmezeit, Hersteller, Modell.
// Liest nur die wenigen Felder, die die App braucht (keine Abhängigkeiten).

const TAGS = { 0x0112: 'orientierung', 0x010f: 'hersteller', 0x0110: 'modell', 0x0132: 'datum', 0x9003: 'aufnahme', 0x8769: 'exifIfd' };

/**
 * bytes: Uint8Array/ArrayBuffer der JPEG-Datei (die ersten 128 KB genügen).
 * Ergebnis: { orientierung, aufnahme: Date|null, aufnahmeText, hersteller, modell } oder null.
 */
export function exifLesen(eingabe) {
  const b = eingabe instanceof Uint8Array ? eingabe : new Uint8Array(eingabe);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 < b.length) {
    if (b[p] !== 0xff) return null;
    const marker = b[p + 1];
    const laenge = (b[p + 2] << 8) | b[p + 3];
    if (marker === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      return tiffLesen(b, p + 10, Math.min(b.length, p + 2 + laenge));
    }
    if (marker === 0xda || marker === 0xd9) return null;
    p += 2 + laenge;
  }
  return null;
}

function tiffLesen(b, start, ende) {
  const klein = b[start] === 0x49; // "II" = little endian
  const u16 = (o) => (klein ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (klein ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const werte = {};
  const ifdLesen = (offset) => {
    const o = start + offset;
    if (o + 2 > ende) return;
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12;
      if (e + 12 > ende) return;
      const tag = u16(e); const typ = u16(e + 2); const anzahl = u32(e + 4);
      const name = TAGS[tag];
      if (!name) continue;
      if (typ === 3) werte[name] = u16(e + 8);
      else if (typ === 4) werte[name] = u32(e + 8);
      else if (typ === 2) {
        const wo = anzahl > 4 ? start + u32(e + 8) : e + 8;
        let t = '';
        for (let k = 0; k < anzahl - 1 && wo + k < ende; k++) t += String.fromCharCode(b[wo + k]);
        werte[name] = t.replace(/\0+$/, '').trim();
      }
    }
  };
  ifdLesen(u32(start + 4));
  if (werte.exifIfd) ifdLesen(werte.exifIfd);
  const text = werte.aufnahme || werte.datum || null;
  let aufnahme = null;
  const m = text && text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (m) aufnahme = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return {
    orientierung: werte.orientierung || 1,
    aufnahme,
    aufnahmeText: text,
    hersteller: werte.hersteller || null,
    modell: werte.modell || null,
  };
}

/** Aufnahmezeit aus Open-Camera-Dateinamen wie BOX_20261012_101532.jpg (lokale Zeit). */
export function zeitAusDateiname(name) {
  const m = String(name).match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Dreht ein RGBA-Bild gemäß EXIF-Ausrichtung (1, 3, 6, 8; Spiegelungen werden ignoriert). */
export function nachExifDrehen(bild, orientierung) {
  const { width: W, height: H, data } = bild;
  if (![3, 6, 8].includes(orientierung)) return bild;
  const quer = orientierung !== 3;
  const nw = quer ? H : W; const nh = quer ? W : H;
  const aus = new Uint8ClampedArray(data.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let nx; let ny;
      if (orientierung === 3) { nx = W - 1 - x; ny = H - 1 - y; } else if (orientierung === 6) { nx = H - 1 - y; ny = x; } else { nx = y; ny = W - 1 - x; }
      const q = (y * W + x) * 4; const z = (ny * nw + nx) * 4;
      aus[z] = data[q]; aus[z + 1] = data[q + 1]; aus[z + 2] = data[q + 2]; aus[z + 3] = data[q + 3];
    }
  }
  return { width: nw, height: nh, data: aus };
}
