// Statistik für Pilot, Kalibrierung und Auswertung:
// Mittelwert, Standardabweichung, Median, gewichtetes Kappa, Rangkorrelation, AUDPC.

export function mittelwert(x) {
  const w = x.filter(Number.isFinite);
  return w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN;
}

/** Stichproben-Standardabweichung (n - 1). */
export function standardabweichung(x) {
  const w = x.filter(Number.isFinite);
  if (w.length < 2) return NaN;
  const m = mittelwert(w);
  return Math.sqrt(w.reduce((a, b) => a + (b - m) * (b - m), 0) / (w.length - 1));
}

export function median(x) {
  const w = x.filter(Number.isFinite).sort((a, b) => a - b);
  if (!w.length) return NaN;
  const m = Math.floor(w.length / 2);
  return w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2;
}

/**
 * Quadratisch gewichtetes Kappa (Cohen) für zwei Bewertungsreihen auf einer Notenskala.
 * kategorien: alle möglichen Noten in Reihenfolge (z. B. [0,1,2,3,4]).
 * Paare mit fehlendem Wert werden ignoriert. Ergebnis NaN, wenn nicht berechenbar.
 */
export function gewichtetesKappa(a, b, kategorien) {
  const k = kategorien.length;
  const pos = new Map(kategorien.map((c, i) => [c, i]));
  const paare = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (pos.has(a[i]) && pos.has(b[i])) paare.push([pos.get(a[i]), pos.get(b[i])]);
  }
  const n = paare.length;
  if (n === 0 || k < 2) return NaN;
  const ra = new Array(k).fill(0); const rb = new Array(k).fill(0);
  let beobachtet = 0;
  for (const [i, j] of paare) { ra[i]++; rb[j]++; beobachtet += (i - j) * (i - j); }
  let erwartet = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) erwartet += ra[i] * rb[j] * (i - j) * (i - j);
  erwartet /= n;
  if (erwartet === 0) return beobachtet === 0 ? 1 : NaN;
  return 1 - beobachtet / erwartet;
}

/** Ränge mit Durchschnittsrängen bei Gleichstand (1-basiert). */
export function raenge(x) {
  const idx = x.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]);
  const r = new Array(x.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const rang = (i + j) / 2 + 1;
    for (let t = i; t <= j; t++) r[idx[t][1]] = rang;
    i = j + 1;
  }
  return r;
}

export function pearson(x, y) {
  const n = x.length;
  if (n < 2) return NaN;
  const mx = mittelwert(x); const my = mittelwert(y);
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Rangkorrelation nach Spearman (Pearson der Ränge, Gleichstände gemittelt). */
export function spearman(x, y) {
  const paare = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) paare.push([x[i], y[i]]);
  }
  if (paare.length < 3) return NaN;
  return pearson(raenge(paare.map((p) => p[0])), raenge(paare.map((p) => p[1])));
}

/**
 * AUDPC (Fläche unter der Befallsverlaufskurve), Trapezregel:
 * Summe über aufeinanderfolgende Termine von (Befall_1 + Befall_2) / 2 × Tage dazwischen.
 * tage: Tage seit dem ersten Termin (aufsteigend), werte: Befall in %.
 */
export function audpc(tage, werte) {
  let summe = 0;
  for (let i = 0; i + 1 < tage.length; i++) {
    summe += ((werte[i] + werte[i + 1]) / 2) * (tage[i + 1] - tage[i]);
  }
  return summe;
}

/** Rundet auf n Nachkommastellen (für Anzeige und Export). */
export function runden(x, n = 1) {
  if (!Number.isFinite(x)) return x;
  const f = 10 ** n;
  return Math.round(x * f) / f;
}
