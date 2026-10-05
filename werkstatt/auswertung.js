// Auswertungslogik der Werkstatt (ohne Oberfläche, in Node testbar):
// Excel-Zeilen aufbereiten, Fotos zuordnen, Kennzahlen, Go/No-Go, Vorschlag für Notengrenzen.

import {
  gewichtetesKappa, spearman, mittelwert, standardabweichung, runden,
} from '../kern/statistik.js';
import { noteAusBefall } from '../kern/noten.js';

// ---------- Excel-Zeilen aufbereiten ----------

/** Spaltenname vereinheitlichen: klein, ohne Leerzeichen/Bindestriche. */
export function spaltenname(s) {
  return String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

const leer = (v) => v === null || v === undefined || String(v).trim() === '';

export function jaNein(v) {
  if (leer(v)) return null;
  const t = String(v).trim().toLowerCase();
  if (['ja', 'j', 'x', '1', 'true', 'wahr', 'yes', 'y'].includes(t)) return true;
  if (['nein', 'n', '0', 'false', 'falsch', 'no', '-'].includes(t)) return false;
  return null;
}

export function zahl(v) {
  if (leer(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace('%', '').replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function dateiSchluessel(name) {
  if (leer(name)) return null;
  let n = String(name).trim().split(/[\\/]/).pop().toLowerCase();
  if (!/\.(jpe?g)$/.test(n)) n += '.jpg';
  return n.replace(/\.jpeg$/, '.jpg');
}

/** Zeilen (Objekte aus der Tabelle) mit vereinheitlichten Spaltennamen. */
export function zeilenAufbereiten(roh) {
  return (roh || []).map((zeile, i) => {
    const z = { _zeile: i + 2 }; // Excel-Zeilennummer (Zeile 1 = Überschrift)
    for (const [k, v] of Object.entries(zeile)) z[spaltenname(k)] = v;
    return z;
  }).filter((z) => Object.entries(z).some(([k, v]) => k !== '_zeile' && !leer(v)));
}

/**
 * Bonitur-Blatt prüfen und in feste Felder bringen.
 * Ergebnis: { zeilen: [...], fehler: [Text], hinweise: [Text] }
 */
export function boniturLesen(roh, noten) {
  const fehler = []; const hinweise = [];
  // Vorbereitete Zeilen (nur Topfnummer, evtl. Datum/Sorte/Satz) ohne Noten, Prozent und Foto
  // gehören zu Töpfen, die nicht im Pilot waren: still überspringen.
  const genutzt = (z) => ['note_a', 'note_b', 'prozent_a', 'prozent_b', 'sporen_unten', 'foto_datei', 'bemerkung'].some((k) => !leer(z[k]));
  const alle = zeilenAufbereiten(roh);
  const unbenutzt = alle.filter((z) => !genutzt(z)).length;
  if (unbenutzt) hinweise.push(`${unbenutzt} vorbereitete Zeile${unbenutzt === 1 ? '' : 'n'} ohne Noten und Foto übersprungen.`);
  const zeilen = alle.filter(genutzt).map((z) => {
    const r = {
      excelZeile: z._zeile,
      topf_nr: leer(z.topf_nr) ? null : String(z.topf_nr).trim(),
      datum: z.datum ?? null,
      sorte: z.sorte ?? null,
      satz: z.satz ?? null,
      behandlung: z.behandlung ?? null,
      note_A: zahl(z.note_a),
      note_B: zahl(z.note_b),
      prozent_A: zahl(z.prozent_a),
      prozent_B: zahl(z.prozent_b),
      sporen_unten: jaNein(z.sporen_unten),
      foto_datei: leer(z.foto_datei) ? null : String(z.foto_datei).trim(),
      bemerkung: z.bemerkung ?? null,
    };
    if (!r.topf_nr) fehler.push(`Bonitur Zeile ${r.excelZeile}: topf_nr fehlt.`);
    for (const k of ['note_A', 'note_B']) {
      if (r[k] === null) hinweise.push(`Bonitur Zeile ${r.excelZeile}: ${k} fehlt.`);
      else if (!noten.includes(r[k])) fehler.push(`Bonitur Zeile ${r.excelZeile}: ${k} = ${r[k]} ist keine Note der Skala (${noten.join(', ')}).`);
    }
    return r;
  });
  const gesehen = new Map();
  for (const z of zeilen) {
    if (!z.topf_nr) continue;
    if (gesehen.has(z.topf_nr)) fehler.push(`Bonitur: Topf ${z.topf_nr} kommt doppelt vor (Zeilen ${gesehen.get(z.topf_nr)} und ${z.excelZeile}).`);
    else gesehen.set(z.topf_nr, z.excelZeile);
  }
  return { zeilen, fehler, hinweise };
}

export function wiederholungLesen(roh) {
  return zeilenAufbereiten(roh).map((z) => ({
    excelZeile: z._zeile,
    topf_nr: leer(z.topf_nr) ? null : String(z.topf_nr).trim(),
    durchgang: zahl(z.durchgang),
    foto_datei: leer(z.foto_datei) ? null : String(z.foto_datei).trim(),
    bemerkung: z.bemerkung ?? null,
  }));
}

export function lichttestLesen(roh) {
  return zeilenAufbereiten(roh).map((z) => ({
    excelZeile: z._zeile,
    topf_nr: leer(z.topf_nr) ? null : String(z.topf_nr).trim(),
    zeitpunkt: z.zeitpunkt ?? null,
    hallenlicht: z.hallenlicht ?? null,
    foto_datei: leer(z.foto_datei) ? null : String(z.foto_datei).trim(),
    bemerkung: z.bemerkung ?? null,
  }));
}

// ---------- Zuordnung Foto <-> Zeile ----------

/**
 * fotos: [{ name, qr }] (qr = gelesene Topf-ID oder null)
 * Ergebnis: Zuordnung je Blatt (Index ins Foto-Array), Listen mit Problemen.
 * Bonitur-Zeilen ohne foto_datei werden – falls eindeutig – über den QR-Code zugeordnet.
 */
export function zuordnen(fotos, { bonitur = [], wiederholung = [], lichttest = [] }) {
  const index = new Map();
  fotos.forEach((f, i) => {
    const k = dateiSchluessel(f.name);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(i);
  });
  const benutzt = new Map(); // fotoIndex -> [Blatt Zeile]
  const probleme = { zeilenOhneFoto: [], fotosOhneZeile: [], doppelt: [], perQr: [], hinweise: [] };
  const merken = (fi, wo) => {
    if (!benutzt.has(fi)) benutzt.set(fi, []);
    benutzt.get(fi).push(wo);
  };
  const perName = (blatt, zeilen) => zeilen.map((z) => {
    if (!z.foto_datei) return null;
    const treffer = index.get(dateiSchluessel(z.foto_datei));
    if (!treffer) { probleme.zeilenOhneFoto.push(`${blatt} Zeile ${z.excelZeile}: Foto „${z.foto_datei}“ nicht gefunden.`); return null; }
    if (treffer.length > 1) probleme.doppelt.push(`Foto „${z.foto_datei}“ gibt es ${treffer.length}-mal (verschiedene Ordner).`);
    merken(treffer[0], `${blatt} Zeile ${z.excelZeile}`);
    return treffer[0];
  });
  const wFotos = perName('Wiederholung', wiederholung);
  const lFotos = perName('Lichttest', lichttest);
  const bFotos = perName('Bonitur', bonitur);
  // QR-Rückfall für Bonitur-Zeilen ohne Dateiname
  bonitur.forEach((z, i) => {
    if (bFotos[i] !== null || z.foto_datei || !z.topf_nr) return;
    const kandidaten = fotos.map((f, fi) => fi).filter((fi) => !benutzt.has(fi) && fotos[fi].qr && fotos[fi].qr === z.topf_nr);
    if (kandidaten.length === 0) { probleme.zeilenOhneFoto.push(`Bonitur Zeile ${z.excelZeile}: kein Foto für Topf ${z.topf_nr} (foto_datei leer, QR nicht gefunden).`); return; }
    kandidaten.sort((a, b) => fotos[a].name.localeCompare(fotos[b].name));
    if (kandidaten.length > 1) probleme.hinweise.push(`Topf ${z.topf_nr}: ${kandidaten.length} Fotos mit diesem QR-Code – das erste (${fotos[kandidaten[0]].name}) wird verwendet.`);
    bFotos[i] = kandidaten[0];
    merken(kandidaten[0], `Bonitur Zeile ${z.excelZeile}`);
    probleme.perQr.push(`Topf ${z.topf_nr} → ${fotos[kandidaten[0]].name} (per QR)`);
  });
  for (const [fi, wo] of benutzt) {
    if (wo.length > 1) probleme.doppelt.push(`Foto „${fotos[fi].name}“ ist mehrfach eingetragen: ${wo.join(', ')}.`);
  }
  fotos.forEach((f, fi) => { if (!benutzt.has(fi)) probleme.fotosOhneZeile.push(f.name); });
  return { bonitur: bFotos, wiederholung: wFotos, lichttest: lFotos, probleme };
}

// ---------- Kennzahlen ----------

/** Karte gilt als erkannt, wenn keine Farbkarten-Warnung vorliegt. */
export function karteErkannt(ergebnis) {
  return Boolean(ergebnis) && !(ergebnis.warnungen || []).some((w) => w.startsWith('Farbkarte'));
}

/**
 * Kennzahlen für Pilot oder Kalibrierung.
 * daten: { bonitur, wiederholung, lichttest } (aufbereitete Zeilen)
 * zuordnung: Ergebnis von zuordnen()
 * ergebnisse: Ergebnis je Foto-Index ({ befall_pct, note_app, warnungen, ... }) oder null
 * ausgeschlossen: Set von Foto-Indizes, die nicht zählen
 */
export function kennzahlenBerechnen(daten, zuordnung, ergebnisse, skala, { ausgeschlossen = new Set(), auswahl = null } = {}) {
  const noten = skala.noten;
  const paare = [];
  daten.bonitur.forEach((z, i) => {
    if (auswahl && !auswahl.has(z.topf_nr)) return;
    const fi = zuordnung.bonitur[i];
    if (fi === null || fi === undefined || ausgeschlossen.has(fi)) return;
    const e = ergebnisse[fi];
    if (!e || !Number.isFinite(e.befall_pct)) return;
    paare.push({ zeile: z, fi, befall: e.befall_pct, note: e.note_app, ergebnis: e });
  });
  const notenA = paare.map((p) => p.zeile.note_A);
  const notenB = paare.map((p) => p.zeile.note_B);
  const notenApp = paare.map((p) => p.note);
  const kappaAB = gewichtetesKappa(notenA, notenB, noten);
  const kappaAppA = gewichtetesKappa(notenApp, notenA, noten);
  const kappaAppB = gewichtetesKappa(notenApp, notenB, noten);
  const kappaAppMittel = mittelwert([kappaAppA, kappaAppB]);
  const menschMittel = paare.map((p) => mittelwert([p.zeile.note_A, p.zeile.note_B]));
  const rang = spearman(paare.map((p) => p.befall), menschMittel);

  // Wiederholbarkeit je Topf
  const gruppen = new Map();
  daten.wiederholung.forEach((z, i) => {
    const fi = zuordnung.wiederholung[i];
    if (fi === null || fi === undefined || ausgeschlossen.has(fi) || !ergebnisse[fi]) return;
    const key = z.topf_nr || '?';
    if (!gruppen.has(key)) gruppen.set(key, []);
    gruppen.get(key).push({ durchgang: z.durchgang, befall: ergebnisse[fi].befall_pct, fi });
  });
  const wiederholbarkeit = [...gruppen.entries()].map(([topf, werte]) => ({
    topf,
    werte: werte.sort((a, b) => (a.durchgang ?? 0) - (b.durchgang ?? 0)).map((w) => w.befall),
    mittel: runden(mittelwert(werte.map((w) => w.befall)), 1),
    streuung: runden(standardabweichung(werte.map((w) => w.befall)), 2),
  }));
  const streuungMax = wiederholbarkeit.length ? Math.max(...wiederholbarkeit.map((w) => (Number.isFinite(w.streuung) ? w.streuung : Infinity))) : NaN;

  const lichttest = daten.lichttest.map((z, i) => {
    const fi = zuordnung.lichttest[i];
    const e = fi !== null && fi !== undefined && !ausgeschlossen.has(fi) ? ergebnisse[fi] : null;
    return { topf: z.topf_nr, zeitpunkt: z.zeitpunkt, hallenlicht: z.hallenlicht, befall: e?.befall_pct ?? null, deltaE: e?.farbkarte_delta_e ?? null, qualitaet: e?.qualitaet ?? null };
  });
  const lichtWerte = lichttest.map((l) => l.befall).filter(Number.isFinite);
  const lichtSpanne = lichtWerte.length ? runden(Math.max(...lichtWerte) - Math.min(...lichtWerte), 1) : NaN;

  const alleFotos = ergebnisse.map((e, fi) => ({ e, fi })).filter(({ e, fi }) => e && !ausgeschlossen.has(fi));
  const karteAnteil = alleFotos.length ? alleFotos.filter(({ e }) => karteErkannt(e)).length / alleFotos.length : NaN;

  const mitSporen = paare.filter((p) => p.zeile.sporen_unten === true);
  const unsichtbar = mitSporen.filter((p) => p.befall < 1);

  return {
    n: paare.length,
    paare,
    kappaAB, kappaAppA, kappaAppB, kappaAppMittel,
    spearman: rang,
    wiederholbarkeit, streuungMax,
    lichttest, lichtSpanne,
    karteAnteil,
    fotosGesamt: alleFotos.length,
    unsichtbar: { anzahl: unsichtbar.length, von: mitSporen.length, anteil: mitSporen.length ? unsichtbar.length / mitSporen.length : 0, toepfe: unsichtbar.map((p) => p.zeile.topf_nr) },
  };
}

/**
 * Entscheidung nach Leitfaden Tabelle 8.2 / Abb. 8.2 (Vorschlag).
 * optionen: { nachgebessert: bool, grenzeUnsichtbar: Anteil 0..1 }
 */
export function entscheidung(kz, { nachgebessert = false, grenzeUnsichtbar = 0.2 } = {}) {
  const kriterien = [
    { name: 'Kappa App–Menschen', wert: kz.kappaAppMittel, ziel: '≥ 0,6', erfuellt: kz.kappaAppMittel >= 0.6 },
    { name: 'Höchstens 0,1 unter Kappa A–B', wert: kz.kappaAB, ziel: 'App ≥ A–B − 0,1', erfuellt: kz.kappaAppMittel >= kz.kappaAB - 0.1 },
    { name: 'Streuung Wiederholungsfotos (größte)', wert: kz.streuungMax, ziel: '≤ 2 Prozentpunkte', erfuellt: kz.streuungMax <= 2 },
    { name: 'Farbkarte erkannt', wert: kz.karteAnteil, ziel: '≥ 95 %', erfuellt: kz.karteAnteil >= 0.95 },
  ];
  const unsichtbarZuViel = kz.unsichtbar.anteil > grenzeUnsichtbar;
  let ergebnis; let begruendung;
  if (unsichtbarZuViel) {
    ergebnis = 'NO-GO';
    begruendung = `Zu viel unsichtbarer Befall: ${kz.unsichtbar.anzahl} von ${kz.unsichtbar.von} Töpfen mit Sporen unten haben App-Befall unter 1 % (Grenze ${Math.round(grenzeUnsichtbar * 100)} %).`;
  } else if (kz.kappaAppMittel < 0.4 && nachgebessert) {
    ergebnis = 'NO-GO';
    begruendung = 'Kappa App–Menschen unter 0,4, obwohl schon nachgebessert wurde.';
  } else if (kriterien.every((k) => k.erfuellt)) {
    ergebnis = 'GO';
    begruendung = 'Alle vier Bedingungen sind erfüllt.';
  } else {
    ergebnis = 'NACHBESSERN';
    begruendung = `Nicht erfüllt: ${kriterien.filter((k) => !k.erfuellt).map((k) => k.name).join(', ')}.`;
  }
  return { ergebnis, begruendung, kriterien, unsichtbarZuViel };
}

/**
 * Vorschlag für Notengrenzen: maximiert das mittlere Kappa (App–A, App–B) über die Grenzen
 * (Koordinatensuche in 0,5-%-Schritten). Nur ein Vorschlag – Gefahr der Selbsttäuschung (Leitfaden 8.6).
 */
export function notengrenzenVorschlagen(befall, notenA, notenB, skala) {
  const { noten } = skala;
  let grenzen = [...skala.grenzen];
  const guete = (g) => {
    const s = { noten, grenzen: g };
    const app = befall.map((b) => noteAusBefall(b, s));
    return mittelwert([gewichtetesKappa(app, notenA, noten), gewichtetesKappa(app, notenB, noten)]);
  };
  let beste = guete(grenzen);
  if (!Number.isFinite(beste)) return { grenzen, kappa: beste };
  const kandidaten = [];
  for (let x = 0.5; x <= 95; x += 0.5) kandidaten.push(x);
  for (let runde = 0; runde < 6; runde++) {
    let verbessert = false;
    for (let i = 0; i < grenzen.length; i++) {
      const unten = i > 0 ? grenzen[i - 1] : 0;
      const oben = i < grenzen.length - 1 ? grenzen[i + 1] : 100;
      for (const x of kandidaten) {
        if (x <= unten || x >= oben || x === grenzen[i]) continue;
        const probe = [...grenzen]; probe[i] = x;
        const g = guete(probe);
        if (g > beste + 1e-9) { beste = g; grenzen = probe; verbessert = true; }
      }
    }
    if (!verbessert) break;
  }
  return { grenzen, kappa: beste };
}

/** Übungs- und Prüfhälfte (Kalibrieren, Kapitel 10): zufällige, feste Aufteilung je Topf. */
export function haelftenBilden(toepfe, seed = 20270210) {
  let a = seed >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const liste = [...new Set(toepfe.filter(Boolean))].sort();
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  const mitte = Math.ceil(liste.length / 2);
  return { uebung: new Set(liste.slice(0, mitte)), pruefung: new Set(liste.slice(mitte)) };
}
