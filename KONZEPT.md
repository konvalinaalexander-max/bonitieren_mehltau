# Konzept: Mehltau-Bonitur von Basilikum per Handy

Stand: Ideen- und Planungsphase. Noch kein Code.

## 1. Kurzfazit

**Machbar – ja.** Das Grundprinzip (Foto unter kontrolliertem Licht → Pixel nach
Farbe einteilen → Anteil gelber/brauner Blattfläche berechnen) ist in der
Pflanzenforschung Standard und erprobt, z. B.:

- **PlantCV** – Open-Source-Bildanalyse für Pflanzen-Phänotypisierung (Python),
  inkl. Farbkorrektur mit Farbkarte und Farbanalyse von Blattflächen.
- **Leaf Doctor** – Smartphone-App, die Krankheitsbefall über Farbschwellen
  schätzt.
- **APS Assess** – klassische Software zur Befallsschätzung über Farbanteile.

**Schwierigkeit:** Die Programmierung ist mittelschwer, aber gut machbar. Der
eigentlich schwierige Teil ist nicht der Code, sondern:

1. **gleichbleibende Fotos** (→ genau dafür ist die Box da – sehr gute Idee),
2. **Kalibrierung**: die App so einstellen, dass ihre Note mit der Note eurer
   erfahrenen Leute übereinstimmt. Dafür braucht es echte, von Menschen
   bonitierte Fotos.

| Baustein | Schwierigkeit | Kommentar |
|---|---|---|
| Fotobox bauen | leicht–mittel | Maker-Projekt, 3D-Druck + Platten + LED |
| Grün-/Gelb-/Braunanteil messen | mittel | Standard-Bildverarbeitung |
| Pflanzengröße (Fläche) messen | leicht–mittel | Pixel zählen + Maßstab |
| Handy-App mit Kamera, Speichern, Export | mittel | Standard-Web-App |
| Note, die mit Experten übereinstimmt | mittel–schwer | steht und fällt mit Kalibrierdaten |
| KI-Modell (falls Farbschwellen nicht reichen) | schwer | erst später und nur wenn nötig |

---

## 2. Was die App messen kann – und was nicht

**Falscher Mehltau an Basilikum** (*Peronospora belbahrii*):

- Oberseite: Aufhellung/Gelbfärbung (Chlorose), oft von Blattadern begrenzt
- Unterseite: grau-violetter bis schwarzer Sporenrasen
- später: braune Nekrosen, Blattfall

Von oben sieht die Kamera die **Blattoberseite**, also Gelbfärbung und
Braunfärbung. Das passt gut zu eurem Ziel.

**Messbar:**

- Pflanzenfläche von oben (cm²) → Maß für Größe/Wachstum
- Anteil gesund-grün / gelblich / braun an der Pflanzenfläche (%)
- mittlerer „Grünwert" der Pflanze (stufenlose Kennzahl für Vergilbung)
- daraus abgeleitet: Befallsnote nach eurer Skala

**Nicht (direkt) messbar:**

- **Frühe Infektion** ohne sichtbare Vergilbung (Sporen nur auf der Unterseite)
- **Untere Blätter**, die von oberen verdeckt sind – Befall beginnt häufig unten
  → die App wird frühen/unteren Befall unterschätzen. Für Vergleiche
  (Behandlung A vs. B, Verlauf über die Zeit) ist das unkritisch, solange immer
  gleich fotografiert wird.
- **Ursache der Vergilbung**: Gelb kann auch von Nährstoffmangel (N, Fe, Mg),
  Staunässe, Lichtmangel oder alten Blättern kommen. Die App misst
  „Vergilbung", nicht den Pilz. Ein Mensch muss die Ursache kennen/prüfen.
- **Pflanzenhöhe**: mit einem Foto von oben nicht direkt messbar (nur Fläche).
  Falls Höhe wichtig ist: Maßskala an der Innenwand + zweites Foto von der Seite,
  oder später Tiefensensor (LiDAR bei manchen iPhones).

---

## 3. Wie die Bilderkennung funktioniert (Schritt für Schritt)

```
Foto ──► Farbkorrektur ──► Box-Bereich ausschneiden ──► Pflanze vom Hintergrund trennen
                                                                 │
     Ergebnis + Kontrollbild ◄── Kennzahlen berechnen ◄── Pflanzenpixel einfärben:
                                                           grün / gelb / braun
```

