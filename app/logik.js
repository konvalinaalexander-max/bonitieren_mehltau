// Fachlogik der Handy-App ohne Oberfläche (in Node testbar):
// Kennungen, Dateinamen, Excel-Zeilen, Verlauf/AUDPC, Regelkarte der Kontroll-Pflanze.

import { audpc, mittelwert, runden } from '../kern/statistik.js';

/** Spalten der Export-Excel – genau wie in docs/SPEZIFIKATION.md (Abschnitt Handy-App). */
export const EXPORT_SPALTEN = [
  'mess_id', 'datum_zeit', 'mitarbeiter', 'sitzung_id', 'topf_id', 'satz', 'sorte', 'behandlung', 'tisch',
  'foto_datei', 'flaeche_px', 'flaeche_cm2_ca', 'gruen_pct', 'gelb_pct', 'braun_pct', 'befall_pct', 'gruenwert',
  'note_app', 'note_manuell', 'qualitaet', 'algorithmus_version', 'app_version', 'handy_modell', 'bemerkung',
];

/** Version des Datenmodells je Messung (bei neuen Feldern erhöhen und messungErgaenzen anpassen). */
export const DATEN_VERSION = 1;

/**
 * Ergänzt eine gespeicherte Messung auf das aktuelle Datenmodell: fehlende Felder werden
 * mit null angelegt, nichts wird gelöscht. So lassen sich ältere Daten immer exportieren.
 */
export function messungErgaenzen(m) {
  const aus = { ...m };
  for (const s of EXPORT_SPALTEN) if (aus[s] === undefined) aus[s] = null;
  for (const s of ['foto_key', 'kontroll_key', 'vorschau_key']) if (aus[s] === undefined) aus[s] = null;
  aus.daten_version = DATEN_VERSION;
  return aus;
}

/** Testversion der App (eigene Daten): Pfad enthält /vorschau/ oder /test/. */
export function istTestversion(pfad) {
  return /\/(vorschau|test)\//i.test(String(pfad ?? ''));
}

export const SITZUNGSARTEN = {
  normal: 'Bonitur',
  kontrolle: 'Kontroll-Pflanze',
  kalibrierung: 'Kalibrierung',
};

const zwei = (n) => String(n).padStart(2, '0');

/** Datum als JJJJ-MM-TT (lokale Zeit). */
export function datumText(d = new Date()) {
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
}

