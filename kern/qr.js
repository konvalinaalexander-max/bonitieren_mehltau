// Topf-ID aus dem QR-Code der Topf-Karte lesen (jsQR, Apache-2.0).
// Gelesen wird in voller Auflösung im eingestellten Etikettbereich (plus Rand);
// gelingt das nicht, wird das ganze Bild verkleinert durchsucht.

import jsQR from '../bibliotheken/jsqr.mjs';
import { ausschnitt, verkleinern } from './bild.js';

function versuch(bild) {
  if (!bild.width || !bild.height) return null;
  const r = jsQR(bild.data, bild.width, bild.height, { inversionAttempts: 'dontInvert' });
  return r && r.data ? r.data.trim() : null;
}

/**
 * bild: Foto in voller Auflösung (RGBA). bereich: normalisiert {x, y, w, h} oder null.
 * Ergebnis: { text, quelle } oder null.
 */
export function qrLesen(bild, bereich) {
  const { width: W, height: H } = bild;
  if (bereich) {
    const rand = 0.25;
    const x = (bereich.x - bereich.w * rand) * W;
    const y = (bereich.y - bereich.h * rand) * H;
    const w = bereich.w * (1 + 2 * rand) * W;
    const h = bereich.h * (1 + 2 * rand) * H;
    const teil = ausschnitt(bild, x, y, w, h);
    const t = versuch(teil) || versuch(verkleinern(teil, 800));
    if (t) return { text: t, quelle: 'etikettbereich' };
  }
  const ganz = versuch(verkleinern(bild, 2000));
  return ganz ? { text: ganz, quelle: 'ganzes Bild' } : null;
}
