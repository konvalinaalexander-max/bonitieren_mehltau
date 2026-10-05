import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verkleinern, ausschnitt } from '../kern/bild.js';
import { qrLesen } from '../kern/qr.js';
import { exifLesen, zeitAusDateiname, nachExifDrehen } from '../kern/exif.js';
import { standardEinstellungen, einstellungenPruefen, einstellungenErgaenzen, naechsteKennung, versionsText } from '../kern/einstellungen.js';
import { szeneErzeugen, KAMERAS } from '../werkzeuge/synthetik.js';

function einfarbig(w, h, [r, g, b]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}

test('Verkleinern: Maße, einfarbige Fläche bleibt gleich, Mittelwert bleibt erhalten', () => {
  const k = verkleinern(einfarbig(3264, 2448, [91, 154, 60]), 1600);
  assert.equal(k.width, 1600); assert.equal(k.height, 1200);
  for (let i = 0; i < k.width * k.height; i += 9973) assert.deepEqual([...k.data.slice(i * 4, i * 4 + 3)], [91, 154, 60]);
  // Schachbrett 0/200 -> Mittelwert 100
  const sb = einfarbig(400, 300, [0, 0, 0]);
  for (let y = 0; y < 300; y++) for (let x = 0; x < 400; x++) if ((x + y) % 2) sb.data.fill(200, (y * 400 + x) * 4, (y * 400 + x) * 4 + 3);
  const kl = verkleinern(sb, 100);
  for (let i = 0; i < kl.width * kl.height; i++) assert.ok(Math.abs(kl.data[i * 4] - 100) <= 1);
  assert.equal(verkleinern(sb, 1600), sb, 'kleine Bilder bleiben unverändert');
});

test('Ausschnitt wird auf das Bild begrenzt', () => {
  const a = ausschnitt(einfarbig(10, 10, [1, 2, 3]), -5, 8, 20, 20);
  assert.equal(a.width, 10); assert.equal(a.height, 2); assert.equal(a.x0, 0); assert.equal(a.y0, 8);
});

test('QR-Code der Topf-Karte wird im Foto gelesen (volle Auflösung)', () => {
  const sz = szeneErzeugen({ seed: 13, breite: 3200, hoehe: 2400, kamera: KAMERAS.warm, etikett: 'P017' });
  const r = qrLesen(sz.bild, sz.einstellungen.etikettbereich);
  assert.ok(r, 'QR gelesen');
  assert.equal(r.text, 'P017');
  assert.equal(r.quelle, 'etikettbereich');
  const ohneBereich = qrLesen(sz.bild, null);
  assert.equal(ohneBereich?.text, 'P017');
});

test('EXIF: Ausrichtung, Aufnahmezeit, Modell aus einer minimalen JPEG-Datei', () => {
  // Minimale TIFF-Struktur (little endian) mit Orientation=6, Model="Pixel 7", DateTime
  const teile = [];
  const tiff = new Uint8Array(120);
  const dv = new DataView(tiff.buffer);
  tiff.set([0x49, 0x49, 0x2a, 0x00]); dv.setUint32(4, 8, true);
  dv.setUint16(8, 3, true);
  const eintrag = (i, tag, typ, anzahl, wert) => { const o = 10 + i * 12; dv.setUint16(o, tag, true); dv.setUint16(o + 2, typ, true); dv.setUint32(o + 4, anzahl, true); dv.setUint32(o + 8, wert, true); };
  eintrag(0, 0x0112, 3, 1, 6);
  eintrag(1, 0x0110, 2, 8, 50);
  eintrag(2, 0x0132, 2, 20, 60);
  tiff.set([...'Pixel 7\0'].map((c) => c.charCodeAt(0)), 50);
  tiff.set([...'2026:10:12 10:15:32\0'].map((c) => c.charCodeAt(0)), 60);
  const app1 = new Uint8Array(2 + 2 + 6 + tiff.length);
  app1.set([0xff, 0xe1]); app1[2] = ((app1.length - 2) >> 8) & 255; app1[3] = (app1.length - 2) & 255;
  app1.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); app1.set(tiff, 10);
  teile.push(new Uint8Array([0xff, 0xd8]), app1, new Uint8Array([0xff, 0xd9]));
  const jpeg = new Uint8Array(teile.reduce((a, t) => a + t.length, 0));
  let o = 0; for (const t of teile) { jpeg.set(t, o); o += t.length; }
  const e = exifLesen(jpeg);
  assert.equal(e.orientierung, 6);
  assert.equal(e.modell, 'Pixel 7');
  assert.equal(e.aufnahme.getFullYear(), 2026);
  assert.equal(e.aufnahme.getMinutes(), 15);
  assert.equal(exifLesen(new Uint8Array([1, 2, 3])), null);
});

test('Aufnahmezeit aus Open-Camera-Dateiname', () => {
  const d = zeitAusDateiname('BOX_20261012_101532.jpg');
  assert.equal(d.getFullYear(), 2026); assert.equal(d.getMonth(), 9); assert.equal(d.getDate(), 12);
  assert.equal(d.getHours(), 10); assert.equal(d.getSeconds(), 32);
  assert.equal(zeitAusDateiname('foto.jpg'), null);
});

test('Drehen nach EXIF-Ausrichtung 6 (90° im Uhrzeigersinn)', () => {
  const b = einfarbig(3, 2, [0, 0, 0]);
  b.data[0] = 255; // Pixel oben links rot
  const d = nachExifDrehen(b, 6);
  assert.equal(d.width, 2); assert.equal(d.height, 3);
  assert.equal(d.data[(0 * 2 + 1) * 4], 255, 'oben links landet oben rechts');
});

test('Einstellungen: Standard ist gültig, Fehler werden erkannt, Ergänzen füllt Lücken', () => {
  const e = standardEinstellungen();
  assert.deepEqual(einstellungenPruefen(e), []);
  assert.ok(einstellungenPruefen({ ...e, schwellen: { ...e.schwellen, s_min: 21 } }).length > 0);
  assert.ok(einstellungenPruefen({ ...e, schwellen: { ...e.schwellen, braun_gelb: 90 } }).length > 0);
  assert.ok(einstellungenPruefen({ ...e, notenskala: { noten: [0, 1, 2], grenzen: [5] } }).length > 0);
  assert.ok(einstellungenPruefen({ ...e, farbkarte: { ecken: [[0, 0]] } }).length > 0);
  const ergaenzt = einstellungenErgaenzen({ schwellen: { s_min: 24 } });
  assert.equal(ergaenzt.schwellen.s_min, 24);
  assert.equal(ergaenzt.schwellen.h_max, 170);
  assert.equal(ergaenzt.analyse.lange_kante, 1600);
});

test('Einstellungs-Kennung: Werkstatt und Handy bekommen nie dieselbe Nummer', () => {
  assert.equal(naechsteKennung('W0', 'W'), 'W1');
  assert.equal(naechsteKennung('W3', 'W'), 'W4');
  assert.equal(naechsteKennung('W3', 'H'), 'W3.H1');
  assert.equal(naechsteKennung('W3.H1', 'H'), 'W3.H2');
  assert.equal(naechsteKennung('W3.H2', 'W'), 'W4');
  assert.equal(naechsteKennung(undefined, 'W'), 'W1');
  assert.match(versionsText({ kennung: 'W3.H1' }), /^A-\d+\.\d+\/W3\.H1$/);
});
