// Analyse-Werkstatt: Pilot- und Kalibrierfotos am PC auswerten (Leitfaden Kapitel 8 und 10).

import {
  standardEinstellungen, einstellungenErgaenzen, einstellungenPruefen, naechsteKennung,
  ALGORITHMUS_VERSION, BEREICHE,
} from '../kern/einstellungen.js';
import { kennzahlen } from '../kern/analyse.js';
import { auszaehlen } from '../kern/histogramm.js';
import { notenBeschreibung } from '../kern/noten.js';
import { mittelwert, runden } from '../kern/statistik.js';
import { analyseArbeiterErzeugen, ArbeiterPool } from '../kern/arbeiter.js';
import { arbeitsmappeLesen, arbeitsmappeSchreiben, blattFinden } from '../kern/tabellen.js';
import JSZip from '../bibliotheken/jszip.mjs';
import {
  boniturLesen, wiederholungLesen, lichttestLesen, zuordnen, kennzahlenBerechnen, entscheidung,
  notengrenzenVorschlagen, haelftenBilden,
} from './auswertung.js';
import { streudiagramm } from './diagramme.js';
import { Einrichtung } from './einrichten.js';
import { demoPlan, demoBonitur, DEMO_SPALTEN } from './demo.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const SPEICHER = 'mehltau-werkstatt-einstellungen';

// ---------- Hilfen ----------

function fmt(x, n = 1) {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return '–';
  return Number(x).toFixed(n).replace('.', ',');
}
function proz(anteil) { return Number.isFinite(anteil) ? `${fmt(anteil * 100, 0)} %` : '–'; }
function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

let meldungTimer = null;
function melden(text, fehler = false) {
  const m = $('#meldung');
  m.textContent = text; m.className = `meldung${fehler ? ' fehler' : ''}`; m.hidden = false;
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(() => { m.hidden = true; }, fehler ? 9000 : 5000);
}

function herunterladen(daten, name, typ = 'application/octet-stream') {
  const blob = daten instanceof Blob ? daten : new Blob([daten], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function heute() { return new Date().toISOString().slice(0, 10); }

// ---------- Zustand ----------

function gespeicherteEinstellungen() {
  try {
    const t = localStorage.getItem(SPEICHER);
    return t ? einstellungenErgaenzen(JSON.parse(t)) : null;
  } catch { return null; }
}

const z = {
  fotos: [],
  excelRoh: null,
  excel: null,
  zuordnung: null,
  fotoInfo: [],
  einst: gespeicherteEinstellungen() || standardEinstellungen(),
  gespeichertJson: null,
  ausgewertetMit: null,
  schwellenKontrollbild: null,
  kz: null,
  urteil: null,
  filter: 'alle',
  zufallsListe: null,
  optionen: { nachgebessert: false, grenzeUnsichtbar: 0.2 },
  kalibrierung: { an: false, haelften: null, pruefung: null },
  demo: false,
  einstVorDemo: null,
  demoExcel: null,
  detail: null,
};

function vergleichsteil(e) {
  const { kennung, aenderungen, geaendert, notiz, ...rest } = e;
  return JSON.stringify(rest);
}
z.gespeichertJson = vergleichsteil(z.einst);

function istGeaendert() { return vergleichsteil(z.einst) !== z.gespeichertJson; }

function geaenderteTeile() {
  const alt = JSON.parse(z.gespeichertJson);
  const namen = {
    farbkarte: 'Farbkarte', auswertekreis: 'Topfkreis', etikettbereich: 'Etikettbereich', massstab: 'Maßstab',
    schwellen: 'Schwellen', notenskala: 'Notenskala', qualitaet: 'Qualitätsgrenzen', analyse: 'Analyse', modus: 'Modus',
  };
  return Object.keys(namen).filter((k) => JSON.stringify(alt[k]) !== JSON.stringify(z.einst[k])).map((k) => namen[k]);
}

function speichernLokal() {
  if (z.demo) return;
  try { localStorage.setItem(SPEICHER, JSON.stringify(z.einst)); } catch { /* privates Fenster o. Ä. */ }
}

function geometrieSchluessel(e) {
  return JSON.stringify({ k: e.farbkarte?.ecken, c: e.auswertekreis, t: e.etikettbereich, a: e.analyse });
}

const pool = new ArbeiterPool(analyseArbeiterErzeugen, Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)));

function demoArbeiterErzeugen() {
  const q = globalThis.DEMO_WORKER_QUELLTEXT;
  if (q) return new Worker(URL.createObjectURL(new Blob([q], { type: 'text/javascript' })));
  return new Worker(new URL('./demo-worker.js', import.meta.url), { type: 'module' });
}

// ---------- Navigation ----------

let aktuellerSchritt = 'laden';
function schrittZeigen(name) {
  aktuellerSchritt = name;
  $$('.schritte button').forEach((b) => b.classList.toggle('aktiv', b.dataset.schritt === name));
  $$('.schritt').forEach((s) => s.classList.toggle('aktiv', s.id === `schritt-${name}`));
  if (name === 'einrichten') einrichtenZeigen();
  render();
  window.scrollTo({ top: 0 });
}
$('#schritte').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-schritt]');
  if (b) schrittZeigen(b.dataset.schritt);
});

function render() {
  renderVersion();
  if (aktuellerSchritt === 'laden') renderLaden();
  if (aktuellerSchritt === 'einrichten') renderEinrichtenStatus();
  if (aktuellerSchritt === 'auswerten') renderAuswerten();
  if (aktuellerSchritt === 'kontrolle') renderKontrolle();
  if (aktuellerSchritt === 'ergebnis') renderErgebnis();
  const fertig = {
    laden: z.fotos.length > 0 && !!z.excel,
    einrichten: !!(z.einst.farbkarte?.ecken && z.einst.auswertekreis),
    auswerten: z.fotos.some((f) => f.hist) && !veraltet(),
    kontrolle: false, ergebnis: !!z.urteil, export: false,
  };
  $$('.schritte button').forEach((b) => b.classList.toggle('fertig', !!fertig[b.dataset.schritt] && !b.classList.contains('aktiv')));
}

function renderVersion() {
  $('#version').textContent = `Rechenweg ${ALGORITHMUS_VERSION} · Einstellungen ${z.einst.kennung}${istGeaendert() ? ' (geändert)' : ''}${z.demo ? ' · DEMO' : ''}`;
}

function veraltet() {
  return z.ausgewertetMit !== null && z.ausgewertetMit !== geometrieSchluessel(z.einst);
}

// ---------- 1 Daten laden ----------

function fotosSetzen(dateien, { demo = false } = {}) {
  if (!demo && z.demo) {
    z.demo = false;
    z.einst = z.einstVorDemo || gespeicherteEinstellungen() || standardEinstellungen();
    z.gespeichertJson = vergleichsteil(z.einst);
    z.excelRoh = null; z.excel = null;
    melden('Demo beendet – deine eigenen Einstellungen sind wieder aktiv.');
  }
  z.fotos.forEach((f) => f.kontrolleKleinUrl && URL.revokeObjectURL(f.kontrolleKleinUrl));
  const bilder = [...dateien].filter((d) => /\.jpe?g$/i.test(d.name) || d.type === 'image/jpeg');
  bilder.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'de'));
  z.fotos = bilder.map((d) => ({
    name: d.name, pfad: d.webkitRelativePath || d.name, datei: d,
    roh: null, hist: null, basis: null, ergebnis: null, qr: null, fehler: null,
    kontrolle: null, kontrolleKleinUrl: null, aus: false, grund: '',
  }));
  z.ausgewertetMit = null; z.zufallsListe = null;
  zuordnungAktualisieren();
  neuBerechnen();
  render();
  if (!demo) melden(`${z.fotos.length} Fotos geladen.`);
}

$('#eingabe-ordner').addEventListener('change', (e) => fotosSetzen(e.target.files));
$('#eingabe-fotos').addEventListener('change', (e) => fotosSetzen(e.target.files));

async function excelLadenAusBytes(bytes, name) {
  try {
    const mappe = arbeitsmappeLesen(bytes);
    z.excelRoh = {
      name,
      bonitur: blattFinden(mappe, 'Bonitur'),
      wiederholung: blattFinden(mappe, 'Wiederholung'),
      lichttest: blattFinden(mappe, 'Lichttest'),
    };
    excelAufbereiten();
    neuBerechnen();
    render();
  } catch (f) {
    melden(`Excel-Datei konnte nicht gelesen werden: ${f.message}`, true);
  }
}
$('#eingabe-excel').addEventListener('change', async (e) => {
  const d = e.target.files[0];
  if (d) await excelLadenAusBytes(new Uint8Array(await d.arrayBuffer()), d.name);
});

