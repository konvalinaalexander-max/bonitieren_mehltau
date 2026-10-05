// Prüft echte Referenzbilder gegen gespeicherte Sollwerte (Regressionstest).
// Solange keine Referenzbilder und Sollwerte vorhanden sind, wird der Test übersprungen.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALGORITHMUS_VERSION } from '../kern/einstellungen.js';
import {
  referenzFotos, referenzEinstellungen, jpegAuswerten, REFERENZ_ORDNER, SOLLWERTE_DATEI, FELDER,
} from '../werkzeuge/referenz.mjs';

const fotos = referenzFotos();
const einst = referenzEinstellungen();
const soll = existsSync(SOLLWERTE_DATEI) ? JSON.parse(readFileSync(SOLLWERTE_DATEI, 'utf8')) : null;
const bereit = fotos.length > 0 && einst && soll;

test('Referenzbilder: Sollwerte passen zur Algorithmus-Version', { skip: !bereit && 'noch keine Referenzbilder/Sollwerte' }, () => {
  assert.equal(soll.algorithmus_version, ALGORITHMUS_VERSION,
    'Algorithmus-Version geändert: Sollwerte bewusst neu erzeugen (werkzeuge/sollwerte-erzeugen.mjs) und begründen.');
});

for (const name of (bereit ? fotos : [])) {
  test(`Referenzbild ${name}`, () => {
    assert.ok(soll.bilder[name], `Keine Sollwerte für ${name} – Sollwerte neu erzeugen.`);
    const ist = jpegAuswerten(join(REFERENZ_ORDNER, name), einst);
    for (const f of FELDER) assert.equal(ist[f], soll.bilder[name][f], `${name}: ${f}`);
  });
}
