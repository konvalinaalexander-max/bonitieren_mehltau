// Speicher der App im Browser (IndexedDB): Konfiguration, Sitzungen, Messungen, Bilder.
// Browser-Speicher ist kein Archiv – nach jeder Sitzung exportieren (Leitfaden 11.3).

import { istTestversion, messungErgaenzen } from './logik.js';

/** Testversionen (Pfad mit /vorschau/ oder /test/) bekommen eigene Daten – echte Daten bleiben unberührt. */
export const TESTVERSION = istTestversion(globalThis.location?.pathname);
const NAME = TESTVERSION ? 'mehltau-bonitur-test' : 'mehltau-bonitur';
const VERSION = 1;
let dbVersprechen = null;

/**
 * Schema-Änderungen: je Version eine Funktion, die nur Neues anlegt. Alte Einträge
 * nie ändern, nur neue anhängen und VERSION erhöhen – so bleiben vorhandene Daten erhalten.
 */
const MIGRATIONEN = {
  1: (db) => {
    db.createObjectStore('konfig', { keyPath: 'schluessel' });
    db.createObjectStore('sitzungen', { keyPath: 'sitzung_id' });
    db.createObjectStore('messungen', { keyPath: 'mess_id' }).createIndex('sitzung_id', 'sitzung_id');
    db.createObjectStore('bilder', { keyPath: 'schluessel' });
  },
};

function oeffnen() {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((loesen, ablehnen) => {
    const anfrage = indexedDB.open(NAME, VERSION);
    anfrage.onupgradeneeded = (e) => {
      for (let v = e.oldVersion + 1; v <= VERSION; v++) MIGRATIONEN[v](anfrage.result, anfrage.transaction);
    };
    anfrage.onsuccess = () => loesen(anfrage.result);
    anfrage.onerror = () => ablehnen(anfrage.error);
  });
  return dbVersprechen;
}

function anfrageZuPromise(a) {
  return new Promise((loesen, ablehnen) => { a.onsuccess = () => loesen(a.result); a.onerror = () => ablehnen(a.error); });
}

async function speicher(name, modus = 'readonly') {
  const db = await oeffnen();
  return db.transaction(name, modus).objectStore(name);
}

export async function holen(store, schluessel) {
  return anfrageZuPromise((await speicher(store)).get(schluessel));
}
export async function ablegen(store, wert) {
  return anfrageZuPromise((await speicher(store, 'readwrite')).put(wert));
}
export async function loeschen(store, schluessel) {
  return anfrageZuPromise((await speicher(store, 'readwrite')).delete(schluessel));
}
export async function alle(store) {
  return anfrageZuPromise((await speicher(store)).getAll());
}

// ---- Konfiguration ----
export async function konfigHolen(schluessel, standard = null) {
  const r = await holen('konfig', schluessel);
  return r ? r.wert : standard;
}
export async function konfigSetzen(schluessel, wert) {
  return ablegen('konfig', { schluessel, wert });
}

// ---- Sitzungen und Messungen ----
export async function messungenDerSitzung(sitzungId) {
  const s = await speicher('messungen');
  const liste = await anfrageZuPromise(s.index('sitzung_id').getAll(sitzungId));
  return liste.map(messungErgaenzen).sort((a, b) => String(a.mess_id).localeCompare(String(b.mess_id)));
}

export async function alleMessungen() {
  return (await alle('messungen')).map(messungErgaenzen);
}

export async function sitzungen() {
  const liste = await alle('sitzungen');
  return liste.sort((a, b) => String(b.erstellt).localeCompare(String(a.erstellt)));
}

/** Löscht die Bilder einer Sitzung (nur nach bestätigtem Export erlaubt). */
export async function fotosDerSitzungLoeschen(sitzungId) {
  const sitzung = await holen('sitzungen', sitzungId);
  if (!sitzung?.exportiert) throw new Error('Erst exportieren und die Sicherung bestätigen.');
  const messungen = await messungenDerSitzung(sitzungId);
  for (const m of messungen) {
    for (const k of [m.foto_key, m.kontroll_key, m.vorschau_key]) if (k) await loeschen('bilder', k);
    await ablegen('messungen', { ...m, foto_key: null, kontroll_key: null, vorschau_key: null, foto_geloescht: true });
  }
  await ablegen('sitzungen', { ...sitzung, fotosGeloescht: new Date().toISOString() });
}

/** Löscht eine Sitzung ganz (nur nach Export). */
export async function sitzungLoeschen(sitzungId) {
  const sitzung = await holen('sitzungen', sitzungId);
  if (sitzung && !sitzung.exportiert) throw new Error('Erst exportieren und die Sicherung bestätigen.');
  const messungen = await messungenDerSitzung(sitzungId);
  for (const m of messungen) {
    for (const k of [m.foto_key, m.kontroll_key, m.vorschau_key]) if (k) await loeschen('bilder', k);
    await loeschen('messungen', m.mess_id);
  }
  await loeschen('sitzungen', sitzungId);
}

export async function speicherSchaetzung() {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  const dauerhaft = navigator.storage.persisted ? await navigator.storage.persisted() : null;
  return { belegt: e.usage, frei: e.quota, dauerhaft };
}

export async function dauerhaftAnfordern() {
  if (!navigator.storage?.persist) return null;
  return navigator.storage.persist();
}
