// Analyse-Kern: aus einem Foto Pflanzenfläche, Anteile grün/gelb/braun, Befall % und Note.
//
// Ablauf (Leitfaden Kapitel 7):
//   1. verkleinern (lange Kante 1600 px)            -> bild.js
//   2. Farbkorrektur mit der 24-Feld-Farbkarte       -> farbkarte.js
//   3. Auswertekreis um die Topfmitte
//   4. je Pixel Farbton H, Sättigung S, Helligkeit V (ganze Grad bzw. ganze Prozent)
//   5. Kandidaten-Maske (lockere, feste Grenzen) und Entfernen kleiner Einzelflecken
//   6. Pflanzen-Maske und Farbklassen mit den eingestellten Schwellen
//   7. Kennzahlen, Note, Qualitätsprüfungen, Kontrollbild
//
// Schritte 1–5 hängen nicht von den Schwellen ab („Vorverarbeitung“). Darum kann die
// Werkstatt die Schwellen per Histogramm sofort für alle Fotos neu auswerten (histogramm.js).

import { verkleinern } from './bild.js';
import { farbkarteAuswerten, bildKorrigieren } from './farbkarte.js';
import { BEREICHE, standardEinstellungen, einstellungenErgaenzen, versionsText } from './einstellungen.js';
import { noteAusBefall } from './noten.js';
import { runden } from './statistik.js';

export const KEIN_FARBTON = 65535;
export const F_KREIS = 1;
export const F_KANDIDAT = 2;
export const F_GLANZ = 4;
const F_BESUCHT = 8;

export const KLASSE = { KEINE: 0, GRUEN: 1, GELB: 2, BRAUN: 3, GLANZ: 4 };

/** Lockere Grenzen für Kandidaten: weiteste mögliche Regler-Stellung. */
export const KANDIDAT = {
  h_min: BEREICHE.farbton.min,
  h_max: BEREICHE.farbton.max,
  s_min: BEREICHE.saettigung.min,
  v_min: BEREICHE.helligkeit.min,
};

/** Glanzlicht: sehr hell und fast farblos (V über 90 %, S unter 15 %). */
export function istGlanz(sq, vq) {
  return vq > 90 && sq < 15;
}

/** Farbton (ganze Grad 0–359, KEIN_FARBTON bei Grau), S und V in ganzen Prozent. */
export function hsvGanz(r, g, b) {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const d = max - min;
  const vq = Math.floor((max * 100) / 255);
  const sq = max === 0 ? 0 : Math.floor((d * 100) / max);
  let hb = KEIN_FARBTON;
  if (d > 0) {
    let h;
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    hb = Math.floor(h);
    if (hb >= 360) hb -= 360;
  }
  return [hb, sq, vq];
}

/** Auswertekreis in Pixeln (aus normalisierten Werten; Standard: Bildmitte). */
export function kreisInPixeln(einst, W, H) {
  const k = einst.auswertekreis;
  if (k) return { cx: k.cx * W, cy: k.cy * H, r: k.r * W, eingestellt: true };
  return { cx: W / 2, cy: H / 2, r: 0.3 * Math.min(W, H), eingestellt: false };
}

/** Entfernt Kandidaten-Zusammenhangsgebiete (8er-Nachbarschaft) kleiner als minFleck Pixel. */
function fleckenEntfernen(flags, W, box, minFleck) {
  if (!(minFleck > 1)) return 0;
  const { x0, x1, y0, y1 } = box;
  const stapel = new Int32Array((x1 - x0 + 1) * (y1 - y0 + 1));
  const gebiet = [];
  let entfernt = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const start = y * W + x;
      if ((flags[start] & (F_KANDIDAT | F_BESUCHT)) !== F_KANDIDAT) continue;
      let oben = 0;
      stapel[oben++] = start;
      flags[start] |= F_BESUCHT;
      gebiet.length = 0;
      while (oben > 0) {
        const p = stapel[--oben];
        gebiet.push(p);
        const py = (p / W) | 0; const px = p - py * W;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = py + dy;
          if (ny < y0 || ny > y1) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = px + dx;
            if ((dx === 0 && dy === 0) || nx < x0 || nx > x1) continue;
            const q = ny * W + nx;
            if ((flags[q] & (F_KANDIDAT | F_BESUCHT)) === F_KANDIDAT) {
              flags[q] |= F_BESUCHT;
              stapel[oben++] = q;
            }
          }
        }
      }
      if (gebiet.length < minFleck) {
        for (const p of gebiet) flags[p] &= ~F_KANDIDAT;
        entfernt += gebiet.length;
      }
    }
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) flags[y * W + x] &= ~F_BESUCHT;
  return entfernt;
}

/**
 * Vorverarbeitung eines (bereits verkleinerten) Bildes: Farbkorrektur, Kreis,
 * H/S/V je Pixel, Kandidaten, Fleckenentfernung. Unabhängig von den Schwellen.
 */
