// Speicher der App im Browser (IndexedDB): Konfiguration, Sitzungen, Messungen, Bilder.
// Browser-Speicher ist kein Archiv – nach jeder Sitzung exportieren (Leitfaden 11.3).

const NAME = 'mehltau-bonitur';
const VERSION = 1;
let dbVersprechen = null;

function oeffnen() {
  if (dbVersprechen) return dbVersprechen;
  dbVersprechen = new Promise((loesen, ablehnen) => {
    const anfrage = indexedDB.open(NAME, VERSION);
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains('konfig')) db.createObjectStore('konfig', { keyPath: 'schluessel' });
      if (!db.objectStoreNames.contains('sitzungen')) db.createObjectStore('sitzungen', { keyPath: 'sitzung_id' });
      if (!db.objectStoreNames.contains('messungen')) {
        const m = db.createObjectStore('messungen', { keyPath: 'mess_id' });
        m.createIndex('sitzung_id', 'sitzung_id');
      }
      if (!db.objectStoreNames.contains('bilder')) db.createObjectStore('bilder', { keyPath: 'schluessel' });
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
  return anfrageZuPromise(s.index('sitzung_id').getAll(sitzungId));
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
