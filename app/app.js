// Handy-App „Mehltau-Bonitur“ (Leitfaden Kapitel 9, Bausteine B3–B9).
// Offline-Web-App: Sitzungen, Aufnahme/Import, Analyse, Kontrollbild, Sicht-Bonitur,
// Export (Excel + ZIP), Übersicht/Verlauf/AUDPC, Einstellungen mit PIN, Kamera-Test.

import {
  standardEinstellungen, einstellungenErgaenzen, einstellungenPruefen, naechsteKennung, versionsText,
  ALGORITHMUS_VERSION, BEREICHE,
} from '../kern/einstellungen.js';
import { notenBeschreibung } from '../kern/noten.js';
import { analyseArbeiterErzeugen, ArbeiterPool } from '../kern/arbeiter.js';
import { zeitAusDateiname } from '../kern/exif.js';
import * as db from './db.js';
import {
  SITZUNGSARTEN, datumText, datumZeitText, fotoDateiname, sitzungIdBilden, messIdBilden, eindeutigerName,
  verlaufBerechnen, regelkarte, pinHash, stammdatenMischen, kurzDatum,
} from './logik.js';
import { APP_VERSION } from './version.js';
import {
  kameraStarten, kameraStoppen, kameraInfo, werteAnwenden, fotoAufnehmen,
} from './kamera.js';
import {
  sitzungsExcel, sitzungsZip, herunterladen, teilen, stammdatenExcel, stammdatenLesen,
} from './export.js';
import { Einrichtung } from '../werkstatt/einrichten.js';

const $ = (s, w = document) => w.querySelector(s);
const inhalt = $('#inhalt');
const pool = new ArbeiterPool(analyseArbeiterErzeugen, 1);

const z = {
  einst: standardEinstellungen(),
  stammdaten: { saetze: [], sorten: [], behandlungen: [], tische: [], mitarbeiter: [] },
  kamera: { modus: 'import', werte: {} },
  handy: { modell: '' },
  pin: null,
  entsperrtBis: 0,
  aktiveSitzung: null,
  warteschlange: [],
  aktuell: null,
  stromAktiv: null,
  urls: [],
};

// ---------- Hilfen ----------

function fmt(x, n = 1) {
  if (x === null || x === undefined || !Number.isFinite(Number(x))) return '–';
  return Number(x).toFixed(n).replace('.', ',');
}
function esc(t) { return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function url(blob) { const u = URL.createObjectURL(blob); z.urls.push(u); return u; }
function urlsFreigeben() { z.urls.forEach((u) => URL.revokeObjectURL(u)); z.urls = []; }

let meldungTimer;
function melden(text, fehler = false) {
  const m = $('#meldung');
  m.textContent = text; m.className = `meldung${fehler ? ' fehler' : ''}`; m.hidden = false;
  clearTimeout(meldungTimer);
  meldungTimer = setTimeout(() => { m.hidden = true; }, fehler ? 7000 : 3500);
}

// Jede Navigation bekommt eine Nummer. Eine Seite schreibt nur, solange sie die neueste ist –
// sonst könnte eine langsame ältere Seite eine schon geöffnete neue überschreiben.
let seitenNr = 0;
function seiteGilt() { const nr = seitenNr; return () => nr === seitenNr; }

/** Zu einer Seite wechseln; ist sie schon offen, neu zeichnen (verhindert doppeltes Zeichnen). */
function gehe(hash) {
  if (location.hash === hash) seiteLaden(); else location.hash = hash;
}

function titel(text, zurueck = null) {
  $('#titel').textContent = db.TESTVERSION ? `${text} · TEST` : text;
  const z0 = $('#zurueck');
  z0.hidden = !zurueck;
  z0.onclick = zurueck ? () => { location.hash = zurueck; } : null;
}

function dateiWaehlen(eingabe) {
  return new Promise((loesen) => {
    const el = $(eingabe);
    el.value = '';
    el.onchange = () => loesen([...el.files]);
    el.click();
  });
}

async function speichernKonfig() {
  await db.konfigSetzen('einstellungen', z.einst);
  await db.konfigSetzen('stammdaten', z.stammdaten);
  await db.konfigSetzen('kamera', z.kamera);
  await db.konfigSetzen('handy', z.handy);
}

function stammdatenErgaenzen(art, wert) {
  if (wert === null || wert === undefined || String(wert).trim() === '') return;
  const liste = z.stammdaten[art];
  if (!liste.includes(String(wert).trim())) liste.push(String(wert).trim());
}

function auswahl(name, liste, wert, { leer = true, neu = true } = {}) {
  const opts = [...new Set([...(liste || []), ...(wert ? [String(wert)] : [])])];
  return `<select name="${name}">${leer ? '<option value="">–</option>' : ''}${opts.map((o) => `<option ${String(o) === String(wert ?? '') ? 'selected' : ''}>${esc(o)}</option>`).join('')}${neu ? '<option value="__neu">+ neu …</option>' : ''}</select>`;
}

function neuOptionAktivieren(wurzel) {
  wurzel.querySelectorAll('select').forEach((sel) => sel.addEventListener('change', () => {
    if (sel.value !== '__neu') return;
    const t = window.prompt('Neuer Eintrag:');
    if (t && t.trim()) {
      const o = document.createElement('option'); o.textContent = t.trim(); o.selected = true;
      sel.insertBefore(o, sel.lastElementChild);
    } else sel.value = '';
  }));
}

function naechsteTopfId(letzte) {
  const m = String(letzte || '').match(/^(.*?)(\d+)$/);
  if (!m) return '';
  return `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}`;
}

// ---------- Start ----------

async function laden() {
  z.einst = einstellungenErgaenzen(await db.konfigHolen('einstellungen', standardEinstellungen()));
  z.stammdaten = { ...z.stammdaten, ...(await db.konfigHolen('stammdaten', {})) };
  z.kamera = { ...z.kamera, ...(await db.konfigHolen('kamera', {})) };
  z.handy = { ...z.handy, ...(await db.konfigHolen('handy', {})) };
  z.pin = await db.konfigHolen('pin', null);
  const aktiv = await db.konfigHolen('aktiveSitzung', null);
  z.aktiveSitzung = aktiv ? await db.holen('sitzungen', aktiv) : null;
}

async function seiteStart() {
  const gilt = seiteGilt();
  titel('Mehltau-Bonitur');
  const liste = await db.sitzungen();
  const offen = liste.filter((s) => !s.exportiert && s.sitzung_id !== z.aktiveSitzung?.sitzung_id);
  const anzahl = new Map();
  for (const s of liste.slice(0, 12)) anzahl.set(s.sitzung_id, (await db.messungenDerSitzung(s.sitzung_id)).length);
  const speicher = await db.speicherSchaetzung();
  const ohneKarte = z.einst.modus === 'automatisch' && !z.einst.farbkarte?.ecken;
  if (!gilt()) return;
  inhalt.innerHTML = `
    ${db.TESTVERSION ? '<section class="karte warn"><b>Testversion.</b> Hier gespeicherte Sitzungen sind Testdaten und getrennt von den echten Daten der App.</section>' : ''}
    ${z.aktiveSitzung ? `<section class="karte gut"><h2 style="margin-top:0">Laufende Sitzung</h2>
      <p><b>${esc(z.aktiveSitzung.sitzung_id)}</b> · ${anzahl.get(z.aktiveSitzung.sitzung_id) ?? 0} Töpfe · ${esc(z.aktiveSitzung.mitarbeiter)}</p>
      <a class="knopf haupt gross" href="#/aufnahme">Weiter fotografieren</a>
      <a class="knopf gross" href="#/sitzung/${encodeURIComponent(z.aktiveSitzung.sitzung_id)}">Sitzung ansehen / beenden</a></section>`
    : '<a class="knopf haupt gross" href="#/neu">Neue Sitzung starten</a>'}
    ${ohneKarte ? `<section class="karte warn"><b>Noch keine Einstellungsdatei geladen.</b><p>Ohne Farbkarte und Topfkreis sind die Werte nicht verlässlich. Lade die Datei aus der Analyse-Werkstatt in den Einstellungen.</p><a class="knopf klein" href="#/einstellungen">Zu den Einstellungen</a></section>` : ''}
    ${z.einst.modus === 'sicht' ? '<section class="karte"><b>Betriebsart: Sicht-Bonitur.</b> Du vergibst die Note selbst mit Referenzfotos; die Fotos werden archiviert.</section>' : ''}
    ${offen.length ? `<section class="karte fehler"><b>${offen.length} Sitzung${offen.length > 1 ? 'en sind' : ' ist'} noch nicht gesichert.</b><p>Bitte exportieren und auf dem Firmen-PC ablegen – der Browser-Speicher ist kein Archiv.</p>
      ${offen.slice(0, 4).map((s) => `<a class="knopf klein" href="#/export/${encodeURIComponent(s.sitzung_id)}">${esc(s.sitzung_id)} sichern</a>`).join(' ')}</section>` : ''}
    <h2>Letzte Sitzungen</h2>
    ${liste.length ? `<ul class="liste">${liste.slice(0, 12).map((s) => `<li><a href="#/sitzung/${encodeURIComponent(s.sitzung_id)}"><b>${esc(s.sitzung_id)}</b><br><span class="leise">${esc(SITZUNGSARTEN[s.art] || s.art)} · ${anzahl.get(s.sitzung_id) ?? 0} Töpfe · ${esc(s.mitarbeiter)}</span></a>
      ${s.exportiert ? '<span class="marke ok">gesichert</span>' : '<span class="marke offen">nicht gesichert</span>'}</li>`).join('')}</ul>` : '<p class="leise">Noch keine Sitzungen.</p>'}
    <div class="reihe" style="margin-top:14px"><a class="knopf" href="#/uebersicht">Übersicht und Verlauf</a><a class="knopf" href="#/einstellungen">Einstellungen</a></div>
    <p class="klein-text" style="margin-top:16px">App ${APP_VERSION} · Rechenweg ${ALGORITHMUS_VERSION} · Einstellungen ${esc(z.einst.kennung)}${speicher ? ` · Speicher ${fmt(speicher.belegt / 1e6, 0)} MB belegt${speicher.dauerhaft ? ' (dauerhaft)' : ''}` : ''}</p>`;
}

// ---------- Neue Sitzung ----------

async function seiteNeu() {
  const gilt = seiteGilt();
  titel('Neue Sitzung', '#/');
  const s = z.stammdaten;
  const letzte = (await db.sitzungen())[0];
  if (!gilt()) return;
  inhalt.innerHTML = `<form id="f" class="karte">
    <label class="feld">Datum</label><input type="date" name="datum" value="${datumText()}" required>
    <label class="feld">Mitarbeiter-Kürzel (keine Namen)</label>${auswahl('mitarbeiter', s.mitarbeiter, letzte?.mitarbeiter)}
    <label class="feld">Art</label><select name="art">${Object.entries(SITZUNGSARTEN).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
    <label class="feld">Satz / Versuch</label>${auswahl('satz', s.saetze, letzte?.satz)}
    <label class="feld">Sorte (Vorgabe für alle Töpfe)</label>${auswahl('sorte', s.sorten, letzte?.sorte)}
    <label class="feld">Behandlung (Vorgabe)</label>${auswahl('behandlung', s.behandlungen, '')}
    <label class="feld">Tisch (Vorgabe)</label>${auswahl('tisch', s.tische, '')}
    <button class="knopf haupt gross" type="submit" style="margin-top:16px">Sitzung starten</button></form>`;
  neuOptionAktivieren(inhalt);
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    for (const k of Object.keys(d)) if (d[k] === '__neu') d[k] = '';
    if (!d.mitarbeiter) { melden('Bitte ein Kürzel wählen oder anlegen.', true); return; }
    const vorhandene = (await db.sitzungen()).map((x) => x.sitzung_id);
    const sitzung = {
      sitzung_id: sitzungIdBilden(d.datum, d.satz, d.art, vorhandene),
      datum: d.datum, art: d.art, mitarbeiter: d.mitarbeiter, satz: d.satz || '',
      sorte: d.sorte || '', behandlung: d.behandlung || '', tisch: d.tisch || '',
      erstellt: new Date().toISOString(), beendet: null, exportiert: null,
      einstellungen: z.einst.kennung,
    };
    stammdatenErgaenzen('mitarbeiter', d.mitarbeiter); stammdatenErgaenzen('saetze', d.satz);
    stammdatenErgaenzen('sorten', d.sorte); stammdatenErgaenzen('behandlungen', d.behandlung); stammdatenErgaenzen('tische', d.tisch);
    await db.ablegen('sitzungen', sitzung);
    await db.konfigSetzen('aktiveSitzung', sitzung.sitzung_id);
    await speichernKonfig();
    z.aktiveSitzung = sitzung;
    location.hash = '#/aufnahme';
  });
}

