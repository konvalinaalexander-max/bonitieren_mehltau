import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from '../bibliotheken/jszip.mjs';
import { sitzungsZip, sitzungsExcel, kontrollbildName, stammdatenExcel, stammdatenLesen } from '../app/export.js';
import { messungErgaenzen, EXPORT_SPALTEN } from '../app/logik.js';
import { arbeitsmappeLesen, blattFinden } from '../kern/tabellen.js';
import { standardEinstellungen } from '../kern/einstellungen.js';

const sitzung = { sitzung_id: '2027-02-10_Satz12', datum: '2027-02-10', art: 'normal', mitarbeiter: 'AK', satz: '12' };
const messungen = [1, 2, 3].map((i) => messungErgaenzen({
  mess_id: `2027-02-10_Satz12-00${i}`, sitzung_id: sitzung.sitzung_id, topf_id: `12-00${i}`, satz: '12',
  foto_datei: `BOX_2027021${i}_101500.jpg`, foto_key: `f${i}`, kontroll_key: i === 3 ? null : `k${i}`,
  befall_pct: i * 1.5, gruen_pct: 100 - i * 1.5, note_app: i - 1, flaeche_px: 1000 * i, qualitaet: 'ok',
}));
const bilder = new Map([
  ['f1', { blob: new Uint8Array([0xff, 0xd8, 1]) }], ['f2', { blob: new Uint8Array([0xff, 0xd8, 2]) }], ['f3', { blob: new Uint8Array([0xff, 0xd8, 3]) }],
  ['k1', { blob: new Uint8Array([9]) }], ['k2', { blob: new Uint8Array([9, 9]) }],
]);

test('Export wieder einlesen: jede Zeile hat ihr Foto, Zahlen bleiben Zahlen', async () => {
  const einst = { ...standardEinstellungen(), kennung: 'W3.H1' };
  const bytes = await sitzungsZip(sitzung, messungen, einst, { bildHolen: (k) => bilder.get(k), ausgabe: 'uint8array' });
  const zip = await JSZip.loadAsync(bytes);
  const namen = Object.keys(zip.files);
  assert.ok(namen.includes('2027-02-10_Satz12.xlsx'));
  assert.ok(namen.includes('einstellungen.json'));
  const mappe = arbeitsmappeLesen(await zip.file('2027-02-10_Satz12.xlsx').async('uint8array'));
  const zeilen = blattFinden(mappe, 'Messungen');
  assert.equal(zeilen.length, 3);
  assert.deepEqual(Object.keys(zeilen[0]), EXPORT_SPALTEN);
  for (const z of zeilen) {
    const foto = zip.file(`fotos/${z.foto_datei}`);
    assert.ok(foto, `Foto fehlt: ${z.foto_datei}`);
    assert.equal(typeof z.befall_pct, 'number');
    assert.equal(typeof z.flaeche_px, 'number');
  }
  // Originalfotos Byte für Byte unverändert
  assert.deepEqual([...(await zip.file(`fotos/${messungen[1].foto_datei}`).async('uint8array'))], [0xff, 0xd8, 2]);
  assert.ok(zip.file(`kontrollbilder/${kontrollbildName(messungen[0].foto_datei)}`));
  assert.equal(zip.file(`kontrollbilder/${kontrollbildName(messungen[2].foto_datei)}`), null);
  const info = Object.fromEntries(blattFinden(mappe, 'Sitzung').map((z) => [z.Feld, z.Wert]));
  assert.equal(info.algorithmus_version, 'A-1.0/W3.H1');
  assert.equal(info.einstellungen, 'W3.H1');
  assert.ok(String(info.notenskala).startsWith('0: unter 2 %'));
});

test('Excel ohne Kontrollbilder und Stammdaten-Excel', async () => {
  const bytes = await sitzungsZip(sitzung, messungen, null, { bildHolen: (k) => bilder.get(k), ausgabe: 'uint8array', mitKontrollbildern: false });
  const zip = await JSZip.loadAsync(bytes);
  assert.equal(Object.keys(zip.files).filter((n) => n.startsWith('kontrollbilder/') && !n.endsWith('/')).length, 0);
  assert.ok(sitzungsExcel(sitzung, [], null).length > 1000);
  const s = { saetze: ['12'], sorten: ['Genovese', 'Rosie'], behandlungen: ['unbehandelt'], tische: ['T1'], mitarbeiter: ['AK', 'BM'] };
  assert.deepEqual(stammdatenLesen(stammdatenExcel(s)), s);
});