export function vorverarbeiten(bild, einstellungen) {
  const einst = einstellungenErgaenzen(einstellungen);
  const W = bild.width; const H = bild.height; const N = W * H;

  let karte = null;
  if (einst.farbkarte?.ecken) {
    const eckenPx = einst.farbkarte.ecken.map(([x, y]) => [x * W, y * H]);
    karte = farbkarteAuswerten(bild, eckenPx);
  }
  const korrigiert = karte
    ? bildKorrigieren(bild, karte.matrix)
    : { width: W, height: H, data: new Uint8ClampedArray(bild.data) };

  const kreis = kreisInPixeln(einst, W, H);
  const box = {
    x0: Math.max(0, Math.floor(kreis.cx - kreis.r)),
    x1: Math.min(W - 1, Math.ceil(kreis.cx + kreis.r)),
    y0: Math.max(0, Math.floor(kreis.cy - kreis.r)),
    y1: Math.min(H - 1, Math.ceil(kreis.cy + kreis.r)),
  };
  const farbton = new Uint16Array(N).fill(KEIN_FARBTON);
  const saett = new Uint8Array(N);
  const hell = new Uint8Array(N);
  const flags = new Uint8Array(N);
  const d = korrigiert.data;
  const r2 = kreis.r * kreis.r;
  let kreisPixel = 0;
  for (let y = box.y0; y <= box.y1; y++) {
    const dy = y + 0.5 - kreis.cy;
    for (let x = box.x0; x <= box.x1; x++) {
      const dx = x + 0.5 - kreis.cx;
      if (dx * dx + dy * dy > r2) continue;
      const p = y * W + x; const q = p * 4;
      const [hb, sq, vq] = hsvGanz(d[q], d[q + 1], d[q + 2]);
      farbton[p] = hb; saett[p] = sq; hell[p] = vq;
      let f = F_KREIS;
      if (istGlanz(sq, vq)) f |= F_GLANZ;
      else if (hb !== KEIN_FARBTON && hb >= KANDIDAT.h_min && hb <= KANDIDAT.h_max
        && sq >= KANDIDAT.s_min && vq >= KANDIDAT.v_min) f |= F_KANDIDAT;
      flags[p] = f;
      kreisPixel++;
    }
  }
  const fleckenPixel = fleckenEntfernen(flags, W, box, einst.analyse.min_fleck);
  return {
    breite: W, hoehe: H, korrigiert, farbton, saett, hell, flags, kreis, box,
    kreisPixel, fleckenPixel, karte, einstellungen: einst,
  };
}

/**
 * Pflanzen-Maske und Farbklassen mit den Schwellen.
 * Ergebnis: Klassenkarte (Uint8Array, KLASSE.*) und Zählwerte.
 */
export function klassifizieren(vv, schwellen, { mitKarte = true } = {}) {
  const { h_min: hMin, h_max: hMax, s_min: sMin, v_min: vMin, braun_gelb: bg, gelb_gruen: gg } = schwellen;
  const { breite: W, box, flags, farbton, saett, hell } = vv;
  const klassen = mitKarte ? new Uint8Array(W * vv.hoehe) : null;
  let gruen = 0; let gelb = 0; let braun = 0; let glanz = 0; let farbtonSumme = 0;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const p = y * W + x;
      const f = flags[p];
      if (!(f & F_KREIS)) continue;
      if (f & F_GLANZ) { glanz++; if (klassen) klassen[p] = KLASSE.GLANZ; continue; }
      if (!(f & F_KANDIDAT)) continue;
      const hb = farbton[p];
      if (hb < hMin || hb > hMax || saett[p] < sMin || hell[p] < vMin) continue;
      let k;
      if (hb < bg) { braun++; k = KLASSE.BRAUN; } else if (hb < gg) { gelb++; k = KLASSE.GELB; } else { gruen++; k = KLASSE.GRUEN; }
      farbtonSumme += hb + 0.5;
      if (klassen) klassen[p] = k;
    }
  }
  return { klassen, anzahl: { gruen, gelb, braun, glanz, kreis: vv.kreisPixel, farbtonSumme } };
}

/**
 * Was kennzahlen() außer den Zählwerten braucht (aus der Vorverarbeitung).
 * Klein genug, um es mit den Ergebnissen zu speichern (Werkstatt: Regler ohne neue Bildauswertung).
 */
export function basisInfo(vv) {
  return {
    karte: vv.karte ? { deltaE_mittel: vv.karte.deltaE_mittel, weiss_roh: vv.karte.weiss_roh } : null,
    kreis: { eingestellt: vv.kreis.eingestellt },
    kreisPixel: vv.kreisPixel,
  };
}

