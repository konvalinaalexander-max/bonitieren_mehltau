// Einstellungen der Auswertung: Standardwerte, Prüfung, Ergänzen alter Dateien.
// Die Einstellungsdatei (JSON) entsteht in der Analyse-Werkstatt und wird in die App geladen.

/** Version des Rechenwegs. Erhöhen bei jeder Änderung, die Ergebnisse verschieben kann. */
export const ALGORITHMUS_VERSION = 'A-1.0';
/** Version des Dateiformats der Einstellungsdatei. */
export const EINSTELLUNGS_FORMAT = 1;

/**
 * Erlaubte Bereiche der Stellschrauben. Die Regler der Werkstatt bleiben in diesen Grenzen,
 * damit die schnelle Neuberechnung über Histogramme exakt dieselben Zahlen liefert.
 */
export const BEREICHE = {
  farbton: { min: 10, max: 180, schritt: 1 },
  saettigung: { min: 10, max: 50, schritt: 2 },
  helligkeit: { min: 10, max: 35, schritt: 1 },
};

export function standardEinstellungen() {
  return {
    format: EINSTELLUNGS_FORMAT,
    algorithmus_version: ALGORITHMUS_VERSION,
    geaendert: null,
    notiz: '',
    /** Ecken der Farbkarte, normalisiert [x/Breite, y/Höhe]; Reihenfolge: Feld 1, 6, 24, 19. */
    farbkarte: { ecken: null },
    /** Auswertekreis, normalisiert: cx/Breite, cy/Höhe, r/Breite. */
    auswertekreis: null,
    /** Bereich der Topf-Karte mit QR-Code, normalisiert: x, y, w, h. */
    etikettbereich: null,
    /** Pixel je cm² in Blatthöhe, gemessen an der Maßstab-Karte (bei Analyse-Auflösung). */
    massstab: { pixel_pro_cm2: null },
    /** Stellschrauben (Startwerte aus Leitfaden Tabelle 7.8). Prozentwerte als ganze Zahlen. */
    schwellen: {
      h_min: 15, h_max: 170, s_min: 20, v_min: 15, braun_gelb: 45, gelb_gruen: 80,
    },
    /**
     * Notenskala. grenzen[i] trennt noten[i] und noten[i+1]:
     * Befall < grenzen[0] -> noten[0]; sonst die erste Note i >= 1 mit Befall <= grenzen[i].
     * Beispiel 0–4: unter 2 % -> 0; 2–10 % -> 1; über 10–25 % -> 2; über 25–50 % -> 3; über 50 % -> 4.
     */
    notenskala: {
      name: 'Vorschlag 0–4 (angelehnt an Ben Naim et al. 2025)',
      noten: [0, 1, 2, 3, 4],
      grenzen: [2, 10, 25, 50],
    },
    qualitaet: {
      delta_e_warnung: 6,
      delta_e_fehler: 12,
      weiss_min: 120,
      weiss_max: 250,
      min_pflanzen_anteil: 0.02,
    },
    analyse: { lange_kante: 1600, min_fleck: 30 },
    /** Betriebsart der App: 'automatisch' oder 'sicht' (No-Go-Variante: Sicht-Bonitur). */
    modus: 'automatisch',
  };
}

function istObjekt(x) {
  return x && typeof x === 'object' && !Array.isArray(x);
}

/** Ergänzt fehlende Felder (z. B. aus älteren Dateien) mit Standardwerten. */
export function einstellungenErgaenzen(teil) {
  const basis = standardEinstellungen();
  const mischen = (a, b) => {
    if (!istObjekt(b)) return b === undefined ? a : b;
    const aus = { ...a };
    for (const [k, v] of Object.entries(b)) aus[k] = istObjekt(a?.[k]) ? mischen(a[k], v) : v;
    return aus;
  };
  return mischen(basis, teil || {});
}

const istGanz = (x) => Number.isInteger(x);

/** Prüft Einstellungen. Ergebnis: Liste von Fehlertexten (leer = in Ordnung). */
export function einstellungenPruefen(e) {
  const fehler = [];
  const s = e?.schwellen || {};
  const { farbton: F, saettigung: S, helligkeit: V } = BEREICHE;
  for (const k of ['h_min', 'h_max', 'braun_gelb', 'gelb_gruen']) {
    if (!istGanz(s[k]) || s[k] < F.min || s[k] > F.max + 1) fehler.push(`Schwelle ${k} muss eine ganze Zahl zwischen ${F.min} und ${F.max} sein.`);
  }
  if (!(s.h_min <= s.braun_gelb && s.braun_gelb <= s.gelb_gruen && s.gelb_gruen <= s.h_max + 1)) {
    fehler.push('Reihenfolge der Farbton-Grenzen stimmt nicht (h_min ≤ braun/gelb ≤ gelb/grün ≤ h_max).');
  }
  if (!istGanz(s.s_min) || s.s_min < S.min || s.s_min > S.max || (s.s_min - S.min) % S.schritt !== 0) {
    fehler.push(`Mindest-Sättigung muss gerade sein und zwischen ${S.min} und ${S.max} % liegen.`);
  }
  if (!istGanz(s.v_min) || s.v_min < V.min || s.v_min > V.max) {
    fehler.push(`Mindest-Helligkeit muss eine ganze Zahl zwischen ${V.min} und ${V.max} % sein.`);
  }
  const n = e?.notenskala;
  if (!n || !Array.isArray(n.noten) || !Array.isArray(n.grenzen) || n.grenzen.length !== n.noten.length - 1) {
    fehler.push('Notenskala: Es muss genau eine Grenze weniger als Noten geben.');
  } else if (n.grenzen.some((g, i) => !(Number.isFinite(g)) || (i > 0 && g <= n.grenzen[i - 1]))) {
    fehler.push('Notenskala: Grenzen müssen Zahlen in aufsteigender Reihenfolge sein.');
  }
  const ecken = e?.farbkarte?.ecken;
  if (ecken != null && !(Array.isArray(ecken) && ecken.length === 4 && ecken.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)))) {
    fehler.push('Farbkarte: Es werden genau 4 Ecken mit x und y erwartet.');
  }
  const k = e?.auswertekreis;
  if (k != null && !(Number.isFinite(k.cx) && Number.isFinite(k.cy) && k.r > 0)) {
    fehler.push('Auswertekreis: cx, cy und r (größer 0) werden erwartet.');
  }
  if (!(e?.analyse?.lange_kante >= 400)) fehler.push('Analyse: lange_kante muss mindestens 400 sein.');
  return fehler;
}