1. **Foto** in der Box: gleicher Abstand, gleiches Licht, Topf immer an
   derselben Stelle.
2. **Farbkorrektur**: Im Bild liegt immer eine **Referenzkarte** (mindestens
   Weiß + Grau). Die App rechnet die Farben so um, dass die Karte immer gleich
   aussieht. Damit gleichen wir aus, dass die Handykamera Belichtung und
   Weißabgleich selbst verstellt.
3. **Ausschneiden**: Da die Box fix ist, ist der relevante Bildbereich immer
   gleich. Optional: kleine Markierungen (ArUco/QR-Marker) in den Bodenecken,
   dann findet die App Bereich und Maßstab automatisch.
4. **Pflanze vs. Hintergrund**: Jeder Pixel hat einen **Farbton** (0–360°),
   eine **Sättigung** und eine **Helligkeit**. Pflanzenpixel sind gelb bis grün
   und ausreichend gesättigt. Erde (dunkel, braun, wenig gesättigt), Topf und
   Boden werden verworfen.
5. **Einteilung der Pflanzenpixel**, grob zur Veranschaulichung (die echten
   Grenzwerte werden mit euren Fotos eingestellt):
   - Farbton ca. > 80° → **gesund grün** (typisches Basilikumgrün ≈ 90–110°)
   - Farbton ca. 45–80° → **gelblich / chlorotisch**
   - Farbton ca. < 45° und eher dunkel → **braun / nekrotisch**
   - sehr hell, kaum Farbe → **Glanzlicht**, wird ignoriert
6. **Kennzahlen**: Pixel zählen → Pflanzenfläche in cm² (über den Maßstab),
   % gelb, % braun, mittlerer Grünwert → Note.
7. **Kontrollbild**: Die App zeigt das Foto mit eingefärbten Bereichen (grün /
   gelb / rot). So sehen Mitarbeiter sofort, ob die App sinnvoll erkannt hat –
   wichtig für Vertrauen und zum Aufspüren von Fehlern.
8. **Speichern**: Originalfoto + Ergebnis + Zusatzinfos (Datum, Satz, Sorte,
   Tisch, Behandlung, Mitarbeiter).

> **Wichtig: Originalfotos immer aufheben.** Dann kann man später mit einer
> verbesserten Auswertung (oder einem KI-Modell) alle alten Fotos neu
> auswerten, ohne neu fotografieren zu müssen.

---

## 4. Die Fotobox

### Größe – eher Quader als Würfel

Die Box muss so hoch sein, dass die Kamera die ganze Pflanze sieht. Faustregel
für die normale Hauptkamera (1×, **nicht** Weitwinkel wegen Verzerrung):

> Abstand Kamera → Pflanzenoberkante ≈ gewünschte Bildbreite (kurze Bildseite)

Beispiel: 12-cm-Topf, Pflanze bis ~25 cm Durchmesser und ~25 cm hoch:

- Bildbreite ~30 cm (mit etwas Rand) → Kamera ~30 cm über der Pflanzenoberkante
- Topf ~11 cm + Pflanze ~25 cm + 30 cm → **Kamera ca. 65 cm über dem Boden**
- Grundfläche ca. 40 × 40 cm

→ Eher ein hoher Quader (z. B. 40 × 40 × 70 cm) als ein Würfel.
**Tipp:** Erst mit einem Karton und einer Lampe testen, welche Höhe passt, bevor
gedruckt wird.

### Bauweise

- Die meisten 3D-Drucker haben ~22–25 cm Druckbett → **nur Eckverbinder,
  Handyhalter und LED-Halter drucken**; Kanten aus Alu-Profil (z. B. 2020),
  Holzleisten oder Rundstäben. Stabiler und günstiger als ein komplett
  gedruckter Rahmen.
- **Wände**: matt weiße Platten (Forex/PVC-Hartschaum, Kapa-Platte) → gleichmäßig
  helles, weiches Licht.
- **Boden**: matt und farbneutral (grau oder schwarz) – keine Farbe, die auf die
  Blätter abstrahlt.
- **Topf-Zentrierung**: Ring oder Mulde am Boden, damit der Topf immer mittig
  unter der Kamera steht.
