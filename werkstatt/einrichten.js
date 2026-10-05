// Einrichten in der Werkstatt: Farbkarten-Ecken, Topfkreis, Etikettbereich und Maßstab-Karte
// auf einem Foto anklicken. Alle Koordinaten werden normalisiert gespeichert (x/Breite, y/Höhe).

import { viereckAbbildung, SPALTEN, ZEILEN } from '../kern/farbkarte.js';

const ANLEITUNG = {
  keine: 'Wähle oben ein Werkzeug.',
  karte: 'Farbkarte: Nacheinander die 4 äußeren Ecken der Farbfelder anklicken bzw. antippen (1 braunes Feld, 2 türkises, 3 schwarzes, 4 weißes). Die Lupe hilft beim genauen Treffen; der Punkt wird beim Loslassen gesetzt.',
  kreis: 'Topfkreis: Auf die Mitte der Abdeckscheibe drücken, gedrückt halten (Maustaste oder Finger) und den Radius ziehen. Alle Blattspitzen müssen innen liegen, Farbkarte und Etikett außen.',
  etikett: 'Etikettbereich: Ein Rechteck um die Topf-Karte ziehen (gedrückt halten). Danach wird der QR-Code probeweise gelesen.',
  massstab: 'Maßstab-Karte: Zuerst rechts das Foto der Karte wählen, dann die 4 äußeren Ecken des schwarzen 10 × 10 cm Quadrats anklicken.',
};

/** Analyse-Auflösung wie verkleinern() in kern/bild.js. */
export function analyseGroesse(breite, hoehe, langeKante) {
  const lang = Math.max(breite, hoehe);
  if (lang <= langeKante) return { breite, hoehe };
  const f = langeKante / lang;
  return { breite: Math.max(1, Math.round(breite * f)), hoehe: Math.max(1, Math.round(hoehe * f)) };
}

/** Fläche eines Vielecks (normalisierte Punkte) in Pixeln eines Bildes der Größe B × H. */
export function vieleckFlaeche(punkte, B, H) {
  let s = 0;
  for (let i = 0; i < punkte.length; i++) {
    const [x1, y1] = punkte[i]; const [x2, y2] = punkte[(i + 1) % punkte.length];
    s += x1 * B * y2 * H - x2 * B * y1 * H;
  }
  return Math.abs(s) / 2;
}

export class Einrichtung {
  constructor({ leinwand, lupe, anleitung, einstellungen, setzen, pool, melden, statusKarte }) {
    this.leinwand = leinwand; this.lupe = lupe; this.anleitungEl = anleitung;
    this.einstellungen = einstellungen; // Funktion -> aktuelles Einstellungsobjekt
    this.setzen = setzen; // Funktion(änderung: (e) => void, art)
    this.pool = pool; this.melden = melden; this.statusKarte = statusKarte;
    this.modus = 'keine';
    this.bild = null; this.datei = null;
    this.massstabBild = null; this.massstabDatei = null;
    this.punkte = []; this.ziehen = null; this.mauspos = null; this.setzenBei = null; this.gedrueckt = false;
    this.kartenErgebnis = null;
    this.ereignisse();
    this.anleitungEl.textContent = ANLEITUNG.keine;
  }

  get aktuellesBild() { return this.modus === 'massstab' && this.massstabBild ? this.massstabBild : this.bild; }

  async fotoZeigen(datei) {
    this.datei = datei;
    if (this.bild) this.bild.close?.();
    this.bild = datei ? await createImageBitmap(datei, { imageOrientation: 'from-image' }) : null;
    this.zeichnen();
  }

  async massstabFotoZeigen(datei) {
    this.massstabDatei = datei;
    if (this.massstabBild) this.massstabBild.close?.();
    this.massstabBild = await createImageBitmap(datei, { imageOrientation: 'from-image' });
    this.modusSetzen('massstab');
  }

  modusSetzen(modus) {
    this.modus = modus; this.punkte = []; this.ziehen = null; this.setzenBei = null;
    this.anleitungEl.textContent = ANLEITUNG[modus] || ANLEITUNG.keine;
    if (modus === 'massstab' && !this.massstabBild) this.anleitungEl.textContent = 'Maßstab-Karte: Zuerst rechts unter „Maßstab“ das Foto der 10 × 10 cm Karte wählen.';
    this.zeichnen();
  }

