import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  spaltenname, jaNein, zahl, dateiSchluessel, boniturLesen, wiederholungLesen, lichttestLesen,
  zuordnen, kennzahlenBerechnen, entscheidung, notengrenzenVorschlagen, haelftenBilden, karteErkannt,
} from '../werkstatt/auswertung.js';
import { standardEinstellungen } from '../kern/einstellungen.js';

const skala = standardEinstellungen().notenskala;

test('Spaltennamen, Ja/Nein, Zahlen, Dateinamen', () => {
  assert.equal(spaltenname(' note_A '), 'note_a');
  assert.equal(spaltenname('Foto Datei'), 'foto_datei');
  assert.equal(jaNein('Ja'), true); assert.equal(jaNein('nein'), false); assert.equal(jaNein('x'), true); assert.equal(jaNein(''), null);
  assert.equal(zahl('12,5 %'), 12.5); assert.equal(zahl(''), null); assert.equal(zahl('abc'), null);
  assert.equal(dateiSchluessel('fotos/2026-10-12/BOX_1.JPG'), 'box_1.jpg');
  assert.equal(dateiSchluessel('BOX_2'), 'box_2.jpg');
  assert.equal(dateiSchluessel('a.jpeg'), 'a.jpg');
});

test('Bonitur-Blatt: Fehler für ungültige Noten und doppelte Töpfe', () => {
  const r = boniturLesen([
    { topf_nr: 'P001', note_A: 1, note_B: 1, foto_datei: 'a.jpg' },
    { topf_nr: 'P002', note_A: 7, note_B: 1 },
    { topf_nr: 'P001', note_A: 0, note_B: 0 },
    { topf_nr: null, note_A: null, note_B: null }, // leere Zeile wird ignoriert
  ], skala.noten);
  assert.equal(r.zeilen.length, 3);
  assert.ok(r.fehler.some((f) => f.includes('note_A = 7')));
  assert.ok(r.fehler.some((f) => f.includes('P001 kommt doppelt')));
});

test('Zuordnung über foto_datei, QR-Rückfall und Problemlisten', () => {
  const fotos = [
    { name: 'BOX_1.jpg', qr: 'P001' }, { name: 'BOX_2.jpg', qr: 'P002' }, { name: 'BOX_3.jpg', qr: 'P003' },
    { name: 'BOX_4.jpg', qr: 'P003' }, { name: 'BOX_5.jpg', qr: null }, { name: 'BOX_6.jpg', qr: 'P009' },
  ];
  const bonitur = boniturLesen([
    { topf_nr: 'P001', note_A: 0, note_B: 0, foto_datei: 'box_1' },
    { topf_nr: 'P002', note_A: 1, note_B: 1 }, // per QR
    { topf_nr: 'P007', note_A: 1, note_B: 1, foto_datei: 'BOX_99.jpg' }, // fehlt
    { topf_nr: 'P008', note_A: 1, note_B: 1 }, // kein Foto, kein QR
  ], skala.noten).zeilen;
  const wiederholung = wiederholungLesen([{ topf_nr: 'P003', durchgang: 1, foto_datei: 'BOX_3.jpg' }, { topf_nr: 'P003', durchgang: 2, foto_datei: 'BOX_4.jpg' }]);
  const lichttest = lichttestLesen([{ topf_nr: 'P003', zeitpunkt: 'morgens', hallenlicht: 'an', foto_datei: 'BOX_3.jpg' }]);
  const z = zuordnen(fotos, { bonitur, wiederholung, lichttest });
  assert.deepEqual(z.bonitur, [0, 1, null, null]);
  assert.deepEqual(z.wiederholung, [2, 3]);
  assert.deepEqual(z.lichttest, [2]);
  assert.ok(z.probleme.perQr.some((t) => t.includes('P002')));
  assert.ok(z.probleme.zeilenOhneFoto.some((t) => t.includes('BOX_99')));
  assert.ok(z.probleme.zeilenOhneFoto.some((t) => t.includes('P008')));
  assert.deepEqual(z.probleme.fotosOhneZeile, ['BOX_5.jpg', 'BOX_6.jpg']);
  assert.ok(z.probleme.doppelt.some((t) => t.includes('BOX_3.jpg')), 'BOX_3 steht in Wiederholung und Lichttest');
});

