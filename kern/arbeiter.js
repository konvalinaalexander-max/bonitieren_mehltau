// Hauptseiten-Seite der Worker: Aufträge an einen oder mehrere Analyse-Worker verteilen.
// Funktioniert mit Modul-Workern (gehostet) und – in der gebündelten Einzeldatei der
// Werkstatt – mit Workern aus eingebettetem Quelltext (Blob-URL, auch unter file://).

let blobUrl = null;

/** Erzeugt einen Analyse-Worker. */
export function analyseArbeiterErzeugen() {
  const quelltext = globalThis.ANALYSE_WORKER_QUELLTEXT;
  if (quelltext) {
    if (!blobUrl) blobUrl = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
    return new Worker(blobUrl);
  }
  return new Worker(new URL('./analyse-worker.js', import.meta.url), { type: 'module' });
}

/**
 * Fotos (Blob/File) werden im Hauptprogramm dekodiert und als ImageBitmap übergeben, dazu der
 * Dateianfang für EXIF. Grund: Safari kann unter file:// (Werkstatt als Datei per Doppelklick)
 * in einem Worker keine Bilddaten dekodieren („An error occured reading the Blob argument to
 * createImageBitmap“), im Hauptprogramm aber schon. Dekodiert wird erst, wenn ein Worker frei
 * ist – so liegen nie alle Fotos gleichzeitig im Speicher.
 */
export async function nachrichtVorbereiten(nachricht, transfer = []) {
  const d = nachricht?.datei;
  if (typeof Blob === 'undefined' || !(d instanceof Blob)) return [nachricht, transfer];
  const [bitmap, kopf] = await Promise.all([
    createImageBitmap(d, { imageOrientation: 'from-image' }),
    d.slice(0, 196608).arrayBuffer(),
  ]);
  return [{ ...nachricht, datei: { bitmap, kopf, name: d.name || '', typ: d.type || '' } }, [...transfer, bitmap, kopf]];
}

/** Verteilt Aufträge auf mehrere Worker; jeder Auftrag liefert ein Promise. */
export class ArbeiterPool {
  constructor(erzeugen, anzahl) {
    this.erzeugen = erzeugen;
    this.anzahl = Math.max(1, anzahl);
    this.frei = [];
    this.alle = [];
    this.warteschlange = [];
    this.offen = new Map();
    this.zaehler = 0;
  }

  holeArbeiter() {
    if (this.frei.length) return this.frei.pop();
    if (this.alle.length < this.anzahl) {
      const w = this.erzeugen();
      w.onmessage = (e) => this.antwort(w, e.data);
      w.onerror = (e) => this.absturz(w, e);
      this.alle.push(w);
      return w;
    }
    return null;
  }

  auftrag(nachricht, transfer = []) {
    return new Promise((loesen, ablehnen) => {
      this.warteschlange.push({ nachricht, transfer, loesen, ablehnen });
      this.verteilen();
    });
  }

  verteilen() {
    while (this.warteschlange.length) {
      const w = this.holeArbeiter();
      if (!w) return;
      const a = this.warteschlange.shift();
      const id = ++this.zaehler;
      this.offen.set(id, { ...a, arbeiter: w });
      nachrichtVorbereiten(a.nachricht, a.transfer)
        .then(([n, t]) => w.postMessage({ ...n, id }, t))
        .catch((f) => this.antwort(w, { id, ok: false, fehler: `Foto nicht lesbar: ${f?.message || f}` }));
    }
  }

  antwort(w, daten) {
    const a = this.offen.get(daten.id);
    if (!a) return;
    this.offen.delete(daten.id);
    this.frei.push(w);
    if (daten.ok) a.loesen(daten); else a.ablehnen(new Error(daten.fehler));
    this.verteilen();
  }

  absturz(w, e) {
    for (const [id, a] of this.offen) {
      if (a.arbeiter === w) { this.offen.delete(id); a.ablehnen(new Error(e.message || 'Worker abgestürzt')); }
    }
    this.alle = this.alle.filter((x) => x !== w);
    this.frei = this.frei.filter((x) => x !== w);
    w.terminate();
    this.verteilen();
  }

  beenden() {
    this.alle.forEach((w) => w.terminate());
    this.alle = []; this.frei = [];
  }
}