  normPunkt(ereignis) {
    const r = this.leinwand.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (ereignis.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ereignis.clientY - r.top) / r.height))];
  }

  ereignisse() {
    const lw = this.leinwand;
    lw.style.touchAction = 'none';
    // Zeiger-Ereignisse: Maus und Finger. Ecken werden beim Loslassen gesetzt,
    // so kann man den Finger mit der Lupe noch genau hinschieben.
    lw.addEventListener('pointerdown', (e) => {
      lw.setPointerCapture?.(e.pointerId);
      this.gedrueckt = true;
      this.mauspos = this.normPunkt(e);
      this.druecken(this.mauspos);
      this.zeichnen(); this.lupeZeichnen();
    });
    lw.addEventListener('pointermove', (e) => {
      this.mauspos = this.normPunkt(e);
      if (this.ziehen) this.ziehen.bis = this.mauspos;
      if (this.setzenBei) this.setzenBei = this.mauspos;
      this.zeichnen(); this.lupeZeichnen();
    });
    const ende = (e) => {
      if (!this.gedrueckt) return;
      this.gedrueckt = false;
      if (e && e.type !== 'pointercancel') this.mauspos = this.normPunkt(e);
      if (this.setzenBei) { const p = this.mauspos || this.setzenBei; this.setzenBei = null; this.punktSetzen(p); }
      if (this.ziehen) { this.ziehen.bis = this.mauspos || this.ziehen.bis; this.loslassen(); }
      if (e?.pointerType !== 'mouse') { this.mauspos = null; this.lupe.style.display = 'none'; }
      this.zeichnen();
    };
    lw.addEventListener('pointerup', ende);
    lw.addEventListener('pointercancel', ende);
    lw.addEventListener('pointerleave', (e) => { if (!this.gedrueckt && e.pointerType === 'mouse') { this.mauspos = null; this.lupe.style.display = 'none'; this.zeichnen(); } });
    window.addEventListener('resize', () => this.zeichnen());
  }

  druecken(p) {
    if (!this.aktuellesBild) return;
    if (this.modus === 'karte' || this.modus === 'massstab') {
      if (this.modus === 'massstab' && !this.massstabBild) return;
      this.setzenBei = p;
    } else if (this.modus === 'kreis' || this.modus === 'etikett') {
      this.ziehen = { von: p, bis: p };
    }
  }

  punktSetzen(p) {
    this.punkte.push(p);
    if (this.punkte.length === 4) {
      const ecken = this.punkte; this.punkte = [];
      if (this.modus === 'karte') this.karteFertig(ecken); else this.massstabFertig(ecken);
    }
  }

  loslassen() {
    const { von, bis } = this.ziehen; this.ziehen = null;
    const B = this.bild.width; const H = this.bild.height;
    if (this.modus === 'kreis') {
      const r = Math.hypot((bis[0] - von[0]) * B, (bis[1] - von[1]) * H) / B;
      if (r < 0.02) { this.melden('Kreis zu klein – gedrückt halten und den Radius ziehen.'); this.zeichnen(); return; }
      this.setzen((e) => { e.auswertekreis = { cx: von[0], cy: von[1], r }; }, 'geometrie');
    } else if (this.modus === 'etikett') {
      const x = Math.min(von[0], bis[0]); const y = Math.min(von[1], bis[1]);
      const w = Math.abs(bis[0] - von[0]); const h = Math.abs(bis[1] - von[1]);
      if (w < 0.01 || h < 0.01) { this.zeichnen(); return; }
      this.setzen((e) => { e.etikettbereich = { x, y, w, h }; }, 'geometrie');
      this.qrTesten();
    }
    this.zeichnen();
  }

  async karteFertig(ecken) {
    this.anleitungEl.textContent = 'Farbkarte wird geprüft …';
    try {
      const r = await this.pool.auftrag({ typ: 'farbkarteSuchen', datei: this.datei, ecken, langeKante: this.einstellungen().analyse.lange_kante });
      if (!r.gefunden) throw new Error('Farbkarte nicht auswertbar');
      this.kartenErgebnis = r;
      this.setzen((e) => { e.farbkarte = { ...(e.farbkarte || {}), ecken: r.ecken }; }, 'geometrie');
      const de = r.deltaE_mittel;
      let text = `Farbkarte gesetzt. Mittlere Restabweichung ΔE ${de.toFixed(1).replace('.', ',')} (größte ${r.deltaE_max.toFixed(1).replace('.', ',')}).`;
      if (r.reihenfolgeKorrigiert) text += ' Die Reihenfolge der Ecken wurde automatisch korrigiert.';
      text += ' Prüfe: Jedes Quadrat liegt mitten in seinem Farbfeld.';
      this.anleitungEl.textContent = text;
      this.statusKarte?.(r);
    } catch (f) {
      this.melden(`Farbkarte: ${f.message}`, true);
      this.anleitungEl.textContent = ANLEITUNG.karte;
    }
    this.zeichnen();
  }

  massstabFertig(ecken) {
    const e = this.einstellungen();
    const a = analyseGroesse(this.massstabBild.width, this.massstabBild.height, e.analyse.lange_kante);
    const flaeche = vieleckFlaeche(ecken, a.breite, a.hoehe);
    const ppc = flaeche / 100;
    this.setzen((x) => { x.massstab = { pixel_pro_cm2: Math.round(ppc * 10) / 10, ecken, quelle: this.massstabDatei?.name || null }; }, 'massstab');
    this.anleitungEl.textContent = `Maßstab gesetzt: ${ppc.toFixed(0)} Pixel je cm² (bei ${a.breite} × ${a.hoehe} Pixel Analyse-Auflösung), also ca. ${(10 / Math.sqrt(ppc)).toFixed(2).replace('.', ',')} mm je Pixel.`;
    this.zeichnen();
  }

  async qrTesten() {
    const bereich = this.einstellungen().etikettbereich;
    if (!bereich || !this.datei) return;
    try {
      const r = await this.pool.auftrag({ typ: 'qrTesten', datei: this.datei, bereich });
      this.anleitungEl.textContent = r.qr ? `QR-Code gelesen: „${r.qr.text}“.` : 'Kein QR-Code gelesen. Liegt die Topf-Karte im Rechteck und ist sie scharf? (Ohne QR ordnet die Werkstatt über foto_datei zu.)';
    } catch (f) { this.melden(`QR-Test: ${f.message}`, true); }
  }

  lupeZeichnen() {
    const bild = this.aktuellesBild;
    if (!bild || !this.mauspos || this.modus === 'keine') { this.lupe.style.display = 'none'; return; }
    const ctx = this.lupe.getContext('2d');
    const g = 44; const sx = this.mauspos[0] * bild.width - g / 2; const sy = this.mauspos[1] * bild.height - g / 2;
    ctx.fillStyle = '#222'; ctx.fillRect(0, 0, 180, 180);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bild, sx, sy, g, g, 0, 0, 180, 180);
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(90, 70); ctx.lineTo(90, 110); ctx.moveTo(70, 90); ctx.lineTo(110, 90); ctx.stroke();
    this.lupe.style.display = 'block';
  }

  zeichnen() {
    const bild = this.aktuellesBild;
    const lw = this.leinwand;
    const breite = lw.clientWidth || 900;
    const dpr = window.devicePixelRatio || 1;
    if (!bild) {
      lw.width = breite * dpr; lw.height = Math.round(breite * 0.75) * dpr;
      const ctx = lw.getContext('2d'); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, lw.width, lw.height);
      ctx.fillStyle = '#aaa'; ctx.font = `${16 * dpr}px system-ui`; ctx.fillText('Noch kein Foto geladen (Schritt 1).', 20 * dpr, 40 * dpr);
      return;
    }
    const hoehe = Math.round((breite * bild.height) / bild.width);
    lw.width = Math.round(breite * dpr); lw.height = Math.round(hoehe * dpr);
    const ctx = lw.getContext('2d');
    ctx.drawImage(bild, 0, 0, lw.width, lw.height);
    const W = lw.width; const H = lw.height;
    const px = ([x, y]) => [x * W, y * H];
    const e = this.einstellungen();
    ctx.lineWidth = 2 * dpr;
    if (this.modus === 'massstab') {
      const offen = [...this.punkte, ...(this.setzenBei ? [this.setzenBei] : [])];
      const ecken = offen.length ? offen : (e.massstab?.ecken && e.massstab?.quelle === this.massstabDatei?.name ? e.massstab.ecken : []);
      this.vieleck(ctx, ecken.map(px), '#00e0ff', offen.length > 0 && offen.length < 4, dpr);
      return;
    }
    // Topfkreis
    const k = this.ziehen && this.modus === 'kreis'
      ? { cx: this.ziehen.von[0], cy: this.ziehen.von[1], r: Math.hypot((this.ziehen.bis[0] - this.ziehen.von[0]) * bild.width, (this.ziehen.bis[1] - this.ziehen.von[1]) * bild.height) / bild.width }
      : e.auswertekreis;
    if (k) {
      ctx.strokeStyle = '#ffd60a'; ctx.setLineDash([8 * dpr, 6 * dpr]);
      ctx.beginPath(); ctx.arc(k.cx * W, k.cy * H, k.r * W, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(k.cx * W - 8 * dpr, k.cy * H); ctx.lineTo(k.cx * W + 8 * dpr, k.cy * H); ctx.moveTo(k.cx * W, k.cy * H - 8 * dpr); ctx.lineTo(k.cx * W, k.cy * H + 8 * dpr); ctx.stroke();
    }
    // Etikettbereich
    const r = this.ziehen && this.modus === 'etikett'
      ? { x: Math.min(this.ziehen.von[0], this.ziehen.bis[0]), y: Math.min(this.ziehen.von[1], this.ziehen.bis[1]), w: Math.abs(this.ziehen.bis[0] - this.ziehen.von[0]), h: Math.abs(this.ziehen.bis[1] - this.ziehen.von[1]) }
      : e.etikettbereich;
    if (r) { ctx.strokeStyle = '#4cd964'; ctx.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H); }
    // Farbkarte: Messquadrate
    const ecken = e.farbkarte?.ecken;
    if (ecken && !(this.modus === 'karte' && this.punkte.length)) {
      const abb = viereckAbbildung(ecken.map(px));
      const fehler = this.kartenErgebnis?.deltaE_je_feld;
      for (let z = 0; z < ZEILEN; z++) {
        for (let s = 0; s < SPALTEN; s++) {
          const i = z * SPALTEN + s; const uc = (s + 0.5) / SPALTEN; const vc = (z + 0.5) / ZEILEN;
          const du = 0.28 / SPALTEN; const dv = 0.28 / ZEILEN;
          const pts = [abb(uc - du, vc - dv), abb(uc + du, vc - dv), abb(uc + du, vc + dv), abb(uc - du, vc + dv)];
          const de = fehler?.[i];
          ctx.strokeStyle = !Number.isFinite(de) ? '#ffffff' : de <= 3 ? '#4cd964' : de <= 6 ? '#ffd60a' : '#ff3b30';
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath(); pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
        }
      }
      ctx.lineWidth = 2 * dpr;
    }
    if (this.modus === 'karte' && (this.punkte.length || this.setzenBei)) this.vieleck(ctx, [...this.punkte, ...(this.setzenBei ? [this.setzenBei] : [])].map(px), '#ff3b30', true, dpr);
  }

  vieleck(ctx, punkte, farbe, offen, dpr) {
    if (!punkte.length) return;
    ctx.strokeStyle = farbe; ctx.fillStyle = farbe;
    ctx.beginPath();
    punkte.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    if (offen && this.mauspos) ctx.lineTo(this.mauspos[0] * this.leinwand.width, this.mauspos[1] * this.leinwand.height);
    if (!offen) ctx.closePath();
    ctx.stroke();
    punkte.forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, 5 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.font = `bold ${13 * dpr}px system-ui`; ctx.fillText(String(i + 1), x + 7 * dpr, y - 7 * dpr);
    });
  }
}
