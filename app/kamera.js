// Kamera im Browser: Vorschau, feste Einstellungen (soweit das Handy sie erlaubt), Foto aufnehmen.
// Ob Belichtung/Weißabgleich/Fokus festgestellt werden können, hängt von Handy und Browser ab –
// darum gibt es den Kamera-Test. Der Foto-Import aus Open Camera funktioniert immer.

/** Kamera starten (Rückkamera, möglichst hohe Auflösung). */
export async function kameraStarten(video) {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Dieser Browser erlaubt keinen Kamerazugriff (HTTPS nötig).');
  const strom = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 4096 }, height: { ideal: 3072 } },
  });
  video.srcObject = strom;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  const spur = strom.getVideoTracks()[0];
  return { strom, spur };
}

export function kameraStoppen(strom) {
  strom?.getTracks().forEach((t) => t.stop());
}

/** Was kann die Kamera (Fähigkeiten) und was ist eingestellt? */
export function kameraInfo(spur) {
  const f = spur.getCapabilities ? spur.getCapabilities() : {};
  const e = spur.getSettings ? spur.getSettings() : {};
  return {
    faehigkeiten: f,
    einstellungen: e,
    kannBelichtung: Array.isArray(f.exposureMode) && f.exposureMode.includes('manual'),
    kannWeissabgleich: Array.isArray(f.whiteBalanceMode) && f.whiteBalanceMode.includes('manual'),
    kannFokus: Array.isArray(f.focusMode) && (f.focusMode.includes('manual') || f.focusMode.includes('single-shot')),
    kannIso: Boolean(f.iso),
    kannFarbtemperatur: Boolean(f.colorTemperature),
    imageCapture: typeof ImageCapture !== 'undefined',
  };
}

/** Feste Werte anwenden; liefert die tatsächlich gesetzten Werte zurück. */
export async function werteAnwenden(spur, werte) {
  const erlaubt = spur.getCapabilities ? spur.getCapabilities() : {};
  const bedingung = {};
  if (werte.belichtungszeit && erlaubt.exposureTime) { bedingung.exposureMode = 'manual'; bedingung.exposureTime = werte.belichtungszeit; }
  if (werte.iso && erlaubt.iso) { bedingung.exposureMode = 'manual'; bedingung.iso = werte.iso; }
  if (werte.farbtemperatur && erlaubt.colorTemperature) { bedingung.whiteBalanceMode = 'manual'; bedingung.colorTemperature = werte.farbtemperatur; }
  if (werte.fokus !== undefined && werte.fokus !== null && erlaubt.focusDistance) { bedingung.focusMode = 'manual'; bedingung.focusDistance = werte.fokus; }
  if (Object.keys(bedingung).length) await spur.applyConstraints({ advanced: [bedingung] });
  return spur.getSettings ? spur.getSettings() : {};
}

/**
 * Foto aufnehmen: bevorzugt ImageCapture.takePhoto (volle Fotoauflösung),
 * sonst Einzelbild aus dem Video (geringere Auflösung).
 */
export async function fotoAufnehmen(spur, video) {
  if (typeof ImageCapture !== 'undefined') {
    try {
      const ic = new ImageCapture(spur);
      const blob = await ic.takePhoto();
      if (blob && blob.size > 0) return { blob, quelle: 'takePhoto' };
    } catch { /* weiter mit Videobild */ }
  }
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((loesen) => c.toBlob(loesen, 'image/jpeg', 0.95));
  return { blob, quelle: 'videobild' };
}
