import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vorverarbeiten, klassifizieren } from '../kern/analyse.js';
import { histogrammErstellen, auszaehlen, schwellenImRaster } from '../kern/histogramm.js';
import { szene, einstellungenFuer, KAMERAS } from './hilfen.mjs';
import { zufall } from '../werkzeuge/synthetik.js';

test('Histogramm-Auszählung = exakte Klassifizierung (200 zufällige Regler-Stellungen)', () => {
  const sz = szene('hist', { seed: 31, kamera: KAMERAS.warm, gelb: 0.18, braun: 0.06 });
  const einst = einstellungenFuer(sz);
  const vv = vorverarbeiten(sz.bild, einst);
  const hist = histogrammErstellen(vv);
  const rnd = zufall(99);
  const ganz = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  for (let i = 0; i < 200; i++) {
    const h_min = ganz(10, 40); const h_max = ganz(120, 180);
    const braun_gelb = ganz(h_min, 70); const gelb_gruen = ganz(braun_gelb, 100);
    const s = { h_min, h_max, braun_gelb, gelb_gruen, s_min: 10 + 2 * ganz(0, 20), v_min: ganz(10, 35) };
    assert.ok(schwellenImRaster(s));
    assert.deepEqual(auszaehlen(hist, s), klassifizieren(vv, s, { mitKarte: false }).anzahl, JSON.stringify(s));
  }
});

test('Schwellen außerhalb des Rasters werden abgelehnt', () => {
  const sz = szene('hist', { seed: 31, kamera: KAMERAS.warm, gelb: 0.18, braun: 0.06 });
  const hist = histogrammErstellen(vorverarbeiten(sz.bild, einstellungenFuer(sz)));
  const basis = { h_min: 15, h_max: 170, braun_gelb: 45, gelb_gruen: 80, s_min: 20, v_min: 15 };
  assert.ok(auszaehlen(hist, basis));
  assert.equal(auszaehlen(hist, { ...basis, s_min: 21 }), null);
  assert.equal(auszaehlen(hist, { ...basis, v_min: 9 }), null);
  assert.equal(auszaehlen(hist, { ...basis, h_max: 200 }), null);
});
