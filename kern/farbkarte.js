// Farbkarte (24 Felder, ColorChecker Classic): Sollwerte, Felder messen,
// Korrekturmatrix berechnen und anwenden, Qualität (ΔE) prüfen.

import {
  LIN_AUS_8BIT, linearZu8bit, labZuLinearSrgb, linearSrgbZuLab, deltaE2000,
} from './farbe.js';

/**
 * Sollwerte ColorChecker Classic, Karten ab November 2014, CIE L*a*b* (D50).
 * Quelle: X-Rite „New color specifications for ColorChecker SG and Classic charts“,
 * übernommen aus colour-science (DATA_COLORCHECKER24_AFTER_NOV2014_CIE_LAB, BSD-3).
 * Reihenfolge: Zeile für Zeile von oben links (Feld 1) nach unten rechts (Feld 24).
 */
export const COLORCHECKER_2014 = [
  { nr: 1, name: 'Dunkle Haut', lab: [37.54, 14.37, 14.92] },
  { nr: 2, name: 'Helle Haut', lab: [64.66, 19.27, 17.5] },
  { nr: 3, name: 'Himmelblau', lab: [49.32, -3.82, -22.54] },
  { nr: 4, name: 'Blattgrün', lab: [43.46, -12.74, 22.72] },
  { nr: 5, name: 'Blaue Blüte', lab: [54.94, 9.61, -24.79] },
  { nr: 6, name: 'Blaugrün', lab: [70.48, -32.26, -0.37] },
  { nr: 7, name: 'Orange', lab: [62.73, 35.83, 56.5] },
  { nr: 8, name: 'Violettblau', lab: [39.43, 10.75, -45.17] },
  { nr: 9, name: 'Mittleres Rot', lab: [50.57, 48.64, 16.67] },
  { nr: 10, name: 'Purpur', lab: [30.1, 22.54, -20.87] },
  { nr: 11, name: 'Gelbgrün', lab: [71.77, -24.13, 58.19] },
  { nr: 12, name: 'Orangegelb', lab: [71.51, 18.24, 67.37] },
  { nr: 13, name: 'Blau', lab: [28.37, 15.42, -49.8] },
  { nr: 14, name: 'Grün', lab: [54.38, -39.72, 32.27] },
  { nr: 15, name: 'Rot', lab: [42.43, 51.05, 28.62] },
  { nr: 16, name: 'Gelb', lab: [81.8, 2.67, 80.41] },
  { nr: 17, name: 'Magenta', lab: [50.63, 51.28, -14.12] },
  { nr: 18, name: 'Cyan', lab: [49.57, -29.71, -28.32] },
  { nr: 19, name: 'Weiß', lab: [95.19, -1.03, 2.93] },
  { nr: 20, name: 'Neutral 8', lab: [81.29, -0.57, 0.44] },
  { nr: 21, name: 'Neutral 6,5', lab: [66.89, -0.75, -0.06] },
  { nr: 22, name: 'Neutral 5', lab: [50.76, -0.13, 0.14] },
  { nr: 23, name: 'Neutral 3,5', lab: [35.63, -0.46, -0.48] },
  { nr: 24, name: 'Schwarz', lab: [20.64, 0.07, -0.46] },
];

/** Sollwerte als lineares sRGB (D65, Bradford-angepasst; Cyan liegt leicht außerhalb). */
export const SOLL_LINEAR = COLORCHECKER_2014.map((f) => labZuLinearSrgb(f.lab));

export const SPALTEN = 6;
export const ZEILEN = 4;
/** Indizes (0-basiert) der Graufelder 19–24. */
export const GRAUFELDER = [18, 19, 20, 21, 22, 23];

/**
 * Projektive Abbildung vom Einheitsquadrat (u,v in 0..1) auf ein Viereck.
 * ecken: [p0, p1, p2, p3] mit p = [x, y]; p0 = (u0,v0), p1 = (u1,v0), p2 = (u1,v1), p3 = (u0,v1).
 * Liefert eine Funktion (u, v) -> [x, y].
 */