/** Datum und Uhrzeit als „JJJJ-MM-TT HH:MM“ (lokale Zeit). */
export function datumZeitText(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return `${datumText(d)} ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

/** Dateiname wie bei Open Camera: BOX_JJJJMMTT_HHMMSS.jpg */
export function fotoDateiname(d = new Date()) {
  return `BOX_${d.getFullYear()}${zwei(d.getMonth() + 1)}${zwei(d.getDate())}_${zwei(d.getHours())}${zwei(d.getMinutes())}${zwei(d.getSeconds())}.jpg`;
}

/** Erlaubte Zeichen für Kennungen in Dateinamen. */
export function sauber(text) {
  return String(text ?? '').trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '');
}

/**
 * Sitzungs-Kennung: 2027-02-10_Satz12, bei Kontroll-Pflanze 2027-02-10_Kontrolle,
 * bei Kalibrierung 2027-02-10_Kalibrierung; zweite am selben Tag mit _2, _3 …
 */
export function sitzungIdBilden(datum, satz, art, vorhandene = []) {
  let basis;
  if (art === 'kontrolle') basis = `${datum}_Kontrolle`;
  else if (art === 'kalibrierung') basis = `${datum}_Kalibrierung${satz ? `_Satz${sauber(satz)}` : ''}`;
  else basis = `${datum}_Satz${sauber(satz) || 'ohne'}`;
  const belegt = new Set(vorhandene);
  if (!belegt.has(basis)) return basis;
  for (let i = 2; ; i++) if (!belegt.has(`${basis}_${i}`)) return `${basis}_${i}`;
}

export function messIdBilden(sitzungId, laufnummer) {
  return `${sitzungId}-${String(laufnummer).padStart(3, '0')}`;
}

/** Eindeutiger Dateiname innerhalb einer Sitzung (bei Gleichstand _2, _3 …). */
export function eindeutigerName(name, vorhandene) {
  const belegt = new Set(vorhandene.map((n) => n.toLowerCase()));
  if (!belegt.has(name.toLowerCase())) return name;
  const punkt = name.lastIndexOf('.');
  const stamm = punkt > 0 ? name.slice(0, punkt) : name;
  const endung = punkt > 0 ? name.slice(punkt) : '';
  for (let i = 2; ; i++) {
    const n = `${stamm}_${i}${endung}`;
    if (!belegt.has(n.toLowerCase())) return n;
  }
}

/** Zeile für die Export-Excel (nur die Spalten aus EXPORT_SPALTEN, in dieser Reihenfolge). */
export function exportZeile(m) {
  return Object.fromEntries(EXPORT_SPALTEN.map((s) => [s, m[s] === undefined ? null : m[s]]));
}

// ---- Stammdaten als Excel (eine Spalte je Liste) ----

export const STAMMDATEN_SPALTEN = ['saetze', 'sorten', 'behandlungen', 'tische', 'mitarbeiter'];

const STAMMDATEN_NAMEN = {
  saetze: ['saetze', 'satz', 'saetze_versuche', 'versuche', 'versuch'],
  sorten: ['sorten', 'sorte'],
  behandlungen: ['behandlungen', 'behandlung'],
  tische: ['tische', 'tisch'],
  mitarbeiter: ['mitarbeiter', 'kuerzel', 'mitarbeiter_kuerzel', 'mitarbeiterkuerzel'],
};

const spalte = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** Listen -> Tabellenzeilen ({ saetze, sorten, … } je Zeile). */
export function stammdatenZeilen(stammdaten) {
  const n = Math.max(0, ...STAMMDATEN_SPALTEN.map((k) => (stammdaten?.[k] || []).length));
  return Array.from({ length: n }, (_, i) => Object.fromEntries(STAMMDATEN_SPALTEN.map((k) => [k, stammdaten?.[k]?.[i] ?? null])));
}

/** Tabellenzeilen -> Listen (Überschriften mit oder ohne Umlaute, Einzahl oder Mehrzahl). */
export function stammdatenAusZeilen(zeilen) {
  const aus = Object.fromEntries(STAMMDATEN_SPALTEN.map((k) => [k, []]));
  for (const z of zeilen || []) {
    for (const [roh, wert] of Object.entries(z)) {
      const name = spalte(roh);
      const k = STAMMDATEN_SPALTEN.find((s) => STAMMDATEN_NAMEN[s].includes(name));
      const text = wert === null || wert === undefined ? '' : String(wert).trim();
      if (k && text && !aus[k].includes(text)) aus[k].push(text);
    }
  }
  return aus;
}

/** Listen zusammenführen (vorhandene bleiben, neue werden angehängt). */
export function stammdatenMischen(alt, neu) {
  const aus = { ...alt };
  for (const k of STAMMDATEN_SPALTEN) aus[k] = [...new Set([...(alt?.[k] || []), ...(neu?.[k] || [])])];
  return aus;
}

/** „2026-10-05“ -> „05.10.“ */
export function kurzDatum(datum) {
  const m = String(datum ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.` : String(datum ?? '');
}

