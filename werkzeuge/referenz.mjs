// Referenzbilder in Node auswerten (für die automatischen Tests und das Erzeugen der Sollwerte).
// Referenzbilder liegen in referenzbilder/ (Pilotfotos), die Einstellungen der Werkstatt in
// referenzbilder/einstellungen.json, die Sollwerte in tests/sollwerte.json.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dekodieren from './jpeg-dekoder.mjs';
import { exifLesen, nachExifDrehen } from '../kern/exif.js';
import { analysieren } from '../kern/analyse.js';
import { einstellungenErgaenzen } from '../kern/einstellungen.js';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REFERENZ_ORDNER = join(WURZEL, 'referenzbilder');
export const SOLLWERTE_DATEI = join(WURZEL, 'tests', 'sollwerte.json');
export const FELDER = ['flaeche_px', 'gruen_pct', 'gelb_pct', 'braun_pct', 'befall_pct', 'gruenwert', 'note_app'];

/** Liste der Referenz-Fotos (JPEG), alphabetisch. */
export function referenzFotos() {
  if (!existsSync(REFERENZ_ORDNER)) return [];
  return readdirSync(REFERENZ_ORDNER).filter((n) => /\.jpe?g$/i.test(n)).sort();
}

export function referenzEinstellungen() {
  const datei = join(REFERENZ_ORDNER, 'einstellungen.json');
  if (!existsSync(datei)) return null;
  return einstellungenErgaenzen(JSON.parse(readFileSync(datei, 'utf8')));
}

/** Wertet ein JPEG wie die Werkstatt aus (Ausrichtung nach EXIF, Verkleinern, Analyse). */
export function jpegAuswerten(pfad, einstellungen) {
  const bytes = readFileSync(pfad);
  const roh = dekodieren(bytes, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 1024 });
  const exif = exifLesen(bytes);
  const bild = nachExifDrehen({ width: roh.width, height: roh.height, data: new Uint8ClampedArray(roh.data.buffer) }, exif?.orientierung ?? 1);
  const r = analysieren(bild, einstellungen);
  return Object.fromEntries(FELDER.map((f) => [f, r[f]]));
}
