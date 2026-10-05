// Synthetische Box-Fotos mit bekannter „Wahrheit“ für Tests und den Demo-Modus.
//
// Ein Bild zeigt wie in der Fotobox von oben: dunklen Boden, weiße Wände am Rand,
// Abdeckscheibe, eine Basilikumpflanze aus Blättern (grün, gelbe Aufhellungen,
// braune Nekrosen), die 24-Feld-Farbkarte und eine Topf-Karte mit QR-Code.
// Danach wird eine Kamera simuliert (Farbstich, Helligkeit, Unschärfe, Rauschen).
// Die Wahrheit (welche Pixel grün/gelb/braun gemalt wurden) wird mitgeliefert.

import { srgbZuLinear, linearZu8bit, labZuSrgb8 } from '../kern/farbe.js';
import { COLORCHECKER_2014 } from '../kern/farbkarte.js';
import qrcode from '../bibliotheken/qrcode.mjs';

/** Kleiner deterministischer Zufallsgenerator (mulberry32). */
export function zufall(seed) {
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rnd.zwischen = (a0, b0) => a0 + (b0 - a0) * rnd();
  rnd.normal = () => {
    const u = Math.max(1e-12, rnd()); const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return rnd;
}

function hsvZuRgb8(h, s, v) {
  const c = v * s; const hh = ((h % 360) + 360) % 360 / 60; const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0; let g = 0; let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0]; else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x]; else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const WAHR = { HINTERGRUND: 0, GRUEN: 1, GELB: 2, BRAUN: 3 };

