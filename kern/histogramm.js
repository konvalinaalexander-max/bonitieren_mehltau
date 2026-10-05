// Schnelle Neuberechnung für die Regler der Werkstatt.
//
// Je Foto wird einmal eine Zähltabelle gebaut: für jeden Farbton (ganze Grad 10–180),
// jede mögliche Mindest-Sättigung (10–50 %, Schritt 2) und Mindest-Helligkeit (10–35 %)
// die Zahl der Kandidaten-Pixel mit genau diesem Farbton, die beide Mindestwerte erfüllen.
// Damit lässt sich jede Regler-Stellung ohne erneute Bildauswertung exakt auszählen –
// mit genau denselben Zahlen wie klassifizieren() in analyse.js.

import { BEREICHE } from './einstellungen.js';
import { F_KREIS, F_KANDIDAT, F_GLANZ } from './analyse.js';

const H0 = BEREICHE.farbton.min;
const NH = BEREICHE.farbton.max - BEREICHE.farbton.min + 1; // 171
const S0 = BEREICHE.saettigung.min;
const SS = BEREICHE.saettigung.schritt;
const NS = (BEREICHE.saettigung.max - BEREICHE.saettigung.min) / SS + 1; // 21
const V0 = BEREICHE.helligkeit.min;
const NV = BEREICHE.helligkeit.max - BEREICHE.helligkeit.min + 1; // 26

const index = (h, i, j) => (h * NS + i) * NV + j;

/** Baut die Zähltabelle aus einer Vorverarbeitung (vorverarbeiten() in analyse.js). */
export function histogrammErstellen(vv) {
  const roh = new Uint32Array(NH * NS * NV);
  const { breite: W, box, flags, farbton, saett, hell } = vv;
  let glanz = 0;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      const p = y * W + x;
      const f = flags[p];
      if (!(f & F_KREIS)) continue;
      if (f & F_GLANZ) { glanz++; continue; }
      if (!(f & F_KANDIDAT)) continue;
      const h = farbton[p] - H0;
      const i = Math.min(NS - 1, Math.floor((saett[p] - S0) / SS));
      const j = Math.min(NV - 1, hell[p] - V0);
      roh[index(h, i, j)]++;
    }
  }
  // Aufsummieren von oben: Eintrag (h, i, j) = Anzahl mit S >= S0 + i·SS und V >= V0 + j
  for (let h = 0; h < NH; h++) {
    for (let i = NS - 1; i >= 0; i--) {
      for (let j = NV - 1; j >= 0; j--) {
        let w = roh[index(h, i, j)];
        if (i + 1 < NS) w += roh[index(h, i + 1, j)];
        if (j + 1 < NV) w += roh[index(h, i, j + 1)];
        if (i + 1 < NS && j + 1 < NV) w -= roh[index(h, i + 1, j + 1)];
        roh[index(h, i, j)] = w;
      }
    }
  }
  return { tabelle: roh, kreis: vv.kreisPixel, glanz };
}

/** Prüft, ob die Schwellen auf dem Raster der Zähltabelle liegen. */
export function schwellenImRaster(s) {
  return Number.isInteger(s.h_min) && Number.isInteger(s.h_max)
    && Number.isInteger(s.braun_gelb) && Number.isInteger(s.gelb_gruen)
    && s.h_min >= H0 && s.h_max <= H0 + NH - 1
    && Number.isInteger(s.s_min) && s.s_min >= S0 && (s.s_min - S0) % SS === 0 && (s.s_min - S0) / SS < NS
    && Number.isInteger(s.v_min) && s.v_min >= V0 && s.v_min - V0 < NV;
}

/**
 * Zählt mit der Tabelle aus: liefert dieselben Werte wie klassifizieren().anzahl.
 * Gibt null zurück, wenn die Schwellen nicht im Raster liegen.
 */
export function auszaehlen(hist, s) {
  if (!schwellenImRaster(s)) return null;
  const i = (s.s_min - S0) / SS;
  const j = s.v_min - V0;
  let gruen = 0; let gelb = 0; let braun = 0; let farbtonSumme = 0;
  for (let hb = s.h_min; hb <= s.h_max; hb++) {
    const n = hist.tabelle[index(hb - H0, i, j)];
    if (!n) continue;
    if (hb < s.braun_gelb) braun += n; else if (hb < s.gelb_gruen) gelb += n; else gruen += n;
    farbtonSumme += n * (hb + 0.5);
  }
  return { gruen, gelb, braun, glanz: hist.glanz, kreis: hist.kreis, farbtonSumme };
}