// ---------- Aufnahme ----------

async function seiteAufnahme() {
  const gilt = seiteGilt();
  if (!z.aktiveSitzung) { location.hash = '#/'; return; }
  titel(z.aktiveSitzung.sitzung_id, '#/');
  const messungen = await db.messungenDerSitzung(z.aktiveSitzung.sitzung_id);
  const direkt = z.kamera.modus === 'direkt';
  if (!gilt()) return;
  inhalt.innerHTML = `
    <p class="leise">${messungen.length} Töpfe in dieser Sitzung. Topf trocken, Abdeckscheibe drauf, Topf-Karte in den Halter, Klappe zu.</p>
    ${direkt ? `<div class="video-rahmen"><video id="video" playsinline muted></video><svg id="hilfslinien" viewBox="0 0 100 75" preserveAspectRatio="none"></svg></div>
      <button class="knopf haupt gross" id="ausloesen">Foto aufnehmen</button>
      <label class="leise"><input type="checkbox" id="timer"> mit 2 s Verzögerung (gegen Verwackeln)</label>` : ''}
    <button class="knopf ${direkt ? '' : 'haupt'} gross" id="import">Fotos importieren${direkt ? '' : ' (aus Open Camera)'}</button>
    <button class="knopf gross" id="systemkamera">Kamera des Handys öffnen</button>
    ${direkt ? '' : '<p class="klein-text">Empfohlen: Mit Open Camera (feste Einstellungen) fotografieren und hier importieren. Direkte Aufnahme lässt sich in Einstellungen → Kamera testen freischalten.</p>'}
    ${messungen.length ? '<h2>Zuletzt</h2>' : ''}
    <ul class="liste" id="zuletzt"></ul>
    <a class="knopf gross" href="#/sitzung/${encodeURIComponent(z.aktiveSitzung.sitzung_id)}" style="margin-top:12px">Sitzung ansehen / beenden</a>`;
  const zuletzt = $('#zuletzt');
  for (const m of messungen.slice(-5).reverse()) {
    const v = m.vorschau_key ? await db.holen('bilder', m.vorschau_key) : null;
    zuletzt.insertAdjacentHTML('beforeend', `<li>${v ? `<img src="${url(v.blob)}" alt="">` : ''}<span><b>${esc(m.topf_id || '–')}</b> · Note ${m.note_app ?? m.note_manuell ?? '–'} · ${fmt(m.befall_pct)} %</span></li>`);
  }
  $('#import').addEventListener('click', async () => importieren(await dateiWaehlen('#eingabe-import')));
  $('#systemkamera').addEventListener('click', async () => importieren(await dateiWaehlen('#eingabe-kamera')));
  if (direkt) await liveKamera();
}

async function liveKamera() {
  const video = $('#video');
  try {
    const { strom, spur } = await kameraStarten(video);
    if (!video.isConnected) { kameraStoppen(strom); return; }
    z.stromAktiv = strom;
    if (z.kamera.werte && Object.keys(z.kamera.werte).length) await werteAnwenden(spur, z.kamera.werte).catch(() => {});
    hilfslinienZeichnen();
    $('#ausloesen').addEventListener('click', async () => {
      const knopf = $('#ausloesen'); knopf.disabled = true;
      if ($('#timer').checked) { knopf.textContent = 'Auslösen in 2 s …'; await new Promise((r) => setTimeout(r, 2000)); }
      knopf.textContent = 'Foto wird aufgenommen …';
      try {
        const { blob } = await fotoAufnehmen(spur, video);
        const name = fotoDateiname(new Date());
        kameraStoppen(z.stromAktiv); z.stromAktiv = null;
        await importieren([new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() })]);
      } catch (f) { melden(`Aufnahme fehlgeschlagen: ${f.message}`, true); knopf.disabled = false; knopf.textContent = 'Foto aufnehmen'; }
    });
  } catch (f) {
    melden(`Kamera: ${f.message}. Bitte Fotos importieren.`, true);
  }
}

function hilfslinienZeichnen() {
  const svg = $('#hilfslinien'); if (!svg) return;
  const e = z.einst; const teile = [];
  if (e.auswertekreis) teile.push(`<ellipse cx="${e.auswertekreis.cx * 100}" cy="${e.auswertekreis.cy * 75}" rx="${e.auswertekreis.r * 100}" ry="${e.auswertekreis.r * 100}" fill="none" stroke="#ffd60a" stroke-width="0.5" stroke-dasharray="2 1.5"/>`);
  if (e.farbkarte?.ecken) teile.push(`<polygon points="${e.farbkarte.ecken.map(([x, y]) => `${x * 100},${y * 75}`).join(' ')}" fill="none" stroke="#4cd964" stroke-width="0.5"/>`);
  if (e.etikettbereich) { const t = e.etikettbereich; teile.push(`<rect x="${t.x * 100}" y="${t.y * 75}" width="${t.w * 100}" height="${t.h * 75}" fill="none" stroke="#4cd964" stroke-width="0.5"/>`); }
  svg.innerHTML = teile.join('');
}

async function importieren(dateien) {
  const bilder = dateien.filter((d) => d && (d.type.startsWith('image/') || /\.jpe?g$/i.test(d.name)));
  if (!bilder.length) return;
  z.warteschlange = bilder.map((d, i) => ({ datei: d, nr: i + 1, von: bilder.length }));
  await naechsteAusWarteschlange();
}

async function naechsteAusWarteschlange() {
  const eintrag = z.warteschlange.shift();
  if (!eintrag) { gehe('#/aufnahme'); return; }
  titel(`Auswertung ${eintrag.von > 1 ? `${eintrag.nr} von ${eintrag.von}` : ''}`);
  seitenNr++;
  inhalt.innerHTML = `<p class="laden">Foto wird ausgewertet …</p><p class="klein-text">${esc(eintrag.datei.name)}</p>`;
  const start = performance.now();
  try {
    const sicht = z.einst.modus === 'sicht';
    const r = await pool.auftrag(sicht
      ? { typ: 'vorbereiten', datei: eintrag.datei, einstellungen: z.einst, optionen: { qr: true, vorschau: 320, gross: 1600 } }
      : { typ: 'analysieren', datei: eintrag.datei, einstellungen: z.einst, optionen: { kontrollbild: 1200, qr: true, vorschau: 320 } });
    z.aktuell = { ...eintrag, antwort: r, dauer: performance.now() - start, sicht };
    gehe('#/ergebnis');
  } catch (f) {
    melden(`Auswertung fehlgeschlagen: ${f.message}`, true);
    await naechsteAusWarteschlange();
  }
}

