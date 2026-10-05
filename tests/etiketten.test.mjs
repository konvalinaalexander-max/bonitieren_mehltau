import { test } from 'node:test';
import assert from 'node:assert/strict';
import jsQR from '../bibliotheken/jsqr.mjs';
import {
  idsAusBereich, zeilenAusText, zeilenAusTabelle, doppelte, qrDaten, seitenAufteilen,
} from '../etiketten/etiketten-logik.js';

test('Nummern als Bereich', () => {
  assert.deepEqual(idsAusBereich('P', 1, 3, 3), ['P001', 'P002', 'P003']);
  assert.deepEqual(idsAusBereich('12-', 9, 11, 3), ['12-009', '12-010', '12-011']);
  assert.deepEqual(idsAusBereich('', 5, 4, 2), []);
  assert.equal(idsAusBereich('P', 1, 200, 3).length, 200);
  assert.throws(() => idsAusBereich('P', 1, 99999, 5));
});

test('Liste aus Text und Excel-Zeilen', () => {
  const t = 'topf_id;satz;sorte\n12-001;12;Genovese\n\n12-002\t12\tGenovese\n12-003';
  assert.deepEqual(zeilenAusText(t), [
    { id: '12-001', satz: '12', sorte: 'Genovese' },
    { id: '12-002', satz: '12', sorte: 'Genovese' },
    { id: '12-003', satz: '', sorte: '' },
  ]);
  assert.deepEqual(zeilenAusTabelle([{ Sorte: 'Genovese', topf_nr: 'P001', satz: 7 }, { Sorte: null, topf_nr: 'P002', satz: null }, { topf_nr: null }]), [
    { id: 'P001', satz: '7', sorte: 'Genovese' },
    { id: 'P002', satz: '', sorte: '' },
  ]);
  assert.deepEqual(zeilenAusTabelle([{ Nr: 'A1' }, { Nr: 'A2' }]).map((z) => z.id), ['A1', 'A2']);
  assert.deepEqual(doppelte(['P1', 'P2', 'P1', 'P3', 'P2']), ['P1', 'P2']);
});

function qrRaster(text, px = 6) {
  const d = qrDaten(text, 4);
  const n = d.groesse * px;
  const data = new Uint8ClampedArray(n * n * 4).fill(255);
  for (const [, x, y, w] of d.pfad.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let yy = Number(y) * px; yy < (Number(y) + 1) * px; yy++) {
      for (let xx = Number(x) * px; xx < (Number(x) + Number(w)) * px; xx++) {
        const i = (yy * n + xx) * 4; data[i] = 0; data[i + 1] = 0; data[i + 2] = 0;
      }
    }
  }
  return { data, n };
}

test('QR-Code der Topf-Karte lässt sich wieder lesen', () => {
  for (const text of ['P001', '12-001', 'Satz12-Genovese-0001', 'ä-Topf 7']) {
    const { data, n } = qrRaster(text);
    const r = jsQR(data, n, n);
    assert.ok(r, `nicht gelesen: ${text}`);
    assert.equal(r.data, text);
  }
  assert.equal(qrDaten('P001').module, 21, 'kurze IDs passen in Version 1 (21 × 21 Module)');
});

test('Aufteilung auf A4: 2 × 5 Karten, 20 mm / 11 mm Rand', () => {
  const s = seitenAufteilen(Array.from({ length: 23 }, (_, i) => ({ id: `P${i}` })));
  assert.equal(s.length, 3);
  assert.equal(s[0].length, 10);
  assert.equal(s[2].length, 3);
  assert.deepEqual([s[0][0].x, s[0][0].y], [20, 11]);
  assert.deepEqual([s[0][9].x, s[0][9].y], [105, 231]);
  assert.ok(s[0][9].y + 55 <= 297 - 11 + 1e-9);
});