function excelAufbereiten() {
  if (!z.excelRoh) { z.excel = null; return; }
  const r = z.excelRoh;
  const b = boniturLesen(r.bonitur || [], z.einst.notenskala.noten);
  const fehler = [];
  if (!r.bonitur) fehler.push('Das Blatt „Bonitur“ fehlt.');
  z.excel = {
    name: r.name,
    bonitur: b.zeilen,
    wiederholung: wiederholungLesen(r.wiederholung || []),
    lichttest: lichttestLesen(r.lichttest || []),
    fehler: [...fehler, ...b.fehler],
    hinweise: b.hinweise,
  };
  z.kalibrierung.haelften = null;
  zuordnungAktualisieren();
}

function zuordnungAktualisieren() {
  z.fotoInfo = z.fotos.map(() => null);
  if (!z.excel || !z.fotos.length) { z.zuordnung = null; return; }
  z.zuordnung = zuordnen(z.fotos.map((f) => ({ name: f.name, qr: f.qr?.text ?? null })), z.excel);
  const merk = (liste, zeilen, blatt) => liste.forEach((fi, i) => {
    if (fi !== null && fi !== undefined && !z.fotoInfo[fi]) z.fotoInfo[fi] = { blatt, zeile: zeilen[i] };
  });
  merk(z.zuordnung.bonitur, z.excel.bonitur, 'Bonitur');
  merk(z.zuordnung.wiederholung, z.excel.wiederholung, 'Wiederholung');
  merk(z.zuordnung.lichttest, z.excel.lichttest, 'Lichttest');
}