/** Fester Pseudo-Zufallswert 0..1 je Position (unabhängig von der Malreihenfolge). */
function rauschWert(x, y, k) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(k | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Blätter mit allen Eigenschaften (Lage, Größe, Farbe, Flecken) aus dem Startwert. */
function blaetterErzeugen(o, R) {
  const rnd = zufall(o.seed * 7919 + 17);
  const blaetter = [];
  for (let i = 0; i < o.blattAnzahl; i++) {
    const ring = i / o.blattAnzahl; // 0 = außen, 1 = innen
    blaetter.push({
      nr: i + 1, ring,
      abstand: R * (0.62 - 0.5 * ring) * rnd.zwischen(0.85, 1.1),
      winkel: i * 2.39996 + rnd.zwischen(-0.2, 0.2), // goldener Winkel
      laenge: 0, breite: 0,
      befallFaktor: 1.7 - 1.4 * ring, // außen mehr Befall
    });
    const b = blaetter[i];
    b.laenge = R * rnd.zwischen(0.42, 0.55) * (1 - 0.3 * ring);
    b.breite = b.laenge * rnd.zwischen(0.27, 0.34);
  }
  const mittelFaktor = blaetter.reduce((a, b) => a + b.befallFaktor, 0) / Math.max(1, blaetter.length);
  const flecken = (anteil, rMin, rMax, uMin) => {
    const liste = [];
    const n = Math.round((anteil * 1.2) / (Math.PI * 0.035));
    for (let k = 0; k < n; k++) liste.push({ u: rnd.zwischen(uMin, 0.95), v: rnd.zwischen(-0.7, 0.7), r: rnd.zwischen(rMin, rMax) });
    return liste;
  };
  for (const b of blaetter) {
    b.gruenH = rnd.zwischen(88, 104); b.gruenS = rnd.zwischen(0.55, 0.68); b.gruenV = rnd.zwischen(0.48, 0.62) + 0.08 * b.ring;
    const anteilGelb = Math.min(0.95, o.gelb * (b.befallFaktor / mittelFaktor) * rnd.zwischen(0.6, 1.4));
    const anteilBraun = Math.min(0.9, o.braun * (b.befallFaktor / mittelFaktor) * rnd.zwischen(0.5, 1.5));
    b.gelbFlecken = flecken(anteilGelb, 0.14, 0.24, 0.1);
    b.braunFlecken = flecken(anteilBraun, 0.1, 0.2, 0.45);
  }
  return blaetter;
}

/**
 * Erzeugt ein synthetisches Box-Foto.
 * Rückgabe: { bild, wahrheit, einstellungen } – einstellungen enthält passende
 * Farbkarten-Ecken, Auswertekreis und Etikettbereich (normalisiert).
 */
export function szeneErzeugen(optionen = {}) {
  const o = {
    breite: 1600, hoehe: 1200, seed: 1,
    gelb: 0.10, braun: 0.03, // ungefähre Ziel-Anteile an der Blattfläche
    pflanzenRadius: 0.28, // Anteil der Bildhöhe
    blattAnzahl: 40, drehung: 0, verschiebung: [0, 0],
    karte: true, etikett: 'P001', abdeckscheibe: true, erdeSichtbar: false,
    kamera: { matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], gain: 1, rauschen: 0, unschaerfe: 0 },
    ...optionen,
  };
  const W = o.breite; const H = o.hoehe; const N = W * H;
  const rnd = zufall(o.seed);
  const s = H / 1200; // Maßstab relativ zur Standardgröße
  const rgb = new Uint8ClampedArray(N * 3);
  const wahr = new Uint8Array(N);
  const setze = (p, c) => { rgb[p * 3] = c[0]; rgb[p * 3 + 1] = c[1]; rgb[p * 3 + 2] = c[2]; };

  // Boden (dunkel, matt) und Wände (weiß mit leichtem Verlauf)
  const bodenW = 0.54 * W; const bodenH = 0.71 * H;
  const bx0 = (W - bodenW) / 2; const by0 = (H - bodenH) / 2;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      if (x >= bx0 && x < bx0 + bodenW && y >= by0 && y < by0 + bodenH) setze(p, [24, 25, 26]);
      else {
        const rand = Math.min(Math.abs(x - W / 2) / W, Math.abs(y - H / 2) / H);
        const v = Math.round(235 - 25 * rand);
        setze(p, [v, v, v - 2]);
      }
    }
  }

  const einst = { farbkarte: { ecken: null }, auswertekreis: null, etikettbereich: null };

  // Farbkarte oben links auf dem Boden
  if (o.karte) {
    const kw = 187 * s; const kh = 109 * s; const kx = bx0 + 10 * s; const ky = by0 + 10 * s;
    for (let y = Math.floor(ky); y < ky + kh; y++) for (let x = Math.floor(kx); x < kx + kw; x++) setze(y * W + x, [18, 18, 18]);
    const rand = 7 * s; const spalt = 3 * s;
    const gx0 = kx + rand; const gy0 = ky + rand; const gw = kw - 2 * rand; const gh = kh - 2 * rand;
    const fw = (gw - 5 * spalt) / 6; const fh = (gh - 3 * spalt) / 4;
    COLORCHECKER_2014.forEach((f, i) => {
      const z = Math.floor(i / 6); const sp = i % 6;
      const c = labZuSrgb8(f.lab);
      const x0 = gx0 + sp * (fw + spalt); const y0 = gy0 + z * (fh + spalt);
      for (let y = Math.floor(y0); y < y0 + fh; y++) for (let x = Math.floor(x0); x < x0 + fw; x++) setze(y * W + x, c);
    });
    einst.farbkarte.ecken = [[gx0 / W, gy0 / H], [(gx0 + gw) / W, gy0 / H], [(gx0 + gw) / W, (gy0 + gh) / H], [gx0 / W, (gy0 + gh) / H]];
  }

  // Topf-Karte mit QR-Code unten rechts
  if (o.etikett) {
    const ew = 150 * s; const eh = 97 * s;
    const ex = bx0 + bodenW - ew - 10 * s; const ey = by0 + bodenH - eh - 10 * s;
    for (let y = Math.floor(ey); y < ey + eh; y++) for (let x = Math.floor(ex); x < ex + ew; x++) setze(y * W + x, [238, 238, 236]);
    const q = qrcode(0, 'M'); q.addData(String(o.etikett)); q.make();
    const n = q.getModuleCount();
    const modul = Math.floor((eh - 12 * s) / (n + 2));
    const qx = Math.round(ex + 6 * s + modul); const qy = Math.round(ey + 6 * s + modul);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        for (let yy = 0; yy < modul; yy++) for (let xx = 0; xx < modul; xx++) setze((qy + r * modul + yy) * W + qx + c * modul + xx, [20, 20, 20]);
      }
    }
    // große Nummer als Balken andeuten (nur Optik)
    for (let y = Math.floor(ey + eh * 0.3); y < ey + eh * 0.7; y++) {
      for (let x = Math.floor(qx + (n + 2) * modul); x < ex + ew - 8 * s; x++) if ((x >> 3) % 3) setze(y * W + x, [40, 40, 40]);
    }
    einst.etikettbereich = { x: ex / W, y: ey / H, w: ew / W, h: eh / H };
  }

  const cx = W / 2 + o.verschiebung[0] * W; const cy = H / 2 + o.verschiebung[1] * H;
  // Abdeckscheibe (matt schwarz) bzw. sichtbare Erde
  const scheibeR = 0.11 * H;
  for (let y = Math.floor(cy - scheibeR); y <= cy + scheibeR; y++) {
    for (let x = Math.floor(cx - scheibeR); x <= cx + scheibeR; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > scheibeR ** 2) continue;
      if (o.abdeckscheibe || !o.erdeSichtbar) setze(y * W + x, [30, 30, 31]);
      else {
        const t = rauschWert(x, y, 7);
        setze(y * W + x, [Math.round(95 + 20 * t), Math.round(68 + 14 * t), Math.round(45 + 8 * t)]);
      }
    }
  }

  // Blätter: von außen (untere, ältere Blätter, stärker befallen) nach innen (obere, junge).
  // Alle Blatt-Eigenschaften kommen aus dem Startwert, nicht aus der Malreihenfolge:
  // Dieselbe Pflanze gedreht oder verschoben hat dieselben Blätter und Flecken.
  const R = o.pflanzenRadius * H;
  const blaetter = blaetterErzeugen(o, R);
  for (const b of blaetter) {
    const winkel = b.winkel + o.drehung;
    const ux = Math.cos(winkel); const uy = Math.sin(winkel);
    const basisX = cx + ux * (b.abstand - b.laenge * 0.35);
    const basisY = cy + uy * (b.abstand - b.laenge * 0.35);
    const umfang = b.laenge + b.breite;
    const xa = Math.floor(basisX - umfang); const xb = Math.ceil(basisX + umfang);
    const ya = Math.floor(basisY - umfang); const yb = Math.ceil(basisY + umfang);
    for (let y = Math.max(0, ya); y <= Math.min(H - 1, yb); y++) {
      for (let x = Math.max(0, xa); x <= Math.min(W - 1, xb); x++) {
        const dx = x + 0.5 - basisX; const dy = y + 0.5 - basisY;
        const u = (dx * ux + dy * uy) / b.laenge;
        if (u <= 0 || u >= 1) continue;
        const vAbs = (-dx * uy + dy * ux) / b.breite;
        const form = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 0.9);
        if (Math.abs(vAbs) > form) continue;
        const nahMitte = Math.abs(vAbs / Math.max(form, 1e-6));
        const inFleck = (liste) => liste.some((f) => (u - f.u) ** 2 + ((vAbs - f.v) * 0.8) ** 2 < f.r * f.r);
        const t = rauschWert(Math.round(u * 400), Math.round(vAbs * 200), b.nr);
        let klasse = WAHR.GRUEN; let farbe;
        if (inFleck(b.braunFlecken)) {
          klasse = WAHR.BRAUN;
          farbe = hsvZuRgb8(26 + 10 * t, 0.62, 0.36 + 0.06 * (1 - nahMitte));
        } else if (inFleck(b.gelbFlecken)) {
          klasse = WAHR.GELB;
          farbe = hsvZuRgb8(57 + 9 * t, 0.66, 0.74 + 0.06 * (1 - nahMitte));
        } else {
          const ader = nahMitte < 0.07 ? 0.06 : 0;
          farbe = hsvZuRgb8(b.gruenH, b.gruenS - ader, Math.min(0.95, b.gruenV + 0.07 * (1 - nahMitte) + ader));
        }
        const p = y * W + x;
        setze(p, farbe);
        wahr[p] = klasse;
      }
    }
  }

  // Kamera: linear -> Farbmatrix und Verstärkung -> Unschärfe -> sRGB -> Rauschen
  const { matrix: M, gain, rauschen, unschaerfe } = o.kamera;
  let lin = new Float32Array(N * 3);
  for (let p = 0; p < N; p++) {
    const r = srgbZuLinear(rgb[p * 3] / 255); const g = srgbZuLinear(rgb[p * 3 + 1] / 255); const b = srgbZuLinear(rgb[p * 3 + 2] / 255);
    lin[p * 3] = gain * (M[0][0] * r + M[0][1] * g + M[0][2] * b);
    lin[p * 3 + 1] = gain * (M[1][0] * r + M[1][1] * g + M[1][2] * b);
    lin[p * 3 + 2] = gain * (M[2][0] * r + M[2][1] * g + M[2][2] * b);
  }
  if (unschaerfe > 0) {
    const tmp = new Float32Array(N * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        for (let c = 0; c < 3; c++) {
          let summe = 0; let n = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx; const yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            summe += lin[(yy * W + xx) * 3 + c]; n++;
          }
          tmp[(y * W + x) * 3 + c] = summe / n;
        }
      }
    }
    lin = tmp;
  }
  const data = new Uint8ClampedArray(N * 4);
  for (let p = 0; p < N; p++) {
    for (let c = 0; c < 3; c++) {
      let w = linearZu8bit(lin[p * 3 + c]);
      if (rauschen > 0) w = Math.round(w + rauschen * rnd.normal());
      data[p * 4 + c] = w;
    }
    data[p * 4 + 3] = 255;
  }

  // Wahrheit zählen (im Auswertekreis)
  const kreisR = R * 1.06;
  einst.auswertekreis = { cx: cx / W, cy: cy / H, r: kreisR / W };
  let g = 0; let ge = 0; let br = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > kreisR * kreisR) continue;
      const k = wahr[y * W + x];
      if (k === WAHR.GRUEN) g++; else if (k === WAHR.GELB) ge++; else if (k === WAHR.BRAUN) br++;
    }
  }
  const summe = g + ge + br;
  return {
    bild: { width: W, height: H, data },
    wahrheit: {
      karte: wahr, gruen: g, gelb: ge, braun: br, flaeche: summe,
      gruen_pct: (100 * g) / summe, gelb_pct: (100 * ge) / summe, braun_pct: (100 * br) / summe,
      befall_pct: (100 * (ge + br)) / summe,
    },
    einstellungen: einst,
  };
}

/** Typische Kamera-Verfälschungen für Tests und Demo. */
export const KAMERAS = {
  neutral: { matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], gain: 1, rauschen: 0, unschaerfe: 0 },
  warm: { matrix: [[1.12, 0.04, 0], [0.03, 0.97, 0.02], [0, 0.04, 0.78]], gain: 0.92, rauschen: 1.5, unschaerfe: 1 },
  kalt: { matrix: [[0.86, 0.03, 0.02], [0.02, 1.0, 0.04], [0.01, 0.05, 1.18]], gain: 0.88, rauschen: 1.5, unschaerfe: 1 },
  dunkel: { matrix: [[1.02, 0.02, 0], [0.02, 1, 0.02], [0, 0.03, 0.95]], gain: 0.62, rauschen: 2, unschaerfe: 1 },
};