/** Kennzahlen, Note und Qualitätsprüfung aus Zählwerten (vv: Vorverarbeitung oder basisInfo(vv)). */
export function kennzahlen(anzahl, vv, einstellungen) {
  const einst = einstellungenErgaenzen(einstellungen);
  const { gruen, gelb, braun, farbtonSumme } = anzahl;
  const flaeche = gruen + gelb + braun;
  const anteil = (n) => (flaeche > 0 ? (100 * n) / flaeche : NaN);
  const befallRoh = flaeche > 0 ? (100 * (gelb + braun)) / flaeche : NaN;
  const befall = runden(befallRoh, 1);
  const ppc = einst.massstab?.pixel_pro_cm2;
  const warnungen = [];
  const karte = vv.karte;
  const q = einst.qualitaet;
  if (!einst.farbkarte?.ecken) warnungen.push('Farbkarte nicht eingestellt');
  else if (!karte || !(karte.deltaE_mittel <= q.delta_e_fehler)) warnungen.push('Farbkarte nicht gefunden');
  else if (karte.deltaE_mittel > q.delta_e_warnung) warnungen.push('Farbkarte prüfen');
  if (karte) {
    if (karte.weiss_roh > q.weiss_max) warnungen.push('Bild zu hell');
    else if (karte.weiss_roh < q.weiss_min) warnungen.push('Bild zu dunkel');
  }
  if (!vv.kreis.eingestellt) warnungen.push('Auswertekreis nicht eingestellt');
  if (flaeche < q.min_pflanzen_anteil * vv.kreisPixel) warnungen.push('Keine Pflanze gefunden');
  return {
    flaeche_px: flaeche,
    flaeche_cm2_ca: ppc > 0 ? runden(flaeche / ppc, 0) : null,
    gruen_pct: runden(anteil(gruen), 1),
    gelb_pct: runden(anteil(gelb), 1),
    braun_pct: runden(anteil(braun), 1),
    befall_pct: befall,
    gruenwert: flaeche > 0 ? runden(farbtonSumme / flaeche, 1) : null,
    note_app: noteAusBefall(befall, einst.notenskala),
    warnungen,
    qualitaet: warnungen.length ? `Warnung: ${warnungen.join('; ')}` : 'ok',
    farbkarte_delta_e: karte ? runden(karte.deltaE_mittel, 2) : null,
    algorithmus_version: versionsText(einst),
  };
}

const KLASSEN_FARBE = {
  [KLASSE.GRUEN]: [40, 170, 60],
  [KLASSE.GELB]: [250, 205, 0],
  [KLASSE.BRAUN]: [215, 30, 30],
  [KLASSE.GLANZ]: [90, 190, 255],
};

/**
 * Kontrollbild: korrigiertes Foto, außerhalb des Kreises abgedunkelt,
 * Pflanzenpixel eingefärbt (grün / gelb / rot für braun, hellblau für Glanzlicht).
 */
export function kontrollbild(vv, klassen, { deckkraft = 0.6 } = {}) {
  const { breite: W, hoehe: H, korrigiert, flags } = vv;
  const aus = new Uint8ClampedArray(W * H * 4);
  const src = korrigiert.data;
  for (let p = 0; p < W * H; p++) {
    const q = p * 4;
    const k = klassen[p];
    if (!(flags[p] & F_KREIS)) {
      aus[q] = src[q] * 0.45; aus[q + 1] = src[q + 1] * 0.45; aus[q + 2] = src[q + 2] * 0.45;
    } else if (k) {
      const c = KLASSEN_FARBE[k];
      aus[q] = src[q] * (1 - deckkraft) + c[0] * deckkraft;
      aus[q + 1] = src[q + 1] * (1 - deckkraft) + c[1] * deckkraft;
      aus[q + 2] = src[q + 2] * (1 - deckkraft) + c[2] * deckkraft;
    } else {
      aus[q] = src[q]; aus[q + 1] = src[q + 1]; aus[q + 2] = src[q + 2];
    }
    aus[q + 3] = 255;
  }
  return { width: W, height: H, data: aus };
}

/**
 * Komplette Auswertung eines Fotos (volle Auflösung oder bereits verkleinert).
 * optionen: mitKontrollbild, mitVorverarbeitung (für Histogramm/Regler).
 */
export function analysieren(bild, einstellungen = standardEinstellungen(), optionen = {}) {
  const einst = einstellungenErgaenzen(einstellungen);
  const klein = verkleinern(bild, einst.analyse.lange_kante);
  const vv = vorverarbeiten(klein, einst);
  const { klassen, anzahl } = klassifizieren(vv, einst.schwellen);
  const ergebnis = kennzahlen(anzahl, vv, einst);
  ergebnis.anzahl = anzahl;
  ergebnis.farbkarte = vv.karte;
  ergebnis.kreis = vv.kreis;
  ergebnis.groesse = { breite: vv.breite, hoehe: vv.hoehe };
  if (optionen.mitKontrollbild) ergebnis.kontrollbild = kontrollbild(vv, klassen);
  if (optionen.mitVorverarbeitung) { ergebnis.vorverarbeitung = vv; ergebnis.klassen = klassen; }
  return ergebnis;
}
