// Umrechnung Befall % -> Note nach der eingestellten Notenskala.

/**
 * skala: { noten: [...], grenzen: [...] } mit grenzen.length === noten.length - 1.
 * Befall < grenzen[0] -> noten[0]; sonst erste Note i (>= 1) mit Befall <= grenzen[i];
 * größer als alle Grenzen -> letzte Note.
 */
export function noteAusBefall(befall, skala) {
  if (!Number.isFinite(befall)) return null;
  const { noten, grenzen } = skala;
  if (befall < grenzen[0]) return noten[0];
  for (let i = 1; i < grenzen.length; i++) {
    if (befall <= grenzen[i]) return noten[i];
  }
  return noten[noten.length - 1];
}

/** Lesbare Beschreibung der Grenzen je Note, z. B. für Tabellen in Werkstatt und App. */
export function notenBeschreibung(skala) {
  const { noten, grenzen } = skala;
  const fmt = (x) => String(x).replace('.', ',');
  return noten.map((note, i) => {
    if (i === 0) return { note, text: `unter ${fmt(grenzen[0])} %` };
    if (i === noten.length - 1) return { note, text: `über ${fmt(grenzen[i - 1])} %` };
    if (i === 1) return { note, text: `${fmt(grenzen[0])} bis ${fmt(grenzen[1])} %` };
    return { note, text: `über ${fmt(grenzen[i - 1])} bis ${fmt(grenzen[i])} %` };
  });
}
