// Browser-Test (Playwright): kompletter Ablauf von Handy-App, Werkstatt und Druckseite mit
// künstlichen Box-Fotos – in Chromium (Chrome, Edge) und, falls installiert, in WebKit (Safari,
// iPhone). Die Werkstatt wird zusätzlich als einzelne Datei (file://, wie per Doppelklick) geprüft.
// Aufruf: npm run test:browser
// Browser einmalig installieren: npx playwright install chromium webkit
// (ALLE_BROWSER=1 erzwingt WebKit, z. B. in GitHub Actions.)

import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import JSZip from '../../bibliotheken/jszip.mjs';
import { arbeitsmappeLesen, blattFinden } from '../../kern/tabellen.js';
import { EXPORT_SPALTEN } from '../../app/logik.js';

const WURZEL = fileURLToPath(new URL('../../', import.meta.url));
const TYPEN = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.pdf': 'application/pdf', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// ---------- kleiner Webserver für den Projektordner ----------
function serverStarten() {
  const server = createServer(async (anfrage, antwort) => {
    try {
      let pfad = decodeURIComponent(new URL(anfrage.url, 'http://x').pathname);
      if (pfad.endsWith('/')) pfad += 'index.html';
      const datei = normalize(join(WURZEL, pfad));
      if (!datei.startsWith(WURZEL)) throw new Error('außerhalb');
      if (!(await stat(datei)).isFile()) throw new Error('kein Datei');
      antwort.writeHead(200, { 'Content-Type': TYPEN[extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      antwort.end(await readFile(datei));
    } catch {
      antwort.writeHead(404); antwort.end('nicht gefunden');
    }
  });
  return new Promise((loesen) => server.listen(0, '127.0.0.1', () => loesen(server)));
}

const ergebnisse = [];
async function schritt(maschine, name, f) {
  const t0 = Date.now();
  await f();
  const zeile = `✓ [${maschine}] ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`;
  ergebnisse.push(zeile);
  console.log(zeile);
}

/** Künstliche Box-Fotos als JPEG (im Browser erzeugt) und passende Einstellungsdatei. */
async function fotosErzeugen(browser, basis) {
  const p = await browser.newPage();
  await p.goto(`${basis}/index.html`);
  const r = await p.evaluate(async () => {
    const { szeneErzeugen } = await import('/werkzeuge/synthetik.js');
    const liste = [
      ['BOX_20261005_090101.jpg', { seed: 11, gelb: 0.01, braun: 0, etikett: 'P001' }],
      ['BOX_20261005_090202.jpg', { seed: 12, gelb: 0.12, braun: 0.03, etikett: 'P002' }],
      ['BOX_20261005_090303.jpg', { seed: 13, gelb: 0.30, braun: 0.10, etikett: 'P003' }],
      ['BOX_20261005_090404.jpg', { seed: 14, gelb: 0.05, braun: 0.01, etikett: null }],
    ];
    const aus = []; let einst = null;
    for (const [name, o] of liste) {
      const s = szeneErzeugen({ breite: 2400, hoehe: 1800, ...o });
      const c = new OffscreenCanvas(s.bild.width, s.bild.height);
      c.getContext('2d').putImageData(new ImageData(s.bild.data, s.bild.width, s.bild.height), 0, 0);
      const bytes = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 })).arrayBuffer());
      let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      aus.push({ name, b64: btoa(bin), befall: s.wahrheit.befall_pct, etikett: o.etikett });
      if (!einst && o.etikett) einst = s.einstellungen;
    }
    return { aus, einst };
  });
  await p.close();
  return {
    fotos: r.aus.map((f) => ({ name: f.name, mimeType: 'image/jpeg', buffer: Buffer.from(f.b64, 'base64') })),
    wahrheit: r.aus,
    einstellungen: { ...r.einst, kennung: 'W1', geaendert: '2026-10-05T08:00:00Z' },
  };
}

