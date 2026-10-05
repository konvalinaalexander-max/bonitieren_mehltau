import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analysieren, vorverarbeiten, klassifizieren, hsvGanz, KEIN_FARBTON } from '../kern/analyse.js';
import { verkleinern } from '../kern/bild.js';
import { szene, einstellungenFuer, KAMERAS, nah } from './hilfen.mjs';
import { szeneErzeugen } from '../werkzeuge/synthetik.js';

test('Ohne Kameraverfälschung trifft die Analyse die Wahrheit genau', () => {
  const sz = szene('neutral', { seed: 11, kamera: KAMERAS.neutral, gelb: 0.15, braun: 0.05 });
  const r = analysieren(sz.bild, einstellungenFuer(sz));
  const w = sz.wahrheit;
  assert.equal(r.flaeche_px, w.flaeche);
  nah(assert, r.gelb_pct, w.gelb_pct, 0.06, 'gelb');
  nah(assert, r.braun_pct, w.braun_pct, 0.06, 'braun');
  nah(assert, r.befall_pct, w.befall_pct, 0.06, 'befall');
  assert.equal(r.qualitaet, 'ok');
});

for (const name of ['warm', 'kalt', 'dunkel']) {
  test(`Mit Farbstich „${name}“, Unschärfe und Rauschen: Befall auf ±2 Prozentpunkte`, () => {
    const sz = szene(`ana-${name}`, { seed: 21, kamera: KAMERAS[name], gelb: 0.2, braun: 0.06 });
    const r = analysieren(sz.bild, einstellungenFuer(sz));
    const w = sz.wahrheit;
    nah(assert, r.befall_pct, w.befall_pct, 2, 'befall');
    nah(assert, r.braun_pct, w.braun_pct, 1.5, 'braun');
    nah(assert, r.flaeche_px / w.flaeche, 1, 0.06, 'Fläche');
    assert.equal(r.qualitaet, 'ok', r.qualitaet);
  });
}

test('Ohne Farbkorrektur weicht das Ergebnis bei Farbstich deutlich stärker ab', () => {
  const sz = szene('ana-warm', { seed: 21, kamera: KAMERAS.warm, gelb: 0.2, braun: 0.06 });
  const mit = analysieren(sz.bild, einstellungenFuer(sz));
  const ohne = analysieren(sz.bild, einstellungenFuer(sz, { farbkarte: { ecken: null } }));
  const w = sz.wahrheit.befall_pct;
  assert.ok(Math.abs(ohne.befall_pct - w) > Math.abs(mit.befall_pct - w), `ohne ${ohne.befall_pct}, mit ${mit.befall_pct}, wahr ${w}`);
  assert.match(ohne.qualitaet, /Farbkarte nicht eingestellt/);
});

test('Sichtbare Erde ohne Abdeckscheibe zählt als braun (darum die Scheibe)', () => {
  const opt = { seed: 5, kamera: KAMERAS.neutral, gelb: 0, braun: 0, blattAnzahl: 10 };
  const mitScheibe = szeneErzeugen({ ...opt, abdeckscheibe: true });
  const mitErde = szeneErzeugen({ ...opt, abdeckscheibe: false, erdeSichtbar: true });
  const a = analysieren(mitScheibe.bild, einstellungenFuer(mitScheibe));
  const b = analysieren(mitErde.bild, einstellungenFuer(mitErde));
  assert.ok(a.braun_pct < 0.5, `mit Scheibe braun ${a.braun_pct}`);
  assert.ok(b.braun_pct > 5, `mit Erde braun ${b.braun_pct}`);
});

test('Leere Box: Warnung „Keine Pflanze gefunden“', () => {
  const sz = szeneErzeugen({ seed: 2, kamera: KAMERAS.neutral, blattAnzahl: 0 });
  const r = analysieren(sz.bild, einstellungenFuer(sz));
  assert.match(r.qualitaet, /Keine Pflanze gefunden/);
});

test('Verdeckte Farbkarte: Warnung', () => {
  const sz = szeneErzeugen({ seed: 4, kamera: KAMERAS.warm });
  const { width: W, height: H, data } = sz.bild;
  const [[x0, y0], , [x2, y2]] = sz.einstellungen.farbkarte.ecken;
  // Hälfte der Karte mit „Blättern“ überdecken
  for (let y = Math.floor(y0 * H); y < y2 * H; y++) {
    for (let x = Math.floor(x0 * W); x < ((x0 + x2) / 2) * W; x++) {
      const q = (y * W + x) * 4; data[q] = 70; data[q + 1] = 140; data[q + 2] = 50;
    }
  }
  const r = analysieren(sz.bild, einstellungenFuer(sz));
  assert.match(r.qualitaet, /Farbkarte (prüfen|nicht gefunden)/);
});

test('Ganzzahliges HSV stimmt mit den Grenzen der Spezifikation überein', () => {
  assert.deepEqual(hsvGanz(255, 255, 0), [60, 100, 100]);
  assert.equal(hsvGanz(80, 80, 80)[0], KEIN_FARBTON);
  // V >= 15 % gilt ab Wert 39 (38/255 = 14,9 %)
  assert.equal(hsvGanz(38, 20, 10)[2], 14);
  assert.equal(hsvGanz(39, 20, 10)[2], 15);
});

test('Fotos in voller Auflösung werden auf 1600 px verkleinert', () => {
  const gross = szeneErzeugen({ seed: 9, breite: 3200, hoehe: 2400, kamera: KAMERAS.warm, gelb: 0.12, braun: 0.04 });
  const r = analysieren(gross.bild, einstellungenFuer(gross));
  assert.deepEqual(r.groesse, { breite: 1600, hoehe: 1200 });
  nah(assert, r.befall_pct, gross.wahrheit.befall_pct, 2, 'befall');
  nah(assert, r.flaeche_px * 4 / gross.wahrheit.flaeche, 1, 0.06, 'Fläche (Faktor 4 durch Verkleinern)');
});

test('Klassifizieren ohne Klassenkarte liefert dieselben Zahlen', () => {
  const sz = szene('neutral', { seed: 11, kamera: KAMERAS.neutral, gelb: 0.15, braun: 0.05 });
  const vv = vorverarbeiten(verkleinern(sz.bild, 1600), einstellungenFuer(sz));
  const s = einstellungenFuer(sz).schwellen;
  assert.deepEqual(klassifizieren(vv, s, { mitKarte: false }).anzahl, klassifizieren(vv, s).anzahl);
});
