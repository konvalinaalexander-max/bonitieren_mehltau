// Export einer Sitzung: Excel (eine Zeile je Messung) und ZIP mit Originalfotos
// (dazu die Excel und auf Wunsch die Kontrollbilder). Speichern als Download oder Teilen.

import JSZip from '../bibliotheken/jszip.mjs';
import { arbeitsmappeSchreiben, arbeitsmappeLesen, blattFinden } from '../kern/tabellen.js';
import { ALGORITHMUS_VERSION, versionsText } from '../kern/einstellungen.js';
import { notenBeschreibung } from '../kern/noten.js';
import {
  EXPORT_SPALTEN, exportZeile, SITZUNGSARTEN, STAMMDATEN_SPALTEN, stammdatenZeilen, stammdatenAusZeilen,
} from './logik.js';
import { holen } from './db.js';
import { APP_VERSION } from './version.js';

/** Blatt „Sitzung“: Kopfdaten, Versionen und die verwendeten Einstellungen. */
export function sitzungsInfo(sitzung, messungen, einstellungen, jetzt = new Date()) {
  const e = einstellungen || {};
  const ja = (x) => (x ? 'ja' : 'nein');
  return [
    ['sitzung_id', sitzung.sitzung_id], ['datum', sitzung.datum], ['art', SITZUNGSARTEN[sitzung.art] || sitzung.art],
    ['mitarbeiter', sitzung.mitarbeiter], ['satz', sitzung.satz || ''], ['messungen', messungen.length],
    ['app_version', APP_VERSION], ['algorithmus_version', versionsText(e)], ['rechenweg', ALGORITHMUS_VERSION],
    ['einstellungen', e.kennung ?? ''], ['einstellungen_geaendert', e.geaendert ?? ''], ['betriebsart', e.modus === 'sicht' ? 'Sicht-Bonitur' : 'automatisch'],
    ['schwellen', e.schwellen ? JSON.stringify(e.schwellen) : ''],
    ['notenskala', e.notenskala ? notenBeschreibung(e.notenskala).map((x) => `${x.note}: ${x.text}`).join(' · ') : ''],
    ['farbkarte_eingestellt', ja(e.farbkarte?.ecken)], ['topfkreis_eingestellt', ja(e.auswertekreis)],
    ['etikett_eingestellt', ja(e.etikettbereich)], ['massstab_pixel_pro_cm2', e.massstab?.pixel_pro_cm2 ?? ''],
    ['exportiert', jetzt.toISOString()],
    ['hinweis', 'Werte = sichtbare Symptome von oben (gelbe/braune Blattfläche), keine Mehltau-Diagnose.'],
  ];
}

export function sitzungsExcel(sitzung, messungen, einstellungen) {
  return arbeitsmappeSchreiben([
    { name: 'Messungen', spalten: EXPORT_SPALTEN, zeilen: messungen.map(exportZeile) },
    { name: 'Sitzung', spalten: ['Feld', 'Wert'], zeilen: sitzungsInfo(sitzung, messungen, einstellungen), breiten: [24, 60] },
  ]);
}

/** Name des Kontrollbilds im ZIP zu einem Fotonamen. */
export function kontrollbildName(fotoDatei) {
  return `${String(fotoDatei).replace(/\.jpe?g$/i, '')}_kontrolle.jpg`;
}

/**
 * ZIP: Excel, Originalfotos (unverändert, Namen wie in foto_datei), Kontrollbilder, Einstellungen.
 * bildHolen(schluessel) liefert { blob } (Standard: aus der Datenbank); ausgabe 'blob' oder 'uint8array'.
 */
export async function sitzungsZip(sitzung, messungen, einstellungen, { mitKontrollbildern = true, bildHolen = (k) => holen('bilder', k), ausgabe = 'blob' } = {}) {
  const zip = new JSZip();
  zip.file(`${sitzung.sitzung_id}.xlsx`, sitzungsExcel(sitzung, messungen, einstellungen));
  for (const m of messungen) {
    if (m.foto_key) {
      const b = await bildHolen(m.foto_key);
      if (b?.blob) zip.file(`fotos/${m.foto_datei}`, b.blob);
    }
    if (mitKontrollbildern && m.kontroll_key) {
      const k = await bildHolen(m.kontroll_key);
      if (k?.blob) zip.file(`kontrollbilder/${kontrollbildName(m.foto_datei)}`, k.blob);
    }
  }
  zip.file('einstellungen.json', JSON.stringify(einstellungen ?? {}, null, 2));
  return zip.generateAsync({ type: ausgabe });
}

/** Stammdaten-Listen als Excel (eine Spalte je Liste). */
export function stammdatenExcel(stammdaten) {
  return arbeitsmappeSchreiben([{ name: 'Stammdaten', spalten: STAMMDATEN_SPALTEN, zeilen: stammdatenZeilen(stammdaten), breiten: [16, 20, 22, 12, 14] }]);
}

/** Stammdaten aus einer Excel-Datei lesen (Blatt „Stammdaten“ oder das erste Blatt). */
export function stammdatenLesen(bytes) {
  const mappe = arbeitsmappeLesen(bytes);
  const zeilen = blattFinden(mappe, 'Stammdaten') || Object.values(mappe)[0] || [];
  return stammdatenAusZeilen(zeilen);
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