// ---------- Ergebnis ----------

async function seiteErgebnis() {
  const gilt = seiteGilt();
  const a = z.aktuell;
  if (!a || !z.aktiveSitzung) { location.hash = '#/'; return; }
  const sitzung = z.aktiveSitzung;
  const e = a.antwort.ergebnis;
  const messungen = await db.messungenDerSitzung(sitzung.sitzung_id);
  const letzteId = messungen.at(-1)?.topf_id;
  const topfId = a.antwort.qr?.text || naechsteTopfId(letzteId);
  const qrGelesen = Boolean(a.antwort.qr?.text);
  const warnungen = [...(e.warnungen || [])];
  if (!qrGelesen && z.einst.etikettbereich) warnungen.push('Topf-ID nicht aus dem QR-Code gelesen – bitte prüfen');
  const schonDa = (id) => Boolean(id) && messungen.some((m) => m.topf_id === id);
  if (schonDa(topfId)) warnungen.push(`Topf ${topfId} ist in dieser Sitzung schon gespeichert`);
  const originalUrl = url(a.antwort.gross || a.datei);
  const kontrollUrl = a.antwort.kontrollbild ? url(a.antwort.kontrollbild) : null;
  const skala = z.einst.notenskala;
  const s = z.stammdaten;
  const referenzen = a.sicht ? await Promise.all(skala.noten.map((n) => db.holen('bilder', `referenz-${n}`))) : [];
  titel(`${a.von > 1 ? `Foto ${a.nr} von ${a.von}` : 'Ergebnis'}`);
  if (!gilt()) return;
  inhalt.innerHTML = `
    ${kontrollUrl ? `<div class="umschalter"><button class="aktiv" data-bild="k">Kontrollbild</button><button data-bild="o">Original</button></div>` : ''}
    <img class="bild" id="bild" src="${kontrollUrl || originalUrl}" alt="Foto"><p class="klein-text">Bild antippen zum Vergrößern.</p>
    ${a.sicht ? '' : `<div class="note-gross"><b>Note ${e.note_app ?? '–'}</b><span>Befall ${fmt(e.befall_pct)} %</span></div>
      ${[['grün', e.gruen_pct, '#5B9A3C'], ['gelb', e.gelb_pct, '#D9B32E'], ['braun', e.braun_pct, '#C0392B']].map(([t, w, c]) => `<div class="balken"><span>${t}</span><div><i style="width:${Math.min(100, w || 0)}%;background:${c}"></i></div><span>${fmt(w)} %</span></div>`).join('')}
      <p class="leise">Fläche ${e.flaeche_cm2_ca ? `ca. ${e.flaeche_cm2_ca} cm²` : `${(e.flaeche_px || 0).toLocaleString('de-DE')} Pixel`} · Grünwert ${fmt(e.gruenwert)}°<br>Sichtbare Symptome von oben – keine Mehltau-Diagnose.</p>`}
    ${warnungen.length ? `<div class="warnungen">⚠ ${warnungen.map(esc).join('<br>⚠ ')}</div>` : ''}
    <form id="f" class="karte">
      <label class="feld">Topf-ID ${qrGelesen ? '<span class="marke ok">aus QR gelesen</span>' : ''}</label><input type="text" name="topf_id" value="${esc(topfId)}" autocomplete="off">
      ${a.sicht ? `<label class="feld">Note (vergleiche mit den Referenzfotos)</label>
        <div class="referenzen">${skala.noten.map((n, i) => `<figure data-note="${n}">${referenzen[i] ? `<img src="${url(referenzen[i].blob)}" alt="Note ${n}">` : '<img alt="">'}<figcaption>Note ${n}</figcaption></figure>`).join('')}</div>` : '<label class="feld">Hand-Note (optional, zum Vergleich)</label>'}
      <div class="notenwahl">${a.sicht ? '' : '<button type="button" data-note="" class="aktiv">–</button>'}${skala.noten.map((n) => `<button type="button" data-note="${n}">${n}</button>`).join('')}</div>
      <input type="hidden" name="note_manuell" value="">
      <details ${sitzung.sorte || sitzung.behandlung ? '' : 'open'}><summary>Sorte, Behandlung, Tisch</summary>
        <label class="feld">Sorte</label>${auswahl('sorte', s.sorten, sitzung.sorte)}
        <label class="feld">Behandlung</label>${auswahl('behandlung', s.behandlungen, sitzung.behandlung)}
        <label class="feld">Tisch</label>${auswahl('tisch', s.tische, sitzung.tisch)}
      </details>
      <label class="feld">Bemerkung</label><input type="text" name="bemerkung" placeholder="z. B. Blätter nass">
      <div class="reihe" style="margin-top:14px"><button class="knopf haupt" type="submit">Speichern</button><button class="knopf" type="button" id="wiederholen">Verwerfen</button></div>
      <p class="klein-text" style="margin-top:8px">${a.sicht ? 'Sicht-Bonitur' : `Ausgewertet in ${fmt(a.dauer / 1000)} s`} · ${esc(versionsText(z.einst))} · ${esc(a.datei.name)}</p>
    </form>`;
  neuOptionAktivieren(inhalt);
  inhalt.querySelectorAll('.umschalter button').forEach((b) => b.addEventListener('click', () => {
    inhalt.querySelectorAll('.umschalter button').forEach((x) => x.classList.toggle('aktiv', x === b));
    $('#bild').src = b.dataset.bild === 'k' ? kontrollUrl : originalUrl;
  }));
  inhalt.querySelectorAll('.notenwahl button').forEach((b) => b.addEventListener('click', () => {
    inhalt.querySelectorAll('.notenwahl button').forEach((x) => x.classList.toggle('aktiv', x === b));
    inhalt.querySelectorAll('.referenzen figure').forEach((x) => x.classList.toggle('aktiv', x.dataset.note === b.dataset.note));
    $('[name=note_manuell]').value = b.dataset.note;
  }));
  inhalt.querySelectorAll('.referenzen figure[data-note]').forEach((f) => f.addEventListener('click', () => {
    inhalt.querySelector(`.notenwahl button[data-note="${f.dataset.note}"]`)?.click();
  }));
  $('#wiederholen').addEventListener('click', () => { urlsFreigeben(); naechsteAusWarteschlange(); });
  $('#f').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    for (const k of Object.keys(d)) if (d[k] === '__neu') d[k] = '';
    if (a.sicht && d.note_manuell === '') { melden('Bitte eine Note antippen.', true); return; }
    const id = (d.topf_id || '').trim();
    const offen = [...(e.warnungen || [])];
    if (!id) offen.push('Keine Topf-ID eingetragen');
    if (schonDa(id)) offen.push(`Topf ${id} ist in dieser Sitzung schon gespeichert`);
    if (offen.length && !window.confirm(`Trotz Warnung speichern?\n\n${offen.join('\n')}`)) return;
    await messungSpeichern(a, d);
  });
}

async function messungSpeichern(a, d) {
  const sitzung = z.aktiveSitzung;
  const r = a.antwort; const e = r.ergebnis;
  const messungen = await db.messungenDerSitzung(sitzung.sitzung_id);
  const laufnr = messungen.reduce((m, x) => Math.max(m, Number(String(x.mess_id).split('-').pop()) || 0), 0) + 1;
  const messId = messIdBilden(sitzung.sitzung_id, laufnr);
  const fotoDatei = eindeutigerName(a.datei.name || fotoDateiname(new Date()), messungen.map((m) => m.foto_datei));
  const zeit = (e.exif?.aufnahme && new Date(e.exif.aufnahme)) || zeitAusDateiname(a.datei.name) || new Date(a.datei.lastModified || Date.now());
  await db.ablegen('bilder', { schluessel: `${messId}-foto`, blob: a.datei, typ: 'original' });
  if (r.kontrollbild) await db.ablegen('bilder', { schluessel: `${messId}-kontrolle`, blob: r.kontrollbild, typ: 'kontrolle' });
  if (r.vorschau) await db.ablegen('bilder', { schluessel: `${messId}-vorschau`, blob: r.vorschau, typ: 'vorschau' });
  const notiz = d.note_manuell === '' || d.note_manuell === undefined ? null : Number(d.note_manuell);
  const messung = {
    mess_id: messId,
    datum_zeit: datumZeitText(zeit),
    mitarbeiter: sitzung.mitarbeiter,
    sitzung_id: sitzung.sitzung_id,
    topf_id: (d.topf_id || '').trim() || null,
    satz: sitzung.satz || null,
    sorte: d.sorte || null,
    behandlung: d.behandlung || null,
    tisch: d.tisch || null,
    foto_datei: fotoDatei,
    flaeche_px: a.sicht ? null : e.flaeche_px,
    flaeche_cm2_ca: a.sicht ? null : e.flaeche_cm2_ca,
    gruen_pct: a.sicht ? null : e.gruen_pct,
    gelb_pct: a.sicht ? null : e.gelb_pct,
    braun_pct: a.sicht ? null : e.braun_pct,
    befall_pct: a.sicht ? null : e.befall_pct,
    gruenwert: a.sicht ? null : e.gruenwert,
    note_app: a.sicht ? null : e.note_app,
    note_manuell: notiz,
    qualitaet: a.sicht ? 'Sicht-Bonitur' : e.qualitaet,
    algorithmus_version: a.sicht ? `Sicht/${z.einst.kennung}` : e.algorithmus_version,
    app_version: APP_VERSION,
    handy_modell: e.exif?.modell || z.handy.modell || null,
    bemerkung: d.bemerkung || null,
    foto_key: `${messId}-foto`,
    kontroll_key: r.kontrollbild ? `${messId}-kontrolle` : null,
    vorschau_key: r.vorschau ? `${messId}-vorschau` : null,
    gespeichert: new Date().toISOString(),
  };
  await db.ablegen('messungen', messung);
  stammdatenErgaenzen('sorten', d.sorte); stammdatenErgaenzen('behandlungen', d.behandlung); stammdatenErgaenzen('tische', d.tisch);
  if (!z.handy.modell && e.exif?.modell) z.handy.modell = e.exif.modell;
  await speichernKonfig();
  urlsFreigeben();
  melden(`Gespeichert: ${messung.topf_id || messId} · ${a.sicht ? `Note ${notiz}` : `Note ${messung.note_app}, ${fmt(messung.befall_pct)} %`}`);
  await naechsteAusWarteschlange();
}