function zuordnungHtml() {
  if (!z.excel && !z.fotos.length) return '';
  const teile = ['<div class="karte"><h2>Zuordnung Foto ↔ Excel-Zeile</h2>'];
  if (!z.excel) { teile.push('<p class="status">Excel noch nicht geladen.</p></div>'); return teile.join(''); }
  if (!z.fotos.length) { teile.push('<p class="status">Fotos noch nicht geladen.</p></div>'); return teile.join(''); }
  const zu = z.zuordnung;
  const n = (liste) => liste.filter((x) => x !== null && x !== undefined).length;
  teile.push(`<p>${z.fotos.length} Fotos · Bonitur: ${n(zu.bonitur)} von ${z.excel.bonitur.length} Zeilen zugeordnet · Wiederholung: ${n(zu.wiederholung)} von ${z.excel.wiederholung.length} · Lichttest: ${n(zu.lichttest)} von ${z.excel.lichttest.length}</p>`);
  const block = (titel, liste, offen = false, klasse = '') => (liste.length
    ? `<details class="probleme" ${offen ? 'open' : ''}><summary class="${klasse}">${titel} (${liste.length})</summary><ul class="liste-probleme">${liste.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : '');
  const p = zu.probleme;
  const fehler = [...z.excel.fehler];
  if (!fehler.length && !p.zeilenOhneFoto.length && !p.doppelt.length) teile.push('<p class="status gut">Jede Excel-Zeile hat ihr Foto.</p>');
  teile.push(block('Fehler in der Excel-Datei', fehler, true, 'nein'));
  teile.push(block('Zeilen ohne Foto', p.zeilenOhneFoto, true, 'nein'));
  teile.push(block('Doppelte Einträge', p.doppelt, true, 'nein'));
  teile.push(block('Fotos ohne Zeile (z. B. wiederholte Aufnahmen – dürfen ignoriert werden)', p.fotosOhneZeile));
  teile.push(block('Per QR-Code zugeordnet (foto_datei war leer)', p.perQr));
  teile.push(block('Hinweise', [...p.hinweise, ...z.excel.hinweise]));
  teile.push('</div>');
  return teile.join('');
}

function renderLaden() {
  const ordner = new Set(z.fotos.map((f) => f.pfad.split('/').slice(0, -1).join('/')).filter(Boolean));
  $('#status-fotos').textContent = z.fotos.length ? `${z.fotos.length} Fotos geladen${ordner.size ? ` (aus ${ordner.size} Ordner${ordner.size > 1 ? 'n' : ''})` : ''}.` : 'Noch keine Fotos.';
  $('#status-fotos').className = `status${z.fotos.length ? ' gut' : ''}`;
  if (z.excel) {
    $('#status-excel').textContent = `${z.excel.name}: Bonitur ${z.excel.bonitur.length} Zeilen, Wiederholung ${z.excel.wiederholung.length}, Lichttest ${z.excel.lichttest.length}.`;
    $('#status-excel').className = `status ${z.excel.fehler.length ? 'schlecht' : 'gut'}`;
  }
  $('#status-einstellungen').textContent = `Aktiv: Einstellungen ${z.einst.kennung}${z.einst.geaendert ? ` vom ${z.einst.geaendert.slice(0, 10)}` : ''}${z.demo ? ' (Demo)' : ''}.`;
  $('#zuordnung-laden').innerHTML = zuordnungHtml();
}

// Einstellungsdatei laden (Schritt 1 und 2)
$$('.eingabe-einstellungen').forEach((eingabe) => eingabe.addEventListener('change', async (e) => {
  const d = e.target.files[0];
  e.target.value = '';
  if (!d) return;
  try {
    const neu = einstellungenErgaenzen(JSON.parse(await d.text()));
    const fehler = einstellungenPruefen(neu);
    if (fehler.length) { melden(`Einstellungsdatei fehlerhaft: ${fehler.join(' ')}`, true); return; }
    z.einst = neu; z.gespeichertJson = vergleichsteil(neu);
    speichernLokal(); excelAufbereiten(); neuBerechnen();
    einrichtung?.zeichnen();
    render();
    melden(`Einstellungen ${neu.kennung} geladen.`);
  } catch (f) { melden(`Einstellungsdatei konnte nicht gelesen werden: ${f.message}`, true); }
}));

// ---------- Demo ----------

$('#knopf-demo').addEventListener('click', async () => {
  const knopf = $('#knopf-demo');
  knopf.disabled = true;
  const balken = $('#demo-fortschritt'); balken.hidden = false;
  const plan = demoPlan(40);
  const demoPool = new ArbeiterPool(demoArbeiterErzeugen, Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1)));
  let fertig = 0;
  $('#status-demo').textContent = `Erzeuge ${plan.length} Fotos …`;
  try {
    const antworten = await Promise.all(plan.map((p) => demoPool.auftrag({ szene: p.szene }).then((r) => {
      fertig++; balken.firstElementChild.style.width = `${(100 * fertig) / plan.length}%`;
      $('#status-demo').textContent = `Erzeuge Fotos … ${fertig} von ${plan.length}`;
      return r;
    })));
    const fotos = plan.map((p, i) => ({ ...p, wahrheit: antworten[i].wahrheit }));
    if (!z.demo) z.einstVorDemo = z.einst;
    const e0 = antworten[0].einstellungen;
    z.demo = true;
    z.einst = einstellungenErgaenzen({
      ...standardEinstellungen(), notiz: 'Demo',
      farbkarte: { ecken: e0.farbkarte.ecken },
      auswertekreis: e0.auswertekreis,
      etikettbereich: e0.etikettbereich,
      massstab: { pixel_pro_cm2: 1250 },
    });
    z.gespeichertJson = vergleichsteil(z.einst);
    const tabellen = demoBonitur(fotos, z.einst.notenskala);
    const xlsx = arbeitsmappeSchreiben(Object.entries(DEMO_SPALTEN).map(([name, spalten]) => ({ name, spalten, zeilen: tabellen[name.toLowerCase()] })));
    z.demoExcel = xlsx;
    fotosSetzen(plan.map((p, i) => new File([antworten[i].blob], p.name, { type: 'image/jpeg' })), { demo: true });
    await excelLadenAusBytes(xlsx, 'demo_pilot_bonitur.xlsx');
    $('#status-demo').innerHTML = `Fertig: ${plan.length} Fotos und <a href="#" id="demo-excel">demo_pilot_bonitur.xlsx</a> (zum Ansehen herunterladen). Die Einrichtung ist für die Demo schon gesetzt – weiter mit <b>Schritt 3 „Auswerten“</b>.`;
    $('#demo-excel').addEventListener('click', (ev) => { ev.preventDefault(); herunterladen(z.demoExcel, 'demo_pilot_bonitur.xlsx'); });
  } catch (f) {
    melden(`Demo fehlgeschlagen: ${f.message}`, true);
    $('#status-demo').textContent = '';
  } finally {
    demoPool.beenden(); knopf.disabled = false; balken.hidden = true;
  }
});

// ---------- 2 Einrichten ----------

let einrichtung = null;
function einrichtenZeigen() {
  if (!einrichtung) {
    einrichtung = new Einrichtung({
      leinwand: $('#leinwand'), lupe: $('#lupe'), anleitung: $('#anleitung'),
      einstellungen: () => z.einst,
      setzen: (aenderung, art) => einstellungenSetzen(aenderung, art),
      pool, melden,
      statusKarte: () => renderEinrichtenStatus(),
    });
  }
  const sel = $('#einrichten-foto');
  const alt = sel.value;
  sel.innerHTML = z.fotos.map((f, i) => `<option value="${i}">${esc(f.name)}</option>`).join('');
  if (z.fotos.length) {
    sel.value = alt && Number(alt) < z.fotos.length ? alt : '0';
    const f = z.fotos[Number(sel.value)];
    if (einrichtung.datei !== f.datei) einrichtung.fotoZeigen(f.datei);
    else einrichtung.zeichnen();
  } else einrichtung.fotoZeigen(null);
}
$('#einrichten-foto').addEventListener('change', (e) => einrichtung?.fotoZeigen(z.fotos[Number(e.target.value)]?.datei));
function fotoBlaettern(d) {
  const sel = $('#einrichten-foto');
  if (!z.fotos.length) return;
  sel.value = String((Number(sel.value) + d + z.fotos.length) % z.fotos.length);
  einrichtung?.fotoZeigen(z.fotos[Number(sel.value)].datei);
}
$('#foto-zurueck').addEventListener('click', () => fotoBlaettern(-1));
$('#foto-vor').addEventListener('click', () => fotoBlaettern(1));
$$('.knopf.modus').forEach((b) => b.addEventListener('click', () => {
  $$('.knopf.modus').forEach((x) => x.classList.toggle('aktiv', x === b));
  einrichtung?.modusSetzen(b.dataset.modus);
}));
$('#eingabe-massstab').addEventListener('change', (e) => {
  const d = e.target.files[0];
  if (!d) return;
  $$('.knopf.modus').forEach((x) => x.classList.toggle('aktiv', x.dataset.modus === 'massstab'));
  einrichtung?.massstabFotoZeigen(d);
});

function einstellungenSetzen(aenderung, art) {
  aenderung(z.einst);
  speichernLokal();
  neuBerechnen();
  renderEinrichtenStatus();
  renderVersion();
  if (art === 'geometrie' && z.ausgewertetMit) melden('Einrichtung geändert – die Fotos müssen neu ausgewertet werden (Schritt 3).');
}

function renderEinrichtenStatus() {
  const e = z.einst;
  const karte = einrichtung?.kartenErgebnis;
  const sk = $('#status-karte');
  if (e.farbkarte?.ecken) {
    if (karte) {
      const de = karte.deltaE_mittel;
      sk.textContent = `Gesetzt. ΔE im Mittel ${fmt(de)}, größtes ${fmt(karte.deltaE_max)}${karte.reihenfolgeKorrigiert ? ' · Reihenfolge korrigiert' : ''}.`;
      sk.className = `status ${de <= 3 ? 'gut' : de <= e.qualitaet.delta_e_warnung ? 'warn' : 'schlecht'}`;
    } else { sk.textContent = 'Gesetzt.'; sk.className = 'status gut'; }
  } else { sk.textContent = 'Nicht eingestellt.'; sk.className = 'status'; }
  const k = e.auswertekreis;
  $('#status-kreis').textContent = k ? `Mitte ${fmt(k.cx * 100, 1)} % / ${fmt(k.cy * 100, 1)} %, Radius ${fmt(k.r * 100, 1)} % der Bildbreite.` : 'Nicht eingestellt (Standard: Bildmitte).';
  $('#status-kreis').className = `status${k ? ' gut' : ''}`;
  const t = e.etikettbereich;
  $('#status-etikett').textContent = t ? 'Gesetzt.' : 'Nicht eingestellt (QR wird im ganzen Bild gesucht).';
  $('#status-etikett').className = `status${t ? ' gut' : ''}`;
  const m = e.massstab?.pixel_pro_cm2;
  $('#status-massstab').textContent = m ? `${fmt(m, 0)} Pixel je cm²${e.massstab.quelle ? ` (aus ${e.massstab.quelle})` : ''}.` : 'Nicht eingestellt – Fläche nur in Pixeln.';
  $('#status-massstab').className = `status${m ? ' gut' : ''}`;
  $('#status-kennung').textContent = `Kennung ${e.kennung}${istGeaendert() ? ` – geändert: ${geaenderteTeile().join(', ')}. Beim Speichern entsteht ${naechsteKennung(e.kennung, 'W')}.` : ' – unverändert.'}`;
  // Mini-Farbkarte in der Hilfe
  const g = $('#hilfe-felder');
  if (g && !g.childElementCount) {
    const farben = ['#735244', '#c29682', '#627a9d', '#576c43', '#8580b1', '#67bdaa', '#d67e2c', '#505ba6', '#c15a63', '#5e3c6c', '#9dbc40', '#e0a32e', '#383d96', '#469449', '#af363c', '#e7c71f', '#bb5695', '#0885a1', '#f3f3f2', '#c8c8c8', '#a0a0a0', '#7a7a79', '#555555', '#343434'];
    g.innerHTML = farben.map((c, i) => `<rect x="${8 + (i % 6) * 18}" y="${8 + Math.floor(i / 6) * 17}" width="15" height="14" fill="${c}"/>`).join('');
  }
}

function einstellungenAlsDatei() {
  const e = structuredClone(z.einst);
  if (istGeaendert()) {
    const teile = geaenderteTeile();
    const grund = window.prompt(`Neue Kennung ${naechsteKennung(e.kennung, 'W')} – geändert: ${teile.join(', ')}.\nKurzer Grund (fürs Änderungsprotokoll):`, '') ?? '';
    e.kennung = naechsteKennung(e.kennung, 'W');
    e.aenderungen = [...(e.aenderungen || []), { datum: new Date().toISOString(), kennung: e.kennung, wo: 'Werkstatt', was: teile.join(', '), grund }];
  }
  e.geaendert = new Date().toISOString();
  e.algorithmus_version = ALGORITHMUS_VERSION;
  z.einst = e; z.gespeichertJson = vergleichsteil(e);
  speichernLokal(); neuBerechnen(); render();
  herunterladen(JSON.stringify(e, null, 2), `bonitur-einstellungen_${e.kennung}.json`, 'application/json');
}
$('#knopf-einstellungen-speichern').addEventListener('click', einstellungenAlsDatei);
$('#knopf-einstellungen-export').addEventListener('click', einstellungenAlsDatei);

// ---------- 3 Auswerten ----------

async function alleAuswerten({ nurKontrollbilder = false } = {}) {
  if (!z.fotos.length) { melden('Erst Fotos laden (Schritt 1).', true); return; }
  if (!nurKontrollbilder && (!z.einst.farbkarte?.ecken || !z.einst.auswertekreis)
    && !window.confirm('Farbkarte oder Topfkreis sind noch nicht eingestellt (Schritt 2). Trotzdem auswerten?')) return;
  const knopf = $('#knopf-auswerten'); knopf.disabled = true;
  const balken = $('#auswerten-fortschritt'); balken.hidden = false;
  const status = $('#status-auswerten');
  const einst = structuredClone(z.einst);
  const qr = $('#qr-lesen').checked;
  let fertig = 0; const start = performance.now();
  try {
    await Promise.all(z.fotos.map(async (f) => {
      try {
        const r = await pool.auftrag({
          typ: 'analysieren', datei: f.datei, einstellungen: einst,
          optionen: { histogramm: true, kontrollbild: 1200, kontrollbildKlein: 360, qr: qr && !nurKontrollbilder },
        });
        f.roh = r.ergebnis; f.hist = r.hist; f.basis = r.ergebnis.basis; f.fehler = null;
        if (!nurKontrollbilder) f.qr = r.qr;
        if (f.kontrolleKleinUrl) URL.revokeObjectURL(f.kontrolleKleinUrl);
        f.kontrolle = r.kontrollbild; f.kontrolleKleinUrl = URL.createObjectURL(r.kontrollbildKlein);
      } catch (fehler) { f.fehler = fehler.message; }
      fertig++;
      const sek = (performance.now() - start) / 1000;
      const rest = (sek / fertig) * (z.fotos.length - fertig);
      balken.firstElementChild.style.width = `${(100 * fertig) / z.fotos.length}%`;
      status.textContent = `${fertig} von ${z.fotos.length} Fotos ausgewertet … noch ca. ${Math.ceil(rest)} s`;
    }));
    z.ausgewertetMit = geometrieSchluessel(einst);
    z.schwellenKontrollbild = JSON.stringify(einst.schwellen);
    zuordnungAktualisieren();
    neuBerechnen();
    const sek = (performance.now() - start) / 1000;
    melden(`Fertig: ${z.fotos.length} Fotos in ${fmt(sek, 0)} s.`);
  } finally {
    knopf.disabled = false; balken.hidden = true; render();
  }
}
$('#knopf-auswerten').addEventListener('click', () => alleAuswerten());
$('#knopf-neu-berechnen').addEventListener('click', () => alleAuswerten({ nurKontrollbilder: true }));

function renderAuswerten() {
  const ausgewertet = z.fotos.filter((f) => f.ergebnis);
  const status = $('#status-auswerten');
  if (!ausgewertet.length) { status.textContent = z.fotos.length ? `${z.fotos.length} Fotos bereit.` : 'Erst Fotos laden (Schritt 1).'; }
  else {
    const warn = ausgewertet.filter((f) => f.ergebnis.warnungen.length).length;
    const fehler = z.fotos.filter((f) => f.fehler).length;
    const qr = z.fotos.filter((f) => f.qr).length;
    const dauer = mittelwert(ausgewertet.map((f) => f.roh?.dauer_ms));
    status.innerHTML = `${ausgewertet.length} Fotos ausgewertet · ${warn} mit Warnung · ${fehler} Fehler · QR gelesen: ${qr} · im Mittel ${fmt(dauer / 1000, 1)} s je Foto und Worker.${veraltet() ? ' <span class="nein">Die Einrichtung wurde danach geändert – bitte neu auswerten.</span>' : ''}`;
    status.className = 'status';
  }
  $('#zuordnung-auswerten').innerHTML = zuordnungHtml();
}

// ---------- Neuberechnung (Regler) ----------

function neuBerechnen() {
  for (const f of z.fotos) {
    if (!f.hist || !f.basis) { f.ergebnis = null; continue; }
    const anzahl = auszaehlen(f.hist, z.einst.schwellen);
    if (!anzahl) continue;
    f.ergebnis = { ...kennzahlen(anzahl, f.basis, z.einst), exif: f.roh?.exif, dauer_ms: f.roh?.dauer_ms, groesse: f.roh?.groesse };
  }
  if (z.excel && z.zuordnung && z.fotos.some((f) => f.ergebnis)) {
    const ergebnisse = z.fotos.map((f) => f.ergebnis);
    const ausgeschlossen = new Set(z.fotos.map((f, i) => (f.aus ? i : -1)).filter((i) => i >= 0));
    if (z.kalibrierung.an && !z.kalibrierung.haelften) z.kalibrierung.haelften = haelftenBilden(z.excel.bonitur.map((r) => r.topf_nr));
    const auswahl = z.kalibrierung.an ? z.kalibrierung.haelften.uebung : null;
    z.kz = kennzahlenBerechnen(z.excel, z.zuordnung, ergebnisse, z.einst.notenskala, { ausgeschlossen, auswahl });
    z.urteil = entscheidung(z.kz, z.optionen);
  } else { z.kz = null; z.urteil = null; }
}

// ---------- 4 Kontrollbilder ----------

function menschNote(fi) {
  const info = z.fotoInfo[fi];
  if (!info || info.blatt !== 'Bonitur') return null;
  return mittelwert([info.zeile.note_A, info.zeile.note_B]);
}

function topfVon(fi) {
  return z.fotoInfo[fi]?.zeile?.topf_nr || z.fotos[fi].qr?.text || '';
}

function gefilterteListe() {
  const alle = z.fotos.map((f, i) => i).filter((i) => z.fotos[i].ergebnis || z.fotos[i].fehler);
  switch (z.filter) {
    case 'warnung': return alle.filter((i) => z.fotos[i].fehler || z.fotos[i].ergebnis?.warnungen.length);
    case 'ausgeschlossen': return alle.filter((i) => z.fotos[i].aus);
    case 'abweichung': return alle.filter((i) => Number.isFinite(menschNote(i)) && z.fotos[i].ergebnis)
      .sort((a, b) => Math.abs(z.fotos[b].ergebnis.note_app - menschNote(b)) - Math.abs(z.fotos[a].ergebnis.note_app - menschNote(a))).slice(0, 40);
    case 'zufall': {
      if (!z.zufallsListe) {
        const kand = alle.filter((i) => z.fotoInfo[i]?.blatt === 'Bonitur');
        z.zufallsListe = kand.sort(() => Math.random() - 0.5).slice(0, 20);
      }
      return z.zufallsListe;
    }
    default: return alle;
  }
}

function renderKontrolle() {
  const liste = gefilterteListe();
  $('#status-kontrolle').textContent = `${liste.length} Fotos`;
  $('#hinweis-veraltet').hidden = !(z.schwellenKontrollbild && z.schwellenKontrollbild !== JSON.stringify(z.einst.schwellen));
  if (!z.fotos.some((f) => f.ergebnis)) { $('#raster').innerHTML = '<p class="status">Noch nichts ausgewertet (Schritt 3).</p>'; return; }
  $('#raster').innerHTML = liste.map((i) => {
    const f = z.fotos[i]; const e = f.ergebnis;
    const m = menschNote(i);
    const warn = f.fehler ? [f.fehler] : (e?.warnungen || []);
    return `<div class="kachel${warn.length ? ' warnung' : ''}${f.aus ? ' aus' : ''}" data-i="${i}">
      ${f.kontrolleKleinUrl ? `<img loading="lazy" src="${f.kontrolleKleinUrl}" alt="">` : '<img alt="">'}
      <div class="text"><b>${esc(topfVon(i) || f.name)}</b> · ${esc(f.name)}<br>
      ${e ? `Befall ${fmt(e.befall_pct)} % · Note ${e.note_app ?? '–'}${Number.isFinite(m) ? ` · Mensch ${fmt(m, 1)}` : ''}` : ''}
      ${warn.length ? `<br><span class="marke-warn">${esc(warn.join('; '))}</span>` : ''}${f.aus ? `<br>Ausgeschlossen${f.grund ? `: ${esc(f.grund)}` : ''}` : ''}</div></div>`;
  }).join('');
}
$$('.knopf.filter').forEach((b) => b.addEventListener('click', () => {
  $$('.knopf.filter').forEach((x) => x.classList.toggle('aktiv', x === b));
  z.filter = b.dataset.filter;
  if (z.filter === 'zufall') z.zufallsListe = null;
  renderKontrolle();
}));
$('#raster').addEventListener('click', (e) => {
  const k = e.target.closest('.kachel');
  if (k) detailOeffnen(Number(k.dataset.i), gefilterteListe());
});

// Detailansicht
let detailTimer = null;
function detailOeffnen(i, liste) {
  if (z.detail?.originalUrl) URL.revokeObjectURL(z.detail.originalUrl);
  if (z.detail?.kontrollUrl) URL.revokeObjectURL(z.detail.kontrollUrl);
  const f = z.fotos[i];
  z.detail = { i, liste: liste.includes(i) ? liste : [i], originalUrl: URL.createObjectURL(f.datei), kontrollUrl: null };
  $('#detail').hidden = false;
  $('#detail-titel').textContent = `${topfVon(i) ? `${topfVon(i)} · ` : ''}${f.name}`;
  $('#detail-original').src = z.detail.originalUrl;
  $('#detail-kontrolle').src = f.kontrolleKleinUrl || '';
  detailZahlen();
  detailKontrollbild();
}
function detailKontrollbild() {
  clearTimeout(detailTimer);
  detailTimer = setTimeout(async () => {
    const d = z.detail; if (!d) return;
    const f = z.fotos[d.i];
    $('#detail-kontrolle-text').textContent = 'Kontrollbild wird mit den aktuellen Reglern berechnet …';
    try {
      const r = await pool.auftrag({ typ: 'analysieren', datei: f.datei, einstellungen: z.einst, optionen: { kontrollbild: 1600 } });
      if (z.detail !== d) return;
      if (d.kontrollUrl) URL.revokeObjectURL(d.kontrollUrl);
      d.kontrollUrl = URL.createObjectURL(r.kontrollbild);
      $('#detail-kontrolle').src = d.kontrollUrl;
      $('#detail-kontrolle-text').textContent = 'Kontrollbild (aktuelle Regler): grün = gesund, gelb = Aufhellung, rot = braun, hellblau = Glanzlicht';
    } catch (fehler) { $('#detail-kontrolle-text').textContent = `Fehler: ${fehler.message}`; }
  }, 200);
}
function detailZahlen() {
  const d = z.detail; const f = z.fotos[d.i]; const e = f.ergebnis;
  const info = z.fotoInfo[d.i];
  const zeile = info?.zeile;
  const links = e ? `<table class="tab"><tbody>
    <tr><th>Befall %</th><td class="zahl"><b>${fmt(e.befall_pct)} %</b></td></tr>
    <tr><th>grün / gelb / braun</th><td class="zahl">${fmt(e.gruen_pct)} / ${fmt(e.gelb_pct)} / ${fmt(e.braun_pct)} %</td></tr>
    <tr><th>Note App</th><td class="zahl"><b>${e.note_app ?? '–'}</b></td></tr>
    <tr><th>Fläche</th><td class="zahl">${e.flaeche_px.toLocaleString('de-DE')} px${e.flaeche_cm2_ca ? ` · ca. ${e.flaeche_cm2_ca} cm²` : ''}</td></tr>
    <tr><th>Grünwert</th><td class="zahl">${fmt(e.gruenwert)}°</td></tr>
    <tr><th>Farbkarte ΔE</th><td class="zahl">${fmt(e.farbkarte_delta_e, 2)}</td></tr>
    <tr><th>Qualität</th><td>${e.warnungen.length ? `<span class="nein">${esc(e.warnungen.join('; '))}</span>` : '<span class="ok">ok</span>'}</td></tr>
    <tr><th>QR-Code</th><td>${f.qr ? esc(f.qr.text) : '–'}</td></tr>
    <tr><th>Version</th><td>${esc(e.algorithmus_version)}</td></tr></tbody></table>` : `<p class="nein">${esc(f.fehler || 'Noch nicht ausgewertet.')}</p>`;
  const rechts = `<table class="tab"><tbody>
    <tr><th>Excel</th><td>${info ? `${info.blatt}, Zeile ${zeile.excelZeile}` : 'keiner Zeile zugeordnet'}</td></tr>
    ${zeile && info.blatt === 'Bonitur' ? `<tr><th>Note A / B</th><td>${zeile.note_A ?? '–'} / ${zeile.note_B ?? '–'}</td></tr>
    <tr><th>Befall % A / B</th><td>${zeile.prozent_A ?? '–'} / ${zeile.prozent_B ?? '–'}</td></tr>
    <tr><th>Sporen unten</th><td>${zeile.sporen_unten === null ? '–' : zeile.sporen_unten ? 'ja' : 'nein'}</td></tr>
    <tr><th>Sorte / Satz / Behandlung</th><td>${esc([zeile.sorte, zeile.satz, zeile.behandlung].filter((x) => x !== null && x !== undefined).join(' / '))}</td></tr>
    <tr><th>Bemerkung</th><td>${esc(zeile.bemerkung || '')}</td></tr>` : ''}
    <tr><th>Ausschließen</th><td><label class="haken"><input type="checkbox" id="detail-aus" ${f.aus ? 'checked' : ''}> nicht mitzählen</label>
    <input type="text" id="detail-grund" placeholder="Grund, z. B. unscharf" value="${esc(f.grund)}" style="width:100%;margin-top:4px"></td></tr></tbody></table>`;
  $('#detail-zahlen').innerHTML = `<div>${links}</div><div>${rechts}</div>`;
  $('#detail-aus').addEventListener('change', (ev) => { f.aus = ev.target.checked; neuBerechnen(); renderKontrolle(); });
  $('#detail-grund').addEventListener('input', (ev) => { f.grund = ev.target.value; });
}
function detailBlaettern(d) {
  const dd = z.detail; if (!dd) return;
  const pos = dd.liste.indexOf(dd.i);
  const n = dd.liste[(pos + d + dd.liste.length) % dd.liste.length];
  detailOeffnen(n, dd.liste);
}
$('#detail-zu').addEventListener('click', () => { $('#detail').hidden = true; render(); });
$('#detail-vor').addEventListener('click', () => detailBlaettern(1));
$('#detail-zurueck').addEventListener('click', () => detailBlaettern(-1));
document.addEventListener('keydown', (e) => {
  if ($('#detail').hidden) return;
  if (e.key === 'Escape') { $('#detail').hidden = true; render(); }
  if (e.key === 'ArrowRight') detailBlaettern(1);
  if (e.key === 'ArrowLeft') detailBlaettern(-1);
});

// ---------- 5 Ergebnis ----------

const REGLER = [
  { key: 'gelb_gruen', name: 'Grenze gelb/grün', einheit: '°', min: 40, max: 120, schritt: 1 },
  { key: 'braun_gelb', name: 'Grenze braun/gelb', einheit: '°', min: 15, max: 80, schritt: 1 },
  { key: 'h_min', name: 'Farbton-Untergrenze Pflanze', einheit: '°', min: BEREICHE.farbton.min, max: 40, schritt: 1 },
  { key: 'h_max', name: 'Farbton-Obergrenze Pflanze', einheit: '°', min: 120, max: BEREICHE.farbton.max, schritt: 1 },
  { key: 's_min', name: 'Mindest-Sättigung S', einheit: '%', min: BEREICHE.saettigung.min, max: BEREICHE.saettigung.max, schritt: BEREICHE.saettigung.schritt },
  { key: 'v_min', name: 'Mindest-Helligkeit V', einheit: '%', min: BEREICHE.helligkeit.min, max: BEREICHE.helligkeit.max, schritt: 1 },
];

let reglerGebaut = false;
function reglerAufbauen() {
  const r = $('#regler');
  r.innerHTML = `<h2>Stellschrauben</h2><p class="vorschlag">Wirken sofort auf alle Zahlen. Wenige Regler, runde Werte, nur mit Begründung aus den Kontrollbildern (Leitfaden 8.6).</p>
    <h3>Maske und Farbklassen</h3>
    ${REGLER.map((g) => `<label for="r-${g.key}">${g.name}<span class="wert" id="w-${g.key}"></span></label>
      <input type="range" id="r-${g.key}" data-key="${g.key}" min="${g.min}" max="${g.max}" step="${g.schritt}">`).join('')}
    <h3>Notengrenzen (Befall %)</h3><div class="grenzen" id="grenzen"></div>
    <div class="knoepfe" style="margin-top:10px"><button class="knopf" id="knopf-vorschlag">Grenzen vorschlagen</button><button class="knopf" id="knopf-start">Startwerte</button></div>
    <div id="vorschlag"></div>`;
  REGLER.forEach((g) => $(`#r-${g.key}`).addEventListener('input', (e) => reglerGeaendert(g, Number(e.target.value))));
  $('#knopf-vorschlag').addEventListener('click', grenzenVorschlagen);
  $('#knopf-start').addEventListener('click', () => {
    if (!window.confirm('Alle Schwellen und Notengrenzen auf die Startwerte zurücksetzen?')) return;
    const s = standardEinstellungen();
    z.einst.schwellen = s.schwellen; z.einst.notenskala = { ...z.einst.notenskala, grenzen: s.notenskala.grenzen.slice(0, z.einst.notenskala.grenzen.length) };
    nachRegler();
  });
  reglerGebaut = true;
}

function reglerGeaendert(g, wert) {
  const s = z.einst.schwellen;
  const grenzen = {
    h_min: [BEREICHE.farbton.min, s.braun_gelb], braun_gelb: [s.h_min, s.gelb_gruen],
    gelb_gruen: [s.braun_gelb, s.h_max + 1], h_max: [s.gelb_gruen - 1, BEREICHE.farbton.max],
  };
  if (grenzen[g.key]) wert = Math.min(grenzen[g.key][1], Math.max(grenzen[g.key][0], wert));
  s[g.key] = wert;
  nachRegler();
}

function nachRegler() {
  speichernLokal();
  neuBerechnen();
  renderErgebnis();
  renderVersion();
  if (z.detail && !$('#detail').hidden) { detailZahlen(); detailKontrollbild(); }
}

function reglerWerteZeigen() {
  const s = z.einst.schwellen;
  REGLER.forEach((g) => { $(`#r-${g.key}`).value = s[g.key]; $(`#w-${g.key}`).textContent = `${s[g.key]} ${g.einheit}`; });
  const n = z.einst.notenskala;
  $('#grenzen').innerHTML = n.grenzen.map((gr, i) => `<label>${n.noten[i]} | ${n.noten[i + 1]}<input type="number" step="0.5" min="0" max="100" data-i="${i}" value="${gr}"></label>`).join('');
  $$('#grenzen input').forEach((inp) => inp.addEventListener('change', (e) => {
    const i = Number(e.target.dataset.i); const w = Number(String(e.target.value).replace(',', '.'));
    const neu = [...z.einst.notenskala.grenzen]; neu[i] = w;
    if (neu.some((x, k) => !Number.isFinite(x) || (k > 0 && x <= neu[k - 1]))) { melden('Die Grenzen müssen aufsteigend sein.', true); reglerWerteZeigen(); return; }
    z.einst.notenskala = { ...z.einst.notenskala, grenzen: neu };
    nachRegler();
  }));
}

function grenzenVorschlagen() {
  if (!z.kz?.paare.length) { melden('Erst auswerten und Excel laden.', true); return; }
  const p = z.kz.paare;
  const v = notengrenzenVorschlagen(p.map((x) => x.befall), p.map((x) => x.zeile.note_A), p.map((x) => x.zeile.note_B), z.einst.notenskala);
  $('#vorschlag').innerHTML = `<div class="hinweis"><b>Vorschlag:</b> ${v.grenzen.map((g) => fmt(g, 1)).join(' · ')} %<br>Kappa App–Menschen damit: ${fmt(v.kappa, 2)} (jetzt ${fmt(z.kz.kappaAppMittel, 2)}).<br><span class="vorschlag">Gefahr der Selbsttäuschung: Die Grenzen passen dann genau zu diesen Töpfen. Runde Werte wählen und in Etappe 6 mit neuen Töpfen prüfen.</span><br><button class="knopf" id="vorschlag-uebernehmen" style="margin-top:6px">Übernehmen</button></div>`;
  $('#vorschlag-uebernehmen').addEventListener('click', () => {
    z.einst.notenskala = { ...z.einst.notenskala, grenzen: v.grenzen };
    $('#vorschlag').innerHTML = '';
    nachRegler();
  });
}

function renderErgebnis() {
  if (!reglerGebaut) reglerAufbauen();
  reglerWerteZeigen();
  const kz = z.kz;
  if (!kz) {
    $('#entscheidung').innerHTML = '<h2>Entscheidung</h2><p class="status">Dafür braucht es ausgewertete Fotos (Schritt 3) und die Bonitur-Excel (Schritt 1).</p>';
    ['#streudiagramm', '#kennzahlen', '#wiederholbarkeit', '#lichttest'].forEach((s) => { $(s).innerHTML = ''; });
    renderKalibrierung();
    return;
  }
  const u = z.urteil;
  $('#entscheidung').innerHTML = `<h2>Entscheidung${z.kalibrierung.an ? ' (Übungshälfte)' : ''}</h2>
    <div class="urteil"><span class="stempel ${u.ergebnis}">${u.ergebnis}</span><div>${esc(u.begruendung)}<br><span class="vorschlag">Vorschlag nach Leitfaden Tabelle 8.2 – du entscheidest. ${kz.n} Töpfe ausgewertet.</span></div></div>
    <table class="tab"><thead><tr><th>Bedingung für GO</th><th class="zahl">Wert</th><th>Ziel</th><th></th></tr></thead><tbody>
    ${u.kriterien.map((k, i) => `<tr><td>${k.name}</td><td class="zahl">${i === 3 ? proz(k.wert) : i === 1 ? `A–B: ${fmt(k.wert, 2)}` : fmt(k.wert, 2)}</td><td>${k.ziel}</td><td class="${k.erfuellt ? 'ok' : 'nein'}">${k.erfuellt ? '✓' : '✗'}</td></tr>`).join('')}
    <tr><td>Unsichtbarer Befall (Sporen unten, App unter 1 %)</td><td class="zahl">${kz.unsichtbar.anzahl} von ${kz.unsichtbar.von}</td><td>höchstens <input type="number" id="grenze-unsichtbar" min="0" max="100" step="5" value="${Math.round(z.optionen.grenzeUnsichtbar * 100)}" style="width:58px"> %</td><td class="${u.unsichtbarZuViel ? 'nein' : 'ok'}">${u.unsichtbarZuViel ? '✗' : '✓'}</td></tr>
    </tbody></table>
    <label class="haken" style="margin-top:8px"><input type="checkbox" id="nachgebessert" ${z.optionen.nachgebessert ? 'checked' : ''}> Das ist schon der Durchgang nach dem Nachbessern (dann führt Kappa unter 0,4 zu NO-GO)</label>`;
  $('#grenze-unsichtbar').addEventListener('change', (e) => { z.optionen.grenzeUnsichtbar = Number(e.target.value) / 100; neuBerechnen(); renderErgebnis(); });
  $('#nachgebessert').addEventListener('change', (e) => { z.optionen.nachgebessert = e.target.checked; neuBerechnen(); renderErgebnis(); });

  const punkte = kz.paare.map((p) => ({ id: p.fi, topf: p.zeile.topf_nr, x: mittelwert([p.zeile.note_A, p.zeile.note_B]), befall: p.befall, appNote: p.note }));
  $('#streudiagramm').innerHTML = streudiagramm(punkte, z.einst.notenskala)
    + `<p class="vorschlag">Ein Punkt je Topf. Klick auf einen Punkt öffnet das Kontrollbild. Notengrenzen: ${notenBeschreibung(z.einst.notenskala).map((x) => `${x.note}: ${x.text}`).join(' · ')}</p>`;

  const zeilen = [
    ['Töpfe (Bonitur mit Foto)', kz.n],
    ['Kappa Person A – Person B', fmt(kz.kappaAB, 2)],
    ['Kappa App – Person A', fmt(kz.kappaAppA, 2)],
    ['Kappa App – Person B', fmt(kz.kappaAppB, 2)],
    ['Kappa App – Menschen (Mittel)', `<b>${fmt(kz.kappaAppMittel, 2)}</b>`],
    ['Rangkorrelation (Spearman) App-Befall % – Menschen-Note', fmt(kz.spearman, 2)],
    ['Farbkarte erkannt', `${proz(kz.karteAnteil)} von ${kz.fotosGesamt} Fotos`],
    ['Unsichtbarer Befall', `${kz.unsichtbar.anzahl} von ${kz.unsichtbar.von} Töpfen mit Sporen unten${kz.unsichtbar.toepfe.length ? ` (${esc(kz.unsichtbar.toepfe.join(', '))})` : ''}`],
    ['Größte Streuung Wiederholungsfotos', `${fmt(kz.streuungMax, 2)} Prozentpunkte`],
    ['Lichttest: Spanne Befall %', `${fmt(kz.lichtSpanne, 1)} Prozentpunkte`],
  ];
  $('#kennzahlen').innerHTML = `<table class="tab"><tbody>${zeilen.map(([a, b]) => `<tr><td>${a}</td><td class="zahl">${b}</td></tr>`).join('')}</tbody></table>
    <p class="vorschlag">Kappa: 0 = Zufall, 1 = perfekt; unter 0,4 schwach · 0,4–0,6 mittel · 0,6–0,8 gut · über 0,8 sehr gut (quadratisch gewichtet).</p>`;

  $('#wiederholbarkeit').innerHTML = kz.wiederholbarkeit.length
    ? `<table class="tab"><thead><tr><th>Topf</th><th>Befall % je Foto</th><th class="zahl">Mittel</th><th class="zahl">Streuung</th></tr></thead><tbody>
      ${kz.wiederholbarkeit.map((w) => `<tr><td>${esc(w.topf)}</td><td>${w.werte.map((x) => fmt(x)).join(' · ')}</td><td class="zahl">${fmt(w.mittel)}</td><td class="zahl ${w.streuung <= 2 ? 'ok' : 'nein'}">${fmt(w.streuung, 2)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="status">Keine Wiederholungsfotos zugeordnet (Blatt „Wiederholung“).</p>';
  $('#lichttest').innerHTML = kz.lichttest.length
    ? `<table class="tab"><thead><tr><th>Zeitpunkt</th><th>Hallenlicht</th><th class="zahl">Befall %</th><th class="zahl">ΔE</th></tr></thead><tbody>
      ${kz.lichttest.map((l) => `<tr><td>${esc(l.zeitpunkt)}</td><td>${esc(l.hallenlicht)}</td><td class="zahl">${fmt(l.befall)}</td><td class="zahl">${fmt(l.deltaE, 2)}</td></tr>`).join('')}</tbody></table>
      <p class="vorschlag">Spanne ${fmt(kz.lichtSpanne)} Prozentpunkte. Bleibt Befall % bei allen Lichtverhältnissen fast gleich, dichtet die Box gut ab.</p>`
    : '<p class="status">Keine Lichttest-Fotos zugeordnet (Blatt „Lichttest“).</p>';
  renderKalibrierung();
}

$('#streudiagramm').addEventListener('click', (e) => {
  const c = e.target.closest('circle[data-id]');
  if (c) detailOeffnen(Number(c.dataset.id), z.kz.paare.map((p) => p.fi));
});

// Kalibrier-Modus (Kapitel 10)
function renderKalibrierung() {
  const k = z.kalibrierung;
  const el = $('#kalibrier-karte');
  let html = `<h2>Kalibrier-Modus (Etappe 6)</h2>
    <p>Teilt die Töpfe fest in eine <b>Übungshälfte</b> (hier stellst du ein) und eine <b>Prüfhälfte</b> (einmal am Ende ansehen). So täuschst du dich nicht selbst.</p>
    <label class="haken"><input type="checkbox" id="kal-an" ${k.an ? 'checked' : ''}> Kalibrier-Modus an – alle Zahlen oben beziehen sich dann nur auf die Übungshälfte</label>`;
  if (k.an && k.haelften) {
    html += `<p class="status">Übungshälfte: ${k.haelften.uebung.size} Töpfe · Prüfhälfte: ${k.haelften.pruefung.size} Töpfe.</p>
      <button class="knopf haupt" id="kal-pruefen">Prüfhälfte auswerten (Einweg-Test)</button>`;
    if (k.pruefung) {
      const kz = k.pruefung.kz; const u = k.pruefung.urteil;
      html += `<div class="hinweis" style="margin-top:10px"><b>Prüfhälfte (angesehen am ${new Date(k.pruefung.zeit).toLocaleString('de-DE')} mit Einstellungen ${esc(k.pruefung.kennung)}):</b>
        <span class="stempel ${u.ergebnis}" style="font-size:14px;padding:2px 8px;margin-left:6px">${u.ergebnis}</span><br>
        Kappa App–Menschen ${fmt(kz.kappaAppMittel, 2)} · Kappa A–B ${fmt(kz.kappaAB, 2)} · ${kz.n} Töpfe · Farbkarte ${proz(kz.karteAnteil)}<br>
        <span class="vorschlag">Danach nicht mehr an den Reglern drehen und erneut prüfen – sonst wird die Prüfhälfte zur Übungshälfte (Leitfaden 10.3).</span></div>`;
    }
  }
  el.innerHTML = html;
  $('#kal-an').addEventListener('change', (e) => {
    k.an = e.target.checked;
    if (k.an && z.excel) k.haelften = haelftenBilden(z.excel.bonitur.map((r) => r.topf_nr));
    neuBerechnen(); renderErgebnis();
  });
  $('#kal-pruefen')?.addEventListener('click', () => {
    if (k.pruefung && !window.confirm('Die Prüfhälfte wurde schon angesehen. Wirklich noch einmal? Das ist dann keine ehrliche Prüfung mehr.')) return;
    if (!k.pruefung && !window.confirm('Die Prüfhälfte nur einmal ansehen – sind die Regler fertig eingestellt?')) return;
    const ergebnisse = z.fotos.map((f) => f.ergebnis);
    const ausgeschlossen = new Set(z.fotos.map((f, i) => (f.aus ? i : -1)).filter((i) => i >= 0));
    const kz = kennzahlenBerechnen(z.excel, z.zuordnung, ergebnisse, z.einst.notenskala, { ausgeschlossen, auswahl: k.haelften.pruefung });
    k.pruefung = { kz, urteil: entscheidung(kz, z.optionen), zeit: Date.now(), kennung: z.einst.kennung };
    renderKalibrierung();
  });
}

// ---------- 6 Speichern ----------

const ERGEBNIS_SPALTEN = ['foto_datei', 'ordner', 'blatt', 'excel_zeile', 'topf_nr', 'qr_gelesen', 'sorte', 'satz', 'behandlung',
  'note_A', 'note_B', 'note_mensch_mittel', 'prozent_A', 'prozent_B', 'sporen_unten', 'durchgang', 'zeitpunkt', 'hallenlicht',
  'flaeche_px', 'flaeche_cm2_ca', 'gruen_pct', 'gelb_pct', 'braun_pct', 'befall_pct', 'gruenwert', 'note_app', 'abweichung_note',
  'qualitaet', 'farbkarte_delta_e', 'ausgeschlossen', 'grund', 'algorithmus_version', 'handy_modell', 'aufnahme'];

function ergebnisZeilen() {
  return z.fotos.map((f, i) => {
    const info = z.fotoInfo[i]; const zl = info?.zeile || {}; const e = f.ergebnis || {};
    const m = info?.blatt === 'Bonitur' ? mittelwert([zl.note_A, zl.note_B]) : null;
    return {
      foto_datei: f.name, ordner: f.pfad.split('/').slice(0, -1).join('/'), blatt: info?.blatt || '', excel_zeile: zl.excelZeile ?? null,
      topf_nr: zl.topf_nr || null, qr_gelesen: f.qr?.text || null, sorte: zl.sorte ?? null, satz: zl.satz ?? null, behandlung: zl.behandlung ?? null,
      note_A: zl.note_A ?? null, note_B: zl.note_B ?? null, note_mensch_mittel: Number.isFinite(m) ? m : null,
      prozent_A: zl.prozent_A ?? null, prozent_B: zl.prozent_B ?? null, sporen_unten: zl.sporen_unten === undefined || zl.sporen_unten === null ? null : (zl.sporen_unten ? 'ja' : 'nein'),
      durchgang: zl.durchgang ?? null, zeitpunkt: zl.zeitpunkt ?? null, hallenlicht: zl.hallenlicht ?? null,
      flaeche_px: e.flaeche_px ?? null, flaeche_cm2_ca: e.flaeche_cm2_ca ?? null, gruen_pct: e.gruen_pct ?? null, gelb_pct: e.gelb_pct ?? null,
      braun_pct: e.braun_pct ?? null, befall_pct: e.befall_pct ?? null, gruenwert: e.gruenwert ?? null, note_app: e.note_app ?? null,
      abweichung_note: Number.isFinite(m) && Number.isFinite(e.note_app) ? runden(e.note_app - m, 1) : null,
      qualitaet: f.fehler ? `Fehler: ${f.fehler}` : (e.qualitaet ?? null), farbkarte_delta_e: e.farbkarte_delta_e ?? null,
      ausgeschlossen: f.aus ? 'ja' : null, grund: f.grund || null, algorithmus_version: e.algorithmus_version ?? null,
      handy_modell: e.exif?.modell ?? null, aufnahme: e.exif?.aufnahme ?? null,
    };
  });
}

function kennzahlenZeilen() {
  const kz = z.kz; const u = z.urteil;
  if (!kz) return [];
  return [
    ['Datum', heute()], ['Rechenweg / Einstellungen', `${ALGORITHMUS_VERSION} / ${z.einst.kennung}${istGeaendert() ? ' (ungespeicherte Änderungen)' : ''}`],
    ['Töpfe', kz.n], ['Kappa A–B', runden(kz.kappaAB, 3)], ['Kappa App–A', runden(kz.kappaAppA, 3)], ['Kappa App–B', runden(kz.kappaAppB, 3)],
    ['Kappa App–Menschen (Mittel)', runden(kz.kappaAppMittel, 3)], ['Spearman App-Befall – Menschen-Note', runden(kz.spearman, 3)],
    ['Farbkarte erkannt (Anteil)', runden(kz.karteAnteil, 3)], ['Größte Streuung Wiederholung (Prozentpunkte)', runden(kz.streuungMax, 2)],
    ['Lichttest Spanne (Prozentpunkte)', runden(kz.lichtSpanne, 1)], ['Unsichtbarer Befall', `${kz.unsichtbar.anzahl} von ${kz.unsichtbar.von}`],
    ['Vorschlag Entscheidung', u.ergebnis], ['Begründung', u.begruendung], ['Kalibrier-Modus', z.kalibrierung.an ? 'an (Übungshälfte)' : 'aus'],
  ];
}

$('#knopf-excel').addEventListener('click', () => {
  if (!z.fotos.some((f) => f.ergebnis)) { melden('Erst auswerten (Schritt 3).', true); return; }
  const blaetter = [{ name: 'Ergebnisse', spalten: ERGEBNIS_SPALTEN, zeilen: ergebnisZeilen() }];
  if (z.kz) {
    blaetter.push({ name: 'Kennzahlen', spalten: ['Kennzahl', 'Wert'], zeilen: kennzahlenZeilen(), breiten: [44, 60] });
    blaetter.push({ name: 'Wiederholung', spalten: ['topf_nr', 'werte_befall_pct', 'mittel', 'streuung'], zeilen: z.kz.wiederholbarkeit.map((w) => [w.topf, w.werte.map((x) => fmt(x)).join('; '), w.mittel, w.streuung]) });
    blaetter.push({ name: 'Lichttest', spalten: ['topf_nr', 'zeitpunkt', 'hallenlicht', 'befall_pct', 'delta_e'], zeilen: z.kz.lichttest.map((l) => [l.topf, l.zeitpunkt, l.hallenlicht, l.befall, l.deltaE]) });
  }
  const e = z.einst;
  blaetter.push({
    name: 'Einstellungen', spalten: ['Einstellung', 'Wert'], breiten: [32, 70],
    zeilen: [['Kennung', e.kennung], ['Rechenweg', ALGORITHMUS_VERSION], ...Object.entries(e.schwellen).map(([k, v]) => [`Schwelle ${k}`, v]),
      ['Notenskala', `${e.notenskala.noten.join(', ')} | Grenzen ${e.notenskala.grenzen.join(', ')}`], ['Pixel je cm²', e.massstab?.pixel_pro_cm2 ?? ''],
      ['Farbkarte (Ecken)', JSON.stringify(e.farbkarte?.ecken)], ['Topfkreis', JSON.stringify(e.auswertekreis)], ['Etikettbereich', JSON.stringify(e.etikettbereich)]],
  });
  herunterladen(arbeitsmappeSchreiben(blaetter), `werkstatt_ergebnis_${heute()}.xlsx`);
});

$('#knopf-zip').addEventListener('click', async () => {
  const mit = z.fotos.filter((f) => f.kontrolle);
  if (!mit.length) { melden('Erst auswerten (Schritt 3).', true); return; }
  if (z.schwellenKontrollbild !== JSON.stringify(z.einst.schwellen)
    && !window.confirm('Die Kontrollbilder zeigen noch die Schwellen vom Zeitpunkt der Auswertung. Trotzdem speichern? (Sonst vorher in Schritt 4 „neu berechnen“.)')) return;
  const zip = new JSZip();
  mit.forEach((f) => zip.file(`kontrollbilder/${f.name.replace(/\.jpe?g$/i, '')}_kontrolle.jpg`, f.kontrolle));
  melden('ZIP wird erstellt …');
  herunterladen(await zip.generateAsync({ type: 'blob' }), `kontrollbilder_${heute()}.zip`);
});

$('#knopf-referenz').addEventListener('click', async () => {
  if (!z.kz?.paare.length) { melden('Erst auswerten und Excel laden.', true); return; }
  const proNote = new Map();
  for (const p of z.kz.paare) {
    const n = Math.round(mittelwert([p.zeile.note_A, p.zeile.note_B]));
    if (!proNote.has(n)) proNote.set(n, []);
    proNote.get(n).push(p);
  }
  const auswahl = [];
  for (const liste of proNote.values()) {
    liste.sort((a, b) => a.befall - b.befall);
    const k = Math.min(5, liste.length);
    for (let j = 0; j < k; j++) auswahl.push(liste[Math.floor(((j + 0.5) * liste.length) / k)]);
  }
  const wieder = z.excel.wiederholung.map((r, i) => ({ r, fi: z.zuordnung.wiederholung[i] })).filter((x) => x.fi !== null && x.fi !== undefined);
  const zip = new JSZip();
  const ordner = zip.folder('referenzbilder');
  const fis = new Set([...auswahl.map((p) => p.fi), ...wieder.map((x) => x.fi)]);
  for (const fi of fis) ordner.file(z.fotos[fi].name, z.fotos[fi].datei);
  const boniturSpalten = DEMO_SPALTEN.Bonitur;
  const xlsx = arbeitsmappeSchreiben([
    { name: 'Bonitur', spalten: boniturSpalten, zeilen: auswahl.map((p) => ({ ...p.zeile, sporen_unten: p.zeile.sporen_unten === null ? null : (p.zeile.sporen_unten ? 'ja' : 'nein'), foto_datei: z.fotos[p.fi].name })) },
    { name: 'Wiederholung', spalten: DEMO_SPALTEN.Wiederholung, zeilen: wieder.map((x) => ({ ...x.r, foto_datei: z.fotos[x.fi].name })) },
  ]);
  ordner.file('referenzbilder.xlsx', xlsx);
  ordner.file('einstellungen.json', JSON.stringify(z.einst, null, 2));
  melden('Paket wird erstellt …');
  herunterladen(await zip.generateAsync({ type: 'blob' }), `referenzbilder_${heute()}.zip`);
  melden(`Referenzbilder-Paket: ${fis.size} Fotos. Entpacken und den Ordner „referenzbilder“ ins Repository hochladen (Leitfaden 6.7).`);
});

$('#knopf-text').addEventListener('click', async () => {
  const kz = z.kz;
  if (!kz) { melden('Erst auswerten und Excel laden.', true); return; }
  const w = kz.wiederholbarkeit;
  const text = [
    `Meine Ergebnisse aus der Analyse-Werkstatt (${heute()}):`,
    `- Rechenweg/Einstellungen: ${ALGORITHMUS_VERSION} / ${z.einst.kennung}`,
    `- Ausgewertete Töpfe: ${kz.n}; Fotos gesamt: ${kz.fotosGesamt}`,
    `- Kappa Person A–B: ${fmt(kz.kappaAB, 2)}`,
    `- Kappa App–A: ${fmt(kz.kappaAppA, 2)}; App–B: ${fmt(kz.kappaAppB, 2)}; Mittel: ${fmt(kz.kappaAppMittel, 2)}`,
    `- Rangkorrelation App-Befall % – Menschen-Note: ${fmt(kz.spearman, 2)}`,
    `- Streuung Wiederholungsfotos: ${w.map((x) => `${x.topf} ${fmt(x.streuung, 2)}`).join(', ') || '–'} (größte ${fmt(kz.streuungMax, 2)} Prozentpunkte)`,
    `- Lichttest: Spanne ${fmt(kz.lichtSpanne)} Prozentpunkte`,
    `- Farbkarte erkannt: ${proz(kz.karteAnteil)}`,
    `- Unsichtbarer Befall: ${kz.unsichtbar.anzahl} von ${kz.unsichtbar.von} Töpfen mit Sporen unten`,
    `- Eingestellte Schwellen: ${Object.entries(z.einst.schwellen).map(([k, v]) => `${k}=${v}`).join(', ')}`,
    `- Notengrenzen: ${z.einst.notenskala.grenzen.join(' / ')} %`,
    `- Vorschlag der Werkstatt: ${z.urteil.ergebnis} (${z.urteil.begruendung})`,
    `- Ausgeschlossene Fotos: ${z.fotos.filter((f) => f.aus).map((f) => `${f.name}${f.grund ? ` (${f.grund})` : ''}`).join(', ') || 'keine'}`,
  ].join('\n');
  const pre = $('#kennzahlen-text'); pre.textContent = text; pre.hidden = false;
  try { await navigator.clipboard.writeText(text); melden('In die Zwischenablage kopiert.'); } catch { melden('Text unten markieren und kopieren.'); }
});

// ---------- Start ----------
render();
window.addEventListener('beforeunload', (e) => {
  if (z.fotos.some((f) => f.ergebnis) && istGeaendert()) { e.preventDefault(); e.returnValue = ''; }
});
// Für automatische Tests im Browser
globalThis.werkstattZustand = z;
