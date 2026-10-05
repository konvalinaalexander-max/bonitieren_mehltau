import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gewichtetesKappa, spearman, audpc, mittelwert, standardabweichung, median, raenge, runden,
} from '../kern/statistik.js';
import { noteAusBefall, notenBeschreibung } from '../kern/noten.js';
import { standardEinstellungen } from '../kern/einstellungen.js';

const nah = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

test('Gewichtetes Kappa: Beispiel aus Leitfaden Tabelle 8.1 (0,69)', () => {
  const personA = [0, 1, 1, 2, 3, 4];
  const app = [0, 2, 1, 2, 3, 2];
  const k = gewichtetesKappa(personA, app, [0, 1, 2, 3, 4]);
  nah(k, 1 - 5 / (98 / 6), 1e-12);
  assert.equal(runden(k, 2), 0.69);
});

test('Gewichtetes Kappa: Grenzfälle', () => {
  assert.equal(gewichtetesKappa([0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3, 4]), 1);
  assert.ok(gewichtetesKappa([0, 0, 4, 4], [4, 4, 0, 0], [0, 1, 2, 3, 4]) < 0);
  assert.ok(Number.isNaN(gewichtetesKappa([], [], [0, 1])));
  // fehlende Werte werden übersprungen
  nah(gewichtetesKappa([0, 1, null, 2], [0, 1, 3, 2], [0, 1, 2, 3]), 1, 1e-12);
});

test('AUDPC: Beispiel aus Leitfaden Tabelle 11.3/11.4', () => {
  const tage = [0, 5, 12, 19];
  assert.equal(audpc(tage, [1, 4, 12, 28]), 208.5);
  assert.equal(audpc(tage, [1, 2, 5, 11]), 88);
  // Testfall aus dem Prompt für Baustein B9
  assert.equal(audpc([0, 7, 14], [2, 10, 30]), 182);
});

test('Wiederholbarkeit: Beispiel aus Kapitel 8.5 (Streuung ca. 1,1)', () => {
  const werte = [12, 13, 11, 12, 14];
  nah(mittelwert(werte), 12.4, 1e-12);
  assert.equal(runden(standardabweichung(werte), 2), 1.14);
  assert.equal(median(werte), 12);
});

test('Spearman mit Gleichständen', () => {
  assert.deepEqual(raenge([10, 20, 20, 5]), [2, 3.5, 3.5, 1]);
  nah(spearman([1, 2, 3, 4, 5], [2, 4, 6, 8, 10]), 1, 1e-12);
  nah(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1, 1e-12);
  assert.ok(Number.isNaN(spearman([1, 2], [1, 2])));
});

test('Notenskala 0–4: Grenzen wie in Leitfaden Tabelle 7.6', () => {
  const skala = standardEinstellungen().notenskala;
  const faelle = [[0, 0], [1.9, 0], [2, 1], [10, 1], [10.1, 2], [25, 2], [25.1, 3], [50, 3], [50.1, 4], [100, 4]];
  for (const [befall, note] of faelle) assert.equal(noteAusBefall(befall, skala), note, `Befall ${befall}`);
  assert.equal(noteAusBefall(NaN, skala), null);
  assert.deepEqual(notenBeschreibung(skala).map((x) => x.text), ['unter 2 %', '2 bis 10 %', 'über 10 bis 25 %', 'über 25 bis 50 %', 'über 50 %']);
});

test('Andere Skala (1–9) funktioniert ebenso', () => {
  const skala = { noten: [1, 2, 3, 4, 5, 6, 7, 8, 9], grenzen: [1, 3, 6, 10, 18, 30, 45, 65] };
  assert.equal(noteAusBefall(0.5, skala), 1);
  assert.equal(noteAusBefall(3, skala), 2);
  assert.equal(noteAusBefall(70, skala), 9);
});