// ---------- Sitzung ----------

async function seiteSitzung(id) {
  const gilt = seiteGilt();
  const sitzung = await db.holen('sitzungen', id);
  if (!sitzung) { location.hash = '#/'; return; }
  titel(sitzung.sitzung_id, '#/');
  const messungen = await db.messungenDerSitzung(id);
  const aktiv = z.aktiveSitzung?.sitzung_id === id;
  if (!gilt()) return;
  inhalt.innerHTML = `
    <section class="karte"><p><b>${esc(SITZUNGSARTEN[sitzung.art] || sitzung.art)}</b> · ${esc(sitzung.datum)} · ${esc(sitzung.mitarbeiter)}${sitzung.satz ? ` · Satz ${esc(sitzung.satz)}` : ''}</p>
      <p>${messungen.length} Töpfe · ${sitzung.exportiert ? `<span class="marke ok">gesichert ${esc(sitzung.exportiert.slice(0, 10))}</span>` : '<span class="marke offen">nicht gesichert</span>'}</p>
      <div class="reihe">${aktiv ? '<a class="knopf haupt" href="#/aufnahme">Weiter fotografieren</a><button class="knopf" id="beenden">Sitzung beenden</button>' : '<button class="knopf" id="fortsetzen">Wieder aufnehmen</button>'}
      <a class="knopf ${aktiv ? '' : 'haupt'}" href="#/export/${encodeURIComponent(id)}">Exportieren</a></div></section>
    <ul class="liste" id="messliste"></ul>
    ${sitzung.exportiert ? `<h2>Aufräumen</h2><div class="reihe">${sitzung.fotosGeloescht ? '<span class="leise">Fotos sind vom Handy gelöscht.</span>' : '<button class="knopf gefahr" id="fotos-loeschen">Fotos vom Handy löschen</button>'}<button class="knopf gefahr" id="sitzung-loeschen">Sitzung ganz löschen</button></div>` : ''}`;
  const ul = $('#messliste');
  for (const m of messungen) {
    const v = m.vorschau_key ? await db.holen('bilder', m.vorschau_key) : null;
    const warn = m.qualitaet && m.qualitaet !== 'ok' && m.qualitaet !== 'Sicht-Bonitur';
    ul.insertAdjacentHTML('beforeend', `<li data-id="${esc(m.mess_id)}">${v ? `<img src="${url(v.blob)}" alt="">` : '<img alt="">'}
      <a href="#/messung/${encodeURIComponent(m.mess_id)}"><b>${esc(m.topf_id || '–')}</b> · Note ${m.note_app ?? '–'}${m.note_manuell !== null && m.note_manuell !== undefined ? ` (Hand ${m.note_manuell})` : ''}<br>
      <span class="leise">${fmt(m.befall_pct)} % · ${esc(m.behandlung || '')} ${warn ? '<span class="marke warn">Warnung</span>' : ''}</span></a></li>`);
  }
  $('#beenden')?.addEventListener('click', async () => {
    await db.ablegen('sitzungen', { ...sitzung, beendet: new Date().toISOString() });
    await db.konfigSetzen('aktiveSitzung', null); z.aktiveSitzung = null;
    location.hash = `#/export/${encodeURIComponent(id)}`;
  });
  $('#fortsetzen')?.addEventListener('click', async () => {
    await db.konfigSetzen('aktiveSitzung', id); z.aktiveSitzung = sitzung; location.hash = '#/aufnahme';
  });
  $('#fotos-loeschen')?.addEventListener('click', async () => {
    if (!window.confirm('Fotos dieser Sitzung vom Handy löschen? Die Messwerte bleiben. Nur tun, wenn die ZIP-Datei sicher auf dem Firmen-PC liegt.')) return;
    try { await db.fotosDerSitzungLoeschen(id); melden('Fotos gelöscht.'); seiteSitzung(id); } catch (f) { melden(f.message, true); }
  });
  $('#sitzung-loeschen')?.addEventListener('click', async () => {
    if (!window.confirm('Sitzung mit allen Messwerten und Fotos vom Handy löschen?')) return;
    try { await db.sitzungLoeschen(id); melden('Sitzung gelöscht.'); location.hash = '#/'; } catch (f) { melden(f.message, true); }
  });
}

async function seiteMessung(messId) {
  const gilt = seiteGilt();
  const m = await db.holen('messungen', messId);
  if (!m) { location.hash = '#/'; return; }
  titel(m.topf_id || m.mess_id, `#/sitzung/${encodeURIComponent(m.sitzung_id)}`);
  const kb = m.kontroll_key ? await db.holen('bilder', m.kontroll_key) : null;
  const og = m.foto_key ? await db.holen('bilder', m.foto_key) : null;
  if (!gilt()) return;
  inhalt.innerHTML = `
    ${kb && og ? '<div class="umschalter"><button class="aktiv" data-b="k">Kontrollbild</button><button data-b="o">Original</button></div>' : ''}
    ${kb || og ? `<img class="bild" id="bild" src="${url((kb || og).blob)}" alt="">` : '<p class="leise">Foto ist vom Handy gelöscht (liegt im Export).</p>'}
    <table class="tabelle" style="margin-top:10px"><tbody>
      ${[['Befall %', fmt(m.befall_pct)], ['grün / gelb / braun %', `${fmt(m.gruen_pct)} / ${fmt(m.gelb_pct)} / ${fmt(m.braun_pct)}`], ['Note App', m.note_app ?? '–'], ['Hand-Note', m.note_manuell ?? '–'],
        ['Fläche', m.flaeche_cm2_ca ? `ca. ${m.flaeche_cm2_ca} cm²` : `${m.flaeche_px ?? '–'} px`], ['Qualität', esc(m.qualitaet)], ['Foto', `${esc(m.foto_datei)}${og?.blob?.size ? ` (${fmt(og.blob.size / 1e6, 1)} MB)` : ''}`], ['Zeit', esc(m.datum_zeit)],
        ['Sorte / Behandlung / Tisch', esc([m.sorte, m.behandlung, m.tisch].filter(Boolean).join(' / '))], ['Version', esc(m.algorithmus_version)]].map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}
    </tbody></table>
    <form id="f" class="karte" style="margin-top:12px"><h3 style="margin-top:0">Korrigieren</h3>
      <label class="feld">Topf-ID</label><input type="text" name="topf_id" value="${esc(m.topf_id || '')}">
      <label class="feld">Hand-Note</label><select name="note_manuell"><option value="">–</option>${z.einst.notenskala.noten.map((n) => `<option ${m.note_manuell === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <label class="feld">Bemerkung</label><input type="text" name="bemerkung" value="${esc(m.bemerkung || '')}">
      <button class="knopf haupt" type="submit" style="margin-top:12px">Änderung speichern</button></form>`;
  inhalt.querySelectorAll('.umschalter button').forEach((b) => b.addEventListener('click', () => {
    inhalt.querySelectorAll('.umschalter button').forEach((x) => x.classList.toggle('aktiv', x === b));
    $('#bild').src = url((b.dataset.b === 'k' ? kb : og).blob);
  }));
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    await db.ablegen('messungen', { ...m, topf_id: d.topf_id.trim() || null, note_manuell: d.note_manuell === '' ? null : Number(d.note_manuell), bemerkung: d.bemerkung || null });
    const s = await db.holen('sitzungen', m.sitzung_id);
    if (s?.exportiert) await db.ablegen('sitzungen', { ...s, exportiert: null });
    melden('Gespeichert. Die Sitzung muss neu exportiert werden.');
    location.hash = `#/sitzung/${encodeURIComponent(m.sitzung_id)}`;
  });
}

// ---------- Export ----------

