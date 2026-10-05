// Export einer Sitzung: Excel (eine Zeile je Messung) und ZIP mit Originalfotos
// (dazu die Excel und auf Wunsch die Kontrollbilder). Speichern als Download oder Teilen.

import JSZip from '../bibliotheken/jszip.mjs';
import { arbeitsmappeSchreiben } from '../kern/tabellen.js';
import { EXPORT_SPALTEN, exportZeile, SITZUNGSARTEN } from './logik.js';
import { holen } from './db.js';

export function sitzungsExcel(sitzung, messungen, einstellungen) {
  const zeilen = messungen.map(exportZeile);
  const info = [
    ['sitzung_id', sitzung.sitzung_id], ['datum', sitzung.datum], ['art', SITZUNGSARTEN[sitzung.art] || sitzung.art],
    ['mitarbeiter', sitzung.mitarbeiter], ['satz', sitzung.satz], ['messungen', messungen.length],
    ['einstellungen', einstellungen?.kennung ?? ''], ['exportiert', new Date().toISOString()],
  ];
  return arbeitsmappeSchreiben([
    { name: 'Messungen', spalten: EXPORT_SPALTEN, zeilen },
    { name: 'Sitzung', spalten: ['Feld', 'Wert'], zeilen: info, breiten: [18, 40] },
  ]);
}

export async function sitzungsZip(sitzung, messungen, einstellungen, { mitKontrollbildern = true } = {}) {
  const zip = new JSZip();
  zip.file(`${sitzung.sitzung_id}.xlsx`, sitzungsExcel(sitzung, messungen, einstellungen));
  for (const m of messungen) {
    if (m.foto_key) {
      const b = await holen('bilder', m.foto_key);
      if (b?.blob) zip.file(`fotos/${m.foto_datei}`, b.blob);
    }
    if (mitKontrollbildern && m.kontroll_key) {
      const k = await holen('bilder', m.kontroll_key);
      if (k?.blob) zip.file(`kontrollbilder/${m.foto_datei.replace(/\.jpe?g$/i, '')}_kontrolle.jpg`, k.blob);
    }
  }
  zip.file('einstellungen.json', JSON.stringify(einstellungen ?? {}, null, 2));
  return zip.generateAsync({ type: 'blob' });
}

export function herunterladen(daten, name, typ = 'application/octet-stream') {
  const blob = daten instanceof Blob ? daten : new Blob([daten], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Teilen (z. B. an Google Drive, E-Mail), falls das Handy das kann. */
export async function teilen(dateien, titel) {
  if (!navigator.canShare || !navigator.canShare({ files: dateien })) return false;
  await navigator.share({ files: dateien, title: titel });
  return true;
}