async function durchlauf(m, basis, daten, ordner) {
  const browser = await m.typ.launch({ args: m.args });
  const fehler = [];
  const beobachten = (seite, wo) => {
    seite.on('console', (x) => { if (x.type() === 'error') fehler.push(`${wo} Konsole: ${x.text()}`); });
    seite.on('pageerror', (x) => fehler.push(`${wo} Seitenfehler: ${x.message}`));
  };
  try {
    const { fotos, wahrheit, einstellungen } = daten;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage();
    beobachten(p, 'App');
    const antworten = [];
    p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (antworten.shift() ?? '') : undefined));
    const dateiWaehlen = async (seite, klick, dateien) => {
      const [fc] = await Promise.all([seite.waitForEvent('filechooser'), klick()]);
      await fc.setFiles(dateien);
    };

    await schritt(m.kurz, 'App: Start und Einstellungsdatei laden', async () => {
      await p.goto(`${basis}/app/`);
      await p.waitForSelector('text=Neue Sitzung starten');
      await p.click('#zu-einstellungen');
      await dateiWaehlen(p, () => p.click('#json-laden'), { name: 'bonitur-einstellungen_W1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(einstellungen)) });
      await p.waitForSelector('text=Aktiv: W1');
    });

    await schritt(m.kurz, 'App: Sitzung anlegen', async () => {
      await p.goto(`${basis}/app/#/neu`);
      await p.waitForSelector('#f');
      antworten.push('AK'); await p.selectOption('[name=mitarbeiter]', '__neu');
      antworten.push('12'); await p.selectOption('[name=satz]', '__neu');
      antworten.push('Genovese'); await p.selectOption('[name=sorte]', '__neu');
      antworten.push('unbehandelt'); await p.selectOption('[name=behandlung]', '__neu');
      await p.fill('[name=datum]', '2026-10-05');
      await p.click('#f button[type=submit]');
      await p.waitForSelector('#import');
    });

    await schritt(m.kurz, 'App: 4 Fotos importieren, auswerten, Topf-ID aus QR, speichern', async () => {
      await dateiWaehlen(p, () => p.click('#import'), fotos);
      for (let i = 0; i < fotos.length; i++) {
        // Warten, bis wirklich das Ergebnis dieses Fotos angezeigt wird (nicht noch das vorige)
        await p.waitForFunction((titel) => document.querySelector('#titel')?.textContent.startsWith(titel)
          && document.querySelector('#f [name=topf_id]'), `Foto ${i + 1} von ${fotos.length}`, { timeout: 90000 });
        const info = await p.evaluate(() => ({
          befall: Number(document.querySelector('.note-gross span').textContent.replace(/[^\d,]/g, '').replace(',', '.')),
          topf: document.querySelector('[name=topf_id]').value,
          qr: Boolean(document.querySelector('.marke.ok')),
          warn: document.querySelector('.warnungen')?.textContent || '',
        }));
        const w = wahrheit[i];
        assert.ok(Math.abs(info.befall - w.befall) <= 1.5, `${w.name}: Befall ${info.befall} statt ca. ${w.befall.toFixed(1)}`);
        if (w.etikett) { assert.equal(info.topf, w.etikett); assert.ok(info.qr, 'QR nicht gelesen'); } else {
          assert.match(info.warn, /QR-Code/);
          await p.fill('[name=topf_id]', 'P004');
        }
        await p.click('#f button[type=submit]');
        await p.waitForTimeout(200);
      }
      await p.waitForSelector('#import');
    });

    await schritt(m.kurz, 'App: Export Excel + ZIP und wieder einlesen', async () => {
      await p.click('text=Sitzung ansehen / beenden');
      await p.waitForSelector('#messliste li');
      await p.click('#beenden');
      await p.waitForSelector('#excel');
      const [d1] = await Promise.all([p.waitForEvent('download'), p.click('#excel')]);
      assert.equal(d1.suggestedFilename(), '2026-10-05_Satz12.xlsx');
      const mappe = arbeitsmappeLesen(new Uint8Array(await readFile(await d1.path())));
      const zeilen = blattFinden(mappe, 'Messungen');
      assert.equal(zeilen.length, 4);
      assert.deepEqual(Object.keys(zeilen[0]), EXPORT_SPALTEN);
      assert.deepEqual(zeilen.map((z) => z.topf_id), ['P001', 'P002', 'P003', 'P004']);
      const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.click('#zip')]);
      assert.equal(d2.suggestedFilename(), '2026-10-05_Satz12.zip');
      const zip = await JSZip.loadAsync(await readFile(await d2.path()));
      for (const z of zeilen) assert.ok(zip.file(`fotos/${z.foto_datei}`), `Foto fehlt im ZIP: ${z.foto_datei}`);
      await p.click('#bestaetigen');
      await p.waitForSelector('text=Gesichert am');
    });

    await schritt(m.kurz, 'App: Übersicht, Sicht-Bonitur, Offline-Start', async () => {
      await p.goto(`${basis}/app/#/uebersicht`);
      await p.waitForSelector('.diagramm svg');
      await p.goto(`${basis}/app/#/einstellungen`);
      await p.check('[name=modus][value=sicht]');
      await p.goto(`${basis}/app/#/neu`);
      await p.waitForSelector('#f');
      await p.selectOption('[name=art]', 'kontrolle');
      await p.click('#f button[type=submit]');
      await dateiWaehlen(p, () => p.click('#import'), fotos[1]);
      await p.waitForSelector('.referenzen', { timeout: 90000 });
      await p.click('.notenwahl button[data-note="1"]');
      await p.click('#f button[type=submit]');
      await p.waitForSelector('#import');
      // Offline wie im Gewächshaus ohne Netz: eigener Server, App laden, Server abschalten, neu laden.
      // (Die Offline-Simulation von Playwright blockiert in WebKit auch den Service Worker.)
      const zweit = await serverStarten();
      const o = await ctx.newPage();
      await o.goto(`http://127.0.0.1:${zweit.address().port}/app/`);
      await o.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
      await o.reload();
      await o.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 });
      zweit.close(); zweit.closeAllConnections?.();
      await o.reload();
      await o.waitForSelector('text=Neue Sitzung starten', { timeout: 20000 });
      await o.close();
    });

    await schritt(m.kurz, 'Druckseite: 200 Topf-Karten auf 20 Seiten', async () => {
      const e = await browser.newPage();
      beobachten(e, 'Druckseite');
      await e.goto(`${basis}/etiketten/?praefix=P&von=1&bis=200&stellen=3`);
      await e.waitForFunction(() => globalThis.etikettenFertig);
      assert.equal(await e.locator('.seite').count(), 20);
      assert.equal(await e.locator('.topfkarte .qr svg').count(), 200);
      await e.close();
    });

    await schritt(m.kurz, 'Werkstatt: Demo-Pilot erzeugen, auswerten, Entscheidung', async () => {
      const w = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
      beobachten(w, 'Werkstatt');
      await w.goto(`${basis}/werkstatt/`);
      await w.click('#knopf-demo');
      await w.waitForFunction(() => document.querySelector('#status-demo').textContent.startsWith('Fertig'), null, { timeout: 600000 });
      await w.click('button[data-schritt="auswerten"]');
      await w.click('#knopf-auswerten');
      await w.waitForFunction(() => document.querySelector('#status-auswerten').textContent.includes('ausgewertet ·'), null, { timeout: 600000 });
      const z = await w.evaluate(() => ({ n: globalThis.werkstattZustand.kz?.n, urteil: globalThis.werkstattZustand.urteil?.ergebnis, kappa: globalThis.werkstattZustand.kz?.kappaAppMittel }));
      assert.equal(z.n, 40);
      assert.equal(z.urteil, 'GO');
      assert.ok(z.kappa > 0.8, `Kappa ${z.kappa}`);
      await w.close();
    });

    await schritt(m.kurz, 'Werkstatt als Datei (Doppelklick): eigene Fotos, Farbkarte einrichten, auswerten', async () => {
      const w = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
      beobachten(w, 'Werkstatt-Datei');
      w.on('dialog', (d) => { fehler.push(`Werkstatt-Datei: unerwartete Rückfrage „${d.message()}“`); d.accept(); });
      await w.goto(pathToFileURL(join(WURZEL, 'dist/analyse-werkstatt.html')).href);
      await dateiWaehlen(w, () => w.click('label:has(#eingabe-fotos)'), fotos.map((f) => join(ordner, f.name)));
      await w.click('button[data-schritt="einrichten"]');
      await w.waitForTimeout(1000);
      await w.click('.knopf.modus[data-modus="karte"]');
      const box = await w.locator('#leinwand').boundingBox();
      for (const [x, y] of einstellungen.farbkarte.ecken) {
        await w.mouse.move(box.x + x * box.width, box.y + y * box.height);
        await w.mouse.down(); await w.mouse.up(); await w.waitForTimeout(100);
      }
      await w.waitForFunction(() => document.querySelector('#anleitung').textContent.includes('Farbkarte gesetzt'), null, { timeout: 60000 })
        .catch(async () => { throw new Error(`Farbkarte nicht gesetzt: ${await w.textContent('#anleitung')}`); });
      // Topfkreis: von der Mitte aus den Radius ziehen
      const k = einstellungen.auswertekreis;
      await w.click('.knopf.modus[data-modus="kreis"]');
      await w.mouse.move(box.x + k.cx * box.width, box.y + k.cy * box.height); await w.mouse.down();
      await w.mouse.move(box.x + (k.cx + k.r) * box.width, box.y + k.cy * box.height, { steps: 5 }); await w.mouse.up();
      const kreis = await w.evaluate(() => globalThis.werkstattZustand.einst.auswertekreis);
      assert.ok(kreis && Math.abs(kreis.r - k.r) < 0.01, `Topfkreis nicht gesetzt: ${JSON.stringify(kreis)}`);
      await w.click('button[data-schritt="auswerten"]');
      await w.click('#knopf-auswerten');
      await w.waitForFunction(() => document.querySelector('#status-auswerten').textContent.includes('ausgewertet ·'), null, { timeout: 300000 });
      const z = await w.evaluate(() => globalThis.werkstattZustand.fotos.map((f) => ({ befall: f.ergebnis?.befall_pct, fehler: f.fehler, qr: f.qr })));
      z.forEach((f, i) => {
        assert.equal(f.fehler, null, `Foto ${i + 1}: ${f.fehler}`);
        assert.ok(Math.abs(f.befall - wahrheit[i].befall) <= 1.5, `Foto ${i + 1}: Befall ${f.befall} statt ca. ${wahrheit[i].befall.toFixed(1)}`);
      });
      await w.close();
    });

    assert.deepEqual(fehler, [], `Fehler im Browser:\n${fehler.join('\n')}`);
    return true;
  } finally {
    await browser.close();
  }
}