async function seiteExport(id) {
  const gilt = seiteGilt();
  const sitzung = await db.holen('sitzungen', id);
  if (!sitzung) { location.hash = '#/'; return; }
  titel('Exportieren', `#/sitzung/${encodeURIComponent(id)}`);
  const messungen = await db.messungenDerSitzung(id);
  const ordner = `Bonitur/${sitzung.datum.slice(0, 4)}/${sitzung.sitzung_id}/`;
  if (!gilt()) return;
  inhalt.innerHTML = `
    <section class="karte"><p><b>${esc(id)}</b> · ${messungen.length} Messungen</p>
      <p>Speichere beides und lege es auf dem Firmen-PC, NAS oder Cloud-Ordner ab, z. B. in <b>${esc(ordner)}</b>.</p>
      <button class="knopf haupt gross" id="excel">Excel speichern</button>
      <label class="leise"><input type="checkbox" id="mit-kontrolle" checked> Kontrollbilder ins ZIP</label>
      <button class="knopf haupt gross" id="zip">ZIP mit Fotos speichern</button>
      <button class="knopf gross" id="teilen">Teilen (z. B. Google Drive, E-Mail)</button></section>
    <section class="karte ${sitzung.exportiert ? 'gut' : 'warn'}">${sitzung.exportiert ? `<b>Gesichert am ${esc(sitzung.exportiert.slice(0, 10))}.</b><p>Du kannst die Fotos jetzt vom Handy löschen (Sitzung ansehen → Aufräumen).</p>`
    : `<p><b>Erst wenn beide Dateien sicher abgelegt sind:</b></p><button class="knopf gross" id="bestaetigen">Ich habe Excel und ZIP gesichert</button>`}</section>`;
  const einst = z.einst;
  $('#excel').addEventListener('click', () => herunterladen(sitzungsExcel(sitzung, messungen, einst), `${id}.xlsx`));
  $('#zip').addEventListener('click', async () => {
    melden('ZIP wird erstellt …');
    herunterladen(await sitzungsZip(sitzung, messungen, einst, { mitKontrollbildern: $('#mit-kontrolle').checked }), `${id}.zip`);
  });
  $('#teilen').addEventListener('click', async () => {
    try {
      const zipBlob = await sitzungsZip(sitzung, messungen, einst, { mitKontrollbildern: $('#mit-kontrolle').checked });
      const ok = await teilen([
        new File([sitzungsExcel(sitzung, messungen, einst)], `${id}.xlsx`, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        new File([zipBlob], `${id}.zip`, { type: 'application/zip' }),
      ], id);
      if (!ok) melden('Teilen geht auf diesem Handy nicht – bitte „speichern“ nutzen.', true);
    } catch (f) { if (f.name !== 'AbortError') melden(`Teilen: ${f.message}`, true); }
  });
  $('#bestaetigen')?.addEventListener('click', async () => {
    await db.ablegen('sitzungen', { ...sitzung, exportiert: new Date().toISOString() });
    melden('Als gesichert markiert.');
    seiteExport(id);
  });
}

// ---------- Übersicht ----------

const FARBEN = ['#2F6B3A', '#C0392B', '#2B5D8C', '#D9A400', '#8A5A2B', '#7B3FA0'];

function verlaufDiagramm(gruppen) {
  const alle = gruppen.flatMap((g) => g.termine).filter((t) => Number.isFinite(t.befall));
  if (!alle.length) return '';
  const B = 360; const H = 210; const l = 34; const r = 12; const o = 10; const u = 34;
  const tMax = Math.max(1, ...alle.map((t) => t.tag));
  const yMax = Math.max(10, Math.ceil(Math.max(...alle.map((t) => t.befall)) / 10) * 10);
  const xs = (t) => l + (t / tMax) * (B - l - r); const ys = (y) => H - u - (y / yMax) * (H - o - u);
  const teile = [`<svg viewBox="0 0 ${B} ${H}" font-size="11" font-family="system-ui, sans-serif" role="img" aria-label="Befall im Verlauf">`];
  const schritt = yMax <= 20 ? 5 : yMax <= 50 ? 10 : 20;
  for (let y = 0; y <= yMax; y += schritt) teile.push(`<line x1="${l}" x2="${B - r}" y1="${ys(y)}" y2="${ys(y)}" stroke="#E3E9E1"/><text x="${l - 5}" y="${ys(y) + 4}" text-anchor="end" fill="#6B7570">${y}</text>`);
  const tagSchritt = tMax <= 42 ? 7 : 14;
  for (let d = 0; d <= tMax; d += tagSchritt) teile.push(`<text x="${xs(d)}" y="${H - u + 15}" text-anchor="middle" fill="#6B7570">${d}</text>`);
  teile.push(`<text x="${(l + B - r) / 2}" y="${H - 4}" text-anchor="middle" fill="#1F2A24">Tage seit dem ersten Termin · Befall %</text>`);
  gruppen.forEach((g, i) => {
    const pts = g.termine.filter((t) => Number.isFinite(t.befall));
    const c = FARBEN[i % FARBEN.length];
    if (pts.length > 1) teile.push(`<polyline fill="none" stroke="${c}" stroke-width="2.5" points="${pts.map((t) => `${xs(t.tag)},${ys(t.befall)}`).join(' ')}"/>`);
    pts.forEach((t) => teile.push(`<circle cx="${xs(t.tag)}" cy="${ys(t.befall)}" r="4" fill="${c}"><title>${esc(g.behandlung || '–')} · ${t.datum}: ${fmt(t.befall)} %</title></circle>`));
  });
  teile.push('</svg>');
  const legende = gruppen.map((g, i) => `<span><i style="background:${FARBEN[i % FARBEN.length]}"></i>${esc(g.behandlung || 'ohne Behandlung')}</span>`).join('');
  return `${teile.join('')}<div class="legende">${legende}</div>`;
}

function regelDiagramm(rk) {
  if (!rk.bereit) return '';
  const B = 360; const H = 200; const l = 34; const r = 12; const o = 10; const u = 24;
  const n = rk.punkte.length;
  const werte = rk.punkte.map((p) => p.befall);
  const yMin = Math.floor(Math.min(...werte, rk.mitte - rk.band) - 1); const yMax = Math.ceil(Math.max(...werte, rk.mitte + rk.band) + 1);
  const xs = (i) => l + (n > 1 ? (i / (n - 1)) : 0.5) * (B - l - r); const ys = (y) => H - u - ((y - yMin) / (yMax - yMin || 1)) * (H - o - u);
  const t = [`<svg viewBox="0 0 ${B} ${H}" font-size="11" font-family="system-ui, sans-serif" role="img" aria-label="Regelkarte">`,
    `<rect x="${l}" y="${ys(rk.mitte + rk.band)}" width="${B - l - r}" height="${ys(rk.mitte - rk.band) - ys(rk.mitte + rk.band)}" fill="#E3EFDD"/>`,
    `<line x1="${l}" x2="${B - r}" y1="${ys(rk.mitte)}" y2="${ys(rk.mitte)}" stroke="#2F6B3A" stroke-dasharray="5 4"/>`,
    `<polyline fill="none" stroke="#1F2A24" stroke-width="2" points="${rk.punkte.map((p, i) => `${xs(i)},${ys(p.befall)}`).join(' ')}"/>`,
    ...rk.punkte.map((p, i) => `<circle cx="${xs(i)}" cy="${ys(p.befall)}" r="4.5" fill="${p.ausserhalb ? '#C0392B' : '#1F2A24'}"><title>${p.datum}: ${fmt(p.befall)} %</title></circle>`),
    `<text x="${l}" y="${H - 8}" fill="#6B7570">${rk.punkte[0].datum}</text><text x="${B - r}" y="${H - 8}" text-anchor="end" fill="#6B7570">${rk.punkte[n - 1].datum}</text>`,
    `<text x="${l - 6}" y="${ys(rk.mitte) + 4}" text-anchor="end" fill="#2F6B3A">${fmt(rk.mitte)}</text>`, '</svg>'];
  return t.join('');
}

async function seiteUebersicht() {
  const gilt = seiteGilt();
  titel('Übersicht und Verlauf', '#/');
  const sitzungen = await db.sitzungen();
  const messungen = await db.alleMessungen();
  const gruppen = verlaufBerechnen(messungen, sitzungen);
  const saetze = [...new Set(gruppen.map((g) => g.satz))];
  const kontrollSitzungen = new Map(sitzungen.filter((s) => s.art === 'kontrolle').map((s) => [s.sitzung_id, s.datum]));
  const kontrolle = messungen.filter((m) => kontrollSitzungen.has(m.sitzung_id) && Number.isFinite(m.befall_pct))
    .map((m) => ({ datum: kontrollSitzungen.get(m.sitzung_id), befall: m.befall_pct }));
  const rk = regelkarte(kontrolle);
  if (!gilt()) return;
  inhalt.innerHTML = `
    ${saetze.length ? saetze.map((satz) => {
      const gs = gruppen.filter((g) => g.satz === satz);
      const termine = new Set(gs.flatMap((g) => g.termine.map((x) => x.datum))).size;
      return `<section class="karte"><h2 style="margin-top:0">Satz ${esc(satz || '–')}</h2><div class="diagramm">${verlaufDiagramm(gs)}</div>
        ${termine < 2 ? '<p class="klein-text">Ein Verlauf und die AUDPC entstehen ab dem zweiten Termin.</p>' : ''}
        <table class="tabelle"><thead><tr><th>Behandlung</th><th>Termin</th><th class="z">Ø Befall %</th><th class="z">Ø Note</th><th class="z">n</th></tr></thead><tbody>
        ${gs.map((g) => g.termine.map((t, i) => `<tr${i === 0 ? ' class="gruppe"' : ''}><td>${i === 0 ? esc(g.behandlung || '–') : ''}</td><td>${kurzDatum(t.datum)}</td><td class="z">${fmt(t.befall)}</td><td class="z">${fmt(t.note)}</td><td class="z">${t.n}</td></tr>`).join('')
          + (g.audpc !== null ? `<tr class="summe"><td></td><td>AUDPC</td><td class="z">${fmt(g.audpc, 1)}</td><td></td><td></td></tr>` : '')).join('')}
        </tbody></table><p class="klein-text">AUDPC = Summe über aufeinanderfolgende Termine von (Befall₁ + Befall₂) / 2 × Tage dazwischen (Prozent-Tage).</p></section>`;
    }).join('') : '<p class="leise">Noch keine Messungen für einen Verlauf.</p>'}
    <section class="karte"><h2 style="margin-top:0">Kontroll-Pflanze (Regelkarte)</h2>
      ${rk.bereit ? `<div class="diagramm">${regelDiagramm(rk)}</div><p class="klein-text">Mittellinie aus den ersten 5 Terminen, grünes Band ± ${rk.band} Prozentpunkte (Vorschlag, Leitfaden 10.7).</p>
        ${rk.warnungen.length ? `<div class="warnungen">${rk.warnungen.map(esc).join('<br>')}</div>` : '<p class="leise">Alles im Band.</p>'}`
      : `<p class="leise">Noch ${Math.max(0, 5 - rk.punkte.length)} Termine bis zur Regelkarte. Sitzungsart „Kontroll-Pflanze“ wöchentlich fotografieren.</p>`}</section>`;
}

// ---------- Einstellungen ----------

async function entsperrt(gilt) {
  if (!z.pin || Date.now() < z.entsperrtBis) return true;
  if (!gilt()) return false;
  inhalt.innerHTML = `<form id="pin" class="karte"><label class="feld">PIN für die Einstellungen</label><input type="password" inputmode="numeric" name="pin" autocomplete="off" autofocus>
    <button class="knopf haupt gross" type="submit" style="margin-top:12px">Entsperren</button></form>`;
  return new Promise((loesen) => {
    $('#pin').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (await pinHash(new FormData(e.target).get('pin')) === z.pin) { z.entsperrtBis = Date.now() + 10 * 60 * 1000; loesen(true); } else melden('PIN falsch.', true);
    });
  });
}

