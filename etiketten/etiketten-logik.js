// Logik der Druckseite für Topf-Karten (ohne Oberfläche, in Node testbar):
// Nummern erzeugen, Listen lesen, QR-Code als SVG-Pfad, Aufteilung auf A4-Seiten.

import qrcode from '../bibliotheken/qrcode.mjs';

/** Karten je A4-Seite: 2 Spalten × 5 Zeilen à 85 × 55 mm. */
export const SPALTEN = 2;
export const ZEILEN = 5;
export const KARTE_B = 85;
export const KARTE_H = 55;
export const RAND_LINKS = (210 - SPALTEN * KARTE_B) / 2; // 20 mm
export const RAND_OBEN = (297 - ZEILEN * KARTE_H) / 2; // 11 mm

/** Nummern als Bereich: („P“, 1, 3, 3) → P001, P002, P003. */
export function idsAusBereich(praefix, von, bis, stellen = 3) {
  const a = Math.trunc(Number(von)); const b = Math.trunc(Number(bis));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return [];
  if (b - a > 5000) throw new Error('Höchstens 5000 Karten auf einmal.');
  const s = Math.max(1, Math.min(8, Math.trunc(Number(stellen)) || 1));
  const aus = [];
  for (let i = a; i <= b; i++) aus.push(`${praefix ?? ''}${String(i).padStart(s, '0')}`);
  return aus;
}

/**
 * Liste aus Text: eine Zeile je Karte, Felder getrennt durch Tabulator oder Strichpunkt:
 * topf_id[;satz[;sorte]]. Leere Zeilen und eine Überschriftzeile (topf_id/topf_nr) werden übersprungen.
 */
export function zeilenAusText(text) {
  return String(text ?? '').split(/\r?\n/)
    .map((z) => z.split(/\t|;/).map((x) => x.trim()))
    .filter((f) => f[0] && !/^topf_(id|nr)$/i.test(f[0]))
    .map(([id, satz = '', sorte = '']) => ({ id, satz, sorte }));
}

/** Zeilen aus einer Excel-Tabelle (Liste von Objekten mit Überschriften als Schlüssel). */
export function zeilenAusTabelle(zeilen) {
  if (!zeilen?.length) return [];
  const schluessel = Object.keys(zeilen[0]);
  const finde = (...namen) => schluessel.find((k) => namen.includes(String(k).trim().toLowerCase()));
  const sid = finde('topf_id', 'topf_nr', 'topf', 'id', 'nummer') ?? schluessel[0];
  const ssatz = finde('satz');
  const ssorte = finde('sorte');
  const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
  return zeilen.map((z) => ({ id: text(z[sid]), satz: ssatz ? text(z[ssatz]) : '', sorte: ssorte ? text(z[ssorte]) : '' }))
    .filter((z) => z.id);
}

/** Doppelte IDs finden (Karten müssen eindeutig sein). */
export function doppelte(ids) {
  const gesehen = new Set(); const doppelt = new Set();
  for (const id of ids) { if (gesehen.has(id)) doppelt.add(id); gesehen.add(id); }
  return [...doppelt];
}

/**
 * QR-Code als SVG-Daten: { groesse (Module inkl. Ruhezone), pfad (SVG-Pfad der dunklen Module) }.
 * Fehlerkorrektur M; die Version wird automatisch gewählt.
 */
export function qrDaten(text, ruhezone = 2) {
  const qr = qrcode(0, 'M');
  const s = String(text);
  // Großbuchstaben, Ziffern und - . / : passen kompakter (Alphanumerisch) -> größere Module.
  if (/^[0-9A-Z $%*+\-./:]+$/.test(s)) qr.addData(s, 'Alphanumeric');
  else qr.addData(String.fromCharCode(...new TextEncoder().encode(s)), 'Byte'); // UTF-8 (Umlaute)
  qr.make();
  const n = qr.getModuleCount();
  const teile = [];
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!qr.isDark(r, c)) { c++; continue; }
      let ende = c;
      while (ende < n && qr.isDark(r, ende)) ende++;
      teile.push(`M${c + ruhezone} ${r + ruhezone}h${ende - c}v1h-${ende - c}z`);
      c = ende;
    }
  }
  return { groesse: n + 2 * ruhezone, module: n, pfad: teile.join('') };
}

export function qrSvg(text, ruhezone = 2) {
  const d = qrDaten(text, ruhezone);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.groesse} ${d.groesse}" shape-rendering="crispEdges"><rect width="${d.groesse}" height="${d.groesse}" fill="#fff"/><path d="${d.pfad}" fill="#000"/></svg>`;
}

/** Teilt Karten auf Seiten auf; je Karte Position in mm. */
export function seitenAufteilen(karten) {
  const jeSeite = SPALTEN * ZEILEN;
  const seiten = [];
  karten.forEach((k, i) => {
    const s = Math.floor(i / jeSeite); const p = i % jeSeite;
    if (!seiten[s]) seiten[s] = [];
    seiten[s].push({ ...k, x: RAND_LINKS + (p % SPALTEN) * KARTE_B, y: RAND_OBEN + Math.floor(p / SPALTEN) * KARTE_H });
  });
  return seiten;
}