export function viereckAbbildung(ecken) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = ecken;
  const dx1 = x1 - x2; const dx2 = x3 - x2; const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2; const dy2 = y3 - y2; const dy3 = y0 - y1 + y2 - y3;
  let a; let b; let c; let d; let e; let f; let g; let h;
  if (Math.abs(dx3) < 1e-12 && Math.abs(dy3) < 1e-12) {
    a = x1 - x0; b = x3 - x0; c = x0;
    d = y1 - y0; e = y3 - y0; f = y0;
    g = 0; h = 0;
  } else {
    const nenner = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / nenner;
    h = (dx1 * dy3 - dx3 * dy1) / nenner;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

/** Mittelpunkte der 24 Felder im Bild (Pixel), Ecken in Pixeln. */
export function feldMittelpunkte(eckenPx) {
  const abb = viereckAbbildung(eckenPx);
  const punkte = [];
  for (let z = 0; z < ZEILEN; z++) {
    for (let s = 0; s < SPALTEN; s++) punkte.push(abb((s + 0.5) / SPALTEN, (z + 0.5) / ZEILEN));
  }
  return punkte;
}

/**
 * Misst die 24 Felder. Je Feld wird ein Quadrat (halbe Kantenlänge = anteil × Feldbreite)
 * um die Feldmitte mit einem Raster von raster × raster Punkten abgetastet.
 * bild: { width, height, data } (RGBA, 8 Bit); eckenPx: 4 Ecken in Pixeln.
 * Ergebnis je Feld: { mittel: [r,g,b] (0..255), streuung (mittlere Standardabweichung), n }.
 */
export function felderMessen(bild, eckenPx, { anteil = 0.28, raster = 9 } = {}) {
  const abb = viereckAbbildung(eckenPx);
  const { width: W, height: H, data } = bild;
  const felder = [];
  for (let z = 0; z < ZEILEN; z++) {
    for (let s = 0; s < SPALTEN; s++) {
      const uc = (s + 0.5) / SPALTEN; const vc = (z + 0.5) / ZEILEN;
      const du = anteil / SPALTEN; const dv = anteil / ZEILEN;
      let n = 0; const sum = [0, 0, 0]; const sq = [0, 0, 0];
      for (let i = 0; i < raster; i++) {
        for (let j = 0; j < raster; j++) {
          const u = uc - du + (2 * du * i) / (raster - 1);
          const v = vc - dv + (2 * dv * j) / (raster - 1);
          const [x, y] = abb(u, v);
          const xi = Math.round(x); const yi = Math.round(y);
          if (xi < 0 || yi < 0 || xi >= W || yi >= H) continue;
          const k = (yi * W + xi) * 4;
          for (let c = 0; c < 3; c++) { const w = data[k + c]; sum[c] += w; sq[c] += w * w; }
          n++;
        }
      }
      if (n === 0) { felder.push({ mittel: [NaN, NaN, NaN], streuung: NaN, n: 0 }); continue; }
      const mittel = sum.map((x) => x / n);
      const streuung = (sq.reduce((acc, q, c) => acc + Math.sqrt(Math.max(0, q / n - mittel[c] * mittel[c])), 0)) / 3;
      felder.push({ mittel, streuung, n });
    }
  }
  return felder;
}

/** 8-Bit-Mittelwert -> linear (mit Interpolation zwischen Tabellenwerten). */
function achtBitZuLinear(w) {
  const x = Math.max(0, Math.min(255, w));
  const i = Math.floor(x); const t = x - i;
  return i >= 255 ? LIN_AUS_8BIT[255] : LIN_AUS_8BIT[i] * (1 - t) + LIN_AUS_8BIT[i + 1] * t;
}

/** Löst ein 3×3-Gleichungssystem A x = b (Gauß mit Pivotsuche). null bei Singularität. */
function loese3(A, b) {
  const m = A.map((zeile, i) => [...zeile, b[i]]);
  for (let k = 0; k < 3; k++) {
    let p = k;
    for (let i = k + 1; i < 3; i++) if (Math.abs(m[i][k]) > Math.abs(m[p][k])) p = i;
    if (Math.abs(m[p][k]) < 1e-12) return null;
    [m[k], m[p]] = [m[p], m[k]];
    for (let i = k + 1; i < 3; i++) {
      const f = m[i][k] / m[k][k];
      for (let j = k; j < 4; j++) m[i][j] -= f * m[k][j];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = m[i][3];
    for (let j = i + 1; j < 3; j++) s -= m[i][j] * x[j];
    x[i] = s / m[i][i];
  }
  return x;
}

/**
 * Gewichtete Ausgleichsrechnung: 3×3-Matrix M mit soll ≈ M · gemessen (beides linear).
 * Graufelder zählen doppelt (sie bestimmen den Weißabgleich). Übersteuerte Felder
 * (ein Kanal ≥ 252 oder ≤ 2) werden nicht verwendet.
 */
export function korrekturmatrixBerechnen(felder) {
  const ATA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ATb = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // je Ausgabekanal
  let genutzt = 0;
  felder.forEach((f, i) => {
    if (!(f.n > 0)) return;
    if (f.mittel.some((w) => w >= 252 || w <= 2)) return;
    const w = GRAUFELDER.includes(i) ? 2 : 1;
    const m = f.mittel.map(achtBitZuLinear);
    const s = SOLL_LINEAR[i];
    for (let a = 0; a < 3; a++) {
      for (let b = 0; b < 3; b++) ATA[a][b] += w * m[a] * m[b];
      for (let k = 0; k < 3; k++) ATb[k][a] += w * m[a] * s[k];
    }
    genutzt++;
  });
  if (genutzt < 6) return null;
  const M = [];
  for (let k = 0; k < 3; k++) {
    const zeile = loese3(ATA, ATb[k]);
    if (!zeile) return null;
    M.push(zeile);
  }
  return { matrix: M, genutzteFelder: genutzt };
}

/** Wendet die Matrix auf einen 8-Bit-Farbwert an (Ergebnis 8 Bit, begrenzt). */
export function farbeKorrigieren(M, r, g, b) {
  const lr = LIN_AUS_8BIT[r]; const lg = LIN_AUS_8BIT[g]; const lb = LIN_AUS_8BIT[b];
  return [
    linearZu8bit(M[0][0] * lr + M[0][1] * lg + M[0][2] * lb),
    linearZu8bit(M[1][0] * lr + M[1][1] * lg + M[1][2] * lb),
    linearZu8bit(M[2][0] * lr + M[2][1] * lg + M[2][2] * lb),
  ];
}

/** Korrigiert ein ganzes Bild (neues RGBA-Array). */
export function bildKorrigieren(bild, M) {
  const { data } = bild;
  const aus = new Uint8ClampedArray(data.length);
  const [m00, m01, m02] = M[0]; const [m10, m11, m12] = M[1]; const [m20, m21, m22] = M[2];
  for (let k = 0; k < data.length; k += 4) {
    const lr = LIN_AUS_8BIT[data[k]]; const lg = LIN_AUS_8BIT[data[k + 1]]; const lb = LIN_AUS_8BIT[data[k + 2]];
    aus[k] = linearZu8bit(m00 * lr + m01 * lg + m02 * lb);
    aus[k + 1] = linearZu8bit(m10 * lr + m11 * lg + m12 * lb);
    aus[k + 2] = linearZu8bit(m20 * lr + m21 * lg + m22 * lb);
    aus[k + 3] = 255;
  }
  return { width: bild.width, height: bild.height, data: aus };
}

/** Restabweichung (ΔE2000) der Felder nach Anwendung der Matrix. */
export function restabweichung(felder, M) {
  const werte = felder.map((f, i) => {
    if (!(f.n > 0)) return NaN;
    const lin = f.mittel.map(achtBitZuLinear);
    const korr = [0, 1, 2].map((k) => M[k][0] * lin[0] + M[k][1] * lin[1] + M[k][2] * lin[2]);
    const lab = linearSrgbZuLab(korr.map((x) => Math.max(0, x)));
    return deltaE2000(lab, COLORCHECKER_2014[i].lab);
  });
  const gueltig = werte.filter((x) => Number.isFinite(x));
  const mittel = gueltig.reduce((a, b) => a + b, 0) / Math.max(1, gueltig.length);
  return { je_feld: werte, mittel: gueltig.length ? mittel : NaN, max: gueltig.length ? Math.max(...gueltig) : NaN };
}

/** Alle 8 möglichen Reihenfolgen der 4 Ecken (4 Drehungen, je vorwärts/rückwärts). */
function eckenVarianten(ecken) {
  const v = [];
  for (let d = 0; d < 4; d++) {
    const vor = [0, 1, 2, 3].map((i) => ecken[(i + d) % 4]);
    v.push({ ecken: vor, verschiebung: d, gespiegelt: false });
    const rueck = [0, 3, 2, 1].map((i) => ecken[(i + d) % 4]);
    v.push({ ecken: rueck, verschiebung: d, gespiegelt: true });
  }
  return v;
}

/**
 * Farbkarte auswerten: Felder messen, Matrix berechnen, Restabweichung bestimmen.
 * Mit reihenfolgeSuchen = true werden alle 8 Eckreihenfolgen probiert und die mit der
 * kleinsten Restabweichung genommen (falls die Ecken in falscher Reihenfolge angeklickt
 * wurden). Das macht die Einrichtung; die laufende Auswertung nutzt die gespeicherte Reihenfolge.
 * eckenPx: 4 Ecken in Pixeln des Bildes.
 */
export function farbkarteAuswerten(bild, eckenPx, { reihenfolgeSuchen = false } = {}) {
  let bestes = null;
  const varianten = reihenfolgeSuchen
    ? eckenVarianten(eckenPx)
    : [{ ecken: eckenPx, verschiebung: 0, gespiegelt: false }];
  for (const variante of varianten) {
    const felder = felderMessen(bild, variante.ecken);
    const fit = korrekturmatrixBerechnen(felder);
    if (!fit) continue;
    const rest = restabweichung(felder, fit.matrix);
    if (!Number.isFinite(rest.mittel)) continue;
    if (!bestes || rest.mittel < bestes.rest.mittel) bestes = { variante, felder, fit, rest };
  }
  if (!bestes) return null;
  const { variante, felder, fit, rest } = bestes;
  const weiss = felder[18].mittel; // Feld 19, roh (vor Korrektur)
  return {
    matrix: fit.matrix,
    genutzteFelder: fit.genutzteFelder,
    deltaE_mittel: rest.mittel,
    deltaE_max: rest.max,
    deltaE_je_feld: rest.je_feld,
    felder: felder.map((f) => ({ mittel: f.mittel, streuung: f.streuung })),
    weiss_roh: Math.max(...weiss),
    reihenfolgeKorrigiert: variante.verschiebung !== 0 || variante.gespiegelt,
    ecken: variante.ecken,
  };
}