function chipsHtml(art, titelText) {
  return `<label class="feld">${titelText}</label><div class="chips" data-art="${art}">${z.stammdaten[art].map((x, i) => `<span>${esc(x)}<button type="button" data-i="${i}" aria-label="entfernen">×</button></span>`).join('')}</div>
    <div class="reihe"><input type="text" placeholder="neu …" data-neu="${art}" style="flex:1"><button class="knopf klein" type="button" data-hinzu="${art}">Hinzufügen</button></div>`;
}

async function seiteEinstellungen() {
  const gilt = seiteGilt();
  titel('Einstellungen', '#/');
  if (!(await entsperrt(gilt))) return;
  const e = z.einst;
  const speicher = await db.speicherSchaetzung();
  const notenText = notenBeschreibung(e.notenskala).map((x) => `${x.note}: ${x.text}`).join(' · ');
  if (!gilt()) return;
  inhalt.innerHTML = `
    <section class="karte"><h2 style="margin-top:0">Einstellungsdatei</h2>
      <p>Aktiv: <b>${esc(e.kennung)}</b>${e.geaendert ? ` vom ${esc(e.geaendert.slice(0, 10))}` : ''} · Farbkarte ${e.farbkarte?.ecken ? '✓' : '✗'} · Topfkreis ${e.auswertekreis ? '✓' : '✗'} · Etikett ${e.etikettbereich ? '✓' : '✗'} · Maßstab ${e.massstab?.pixel_pro_cm2 ? '✓' : '✗'}</p>
      <div class="reihe"><button class="knopf haupt" id="json-laden">Datei aus der Werkstatt laden</button><button class="knopf" id="json-speichern">Als Datei speichern</button></div>
      <a class="knopf" href="#/einrichten" style="margin-top:8px">Farbkarte, Topfkreis, Etikett am Handy einstellen</a></section>
    <section class="karte"><h2 style="margin-top:0">Betriebsart</h2>
      <label><input type="radio" name="modus" value="automatisch" ${e.modus !== 'sicht' ? 'checked' : ''}> Automatische Analyse (nach GO im Pilot)</label><br>
      <label><input type="radio" name="modus" value="sicht" ${e.modus === 'sicht' ? 'checked' : ''}> Sicht-Bonitur mit Referenzfotos (nach NO-GO)</label>
      <div id="referenz-bereich" ${e.modus === 'sicht' ? '' : 'hidden'}><h3>Referenzfotos je Note</h3><div class="referenzen" id="referenzen"></div><p class="klein-text">Bleiben nur auf diesem Handy (werden nicht veröffentlicht).</p></div></section>
    <section class="karte"><h2 style="margin-top:0">Schwellen und Notenskala</h2>
      <form id="schwellen">
        ${[['h_min', 'Farbton-Untergrenze Pflanze (°)', BEREICHE.farbton], ['h_max', 'Farbton-Obergrenze Pflanze (°)', BEREICHE.farbton], ['braun_gelb', 'Grenze braun/gelb (°)', BEREICHE.farbton], ['gelb_gruen', 'Grenze gelb/grün (°)', BEREICHE.farbton], ['s_min', 'Mindest-Sättigung (%)', BEREICHE.saettigung], ['v_min', 'Mindest-Helligkeit (%)', BEREICHE.helligkeit]]
    .map(([k, t, b]) => `<label class="feld">${t}</label><input type="number" name="${k}" min="${b.min}" max="${b.max}" step="${b.schritt}" value="${e.schwellen[k]}">`).join('')}
        <label class="feld">Noten (mit Komma getrennt)</label><input type="text" name="noten" value="${e.notenskala.noten.join(', ')}">
        <label class="feld">Grenzen in Befall % (eine weniger als Noten, mit Strichpunkt getrennt)</label><input type="text" name="grenzen" value="${e.notenskala.grenzen.map((g) => String(g).replace('.', ',')).join('; ')}">
        <p class="klein-text">Jetzt: ${esc(notenText)}</p>
        <button class="knopf" type="submit">Ändern (neue Kennung ${esc(naechsteKennung(e.kennung, 'H'))})</button></form>
      ${e.aenderungen?.length ? `<details><summary>Änderungsprotokoll (${e.aenderungen.length})</summary><ul>${e.aenderungen.map((a) => `<li>${esc(a.datum.slice(0, 10))} · ${esc(a.kennung)} · ${esc(a.wo)}: ${esc(a.was)}${a.grund ? ` – ${esc(a.grund)}` : ''}</li>`).join('')}</ul></details>` : ''}</section>
    <section class="karte"><h2 style="margin-top:0">Stammdaten</h2>
      ${chipsHtml('saetze', 'Sätze / Versuche')}${chipsHtml('sorten', 'Sorten')}${chipsHtml('behandlungen', 'Behandlungen')}${chipsHtml('tische', 'Tische')}${chipsHtml('mitarbeiter', 'Mitarbeiter-Kürzel (keine Namen)')}
      <div class="reihe" style="margin-top:12px"><button class="knopf klein" id="stamm-laden">Aus Excel ergänzen</button><button class="knopf klein" id="stamm-speichern">Als Excel speichern</button></div>
      <p class="klein-text">Excel mit den Spalten saetze, sorten, behandlungen, tische, mitarbeiter (eine Liste je Spalte). Beim Laden werden neue Einträge angehängt.</p></section>
    <section class="karte"><h2 style="margin-top:0">Handy und Kamera</h2>
      <label class="feld">Handy-Modell</label><input type="text" id="modell" value="${esc(z.handy.modell)}" placeholder="wird aus dem Foto gelesen">
      <p>Aufnahme: <b>${z.kamera.modus === 'direkt' ? 'direkt in der App' : 'Import aus Open Camera'}</b></p>
      <a class="knopf" href="#/kameratest">Kamera testen</a>
      <a class="knopf" href="../etiketten/" target="_blank" rel="noopener">QR-Etiketten drucken (am PC)</a></section>
    <section class="karte"><h2 style="margin-top:0">Sicherheit und Speicher</h2>
      <button class="knopf" id="pin-setzen">${z.pin ? 'PIN ändern' : 'PIN festlegen'}</button>
      <p style="margin-top:10px">${speicher ? `Belegt: ${fmt(speicher.belegt / 1e6, 0)} MB von ca. ${fmt(speicher.frei / 1e9, 1)} GB · ${speicher.dauerhaft ? 'dauerhafter Speicher ✓' : 'Speicher nicht dauerhaft'}` : 'Speicherangaben nicht verfügbar.'}</p>
      ${speicher && !speicher.dauerhaft ? '<button class="knopf" id="dauerhaft">Dauerhaften Speicher anfordern</button>' : ''}
      <p class="klein-text">App ${APP_VERSION} · Rechenweg ${ALGORITHMUS_VERSION} · Einstellungen ${esc(e.kennung)}</p></section>`;

  $('#json-laden').addEventListener('click', async () => {
    const [d] = await dateiWaehlen('#eingabe-json');
    if (!d) return;
    try {
      const neu = einstellungenErgaenzen(JSON.parse(await d.text()));
      const fehler = einstellungenPruefen(neu);
      if (fehler.length) { melden(`Datei fehlerhaft: ${fehler.join(' ')}`, true); return; }
      neu.modus = z.einst.modus;
      z.einst = neu; await speichernKonfig(); melden(`Einstellungen ${neu.kennung} geladen.`); seiteEinstellungen();
    } catch (f) { melden(`Datei nicht lesbar: ${f.message}`, true); }
  });
  $('#json-speichern').addEventListener('click', () => herunterladen(JSON.stringify(z.einst, null, 2), `bonitur-einstellungen_${z.einst.kennung}.json`, 'application/json'));
  inhalt.querySelectorAll('[name=modus]').forEach((r) => r.addEventListener('change', async () => {
    z.einst.modus = r.value; await speichernKonfig();
    const bereich = $('#referenz-bereich'); // Seite kann inzwischen gewechselt sein
    if (bereich) { bereich.hidden = r.value !== 'sicht'; referenzenZeigen(); }
  }));
  referenzenZeigen();
  $('#schwellen').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target));
    const neu = structuredClone(z.einst);
    for (const k of ['h_min', 'h_max', 'braun_gelb', 'gelb_gruen', 's_min', 'v_min']) neu.schwellen[k] = Number(d[k]);
    const zahlen = (text, trenner) => text.split(trenner).map((x) => x.trim()).filter(Boolean).map((x) => Number(x.replace(',', '.')));
    neu.notenskala = { ...neu.notenskala, noten: zahlen(d.noten, /[,;\s]+/), grenzen: zahlen(d.grenzen, /[;\s]+/) };
    if (neu.notenskala.noten.some((x) => !Number.isInteger(x)) || neu.notenskala.grenzen.some((x) => !Number.isFinite(x))) { melden('Noten als ganze Zahlen, Grenzen als Zahlen eingeben.', true); return; }
    const fehler = einstellungenPruefen(neu);
    if (fehler.length) { melden(fehler.join(' '), true); return; }
    if (JSON.stringify(neu.schwellen) === JSON.stringify(z.einst.schwellen) && JSON.stringify(neu.notenskala) === JSON.stringify(z.einst.notenskala)) { melden('Nichts geändert.'); return; }
    const grund = window.prompt('Kurzer Grund für die Änderung (fürs Änderungsprotokoll):', '');
    if (grund === null) return;
    neu.kennung = naechsteKennung(z.einst.kennung, 'H');
    neu.aenderungen = [...(neu.aenderungen || []), { datum: new Date().toISOString(), kennung: neu.kennung, wo: 'Handy', was: 'Schwellen/Notenskala', alt: JSON.stringify({ s: z.einst.schwellen, n: z.einst.notenskala }), neu: JSON.stringify({ s: neu.schwellen, n: neu.notenskala }), grund }];
    neu.geaendert = new Date().toISOString();
    z.einst = neu; await speichernKonfig(); melden(`Gespeichert als ${neu.kennung}.`); seiteEinstellungen();
  });
  inhalt.querySelectorAll('.chips button').forEach((b) => b.addEventListener('click', async () => {
    const art = b.closest('.chips').dataset.art; z.stammdaten[art].splice(Number(b.dataset.i), 1); await speichernKonfig(); seiteEinstellungen();
  }));
  inhalt.querySelectorAll('[data-hinzu]').forEach((b) => b.addEventListener('click', async () => {
    const art = b.dataset.hinzu; const inp = inhalt.querySelector(`[data-neu="${art}"]`);
    stammdatenErgaenzen(art, inp.value); await speichernKonfig(); seiteEinstellungen();
  }));
  $('#modell').addEventListener('change', async (ev) => { z.handy.modell = ev.target.value.trim(); await speichernKonfig(); });
  $('#stamm-speichern').addEventListener('click', () => herunterladen(stammdatenExcel(z.stammdaten), 'stammdaten.xlsx'));
  $('#stamm-laden').addEventListener('click', async () => {
    const [d] = await dateiWaehlen('#eingabe-excel');
    if (!d) return;
    try {
      const neu = stammdatenLesen(new Uint8Array(await d.arrayBuffer()));
      const vorher = Object.values(z.stammdaten).flat().length;
      z.stammdaten = stammdatenMischen(z.stammdaten, neu);
      await speichernKonfig();
      melden(`${Object.values(z.stammdaten).flat().length - vorher} neue Einträge übernommen.`);
      seiteEinstellungen();
    } catch (f) { melden(`Excel nicht lesbar: ${f.message}`, true); }
  });
  $('#pin-setzen').addEventListener('click', async () => {
    const p1 = window.prompt('Neue PIN (mind. 4 Ziffern, leer = keine PIN):', '');
    if (p1 === null) return;
    if (p1 === '') { z.pin = null; await db.konfigSetzen('pin', null); melden('PIN entfernt.'); return; }
    if (!/^\d{4,}$/.test(p1)) { melden('Bitte mindestens 4 Ziffern.', true); return; }
    if (window.prompt('PIN wiederholen:', '') !== p1) { melden('PINs stimmen nicht überein.', true); return; }
    z.pin = await pinHash(p1); await db.konfigSetzen('pin', z.pin); melden('PIN gespeichert.');
  });
  $('#dauerhaft')?.addEventListener('click', async () => { const ok = await db.dauerhaftAnfordern(); melden(ok ? 'Dauerhafter Speicher erteilt.' : 'Nicht erteilt – App zum Startbildschirm hinzufügen und erneut versuchen.', !ok); seiteEinstellungen(); });
}

