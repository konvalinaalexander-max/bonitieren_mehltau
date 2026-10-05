// Farbumrechnungen: sRGB <-> linear, Lab (D50), HSV, Farbabstand ΔE2000.
// Reines JavaScript ohne Abhängigkeiten; läuft im Browser, im Worker und in Node.

/** sRGB-Kanalwert (0..1) -> linearer Wert (0..1). */
export function srgbZuLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Linearer Wert -> sRGB-Kanalwert (0..1), ohne Begrenzung. */
export function linearZuSrgb(l) {
  return l <= 0.0031308 ? 12.92 * l : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
}

/** Tabelle: 8-Bit-sRGB (0..255) -> linear (0..1). */
export const LIN_AUS_8BIT = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) t[i] = srgbZuLinear(i / 255);
  return t;
})();

const KODIER_STUFEN = 4096;
/** Tabelle: linear (0..1, in 4096 Stufen) -> 8-Bit-sRGB. */
const ACHTBIT_AUS_LIN = (() => {
  const t = new Uint8ClampedArray(KODIER_STUFEN + 1);
  for (let i = 0; i <= KODIER_STUFEN; i++) t[i] = Math.round(linearZuSrgb(i / KODIER_STUFEN) * 255);
  return t;
})();

/** Linearer Wert (beliebig) -> 8-Bit-sRGB, begrenzt auf 0..255. */
export function linearZu8bit(l) {
  if (!(l > 0)) return 0;
  if (l >= 1) return 255;
  return ACHTBIT_AUS_LIN[Math.round(l * KODIER_STUFEN)];
}

// --- Matrizen (Quelle: Bruce Lindbloom, brucelindbloom.com) ---

/** lineares sRGB -> XYZ (D65) */
export const SRGB_ZU_XYZ_D65 = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];
/** XYZ (D65) -> lineares sRGB */
export const XYZ_D65_ZU_SRGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.9692660, 1.8760108, 0.0415560],
  [0.0556434, -0.2040259, 1.0572252],
];
/** Bradford-Anpassung D50 -> D65 */
export const BRADFORD_D50_ZU_D65 = [
  [0.9555766, -0.0230393, 0.0631636],
  [-0.0282895, 1.0099416, 0.0210077],
  [0.0122982, -0.0204830, 1.3299098],
];
/** Bradford-Anpassung D65 -> D50 */
export const BRADFORD_D65_ZU_D50 = [
  [1.0478112, 0.0228866, -0.0501270],
  [0.0295424, 0.9904844, -0.0170491],
  [-0.0092345, 0.0150436, 0.7521316],
];

/** Weißpunkt D50 (ICC) */
export const WEISS_D50 = [0.96422, 1.0, 0.82521];

export function matMalVek(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

export function matMalMat(a, b) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  }
  return r;
}

const LIN_SRGB_ZU_XYZ_D50 = matMalMat(BRADFORD_D65_ZU_D50, SRGB_ZU_XYZ_D65);
const XYZ_D50_ZU_LIN_SRGB = matMalMat(XYZ_D65_ZU_SRGB, BRADFORD_D50_ZU_D65);

const EPS = 216 / 24389; // 0.008856
const KAPPA = 24389 / 27; // 903.3

/** Lab (D50) -> XYZ (D50) */
export function labZuXyzD50([L, a, b]) {
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const fx3 = fx * fx * fx;
  const fz3 = fz * fz * fz;
  const xr = fx3 > EPS ? fx3 : (116 * fx - 16) / KAPPA;
  const yr = L > KAPPA * EPS ? fy * fy * fy : L / KAPPA;
  const zr = fz3 > EPS ? fz3 : (116 * fz - 16) / KAPPA;
  return [xr * WEISS_D50[0], yr * WEISS_D50[1], zr * WEISS_D50[2]];
}

