import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXPORT_SPALTEN, datumText, datumZeitText, fotoDateiname, sitzungIdBilden, messIdBilden, eindeutigerName,
  exportZeile, tageZwischen, verlaufBerechnen, regelkarte, pinHash, sauber, messungErgaenzen, istTestversion,
  stammdatenZeilen, stammdatenAusZeilen, stammdatenMischen, kurzDatum, DATEN_VERSION,
} from '../app/logik.js';
import { APP_VERSION } from '../app/version.js';

test('Export-Spalten genau wie in der Spezifikation', () => {
  const spez = readFileSync(new URL('../docs/SPEZIFIKATION.md', import.meta.url), 'utf8');
  const abschnitt = spez.slice(spez.indexOf('Datenfelder je Messung'));
  const spalten = [...abschnitt.slice(0, abschnitt.indexOf('- Versionen')).matchAll(/`([a-z0-9_]+)`/g)].map((m) => m[1]);
  assert.deepEqual(EXPORT_SPALTEN, spalten);
  assert.deepEqual(Object.keys(exportZeile({ mess_id: 'x', fremd: 1 })), EXPORT_SPALTEN);
});

test('Kennungen und Dateinamen', () => {
  const d = new Date(2027, 1, 10, 9, 32, 15);
  assert.equal(datumText(d), '2027-02-10');
  assert.equal(datumZeitText(d), '2027-02-10 09:32');
  assert.equal(fotoDateiname(d), 'BOX_20270210_093215.jpg');
  assert.equal(sitzungIdBilden('2027-02-10', '12', 'normal'), '2027-02-10_Satz12');
  assert.equal(sitzungIdBilden('2027-02-10', '12', 'normal', ['2027-02-10_Satz12']), '2027-02-10_Satz12_2');
  assert.equal(sitzungIdBilden('2027-02-15', '', 'kontrolle'), '2027-02-15_Kontrolle');
  assert.equal(sitzungIdBilden('2027-03-01', 'K', 'kalibrierung'), '2027-03-01_Kalibrierung_SatzK');
  assert.equal(messIdBilden('2027-02-10_Satz12', 7), '2027-02-10_Satz12-007');
  assert.equal(eindeutigerName('BOX_1.jpg', ['box_1.jpg', 'BOX_1_2.jpg']), 'BOX_1_3.jpg');
  assert.equal(sauber(' Satz 12/a '), 'Satz-12-a');
  assert.equal(tageZwischen('2027-02-10', '2027-03-01'), 19);
});

test('Verlauf und AUDPC wie Leitfaden Tabelle 11.3/11.4', () => {
  const sitzungen = ['2027-02-10', '2027-02-15', '2027-02-22', '2027-03-01'].map((datum, i) => ({ sitzung_id: `s${i}`, datum, art: 'normal' }));
  const a = [1, 4, 12, 28]; const b = [1, 2, 5, 11];
  const messungen = [];
  sitzungen.forEach((s, i) => {
    messungen.push({ sitzung_id: s.sitzung_id, satz: 12, behandlung: 'A', befall_pct: a[i] - 0.5, note_app: 1 });
    messungen.push({ sitzung_id: s.sitzung_id, satz: 12, behandlung: 'A', befall_pct: a[i] + 0.5, note_app: 1 });
    messungen.push({ sitzung_id: s.sitzung_id, satz: 12, behandlung: 'B', befall_pct: b[i], note_app: 0 });
  });
  const v = verlaufBerechnen(messungen, sitzungen);
  assert.equal(v.length, 2);
  assert.deepEqual(v[0].termine.map((t) => t.tag), [0, 5, 12, 19]);
  assert.deepEqual(v[0].termine.map((t) => t.befall), a);
  assert.equal(v[0].audpc, 208.5);
  assert.equal(v[1].audpc, 88);
});

test('Regelkarte: Band aus den ersten 5 Terminen, Ausreißer und Trend', () => {
  const werte = [10, 10.5, 9.5, 10, 10, 10.2, 13, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1];
  const r = regelkarte(werte.map((befall, i) => ({ datum: `2027-03-${String(i + 1).padStart(2, '0')}`, befall })));
  assert.equal(r.mitte, 10);
  assert.ok(r.warnungen.some((w) => w.includes('2027-03-07') && w.includes('außerhalb')));
  assert.ok(r.warnungen.some((w) => w.includes('steigend')));
  assert.equal(regelkarte([{ datum: '2027-01-01', befall: 3 }]).bereit, false);
});

test('PIN wird nur als Hash gespeichert', async () => {
  const h = await pinHash('1234');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, await pinHash('1235'));
});

test('App-Version in version.js und sw.js stimmen überein', () => {
  const sw = readFileSync(new URL('../app/sw.js', import.meta.url), 'utf8');
  assert.match(sw, new RegExp(`APP_VERSION = '${APP_VERSION.replace(/\./g, '\\.')}'`));
});

test('Ältere Messungen werden auf das aktuelle Datenmodell ergänzt, nichts geht verloren', () => {
  const alt = { mess_id: 'S-001', sitzung_id: 'S', befall_pct: 3.5, eigenes_feld: 'bleibt' };
  const m = messungErgaenzen(alt);
  for (const s of EXPORT_SPALTEN) assert.ok(s in m, s);
  assert.equal(m.befall_pct, 3.5);
  assert.equal(m.tisch, null);
  assert.equal(m.eigenes_feld, 'bleibt');
  assert.equal(m.daten_version, DATEN_VERSION);
  assert.equal(alt.tisch, undefined, 'Original bleibt unverändert');
});

test('Testversion (Vorschau) nutzt eigene Daten', () => {
  assert.equal(istTestversion('/bonitieren_mehltau/app/'), false);
  assert.equal(istTestversion('/bonitieren_mehltau/vorschau/app/'), true);
  assert.equal(istTestversion('/test/app/index.html'), true);
  assert.equal(istTestversion(undefined), false);
});

test('Stammdaten als Excel-Zeilen hin und zurück', () => {
  const s = { saetze: ['12', '13'], sorten: ['Genovese'], behandlungen: ['unbehandelt', 'Mittel A', 'Mittel B'], tische: [], mitarbeiter: ['AK'] };
  const zeilen = stammdatenZeilen(s);
  assert.equal(zeilen.length, 3);
  assert.deepEqual(stammdatenAusZeilen(zeilen), s);
  const fremd = stammdatenAusZeilen([{ 'Sätze': 14, Sorte: 'Rosie', 'Kürzel': 'BM' }, { Sorte: 'Rosie', Tisch: 'T3' }]);
  assert.deepEqual(fremd, { saetze: ['14'], sorten: ['Rosie'], behandlungen: [], tische: ['T3'], mitarbeiter: ['BM'] });
  assert.deepEqual(stammdatenMischen(s, fremd).sorten, ['Genovese', 'Rosie']);
  assert.equal(kurzDatum('2026-10-05'), '05.10.');
});