async function referenzenZeigen() {
  const ziel = $('#referenzen'); if (!ziel) return;
  const noten = z.einst.notenskala.noten;
  const bilder = await Promise.all(noten.map((n) => db.holen('bilder', `referenz-${n}`)));
  ziel.innerHTML = noten.map((n, i) => `<figure>${bilder[i] ? `<img src="${url(bilder[i].blob)}" alt="">` : '<img alt="">'}<figcaption>Note ${n}<br><button class="knopf klein" data-ref="${n}">${bilder[i] ? 'Ändern' : 'Foto wählen'}</button></figcaption></figure>`).join('');
  ziel.querySelectorAll('[data-ref]').forEach((b) => b.addEventListener('click', async () => {
    const [d] = await dateiWaehlen('#eingabe-bild');
    if (!d) return;
    const bm = await createImageBitmap(d, { imageOrientation: 'from-image' });
    const f = Math.min(1, 800 / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas'); c.width = Math.round(bm.width * f); c.height = Math.round(bm.height * f);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    await db.ablegen('bilder', { schluessel: `referenz-${b.dataset.ref}`, blob, typ: 'referenz' });
    referenzenZeigen();
  }));
}

// ---------- Einrichten am Handy ----------

async function seiteEinrichten() {
  const gilt = seiteGilt();
  titel('Am Handy einrichten', '#/einstellungen');
  if (!(await entsperrt(gilt))) return;
  if (!gilt()) return;
  inhalt.innerHTML = `<p class="leise">Ein Foto aus der Box wählen, dann Werkzeug wählen. Finger auf das Bild, mit der Lupe genau schieben, loslassen.</p>
    <div class="reihe"><button class="knopf" id="foto">Foto wählen</button></div>
    <div class="reihe" style="margin:8px 0"><button class="knopf klein" data-m="karte">Farbkarte</button><button class="knopf klein" data-m="kreis">Topfkreis</button><button class="knopf klein" data-m="etikett">Etikett</button><button class="knopf klein" id="massstab">Maßstab-Karte</button></div>
    <p class="karte" id="anleitung">Erst ein Foto wählen.</p>
    <canvas class="einrichten" id="lw"></canvas><canvas class="lupe" id="lupe" width="180" height="180"></canvas>
    <button class="knopf haupt gross" id="fertig" style="margin-top:12px">Fertig (neue Kennung ${esc(naechsteKennung(z.einst.kennung, 'H'))})</button>`;
  const arbeit = structuredClone(z.einst);
  const einr = new Einrichtung({
    leinwand: $('#lw'), lupe: $('#lupe'), anleitung: $('#anleitung'),
    einstellungen: () => arbeit, setzen: (aenderung) => { aenderung(arbeit); einr.zeichnen(); },
    pool, melden,
  });
  $('#foto').addEventListener('click', async () => { const [d] = await dateiWaehlen('#eingabe-bild'); if (d) einr.fotoZeigen(d); });
  inhalt.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => einr.modusSetzen(b.dataset.m)));
  $('#massstab').addEventListener('click', async () => {
    const [d] = await dateiWaehlen('#eingabe-bild');
    if (d) await einr.massstabFotoZeigen(d);
  });
  $('#fertig').addEventListener('click', async () => {
    const geaendert = ['farbkarte', 'auswertekreis', 'etikettbereich', 'massstab'].filter((k) => JSON.stringify(arbeit[k]) !== JSON.stringify(z.einst[k]));
    if (!geaendert.length) { location.hash = '#/einstellungen'; return; }
    const grund = window.prompt('Kurzer Grund (fürs Änderungsprotokoll):', '') ?? '';
    arbeit.kennung = naechsteKennung(z.einst.kennung, 'H');
    arbeit.aenderungen = [...(arbeit.aenderungen || []), { datum: new Date().toISOString(), kennung: arbeit.kennung, wo: 'Handy', was: geaendert.join(', '), grund }];
    arbeit.geaendert = new Date().toISOString();
    z.einst = arbeit; await speichernKonfig(); melden(`Gespeichert als ${arbeit.kennung}.`); location.hash = '#/einstellungen';
  });
}