function demoDaten() {
  // 6 Töpfe wie Leitfaden Tabelle 8.1 (A und App), B gleich A
  const bonitur = boniturLesen([0, 1, 1, 2, 3, 4].map((n, i) => ({
    topf_nr: `P00${i + 1}`, note_A: n, note_B: n, sporen_unten: i === 0 ? 'ja' : (n > 0 ? 'ja' : 'nein'), foto_datei: `f${i}.jpg`,
  })), skala.noten).zeilen;
  const befall = [0.5, 12, 5, 15, 30, 20]; // ergibt App-Noten 0, 2, 1, 2, 3, 2
  const wiederholung = wiederholungLesen([1, 2, 3, 4, 5].map((d) => ({ topf_nr: 'P004', durchgang: d, foto_datei: `w${d}.jpg` })));
  const fotos = [...bonitur.map((z) => ({ name: z.foto_datei })), ...[1, 2, 3, 4, 5].map((d) => ({ name: `w${d}.jpg` }))];
  const ergebnisse = [
    ...befall.map((b) => ({ befall_pct: b, note_app: null, warnungen: [] })),
    ...[12, 13, 11, 12, 14].map((b) => ({ befall_pct: b, warnungen: [] })),
  ];
  ergebnisse.forEach((e) => { e.note_app = e.note_app ?? null; });
  return { bonitur, wiederholung, fotos, ergebnisse, befall };
}

test('Kennzahlen: Kappa wie Tabelle 8.1, Wiederholbarkeit, unsichtbarer Befall', () => {
  const { bonitur, wiederholung, fotos, ergebnisse } = demoDaten();
  // App-Noten aus Befall
  ergebnisse.forEach((e) => { e.note_app = e.befall_pct < 2 ? 0 : e.befall_pct <= 10 ? 1 : e.befall_pct <= 25 ? 2 : e.befall_pct <= 50 ? 3 : 4; });
  const z = zuordnen(fotos, { bonitur, wiederholung, lichttest: [] });
  const kz = kennzahlenBerechnen({ bonitur, wiederholung, lichttest: [] }, z, ergebnisse, skala);
  assert.equal(kz.n, 6);
  assert.equal(Math.round(kz.kappaAppA * 100) / 100, 0.69);
  assert.equal(kz.kappaAB, 1);
  assert.equal(kz.wiederholbarkeit.length, 1);
  assert.equal(kz.wiederholbarkeit[0].streuung, 1.14);
  assert.equal(kz.karteAnteil, 1);
  assert.equal(kz.unsichtbar.anzahl, 1, 'Topf P001: Sporen unten, Befall 0,5 %');
  assert.ok(kz.spearman > 0.7);
});

test('Entscheidung nach Tabelle 8.2', () => {
  const basis = { kappaAppMittel: 0.7, kappaAB: 0.75, streuungMax: 1.5, karteAnteil: 0.98, unsichtbar: { anzahl: 0, von: 10, anteil: 0 } };
  assert.equal(entscheidung(basis).ergebnis, 'GO');
  assert.equal(entscheidung({ ...basis, kappaAB: 0.9 }).ergebnis, 'NACHBESSERN');
  assert.equal(entscheidung({ ...basis, karteAnteil: 0.9 }).ergebnis, 'NACHBESSERN');
  assert.equal(entscheidung({ ...basis, kappaAppMittel: 0.3 }).ergebnis, 'NACHBESSERN', 'erster Durchgang');
  assert.equal(entscheidung({ ...basis, kappaAppMittel: 0.3 }, { nachgebessert: true }).ergebnis, 'NO-GO');
  assert.equal(entscheidung({ ...basis, unsichtbar: { anzahl: 4, von: 10, anteil: 0.4 } }, { grenzeUnsichtbar: 0.2 }).ergebnis, 'NO-GO');
});

test('Notengrenzen-Vorschlag verbessert das Kappa', () => {
  // Menschen geben bei 6 % schon Note 2: Vorschlag soll die Grenze 1/2 senken
  const befall = [0, 1, 3, 4, 6, 7, 8, 15, 20, 30, 40, 60, 70];
  const noten = [0, 0, 1, 1, 2, 2, 2, 2, 2, 3, 3, 4, 4];
  const vorher = notengrenzenVorschlagen(befall, noten, noten, { noten: [0, 1, 2, 3, 4], grenzen: [2, 10, 25, 50] });
  assert.ok(vorher.grenzen[1] < 6, `Grenze 1/2: ${vorher.grenzen[1]}`);
  assert.ok(vorher.kappa > 0.95);
});

test('Übungs- und Prüfhälfte: fest, getrennt, je Topf', () => {
  const toepfe = Array.from({ length: 101 }, (_, i) => `K${String(i).padStart(3, '0')}`);
  const a = haelftenBilden(toepfe); const b = haelftenBilden([...toepfe].reverse());
  assert.equal(a.uebung.size, 51); assert.equal(a.pruefung.size, 50);
  assert.deepEqual([...a.uebung].sort(), [...b.uebung].sort(), 'Reihenfolge der Eingabe egal');
  for (const t of a.uebung) assert.ok(!a.pruefung.has(t));
});

test('Farbkarte erkannt = keine Farbkarten-Warnung', () => {
  assert.equal(karteErkannt({ warnungen: [] }), true);
  assert.equal(karteErkannt({ warnungen: ['Bild zu hell'] }), true);
  assert.equal(karteErkannt({ warnungen: ['Farbkarte prüfen'] }), false);
  assert.equal(karteErkannt(null), false);
});