/** Tage zwischen zwei Datumstexten JJJJ-MM-TT. */
export function tageZwischen(a, b) {
  const t = (x) => Date.UTC(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}

/**
 * Verlauf je Satz und Behandlung über die Termine (Sitzungsdaten).
 * messungen: Liste mit satz, behandlung, befall_pct, note_app, note_manuell, sitzung_id
 * sitzungen: Liste mit sitzung_id, datum, art
 * Ergebnis: [{ satz, behandlung, termine: [{ datum, tag, befall, note, n }], audpc }]
 */
export function verlaufBerechnen(messungen, sitzungen) {
  const datumVon = new Map(sitzungen.filter((s) => s.art !== 'kontrolle').map((s) => [s.sitzung_id, s.datum]));
  const gruppen = new Map();
  for (const m of messungen) {
    const datum = datumVon.get(m.sitzung_id);
    if (!datum) continue;
    const befall = Number.isFinite(m.befall_pct) ? m.befall_pct : null;
    const note = Number.isFinite(m.note_app) ? m.note_app : (Number.isFinite(m.note_manuell) ? m.note_manuell : null);
    if (befall === null && note === null) continue;
    const key = `${m.satz ?? ''}\u0000${m.behandlung ?? ''}`;
    if (!gruppen.has(key)) gruppen.set(key, { satz: m.satz ?? '', behandlung: m.behandlung ?? '', proDatum: new Map() });
    const g = gruppen.get(key);
    if (!g.proDatum.has(datum)) g.proDatum.set(datum, []);
    g.proDatum.get(datum).push({ befall, note });
  }
  return [...gruppen.values()].map((g) => {
    const daten = [...g.proDatum.keys()].sort();
    const termine = daten.map((d) => {
      const w = g.proDatum.get(d);
      return {
        datum: d, tag: tageZwischen(daten[0], d),
        befall: runden(mittelwert(w.map((x) => x.befall)), 1),
        note: runden(mittelwert(w.map((x) => x.note)), 2),
        n: w.length,
      };
    });
    const mitBefall = termine.filter((t) => Number.isFinite(t.befall));
    return {
      satz: g.satz, behandlung: g.behandlung, termine,
      audpc: mitBefall.length >= 2 ? runden(audpc(mitBefall.map((t) => t.tag), mitBefall.map((t) => t.befall)), 1) : null,
    };
  }).sort((a, b) => String(a.satz).localeCompare(String(b.satz), 'de', { numeric: true }) || String(a.behandlung).localeCompare(String(b.behandlung), 'de'));
}

/**
 * Regelkarte der Kontroll-Pflanze (Leitfaden 10.7): Mittellinie aus den ersten 5 Terminen,
 * Toleranzband ± band Prozentpunkte. Ein Punkt außerhalb oder 6 Termine in Folge steigend/fallend
 * sind Warnsignale.
 */
export function regelkarte(punkte, band = 2) {
  const p = [...punkte].filter((x) => Number.isFinite(x.befall)).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  if (p.length < 5) return { punkte: p, mitte: null, band, warnungen: [], bereit: false };
  const mitte = runden(mittelwert(p.slice(0, 5).map((x) => x.befall)), 2);
  const warnungen = [];
  p.forEach((x, i) => {
    x.ausserhalb = Math.abs(x.befall - mitte) > band;
    if (x.ausserhalb) warnungen.push(`${x.datum}: außerhalb des Bandes (${x.befall} %)`);
    if (i >= 5) {
      const fenster = p.slice(i - 5, i + 1).map((y) => y.befall);
      const steigend = fenster.every((v, k) => k === 0 || v > fenster[k - 1]);
      const fallend = fenster.every((v, k) => k === 0 || v < fenster[k - 1]);
      if (steigend || fallend) warnungen.push(`${x.datum}: 6 Termine in Folge ${steigend ? 'steigend' : 'fallend'} (schleichende Veränderung)`);
    }
  });
  return { punkte: p, mitte, band, warnungen, bereit: true };
}

/** PIN als SHA-256-Hash (nie im Klartext speichern). */
export async function pinHash(pin) {
  const daten = new TextEncoder().encode(`mehltau-bonitur:${pin}`);
  const h = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
