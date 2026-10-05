// Excel-Dateien lesen und schreiben (SheetJS, Apache-2.0). Für Werkstatt und App.

import * as XLSX from '../bibliotheken/xlsx.mjs';

/** Liest eine Arbeitsmappe. Ergebnis: { blattname: [ { Spalte: Wert, … }, … ] } (Zeile 1 = Überschriften). */
export function arbeitsmappeLesen(daten) {
  const mappe = XLSX.read(daten, { type: 'array', cellDates: true });
  const aus = {};
  for (const name of mappe.SheetNames) {
    aus[name] = XLSX.utils.sheet_to_json(mappe.Sheets[name], { defval: null, raw: true });
  }
  return aus;
}

/** Sucht ein Blatt ohne Rücksicht auf Groß-/Kleinschreibung. */
export function blattFinden(mappe, name) {
  const k = Object.keys(mappe).find((n) => n.trim().toLowerCase() === name.toLowerCase());
  return k ? mappe[k] : null;
}

/**
 * Schreibt eine Arbeitsmappe.
 * blaetter: [{ name, spalten: [Spaltenname…], zeilen: [ {…} oder […] ], breiten?: [Zeichen…] }]
 * Ergebnis: Uint8Array (xlsx).
 */
export function arbeitsmappeSchreiben(blaetter) {
  const mappe = XLSX.utils.book_new();
  for (const b of blaetter) {
    const aoa = [b.spalten, ...b.zeilen.map((z) => (Array.isArray(z) ? z : b.spalten.map((s) => {
      const v = z[s];
      return v === undefined ? null : v;
    })))];
    const blatt = XLSX.utils.aoa_to_sheet(aoa);
    blatt['!cols'] = (b.breiten || b.spalten.map((s) => Math.max(10, String(s).length + 2))).map((w) => ({ wch: w }));
    if (b.spalten.length) blatt['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, aoa.length - 1), c: b.spalten.length - 1 } }) };
    XLSX.utils.book_append_sheet(mappe, blatt, b.name.slice(0, 31));
  }
  return new Uint8Array(XLSX.write(mappe, { type: 'array', bookType: 'xlsx', compression: true }));
}