// ---------- Kamera-Test ----------

async function seiteKameratest() {
  const gilt = seiteGilt();
  titel('Kamera testen', '#/einstellungen');
  if (!gilt()) return;
  inhalt.innerHTML = `<p>Prüft, ob die App Belichtung, Weißabgleich und Fokus selbst festhalten kann. Topf mit Farbkarte in die Box, Handy in den Halter.</p>
    <div class="video-rahmen"><video id="video" playsinline muted></video></div>
    <div id="faehig" class="karte" style="margin-top:10px">Kamera wird gestartet …</div>
    <form id="werte" class="karte" hidden></form>
    <button class="knopf haupt gross" id="serie" disabled>5 Testfotos aufnehmen und vergleichen</button>
    <div id="test-ergebnis"></div>`;
  let spur; let video;
  try {
    video = $('#video');
    const k = await kameraStarten(video);
    if (!video.isConnected) { kameraStoppen(k.strom); return; }
    z.stromAktiv = k.strom; spur = k.spur;
  } catch (f) { $('#faehig').innerHTML = `<b>Kamera nicht verfügbar:</b> ${esc(f.message)}<p>Dann bleibt der Import aus Open Camera der Standard.</p>`; return; }
  const info = kameraInfo(spur);
  const f = info.faehigkeiten; const s = info.einstellungen;
  $('#faehig').innerHTML = `<table class="tabelle"><tbody>
    ${[['Auflösung Vorschau', `${s.width || '?'} × ${s.height || '?'}`], ['Belichtung von Hand', info.kannBelichtung ? '✓' : '✗'], ['ISO', info.kannIso ? '✓' : '✗'],
    ['Weißabgleich von Hand', info.kannWeissabgleich ? '✓' : '✗'], ['Farbtemperatur (Kelvin)', info.kannFarbtemperatur ? '✓' : '✗'], ['Fokus von Hand', info.kannFokus ? '✓' : '✗'], ['Fotos in voller Auflösung (ImageCapture)', info.imageCapture ? '✓' : '✗']]
    .map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</tbody></table>`;
  const regler = [];
  if (f.exposureTime) regler.push(['belichtungszeit', 'Belichtungszeit', f.exposureTime, s.exposureTime]);
  if (f.iso) regler.push(['iso', 'ISO', f.iso, s.iso]);
  if (f.colorTemperature) regler.push(['farbtemperatur', 'Farbtemperatur (K)', f.colorTemperature, s.colorTemperature || 5500]);
  if (f.focusDistance) regler.push(['fokus', 'Fokus-Abstand', f.focusDistance, s.focusDistance]);
  const form = $('#werte');
  if (regler.length) {
    form.hidden = false;
    form.innerHTML = `<h3 style="margin-top:0">Feste Werte</h3>${regler.map(([k, t, b, w]) => `<label class="feld">${t}: <span id="w-${k}">${w ?? z.kamera.werte[k] ?? ''}</span></label>
      <input type="range" name="${k}" min="${b.min}" max="${b.max}" step="${b.step || (b.max - b.min) / 100}" value="${z.kamera.werte[k] ?? w ?? b.min}">`).join('')}
      <button class="knopf" type="submit" style="margin-top:10px">Werte festhalten</button>`;
    form.querySelectorAll('input').forEach((i) => i.addEventListener('input', () => { $(`#w-${i.name}`).textContent = i.value; }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const werte = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, Number(v)]));
      try { await werteAnwenden(spur, werte); z.kamera.werte = werte; await speichernKonfig(); melden('Werte festgehalten.'); } catch (fe) { melden(`Nicht möglich: ${fe.message}`, true); }
    });
  }
  $('#serie').disabled = false;
  $('#serie').addEventListener('click', async () => {
    const knopf = $('#serie'); knopf.disabled = true;
    const ergebnisse = [];
    for (let i = 1; i <= 5; i++) {
      knopf.textContent = `Testfoto ${i} von 5 …`;
      const { blob, quelle } = await fotoAufnehmen(spur, video);
      const r = await pool.auftrag({ typ: 'analysieren', datei: new File([blob], `test${i}.jpg`, { type: 'image/jpeg' }), einstellungen: z.einst, optionen: {} });
      ergebnisse.push({ ...r.ergebnis, quelle });
      await new Promise((res) => setTimeout(res, 800));
      if (!knopf.isConnected) return; // Seite verlassen: Test abbrechen
    }
    const weiss = ergebnisse.map((x) => x.farbkarte?.weiss_roh).filter(Number.isFinite);
    const befall = ergebnisse.map((x) => x.befall_pct).filter(Number.isFinite);
    const spanne = (a) => (a.length ? Math.max(...a) - Math.min(...a) : NaN);
    const grosse = ergebnisse[0].groesse.voll;
    const aufloesungOk = Math.max(grosse.breite, grosse.hoehe) >= 2400;
    const stabil = spanne(weiss) <= 4 && spanne(befall) <= 1.5;
    const geht = aufloesungOk && stabil && (info.kannBelichtung || info.kannWeissabgleich);
    $('#test-ergebnis').innerHTML = `<section class="karte ${geht ? 'gut' : 'warn'}"><b>${geht ? 'Direktaufnahme geht.' : 'Import bleibt Standard.'}</b>
      <p>Auflösung ${grosse.breite} × ${grosse.hoehe} (${ergebnisse[0].quelle}) ${aufloesungOk ? '✓' : '✗ zu klein'} · Weißfeld schwankt um ${fmt(spanne(weiss), 1)} ${spanne(weiss) <= 4 ? '✓' : '✗'} · Befall schwankt um ${fmt(spanne(befall), 1)} Prozentpunkte ${spanne(befall) <= 1.5 ? '✓' : '✗'}</p>
      <div class="reihe"><button class="knopf ${geht ? 'haupt' : ''}" id="direkt">Direktaufnahme verwenden</button><button class="knopf ${geht ? '' : 'haupt'}" id="import">Import verwenden</button></div></section>`;
    $('#direkt').addEventListener('click', async () => { z.kamera.modus = 'direkt'; await speichernKonfig(); melden('Aufnahme: direkt in der App.'); });
    $('#import').addEventListener('click', async () => { z.kamera.modus = 'import'; await speichernKonfig(); melden('Aufnahme: Import aus Open Camera.'); });
    knopf.disabled = false; knopf.textContent = '5 Testfotos aufnehmen und vergleichen';
  });
}

// ---------- Router ----------

async function seiteLaden() {
  const nr = ++seitenNr;
  if (z.stromAktiv) { kameraStoppen(z.stromAktiv); z.stromAktiv = null; }
  const [, name = '', ...rest] = (location.hash || '#/').split('/');
  const param = decodeURIComponent(rest.join('/'));
  if (name !== 'ergebnis') urlsFreigeben();
  try {
    switch (name) {
      case 'neu': return await seiteNeu();
      case 'aufnahme': return await seiteAufnahme();
      case 'ergebnis': return await seiteErgebnis();
      case 'sitzung': return await seiteSitzung(param);
      case 'messung': return await seiteMessung(param);
      case 'export': return await seiteExport(param);
      case 'uebersicht': return await seiteUebersicht();
      case 'einstellungen': return await seiteEinstellungen();
      case 'einrichten': return await seiteEinrichten();
      case 'kameratest': return await seiteKameratest();
      default: return await seiteStart();
    }
  } catch (f) {
    console.error(f);
    if (nr !== seitenNr) return;
    inhalt.innerHTML = `<section class="karte fehler"><b>Fehler:</b> ${esc(f.message)}</section><a class="knopf" href="#/">Zur Startseite</a>`;
  }
}

window.addEventListener('hashchange', seiteLaden);

// Kontrollbild oder Foto antippen: groß anzeigen (verschieben mit dem Finger, schließen mit ×).
inhalt.addEventListener('click', (e) => {
  const bild = e.target.closest('img.bild');
  if (!bild) return;
  const zoom = $('#zoom');
  const gross = zoom.querySelector('img');
  gross.onload = () => { zoom.scrollLeft = (gross.scrollWidth - zoom.clientWidth) / 2; zoom.scrollTop = (gross.scrollHeight - zoom.clientHeight) / 2; };
  gross.src = bild.src;
  zoom.hidden = false;
});
$('#zoom button').addEventListener('click', () => { $('#zoom').hidden = true; $('#zoom img').removeAttribute('src'); });

async function serviceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Beim allerersten Besuch gibt es noch keinen Service Worker: dann weder Hinweis noch Neuladen.
  const hatteVersion = Boolean(navigator.serviceWorker.controller);
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    const zeigen = () => {
      $('#aktualisierung').hidden = false;
      $('#neu-laden').onclick = () => reg.waiting?.postMessage('jetzt-aktualisieren');
    };
    if (reg.waiting && hatteVersion) zeigen();
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing;
      neu?.addEventListener('statechange', () => { if (neu.state === 'installed' && hatteVersion) zeigen(); });
    });
    let neuGeladen = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteVersion && !neuGeladen) { neuGeladen = true; location.reload(); } });
  } catch (f) { console.warn('Service Worker:', f); }
}

(async () => {
  await laden();
  await seiteLaden();
  serviceWorker();
  if (navigator.storage?.persisted && !(await navigator.storage.persisted())) db.dauerhaftAnfordern().catch(() => {});
})();

globalThis.appZustand = z;
