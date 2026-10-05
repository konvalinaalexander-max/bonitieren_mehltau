// Baut die Analyse-Werkstatt als EINE HTML-Datei (dist/analyse-werkstatt.html), die ohne
// Server per Doppelklick läuft (file://). Worker-Quelltexte werden eingebettet und über
// Blob-URLs gestartet. Aufruf: node werkzeuge/bauen.mjs
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const gemeinsam = { bundle: true, format: 'iife', write: false, minify: true, target: 'es2020', legalComments: 'none', define: { 'import.meta.url': '"about:blank"' }, logLevel: 'warning' };

async function buendeln(einstieg) {
  const r = await build({ ...gemeinsam, entryPoints: [join(WURZEL, einstieg)] });
  return r.outputFiles[0].text;
}

const sicher = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

const analyseWorker = await buendeln('kern/analyse-worker.js');
const demoWorker = await buendeln('werkstatt/demo-worker.js');
const werkstatt = await buendeln('werkstatt/werkstatt.js');
const css = readFileSync(join(WURZEL, 'werkstatt/werkstatt.css'), 'utf8');
let html = readFileSync(join(WURZEL, 'werkstatt/index.html'), 'utf8');
const stand = new Date().toISOString().slice(0, 10);

html = html.replace('<link rel="stylesheet" href="werkstatt.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="werkstatt.js"></script>', () => [
  `<!-- Einzeldatei-Fassung, gebaut am ${stand} mit werkzeuge/bauen.mjs. Quelltext: Ordner werkstatt/ und kern/. -->`,
  `<script>window.ANALYSE_WORKER_QUELLTEXT = ${sicher(JSON.stringify(analyseWorker))};`,
  `window.DEMO_WORKER_QUELLTEXT = ${sicher(JSON.stringify(demoWorker))};</script>`,
  `<script>${sicher(werkstatt)}</script>`,
].join('\n'));
mkdirSync(join(WURZEL, 'dist'), { recursive: true });
writeFileSync(join(WURZEL, 'dist/analyse-werkstatt.html'), html);
console.log(`dist/analyse-werkstatt.html: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