- **Deckel**: Oben nicht ganz offen lassen, sondern eine Deckelplatte mit Loch
  für die Kamera (= gleichzeitig Handyhalter). Sonst verändert Raumlicht
  (Sonne, Hallenbeleuchtung) die Fotos.
- **Referenzkarte** fest montiert im Bildfeld, an einer Stelle, die nie von
  Blättern verdeckt wird (im Karton-Test ausprobieren – Bodenecken können bei
  großen Pflanzen verdeckt sein). Möglichkeiten: günstige Graukarte (~10–20 €) oder eine Farbkarte
  (z. B. X-Rite ColorChecker, ~80–120 €; PlantCV unterstützt diese direkt).
  Sauber halten, nicht in der Sonne lagern (verblasst).

### Licht

- **LED-Streifen mit hohem Farbwiedergabeindex (CRI/Ra ≥ 90)**, Tageslichtweiß
  (5000–6500 K). Billige LEDs verfälschen Grün-/Gelbtöne.
- **Indirekt/diffus**: LEDs rundum oben, zur Wand gerichtet oder hinter einem
  Diffusor (z. B. opakes/weißes Filament, Milchglasfolie). Direktes Licht
  erzeugt Glanzpunkte auf den Blättern.
- **Nicht dimmen** (oder nur mit flimmerfreien Treibern): gedimmte LEDs
  flackern und erzeugen Streifen im Handyfoto.
- Stromversorgung per USB (5 V) → Powerbank, Box bleibt mobil.

### Das Handy

- **Empfehlung: ein festes „Box-Handy"**, das immer in der Box bleibt.
  Verschiedene Handymodelle liefern unterschiedliche Farben – ein Gerät für alle
  Fotos macht die Daten deutlich vergleichbarer. Ein günstiges Android-Handy
  reicht völlig.
- Der Halter wird genau für dieses Modell gedruckt, Kameralinse mittig über dem
  Topf, Handy waagerecht.

### Grobe Kosten (ohne Handy)

LED-Streifen ~15–30 €, Platten ~20–40 €, Profile/Leisten ~20–40 €, Filament
~10 €, Graukarte ~10–20 € → **ca. 80–150 €**.

---

## 5. Die App (Software)

### Empfehlung: Web-App (PWA)

Eine Web-App ist eine Webseite, die sich wie eine App aufs Handy legen lässt.

**Vorteile:**
- läuft auf iPhone und Android
- kein App Store, kein Apple-Entwicklerkonto nötig
- kostenlos hostbar (z. B. GitHub Pages)
- Bildauswertung läuft direkt auf dem Handy, auch offline
- einfach zu ändern und zu verteilen (Link öffnen, fertig)

**Nachteil:** weniger Kontrolle über die Kamera (Belichtung/Weißabgleich lassen
sich im Browser, vor allem auf dem iPhone, kaum fest einstellen). Wird durch
Box + Referenzkarte ausgeglichen.

**Alternative: native App** (Flutter, Kotlin, Swift): volle Kamerakontrolle
(Belichtung, Weißabgleich, Fokus fixieren), aber deutlich aufwendiger in
Entwicklung, Verteilung und Pflege. Nur sinnvoll, falls sich die Web-App als
nicht präzise genug erweist.

### Ablauf für Mitarbeiter

1. Topf in die Box stellen
2. Topf identifizieren: QR-Code auf dem Etikett/Tisch scannen oder Satz/Sorte
   aus einer Liste wählen
3. Foto auslösen
4. App zeigt Kontrollbild + Ergebnis (Fläche, % gelb, % braun, Note)
5. Bestätigen → gespeichert → nächster Topf

### Daten

- **Anfang:** Speicherung auf dem Handy + Export als CSV/Excel
- **Später:** zentrale Ablage (z. B. Online-Datenbank), damit alle Fotos und
  Ergebnisse an einem Ort landen
- **Auswertung:** Befallsverlauf pro Satz/Sorte/Behandlung über die Zeit,
  z. B. als Kurve oder als AUDPC (Fläche unter der Befallsverlaufskurve – das
  übliche Maß in Pflanzenschutzversuchen)

---

## 6. Bonitur-Skala und Kalibrierung

