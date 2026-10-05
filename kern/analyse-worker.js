// Hintergrund-Worker für Werkstatt und App: Foto dekodieren, auswerten, Kontrollbild erzeugen.
// Läuft als Modul-Worker (new Worker(url, { type: 'module' })) oder gebündelt als klassischer Worker.

import { verkleinern } from './bild.js';
import {
  vorverarbeiten, klassifizieren, kennzahlen, kontrollbild, basisInfo,
} from './analyse.js';
import { histogrammErstellen } from './histogramm.js';
import { farbkarteAuswerten, feldMittelpunkte } from './farbkarte.js';
import { qrLesen } from './qr.js';
import { exifLesen, zeitAusDateiname } from './exif.js';
import { einstellungenErgaenzen } from './einstellungen.js';

/** ImageBitmap -> RGBA-Bild { width, height, data }. */
function bitmapZuBild(bitmap) {
  const leinwand = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = leinwand.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  const d = ctx.getImageData(0, 0, leinwand.width, leinwand.height);
  return { width: d.width, height: d.height, data: d.data };
}

/**
 * Foto als RGBA-Bild. Normalfall: im Hauptprogramm dekodiert ({ bitmap, kopf, name },
 * siehe nachrichtVorbereiten in arbeiter.js). Rückfall: ein Blob, der hier dekodiert wird.
 */
async function fotoBild(datei) {
  if (datei instanceof Blob) return bitmapZuBild(await createImageBitmap(datei, { imageOrientation: 'from-image' }));
  return bitmapZuBild(datei.bitmap);
}

async function alsJpeg(bild, breite, qualitaet = 0.85) {
  const quelle = new OffscreenCanvas(bild.width, bild.height);
  quelle.getContext('2d').putImageData(new ImageData(bild.data, bild.width, bild.height), 0, 0);
  if (!breite || bild.width <= breite) return quelle.convertToBlob({ type: 'image/jpeg', quality: qualitaet });
  const hoehe = Math.round((bild.height * breite) / bild.width);
  const ziel = new OffscreenCanvas(breite, hoehe);
  const ctx = ziel.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(quelle, 0, 0, breite, hoehe);
  return ziel.convertToBlob({ type: 'image/jpeg', quality: qualitaet });
}

async function fotoExif(datei) {
  try {
    const kopf = datei instanceof Blob ? await datei.slice(0, 196608).arrayBuffer() : datei.kopf;
    const e = exifLesen(kopf);
    const zeitName = zeitAusDateiname(datei.name || '');
    return {
      modell: e?.modell || null,
      hersteller: e?.hersteller || null,
      aufnahme: (e?.aufnahme || zeitName || null)?.toISOString?.() ?? null,
      orientierung: e?.orientierung ?? 1,
    };
  } catch {
    return null;
  }
}

async function analysieren({ datei, einstellungen, optionen = {} }) {
  const start = performance.now();
  const einst = einstellungenErgaenzen(einstellungen);
  const [voll, exif] = await Promise.all([fotoBild(datei), fotoExif(datei)]);
  const qr = optionen.qr ? qrLesen(voll, einst.etikettbereich) : null;
  const vorschau = optionen.vorschau ? await alsJpeg(voll, optionen.vorschau, 0.8) : null;
  const klein = verkleinern(voll, einst.analyse.lange_kante);
  const vv = vorverarbeiten(klein, einst);
  const { klassen, anzahl } = klassifizieren(vv, einst.schwellen);
  const kz = kennzahlen(anzahl, vv, einst);
  const antwort = {
    ergebnis: {
      ...kz,
      farbkarte: vv.karte ? {
        deltaE_mittel: vv.karte.deltaE_mittel,
        deltaE_max: vv.karte.deltaE_max,
        weiss_roh: vv.karte.weiss_roh,
        deltaE_je_feld: vv.karte.deltaE_je_feld,
      } : null,
      basis: basisInfo(vv),
      anzahl,
      groesse: { voll: { breite: voll.width, hoehe: voll.height }, analyse: { breite: vv.breite, hoehe: vv.hoehe } },
      exif,
      dauer_ms: 0,
    },
    qr,
    vorschau,
    transfer: [],
  };
  if (optionen.histogramm) {
    const hist = histogrammErstellen(vv);
    antwort.hist = hist;
    antwort.transfer.push(hist.tabelle.buffer);
  }
  if (optionen.kontrollbild) {
    const kb = kontrollbild(vv, klassen);
    antwort.kontrollbild = await alsJpeg(kb, optionen.kontrollbild, 0.85);
    if (optionen.kontrollbildKlein) antwort.kontrollbildKlein = await alsJpeg(kb, optionen.kontrollbildKlein, 0.8);
  }
  antwort.ergebnis.dauer_ms = Math.round(performance.now() - start);
  return antwort;
}

async function farbkarteSuchen({ datei, ecken, langeKante = 1600 }) {
  const klein = verkleinern(await fotoBild(datei), langeKante);
  const W = klein.width; const H = klein.height;
  const k = farbkarteAuswerten(klein, ecken.map(([x, y]) => [x * W, y * H]), { reihenfolgeSuchen: true });
  if (!k) return { gefunden: false };
  return {
    gefunden: true,
    ecken: k.ecken.map(([x, y]) => [x / W, y / H]),
    mittelpunkte: feldMittelpunkte(k.ecken).map(([x, y]) => [x / W, y / H]),
    deltaE_mittel: k.deltaE_mittel,
    deltaE_max: k.deltaE_max,
    deltaE_je_feld: k.deltaE_je_feld,
    reihenfolgeKorrigiert: k.reihenfolgeKorrigiert,
    weiss_roh: k.weiss_roh,
    groesse: { breite: W, hoehe: H },
  };
}

async function qrTesten({ datei, bereich }) {
  return { qr: qrLesen(await fotoBild(datei), bereich) };
}

/** Nur vorbereiten (Sicht-Bonitur): Vorschau, EXIF und QR – ohne automatische Analyse. */
async function vorbereiten({ datei, einstellungen, optionen = {} }) {
  const einst = einstellungenErgaenzen(einstellungen);
  const [voll, exif] = await Promise.all([fotoBild(datei), fotoExif(datei)]);
  return {
    ergebnis: { exif, groesse: { voll: { breite: voll.width, hoehe: voll.height } } },
    qr: optionen.qr ? qrLesen(voll, einst.etikettbereich) : null,
    vorschau: await alsJpeg(voll, optionen.vorschau || 320, 0.8),
    gross: optionen.gross ? await alsJpeg(voll, optionen.gross, 0.85) : null,
  };
}

const AUFGABEN = { analysieren, farbkarteSuchen, qrTesten, vorbereiten };

self.onmessage = async (ereignis) => {
  const { id, typ } = ereignis.data;
  try {
    const aufgabe = AUFGABEN[typ];
    if (!aufgabe) throw new Error(`Unbekannte Aufgabe: ${typ}`);
    const antwort = await aufgabe(ereignis.data);
    const transfer = antwort.transfer || [];
    delete antwort.transfer;
    self.postMessage({ id, ok: true, ...antwort }, transfer);
  } catch (fehler) {
    self.postMessage({ id, ok: false, fehler: String(fehler?.message || fehler) });
  }
};
