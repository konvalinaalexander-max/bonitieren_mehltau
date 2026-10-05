// Worker für den Demo-Modus: rendert synthetische Box-Fotos als JPEG.
import { szeneErzeugen } from '../werkzeuge/synthetik.js';

self.onmessage = async (e) => {
  const { id, szene } = e.data;
  try {
    const s = szeneErzeugen(szene);
    const leinwand = new OffscreenCanvas(s.bild.width, s.bild.height);
    leinwand.getContext('2d').putImageData(new ImageData(s.bild.data, s.bild.width, s.bild.height), 0, 0);
    const blob = await leinwand.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    const { karte, ...wahrheit } = s.wahrheit;
    self.postMessage({ id, ok: true, blob, wahrheit, einstellungen: s.einstellungen });
  } catch (fehler) {
    self.postMessage({ id, ok: false, fehler: String(fehler?.message || fehler) });
  }
};
