// Druckseite: Topf-Karten 85 × 55 mm (große Nummer, QR-Code, klein Satz und Sorte)
// und Maßstab-Karte 10 × 10 cm. Läuft im Browser, auch offline; nichts wird hochgeladen.

import {
  idsAusBereich, zeilenAusText, zeilenAusTabelle, doppelte, qrSvg, seitenAufteilen,
} from './etiketten-logik.js';
import { arbeitsmappeLesen } from '../kern/tabellen.js';

const $ = (s) => document.querySelector(s);
const seitenEl = $('#seiten');
const zustand = { quelle: 'bereich', excelZeilen: [] };

function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function art() { return document.querySelector('[name=art]:checked').value; }

function kartenLesen() {
  let zeilen;
  if (zustand.quelle === 'liste') zeilen = zeilenAusText($('#liste').value);
  else if (zustand.quelle === 'excel') zeilen = zustand.excelZeilen;
  else zeilen = idsAusBereich($('#praefix').value.trim(), $('#von').value, $('#bis').value, $('#stellen').value).map((id) => ({ id, satz: '', sorte: '' }));
  const satz = $('#satz').value.trim(); const sorte = $('#sorte').value.trim();
  return zeilen.map((z) => ({ id: z.id, satz: z.satz || satz, sorte: z.sorte || sorte }));
}

function kontrollmass(nr, von) {
  return `<div class="kontrollmass"><i></i><span>Kontrollmaß: genau 50 mm? Sonst mit „Tatsächliche Größe/100 %“ neu drucken. · Seite ${nr} von ${von}</span></div>`;
}

function kartenSeiten(karten, mitQr) {
  const seiten = seitenAufteilen(karten);
  return seiten.map((karte, i) => `<section class="seite">${kontrollmass(i + 1, seiten.length)}
    ${karte.map((k) => {
    const zusatz = [k.satz ? `Satz ${esc(k.satz)}` : '', esc(k.sorte)].filter(Boolean).join(' · ');
    return `<div class="topfkarte${mitQr ? '' : ' ohne-qr'}" style="left:${k.x}mm;top:${k.y}mm">
      ${mitQr ? `<div class="qr">${qrSvg(k.id)}</div>` : ''}
      <div class="text"><div class="nummer" data-max="${mitQr ? 24 : 34}">${esc(k.id)}</div>${zusatz ? `<div class="zusatz">${zusatz}</div>` : ''}</div></div>`;
  }).join('')}</section>`);
}

function massstabSeite() {
  const karte = (y) => `<div class="massstab" style="top:${y}mm">
    <div class="quadrat"><b>Maßstab-Karte<br>10 × 10 cm</b>
      <span>Die äußere Kante des schwarzen Rahmens misst genau 100 × 100 mm – bitte nachmessen.<br>
      Entlang der gestrichelten Linie ausschneiden, auf festen Karton kleben, matt lassen.
      In der Box auf einen Sockel in typischer Blatthöhe legen und einmal fotografieren.
      In der Werkstatt die 4 äußeren Ecken des schwarzen Rahmens anklicken.</span></div>
    <div class="unten">Mehltau-Bonitur · Maßstab-Karte</div></div>`;
  return [`<section class="seite">${kontrollmass(1, 1)}${karte(22)}${karte(155)}</section>`];
}

/** Nummer so groß wie möglich, aber in die Kartenbreite einpassen. */
function nummernEinpassen() {
  seitenEl.querySelectorAll('.nummer').forEach((el) => {
    const max = Number(el.dataset.max);
    el.style.fontSize = `${max}mm`;
    const platz = el.parentElement.clientWidth;
    const breite = el.scrollWidth;
    if (breite > platz) el.style.fontSize = `${(max * platz / breite) * 0.97}mm`;
  });
}

function zeichnen() {
  const istKarten = art() === 'karten';
  $('#bereich-karten').hidden = !istKarten;
  let seiten; let text;
  if (istKarten) {
    let karten = [];
    try { karten = kartenLesen(); } catch (f) { $('#zusammenfassung').textContent = f.message; seitenEl.innerHTML = ''; return; }
    const doppelt = doppelte(karten.map((k) => k.id));
    seiten = kartenSeiten(karten, $('#mit-qr').checked);
    text = `${karten.length} Karten auf ${seiten.length} Seite${seiten.length === 1 ? '' : 'n'}.`;
    if (karten.length) text += ` Erste: ${karten[0].id}, letzte: ${karten.at(-1).id}.`;
    if (doppelt.length) text += ` Achtung, doppelt: ${doppelt.slice(0, 10).join(', ')}${doppelt.length > 10 ? ' …' : ''}`;
  } else {
    seiten = massstabSeite();
    text = '1 Seite mit 2 Maßstab-Karten (eine als Ersatz).';
  }
  $('#zusammenfassung').textContent = text;
  seitenEl.innerHTML = seiten.join('');
  nummernEinpassen();
  document.title = istKarten ? 'Topf-Karten drucken' : 'Maßstab-Karte drucken';
}

function quelleSetzen(q) {
  zustand.quelle = q;
  document.querySelectorAll('.reiter button').forEach((b) => b.classList.toggle('aktiv', b.dataset.quelle === q));
  document.querySelectorAll('[data-teil]').forEach((t) => { t.hidden = t.dataset.teil !== q; });
  zeichnen();
}

// Startwerte aus der Adresse, z. B. ?praefix=P&von=1&bis=200&stellen=3&qr=1 oder ?art=massstab
const p = new URLSearchParams(location.search);
for (const k of ['praefix', 'von', 'bis', 'stellen', 'satz', 'sorte']) if (p.has(k)) $(`#${k}`).value = p.get(k);
if (p.has('qr')) $('#mit-qr').checked = p.get('qr') !== '0';
if (p.get('art') === 'massstab') document.querySelector('[name=art][value=massstab]').checked = true;
if (p.has('liste')) { $('#liste').value = p.get('liste').replace(/,/g, '\n'); zustand.quelle = 'liste'; }

document.querySelectorAll('[name=art]').forEach((r) => r.addEventListener('change', zeichnen));
document.querySelectorAll('.reiter button').forEach((b) => b.addEventListener('click', () => quelleSetzen(b.dataset.quelle)));
['praefix', 'von', 'bis', 'stellen', 'satz', 'sorte', 'liste'].forEach((id) => $(`#${id}`).addEventListener('input', zeichnen));
$('#mit-qr').addEventListener('change', zeichnen);
$('#excel').addEventListener('change', async (e) => {
  const datei = e.target.files[0];
  if (!datei) return;
  try {
    const mappe = arbeitsmappeLesen(new Uint8Array(await datei.arrayBuffer()));
    const [name, zeilen] = Object.entries(mappe)[0] || [];
    zustand.excelZeilen = zeilenAusTabelle(zeilen || []);
    $('#excel-info').textContent = `${zustand.excelZeilen.length} Topf-IDs aus Blatt „${name}“ gelesen.`;
  } catch (f) {
    zustand.excelZeilen = [];
    $('#excel-info').textContent = `Datei nicht lesbar: ${f.message}`;
  }
  zeichnen();
});
$('#drucken').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', nummernEinpassen);

quelleSetzen(zustand.quelle);
globalThis.etikettenFertig = true;