/** XYZ (D50) -> Lab (D50) */
export function xyzD50ZuLab([X, Y, Z]) {
  const f = (t) => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
  const fx = f(X / WEISS_D50[0]);
  const fy = f(Y / WEISS_D50[1]);
  const fz = f(Z / WEISS_D50[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** Lab (D50) -> lineares sRGB (D65), unbegrenzt (Werte außerhalb 0..1 möglich). */
export function labZuLinearSrgb(lab) {
  return matMalVek(XYZ_D50_ZU_LIN_SRGB, labZuXyzD50(lab));
}

/** lineares sRGB -> Lab (D50) */
export function linearSrgbZuLab(rgb) {
  return xyzD50ZuLab(matMalVek(LIN_SRGB_ZU_XYZ_D50, rgb));
}

/** 8-Bit-sRGB (0..255) -> Lab (D50) */
export function srgb8ZuLab(r, g, b) {
  return linearSrgbZuLab([srgbZuLinear(r / 255), srgbZuLinear(g / 255), srgbZuLinear(b / 255)]);
}

/** Lab (D50) -> 8-Bit-sRGB (gerundet, begrenzt) */
export function labZuSrgb8(lab) {
  return labZuLinearSrgb(lab).map(linearZu8bit);
}

/**
 * RGB (0..255) -> HSV. Farbton h in Grad (0 <= h < 360, NaN bei Grau),
 * s und v als Anteil 0..1.
 */
export function rgbZuHsv(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max / 255;
  const s = max === 0 ? 0 : d / max;
  let h = NaN;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    if (h >= 360) h -= 360;
  }
  return { h, s, v };
}

/**
 * Farbabstand CIEDE2000 zwischen zwei Lab-Farben.
 * Formel nach Sharma, Wu, Dalal (2005).
 */
export function deltaE2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cq = (C1 + C2) / 2;
  const Cq7 = Math.pow(Cq, 7);
  const G = 0.5 * (1 - Math.sqrt(Cq7 / (Cq7 + Math.pow(25, 7))));
  const a1s = (1 + G) * a1;
  const a2s = (1 + G) * a2;
  const C1s = Math.hypot(a1s, b1);
  const C2s = Math.hypot(a2s, b2);
  const hWinkel = (b, a) => {
    if (a === 0 && b === 0) return 0;
    let h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1s = hWinkel(b1, a1s);
  const h2s = hWinkel(b2, a2s);
  const dL = L2 - L1;
  const dC = C2s - C1s;
  let dh = 0;
  if (C1s * C2s !== 0) {
    dh = h2s - h1s;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1s * C2s) * Math.sin((dh / 2) * rad);
  const Lq = (L1 + L2) / 2;
  const Cqs = (C1s + C2s) / 2;
  let hq = h1s + h2s;
  if (C1s * C2s !== 0) {
    if (Math.abs(h1s - h2s) <= 180) hq = (h1s + h2s) / 2;
    else if (h1s + h2s < 360) hq = (h1s + h2s + 360) / 2;
    else hq = (h1s + h2s - 360) / 2;
  }
  const T = 1 - 0.17 * Math.cos((hq - 30) * rad) + 0.24 * Math.cos(2 * hq * rad)
    + 0.32 * Math.cos((3 * hq + 6) * rad) - 0.20 * Math.cos((4 * hq - 63) * rad);
  const dTheta = 30 * Math.exp(-Math.pow((hq - 275) / 25, 2));
  const Cqs7 = Math.pow(Cqs, 7);
  const RC = 2 * Math.sqrt(Cqs7 / (Cqs7 + Math.pow(25, 7)));
  const Lq50 = (Lq - 50) * (Lq - 50);
  const SL = 1 + (0.015 * Lq50) / Math.sqrt(20 + Lq50);
  const SC = 1 + 0.045 * Cqs;
  const SH = 1 + 0.015 * Cqs * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  const tL = dL / SL;
  const tC = dC / SC;
  const tH = dH / SH;
  return Math.sqrt(tL * tL + tC * tC + tH * tH + RT * tC * tH);
}
