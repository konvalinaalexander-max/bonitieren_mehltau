import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viereckAbbildung, farbkarteAuswerten, SOLL_LINEAR, COLORCHECKER_2014 } from '../kern/farbkarte.js';
import { szene, KAMERAS, nah } from './hilfen.mjs';

test('Sollwerte: 24 Felder, Graureihe wird dunkler', () => {
  assert.equal(COLORCHECKER_2014.length, 24);
  assert.equal(SOLL_LINEAR.length, 24);
  for (let i = 19; i < 24; i++) assert.ok(SOLL_LINEAR[i][1] < SOLL_LINEAR[i - 1][1]);
});

test('Viereck-Abbildung trifft die Ecken (auch perspektivisch verzerrt)', () => {
  const ecken = [[10, 20], [110, 25], [120, 90], [5, 80]];
  const abb = viereckAbbildung(ecken);
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
    const [x, y] = abb(u, v);
    nah(assert, x, ecken[i][0], 1e-9); nah(assert, y, ecken[i][1], 1e-9);
  });
});

for (const [name, kamera] of Object.entries(KAMERAS)) {
  test(`Farbkarte bei Kamera „${name}“: kleine Restabweichung`, () => {
    const sz = szene(`karte-${name}`, { seed: 3, kamera, gelb: 0.1, braun: 0.03 });
    const { width: W, height: H } = sz.bild;
    const ecken = sz.einstellungen.farbkarte.ecken.map(([x, y]) => [x * W, y * H]);
    const k = farbkarteAuswerten(sz.bild, ecken);
    assert.ok(k, 'Farbkarte ausgewertet');
    assert.ok(k.deltaE_mittel < 1.5, `ΔE Mittel ${k.deltaE_mittel}`);
    assert.ok(k.deltaE_max < 4, `ΔE Max ${k.deltaE_max}`);
    assert.equal(k.reihenfolgeKorrigiert, false);
  });
}

test('Falsch angeklickte Eckreihenfolge wird bei der Einrichtung erkannt', () => {
  const sz = szene('karte-warm', { seed: 3, kamera: KAMERAS.warm, gelb: 0.1, braun: 0.03 });
  const { width: W, height: H } = sz.bild;
  const richtig = sz.einstellungen.farbkarte.ecken.map(([x, y]) => [x * W, y * H]);
  const gedreht = [richtig[2], richtig[3], richtig[0], richtig[1]]; // 180° gedreht angeklickt
  const ohneSuche = farbkarteAuswerten(sz.bild, gedreht);
  const mitSuche = farbkarteAuswerten(sz.bild, gedreht, { reihenfolgeSuchen: true });
  assert.ok(ohneSuche.deltaE_mittel > 10, `ohne Suche ΔE ${ohneSuche.deltaE_mittel}`);
  assert.ok(mitSuche.deltaE_mittel < 1.5, `mit Suche ΔE ${mitSuche.deltaE_mittel}`);
  assert.equal(mitSuche.reihenfolgeKorrigiert, true);
  mitSuche.ecken.forEach((p, i) => { nah(assert, p[0], richtig[i][0], 1e-9); nah(assert, p[1], richtig[i][1], 1e-9); });
});
