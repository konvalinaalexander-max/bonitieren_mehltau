// Erzeugt tests/sollwerte.json aus den Referenzbildern.
// Nur ausführen, wenn sich die Ergebnisse ABSICHTLICH ändern sollen (neue Algorithmus-Version
// oder neue Einstellungen) – und das im Pull Request begründen.
//   node werkzeuge/sollwerte-erzeugen.mjs

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALGORITHMUS_VERSION } from '../kern/einstellungen.js';
import {
  referenzFotos, referenzEinstellungen, jpegAuswerten, REFERENZ_ORDNER, SOLLWERTE_DATEI,
} from './referenz.mjs';

const fotos = referenzFotos();
const einst = referenzEinstellungen();
if (!fotos.length) { console.error('Keine Referenzbilder in referenzbilder/ gefunden.'); process.exit(1); }
if (!einst) { console.error('referenzbilder/einstellungen.json fehlt (aus der Werkstatt speichern).'); process.exit(1); }

const bilder = {};
for (const name of fotos) {
  bilder[name] = jpegAuswerten(join(REFERENZ_ORDNER, name), einst);
  console.log(name, JSON.stringify(bilder[name]));
}
writeFileSync(SOLLWERTE_DATEI, `${JSON.stringify({ algorithmus_version: ALGORITHMUS_VERSION, erzeugt: new Date().toISOString(), bilder }, null, 2)}\n`);
console.log(`${fotos.length} Sollwerte geschrieben nach ${SOLLWERTE_DATEI}`);
