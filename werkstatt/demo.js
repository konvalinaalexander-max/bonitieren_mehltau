// Demo-Daten: Plan für synthetische Pilotfotos und simulierte Bonitur zweier Personen.
// Damit lässt sich die Werkstatt ausprobieren, bevor es echte Fotos gibt.

import { KAMERAS, zufall } from '../werkzeuge/synthetik.js';
import { noteAusBefall } from '../kern/noten.js';

const STUFEN = [[0, 0.012], [0.03, 0.09], [0.12, 0.22], [0.28, 0.45], [0.52, 0.7]];
const WIEDERHOLUNG = ['P003', 'P011', 'P019', 'P027', 'P035'];
const LICHT_TOPF = 'P023';

function zeitName(sekunden) {
  const h = 9 + Math.floor(sekunden / 3600); const m = Math.floor((sekunden % 3600) / 60); const s = sekunden % 60;
  return `BOX_20261012_${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}${String(s).padStart(2, '0')}.jpg`;
}

/** Liste der zu erzeugenden Fotos (Parameter für szeneErzeugen) mit Rolle und Dateiname. */
export function demoPlan(anzahlToepfe = 40) {
  const rnd = zufall(2026);
  const fotos = [];
  let t = 0;
  const neu = (eintrag) => { t += 47 + Math.floor(rnd() * 40); fotos.push({ ...eintrag, name: zeitName(t) }); };
  for (let i = 0; i < anzahlToepfe; i++) {
    const topf = `P${String(i + 1).padStart(3, '0')}`;
    const [a, b] = STUFEN[i % STUFEN.length];
    const befall = rnd.zwischen(a, b);
    const kamera = i === anzahlToepfe - 1 ? { ...KAMERAS.dunkel, gain: 0.2 } : KAMERAS.warm; // letzter Topf: LED aus
    const szene = { seed: 1000 + i, gelb: befall * 0.78, braun: befall * 0.22, kamera, etikett: topf, drehung: rnd() * 6.28, blattAnzahl: 34 + Math.floor(rnd() * 12) };
    neu({ rolle: 'bonitur', topf, szene });
    if (WIEDERHOLUNG.includes(topf)) {
      // gleicher Topf, jedes Mal neu eingesetzt: etwas gedreht und verschoben
      for (let d = 1; d <= 5; d++) {
        neu({
          rolle: 'wiederholung', topf, durchgang: d,
          szene: { ...szene, drehung: szene.drehung + rnd.zwischen(-0.4, 0.4), verschiebung: [rnd.zwischen(-0.005, 0.005), rnd.zwischen(-0.005, 0.005)], kamera: { ...KAMERAS.warm } },
        });
      }
    }
  }
  const basis = fotos.find((f) => f.topf === LICHT_TOPF && f.rolle === 'bonitur').szene;
  const lichter = [['morgens', 'an', KAMERAS.kalt], ['morgens', 'aus', { ...KAMERAS.kalt, gain: 0.82 }], ['mittags', 'an', KAMERAS.neutral], ['mittags', 'aus', { ...KAMERAS.neutral, gain: 0.93 }], ['abends', 'an', KAMERAS.warm], ['abends', 'aus', { ...KAMERAS.warm, gain: 0.86 }]];
  for (const [zeitpunkt, hallenlicht, kamera] of lichter) {
    neu({ rolle: 'lichttest', topf: LICHT_TOPF, zeitpunkt, hallenlicht, szene: { ...basis, kamera: { ...kamera, rauschen: 1.5, unschaerfe: 1 } } });
  }
  return fotos;
}

/**
 * Baut aus den erzeugten Fotos (mit Wahrheit) die Bonitur-Tabellen, wie zwei Personen sie
 * ausgefüllt hätten: meist richtige Note, manchmal eine Stufe daneben; Prozent eher überschätzt.
 */
export function demoBonitur(fotos, skala) {
  const rnd = zufall(77);
  const fehler = (note) => {
    const r = rnd();
    let d = 0;
    if (r > 0.76) d = r > 0.97 ? 2 : 1;
    if (rnd() < 0.5) d = -d;
    return Math.min(skala.noten[skala.noten.length - 1], Math.max(skala.noten[0], note + d));
  };
  const runde5 = (x) => Math.max(0, Math.min(100, Math.round(x / 5) * 5));
  const bonitur = []; const wiederholung = []; const lichttest = [];
  for (const f of fotos) {
    if (f.rolle === 'bonitur') {
      const wahr = f.wahrheit.befall_pct;
      const note = noteAusBefall(wahr, skala);
      const schaetz = () => runde5(wahr * (wahr < 10 ? 1.6 : 1.15) * Math.exp(0.25 * rnd.normal()));
      bonitur.push({
        topf_nr: f.topf, datum: '12.10.2026', sorte: 'Genovese', satz: 12, behandlung: f.topf <= 'P020' ? 'unbehandelt' : 'Mittel X',
        note_A: fehler(note), note_B: fehler(note), prozent_A: schaetz(), prozent_B: schaetz(),
        sporen_unten: wahr > 5 ? (rnd() < 0.92 ? 'ja' : 'nein') : (wahr < 1.5 ? (rnd() < 0.12 ? 'ja' : 'nein') : (rnd() < 0.5 ? 'ja' : 'nein')),
        foto_datei: f.name, bemerkung: f.szene.kamera.gain < 0.5 ? 'LED war aus?' : null,
      });
    } else if (f.rolle === 'wiederholung') {
      wiederholung.push({ topf_nr: f.topf, durchgang: f.durchgang, foto_datei: f.name, bemerkung: null });
    } else {
      lichttest.push({ topf_nr: f.topf, zeitpunkt: f.zeitpunkt, hallenlicht: f.hallenlicht, foto_datei: f.name, bemerkung: null });
    }
  }
  return { bonitur, wiederholung, lichttest };
}

export const DEMO_SPALTEN = {
  Bonitur: ['topf_nr', 'datum', 'sorte', 'satz', 'behandlung', 'note_A', 'note_B', 'prozent_A', 'prozent_B', 'sporen_unten', 'foto_datei', 'bemerkung'],
  Wiederholung: ['topf_nr', 'durchgang', 'foto_datei', 'bemerkung'],
  Lichttest: ['topf_nr', 'zeitpunkt', 'hallenlicht', 'foto_datei', 'bemerkung'],
};