- Die App liefert zuerst einen **stufenlosen Wert** (% befallene Blattfläche)
  und rechnet ihn in **eure bestehende Skala** um (z. B. 0–5, 1–9 oder
  Prozentklassen). Welche Skala ihr heute nutzt, bestimmt die Umrechnung.
- **Kalibrierung:**
  1. ca. 100–200 Töpfe über die ganze Bandbreite fotografieren (gesund bis
     stark befallen)
  2. jeden Topf zusätzlich von 1–3 erfahrenen Personen wie bisher bonitieren
  3. Grenzwerte der App so einstellen, dass App-Note und Menschen-Note möglichst
     gut übereinstimmen
- Nebeneffekt: Menschen bonitieren untereinander oft unterschiedlich (bekanntes
  Problem, gerade bei geringem Befall). Die App ist dagegen immer gleich – das
  ist ein echter Vorteil.

---

## 7. Risiken und Gegenmaßnahmen

| Risiko | Gegenmaßnahme |
|---|---|
| Sichtbare Erde sieht aus wie braune Blätter | dunkle Erde unterscheidet sich meist in Helligkeit; notfalls KI-Segmentierung |
| Rote/violette Basilikumsorten | Farbschwellen funktionieren nicht → separat behandeln oder ausschließen |
| Glanzlichter auf (nassen) Blättern | diffuses Licht, nicht direkt nach dem Gießen fotografieren, Glanzpixel ignorieren |
| Unterschiedliche Pflanzenhöhe verändert die Fläche im Bild | für Vergleiche okay; bei Bedarf Höhe separat erfassen |
| Vergilbung durch andere Ursachen | App misst Vergilbung; Ursache muss bekannt sein |
| Früher/unterer Befall unsichtbar | akzeptieren; App ist für sichtbaren Befall und Verlauf gedacht |
| Farbabweichungen zwischen Handys | ein festes Box-Handy |

---

## 8. Fahrplan

**Phase 0 – Machbarkeitstest (ohne App, ca. 1–2 Wochen)**
- Karton-Box + gute Lampe + Graukarte
- 30–50 Töpfe mit der normalen Kamera-App fotografieren, gesund bis stark
  befallen, jeweils eure Note notieren
- Auswertungs-Prototyp (Skript oder einfache Testseite) → App-Werte mit
  menschlichen Noten vergleichen
- **Ergebnis:** Klarheit, ob Farbanalyse bei euch funktioniert, bevor Zeit in
  Box und App fließt

**Phase 1 – Box + erste App**
- Box final bauen (3D-Druck, LED, Referenzkarte, Handyhalter)
- Web-App: Foto → Kontrollbild + Kennzahlen + Note → speichern → CSV-Export

**Phase 2 – Kalibrierung und Alltagstauglichkeit**
- 100–200 bewertete Töpfe → Grenzwerte und Notenskala einstellen
- Topf-Identifikation (QR-Code / Auswahlliste), zentrale Datenablage
- Verlaufsauswertung pro Satz/Sorte/Behandlung

**Phase 3 – optional**
- KI-Modell, falls Farbschwellen an Grenzen stoßen (Erde vs. Nekrose,
  aderbegrenzte Flecken als typisches Mehltau-Muster erkennen). Dafür sind die
  gesammelten Originalfotos aus Phase 1–2 die Trainingsdaten.
- native App, falls mehr Kamerakontrolle nötig ist

---

## 9. Offene Fragen

1. Welche Bonitur-Skala nutzt ihr aktuell (0–5, 1–9, % Blattfläche, …)?
2. Topfgröße und maximale Pflanzengröße (Durchmesser, Höhe) beim Fotografieren?
3. Nur grüne Sorten oder auch rote/violette?
4. Haben die Mitarbeiter iPhones oder Android? Ist ein festes Box-Handy möglich?
5. Wie viele Töpfe pro Bonitur-Durchgang (10, 100, 1000)? → Tempo und Ablauf
6. Wie werden Töpfe/Sätze identifiziert (Etikett, Tisch, Behandlung)?
7. Wo sollen die Ergebnisse landen (Excel, zentrale Datenbank, …)?
8. Geht es nur um Falschen Mehltau (Vergilbung) oder auch um Echten Mehltau
   (weißer, mehliger Belag)? Letzteres wäre als zusätzliche Kategorie „weiß"
   ebenfalls erkennbar.
