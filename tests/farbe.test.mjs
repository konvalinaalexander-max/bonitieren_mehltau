import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  srgbZuLinear, linearZuSrgb, linearZu8bit, LIN_AUS_8BIT, labZuXyzD50, xyzD50ZuLab,
  labZuSrgb8, srgb8ZuLab, rgbZuHsv, deltaE2000,
} from '../kern/farbe.js';

const nah = (a, b, tol, text) => assert.ok(Math.abs(a - b) <= tol, `${text ?? ''} ${a} ≠ ${b} (±${tol})`);

test('sRGB hin und zurück', () => {
  for (let i = 0; i <= 255; i++) {
    assert.equal(linearZu8bit(LIN_AUS_8BIT[i]), i);
    nah(linearZuSrgb(srgbZuLinear(i / 255)), i / 255, 1e-9);
  }
  assert.equal(linearZu8bit(-0.2), 0);
  assert.equal(linearZu8bit(1.7), 255);
});

test('Lab <-> XYZ (D50) hin und zurück', () => {
  for (const lab of [[50, 20, -30], [95.19, -1.03, 2.93], [20.64, 0.07, -0.46], [5, 2, -1]]) {
    const zurueck = xyzD50ZuLab(labZuXyzD50(lab));
    lab.forEach((w, i) => nah(zurueck[i], w, 1e-6));
  }
});

test('Weiß- und Grauwerte der Farbkarte liegen im erwarteten sRGB-Bereich', () => {
  // Feld 19 ist leicht gelblich (b* = 2,93): etwa (241, 242, 235)
  assert.deepEqual(labZuSrgb8([95.19, -1.03, 2.93]), [241, 242, 235]);
  assert.deepEqual(labZuSrgb8([20.64, 0.07, -0.46]), [49, 50, 50]);
  const lab = srgb8ZuLab(128, 128, 128);
  nah(lab[1], 0, 0.3); nah(lab[2], 0, 0.3);
});

test('HSV: Grundfarben und Basilikumgrün', () => {
  assert.deepEqual(rgbZuHsv(255, 0, 0), { h: 0, s: 1, v: 1 });
  nah(rgbZuHsv(0, 255, 0).h, 120, 1e-9);
  nah(rgbZuHsv(255, 255, 0).h, 60, 1e-9);
  assert.ok(Number.isNaN(rgbZuHsv(90, 90, 90).h));
  const basilikum = rgbZuHsv(91, 154, 60); // Beispiel aus Leitfaden Tabelle 7.3
  nah(basilikum.h, 100.2, 0.1); nah(basilikum.s, 0.61, 0.01); nah(basilikum.v, 0.60, 0.01);
});

test('ΔE2000: Prüfpaare aus Sharma, Wu, Dalal (2005)', () => {
  nah(deltaE2000([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 1e-4);
  nah(deltaE2000([50, 0, 0], [50, -1, 2]), 2.3669, 1e-4);
  nah(deltaE2000([60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387]), 1.2644, 1e-4);
  nah(deltaE2000([50, 2.5, 0], [73, 25, -18]), 27.1492, 1e-4);
  assert.equal(deltaE2000([40, 10, 10], [40, 10, 10]), 0);
});