const MASCHINEN = [
  { kurz: 'Chromium', name: 'Chromium (Chrome, Edge)', typ: chromium, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  { kurz: 'WebKit', name: 'WebKit (Safari, iPhone, iPad)', typ: webkit, args: [] },
];

const server = await serverStarten();
const BASIS = `http://127.0.0.1:${server.address().port}`;
const ordner = await mkdtemp(join(tmpdir(), 'mehltau-test-'));
let ok = true;
try {
  const erzeuger = await chromium.launch();
  const daten = await fotosErzeugen(erzeuger, BASIS);
  await erzeuger.close();
  for (const f of daten.fotos) await writeFile(join(ordner, f.name), f.buffer);
  console.log(`✓ ${daten.fotos.length} künstliche Box-Fotos erzeugt`);
  for (const m of MASCHINEN) {
    if (!existsSync(m.typ.executablePath())) {
      if (process.env.ALLE_BROWSER) { console.error(`✗ ${m.name} ist nicht installiert (npx playwright install ${m.kurz.toLowerCase()})`); ok = false; }
      else console.log(`– ${m.name} übersprungen: nicht installiert (npx playwright install ${m.kurz.toLowerCase()})`);
      continue;
    }
    try {
      await durchlauf(m, BASIS, daten, ordner);
    } catch (f) {
      ok = false;
      console.error(`\n✗ ${m.name} FEHLGESCHLAGEN: ${f.message}\n`);
    }
  }
} finally {
  server.close();
  await rm(ordner, { recursive: true, force: true });
}
console.log(ok ? `\nAlle ${ergebnisse.length} Browser-Schritte bestanden.` : '\nBrowser-Test fehlgeschlagen.');
process.exit(ok ? 0 : 1);
