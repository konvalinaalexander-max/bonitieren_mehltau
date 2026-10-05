// Browser-Test (Playwright, Chromium): kompletter Ablauf von Handy-App, Werkstatt und Druckseite
// mit künstlichen Box-Fotos. Aufruf: npm run test:browser
// Braucht einmalig einen Browser: npx playwright install chromium

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const schritte = [];
async function schritt(name, f) {
  const t0 = Date.now();
  await f();
  schritte.push(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  console.log(schritte.at(-1));
}

const server = await serverStarten();
const BASIS = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const fehler = [];
let ok = false;

try {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') fehler.push(`Konsole: ${m.text()}`); });
  p.on('pageerror', (e) => fehler.push(`Seitenfehler: ${e.message}`));
  const antworten = [];
  p.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (antworten.shift() ?? '') : undefined));
  const dateiWaehlen = async (klick, dateien) => {
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), klick()]);
    await fc.setFiles(dateien);
  };

  // ---------- künstliche Box-Fotos im Browser erzeugen (JPEG) ----------
  let fotos; let einstellungen; let wahrheit;
  await schritt('Künstliche Box-Fotos erzeugen', async () => {
    await p.goto(`${BASIS}/index.html`);
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
    fotos = r.aus.map((f) => ({ name: f.name, mimeType: 'image/jpeg', buffer: Buffer.from(f.b64, 'base64') }));
    wahrheit = r.aus;
    einstellungen = { ...r.einst, kennung: 'W1', geaendert: '2026-10-05T08:00:00Z' };
  });

  await schritt('App: Start und Einstellungsdatei laden', async () => {
    await p.goto(`${BASIS}/app/`);
    await p.waitForSelector('text=Neue Sitzung starten');
    await p.click('#zu-einstellungen');
    await dateiWaehlen(() => p.click('#json-laden'), { name: 'bonitur-einstellungen_W1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(einstellungen)) });
    await p.waitForSelector('text=Aktiv: W1');
  });

  await schritt('App: Sitzung anlegen', async () => {
    await p.goto(`${BASIS}/app/#/neu`);
    await p.waitForSelector('#f');
    antworten.push('AK'); await p.selectOption('[name=mitarbeiter]', '__neu');
    antworten.push('12'); await p.selectOption('[name=satz]', '__neu');
    antworten.push('Genovese'); await p.selectOption('[name=sorte]', '__neu');
    antworten.push('unbehandelt'); await p.selectOption('[name=behandlung]', '__neu');
    await p.fill('[name=datum]', '2026-10-05');
    await p.click('#f button[type=submit]');
    await p.waitForSelector('#import');
  });

  await schritt('App: 4 Fotos importieren, auswerten, Topf-ID aus QR, speichern', async () => {
    await dateiWaehlen(() => p.click('#import'), fotos);
    for (let i = 0; i < fotos.length; i++) {
      await p.waitForSelector('#f [name=topf_id]', { timeout: 60000 });
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

  await schritt('App: Export Excel + ZIP und wieder einlesen', async () => {
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

  await schritt('App: Übersicht, Sicht-Bonitur, Offline-Start', async () => {
    await p.goto(`${BASIS}/app/#/uebersicht`);
    await p.waitForSelector('.diagramm svg');
    await p.goto(`${BASIS}/app/#/einstellungen`);
    await p.check('[name=modus][value=sicht]');
    await p.goto(`${BASIS}/app/#/neu`);
    await p.waitForSelector('#f');
    await p.selectOption('[name=art]', 'kontrolle');
    await p.click('#f button[type=submit]');
    await dateiWaehlen(() => p.click('#import'), fotos[1]);
    await p.waitForSelector('.referenzen', { timeout: 60000 });
    await p.click('.notenwahl button[data-note="1"]');
    await p.click('#f button[type=submit]');
    await p.waitForSelector('#import');
    await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 }).catch(() => {});
    await p.reload();
    await p.waitForFunction(() => navigator.serviceWorker?.controller, null, { timeout: 30000 });
    await ctx.setOffline(true);
    await p.goto(`${BASIS}/app/`);
    await p.waitForSelector('text=Letzte Sitzungen', { timeout: 20000 });
    await ctx.setOffline(false);
  });

  await schritt('Druckseite: 200 Topf-Karten auf 20 Seiten', async () => {
    const e = await browser.newPage();
    e.on('pageerror', (x) => fehler.push(`Druckseite: ${x.message}`));
    await e.goto(`${BASIS}/etiketten/?praefix=P&von=1&bis=200&stellen=3`);
    await e.waitForFunction(() => globalThis.etikettenFertig);
    assert.equal(await e.locator('.seite').count(), 20);
    assert.equal(await e.locator('.topfkarte .qr svg').count(), 200);
    await e.close();
  });

  await schritt('Werkstatt: Demo-Pilot erzeugen, auswerten, Entscheidung', async () => {
    const w = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    w.on('pageerror', (x) => fehler.push(`Werkstatt: ${x.message}`));
    w.on('console', (m) => { if (m.type() === 'error') fehler.push(`Werkstatt-Konsole: ${m.text()}`); });
    await w.goto(`${BASIS}/werkstatt/`);
    await w.click('#knopf-demo');
    await w.waitForFunction(() => document.querySelector('#status-demo').textContent.startsWith('Fertig'), null, { timeout: 300000 });
    await w.click('button[data-schritt="auswerten"]');
    await w.click('#knopf-auswerten');
    await w.waitForFunction(() => document.querySelector('#status-auswerten').textContent.includes('ausgewertet ·'), null, { timeout: 600000 });
    const z = await w.evaluate(() => ({ n: globalThis.werkstattZustand.kz?.n, urteil: globalThis.werkstattZustand.urteil?.ergebnis, kappa: globalThis.werkstattZustand.kz?.kappaAppMittel }));
    assert.equal(z.n, 40);
    assert.equal(z.urteil, 'GO');
    assert.ok(z.kappa > 0.8, `Kappa ${z.kappa}`);
    await w.close();
  });

  assert.deepEqual(fehler, [], `Fehler im Browser:\n${fehler.join('\n')}`);
  ok = true;
} catch (f) {
  console.error('\n✗ FEHLGESCHLAGEN:', f.message);
  if (fehler.length) console.error(fehler.join('\n'));
} finally {
  await browser.close();
  server.close();
}
console.log(ok ? `\nAlle ${schritte.length} Browser-Schritte bestanden.` : '');
process.exit(ok ? 0 : 1);
