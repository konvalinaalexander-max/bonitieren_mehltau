// Gemeinsame Testhilfen: synthetische Szenen werden je Prozess nur einmal erzeugt.
import { szeneErzeugen, KAMERAS } from '../werkzeuge/synthetik.js';
import { standardEinstellungen, einstellungenErgaenzen } from '../kern/einstellungen.js';

const zwischenspeicher = new Map();

export function szene(name, optionen) {
  if (!zwischenspeicher.has(name)) zwischenspeicher.set(name, szeneErzeugen(optionen));
  return zwischenspeicher.get(name);
}

export function einstellungenFuer(sz, extra = {}) {
  return einstellungenErgaenzen({ ...standardEinstellungen(), ...sz.einstellungen, ...extra });
}

export { KAMERAS };

export const nah = (assert, a, b, tol, text = '') => assert.ok(Math.abs(a - b) <= tol, `${text} ${a} ≠ ${b} (±${tol})`);
