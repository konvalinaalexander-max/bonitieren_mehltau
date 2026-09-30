# Recherche: Selbst bauen oder fertige App nutzen?

Stand: 30.09.2026. Web-Recherche in fünf Bereichen (Handy-Apps, Desktop-/Open-Source-Software,
kommerzielle Systeme und Bonitur-Software, KI-Baukästen und Sprachmodelle, Vorarbeiten speziell zu
Basilikum-Mehltau). Jede Fundstelle wurde ein zweites Mal gegengeprüft: Gibt es sie noch, stimmt der
Preis, kann sie das Behauptete wirklich?

## Ergebnis

**Es gibt keine fertige App, die das kann.** Keine bezahlbare App und kein Dienst deckt alles ab: Foto
eines ganzen Topfs von oben, Anteil grün/gelb/braun, Pflanzengröße, eigene Boniturskala, Topf-IDs und
Excel-Export. Auch speziell für Basilikum-Mehltau wurde weder ein Werkzeug noch ein veröffentlichtes
Bildverfahren gefunden.

**Empfehlung: selbst bauen, aber in Etappen und mit vorhandenen Gratis-Bausteinen.** Der Kern (Farben
korrigieren, Pixel nach Farbe einteilen, zählen) ist einfach, braucht keine KI und ist in anderen
Kulturen erprobt, z. B. bei Gurken-Mehltau.

## Was es gibt – und warum es nicht reicht

| Lösung | Was sie kann | Warum sie nicht reicht | Kosten | Stand 2026 |
|---|---|---|---|---|
| [LeafScan](https://leonlenzo.github.io/leaf-scan/) (Browser, Curtin Univ.) | gesund / chlorotisch / nekrotisch in %, CSV-Export | Forschungsprototyp für einzelne Weizenblätter; Erde und Topf würden als „braun" gezählt; kein Maßstab, keine Topf-IDs, technische Schieberegler | gratis, MIT-Lizenz (Code darf wiederverwendet werden) | neu, aktiv (v1.0 Aug. 2026) |
| [Petiole Pro](https://petiole.pro/) (Android + Desktop) | Blattfläche, Grünindizes, Nekrose (auf dem Handy von Hand umrandet) | gebaut für Einzelblätter auf Kalibrierplatte; keine automatische Gelb/Braun-Einteilung, keine Topf-IDs | App gratis mit Abo-Funktionen; Desktop und Service nur auf Anfrage | aktiv |
| [Leaf Doctor](https://apps.apple.com/gb/app/leaf-doctor/id874509900) (iOS) | % krankes Gewebe | letztes Update 2017, Android-Version weg; jedes Bild von Hand einstellen; nur krank/gesund; keine Größe, kein Export außer E-Mail | gratis | nicht mehr gepflegt |
| Easy Leaf Area, Canopeo, Field Book „Canopy Cover" | grüne Fläche / Bodenbedeckung | zählen nur **grüne** Pixel – gelbe und braune Blätter fallen einfach raus | gratis | Canopeo aufgegeben, andere gepflegt |
| Plantix, PlantVillage, Agrio u. ä. | erkennen, **welche** Krankheit | messen nicht, **wie stark**; Basilikum-Mehltau nicht bestätigt | gratis / Abo | aktiv |
| [PlantCV](https://plantcv.org/) (Python, Danforth Center) | Farbkarten-Korrektur, Pixelklassen, Flächen, Stapelverarbeitung | Programmierbibliothek, keine App für Mitarbeiter | gratis, MPL-2.0 | sehr aktiv |
| ImageJ/Fiji, ilastik | Farbschwellen bzw. lernende Pixelklassifikation am PC | braucht jemanden, der Makros bzw. Klassifikatoren einrichtet; keine Handy-Erfassung | gratis | aktiv |
| APS Assess 2.0 | klassische Befallsschätzung über Farbe | alte 32-Bit-Windows-Software, ein Bild nach dem anderen | ca. 270–540 USD | kein Update |
| LemnaTec, Phenospex, PSI | Profi-Phänotypisierung, könnte es technisch | Zehntausende bis Hunderttausende Euro, für Forschungslabore | nur auf Anfrage | aktiv |
| Gewächshaus-KI (IUNU, Ecoation, HortiKey) | Überwachung ganzer Hightech-Gewächshäuser | Schienen/Kameras, Fokus auf Gemüse, keine Bonitur pro Topf | Enterprise, auf Anfrage | teils unsicher (Umstrukturierungen) |
| Bonitur-Software (PIAF, ARM, smatrix) | Versuchsdaten, Bonitur-Erfassung, Auswertung | **keine** Bildanalyse | auf Anfrage bzw. smatrix 93 €/Nutzer/Monat | aktiv |
| Erfassungs-Apps ([Field Book](https://github.com/PhenoApps/Field-Book), [GridScore](https://github.com/cropgeeks/gridscore-next-client), ODK/Kobo, AppSheet) | Formulare, Barcodes, Export | keine Bildanalyse | gratis bis ca. 10 $/Nutzer/Monat | aktiv |
| KI-Baukästen (Roboflow, Teachable Machine, Edge Impulse) | eigene Bildmodelle trainieren | brauchen Hunderte bewertete Bilder; meist nur „Bild → Klasse", keine Flächenanteile | gratis bis Abo | aktiv, Preise ändern sich oft |
| Sprachmodelle mit Bildverständnis (Claude, GPT, Gemini) als Bewerter | Foto beschreiben, grob einschätzen | Studien zeigen große Schwankungen: dasselbe Foto bekommt verschiedene Noten, und nach Modell-Updates ändert sich die Bewertung. Für eine messbare Note ungeeignet | ca. 0,1–1 Cent pro Bild | aktiv |

## Vorarbeiten aus der Forschung

- **Basilikum-Mehltau:** kein Bildverfahren veröffentlicht, nur visuelle Skalen. Die meisten
  (z. B. Rutgers 0–4) bewerten den Sporenrasen auf der **Blattunterseite**, den eine Kamera von oben
  nicht sieht.
- **Passende Skala:** Ben Naim, Cohen, Wyenandt, Simon u. a. (2025, *Planta*,
  [PMC12122581](https://pmc.ncbi.nlm.nih.gov/articles/PMC12122581/)): Disease Intensity 0–4. Die
  Stufen 1–3 sind über den **Anteil befallener Blattfläche** definiert (bis 10 %, bis 25 %, bis 50 %)
  und lassen sich deshalb gut mit einem Bild-Prozentwert abgleichen. Deutsche Praxisskalen: LVG
  Heidelberg 0–3, HSWT 1–9.
- **Methode anderswo erprobt:** Bei Gurken-Mehltau stimmte die Pixelanteil-Methode sehr gut mit
  Experten überein. Das waren aber Einzelblätter, keine ganzen Töpfe von oben – die Werte lassen sich
  nicht 1:1 übertragen.
- **Warnung aus mehreren Studien:** Ohne kontrolliertes Licht und Farbkarte funktionieren
  Farbmessungen nicht zuverlässig. Das bestätigt die Idee mit der Box.

## Optionen im Vergleich

1. **Eigene Web-App, in Etappen (empfohlen)**
   - Etappe 0: Pilot ohne eigene App (siehe unten)
   - Etappe 1: Erfassungsteil – Topf-ID, Sorte/Satz/Behandlung, manuelle Note mit Referenzfotos,
     Foto-Archiv, Excel-Export. Schon allein nützlich.
   - Etappe 2: automatische Farbanalyse dazu; als Vorlage dient der LeafScan-Code (MIT-Lizenz).
   - Kosten: Hardware ca. 150–250 €, Hosting 0 €.
2. **Handy fotografiert, PC wertet aus:** Fotos landen in einem Ordner, ein PlantCV-Skript erstellt
   daraus eine Excel-Tabelle. Farbtechnisch am robustesten; Ergebnis aber erst später am PC statt
   direkt an der Box. Rückfalloption und gute Referenz, um Option 1 zu prüfen.
3. **Nur digitale Sicht-Bonitur:** Handy-Formular mit Referenzfotos pro Notenstufe, Fotos nur zur
   Dokumentation. Billigste und schnellste Variante. Braucht es ohnehin als Vergleichsbasis – und
   ist die Antwort, falls der Pilot zeigt, dass die Kamera von oben zu viel verpasst.
4. **Fertige Apps (LeafScan, Leaf Doctor, Easy Leaf Area):** nur für den Pilot-Test brauchbar,
   nicht für den Alltag.
5. **KI-Baukästen, App-Baukästen, Sprachmodelle als Bewerter:** zweites System, laufende Kosten,
   Analyse trotzdem nicht gelöst bzw. nicht reproduzierbar. Höchstens als späte Ergänzung.
6. **Profi-Systeme:** weit über Budget.

## Pilot (Etappe 0)

- 100–200 Töpfe über die ganze Befallsbandbreite in einer Box (anfangs auch Karton) fotografieren
- festes Android-Handy, Farbkarte und Topf-Etikett im Bild
- zwei Personen bonitieren jeden Topf wie bisher, inkl. Blick auf die Blattunterseite
- Auswertung mit einem Skript (PlantCV) bzw. zum Vergleich mit LeafScan
- **Entscheidung:** Stimmt der Bildwert (% gelb + braun, Fläche) gut genug mit der Note der Menschen
  überein? Übereinstimmung messen, z. B. mit gewichtetem Kappa.
- Größtes erwartetes Problem: Befall an den unteren Blättern ist von oben nicht sichtbar.

## Was ein Selbstbau braucht, damit er langfristig funktioniert

- Code im Git-Repository (dieses Repo)
- fester Satz von ca. 50 Referenzbildern mit bekannten Ergebnissen, der nach jeder Änderung
  automatisch geprüft wird
- Algorithmus-Version in jeder exportierten Zeile
- Originalfotos immer archivieren, damit man sie später neu auswerten kann
- Web-App auf dem Handy „zum Startbildschirm hinzufügen" und am Ende jeder Sitzung exportieren –
  Browser-Speicher allein ist kein sicheres Archiv

## Nicht bestätigt / offen

- Ob eine Web-App auf dem Android-Handy Belichtung und Weißabgleich selbst festhalten kann (auf dem
  iPhone vermutlich nicht). Falls nicht: die Kamera-App Open Camera mit festen Einstellungen
  verwenden. Klärt der Pilot.
- Preise von Petiole Pro (Desktop/Service), PIAF und ARM sind nicht öffentlich.
- Möglicher Partner für die Validierung: die LVG Heidelberg hat Versuche zu Basilikum-Mehltau an
  Topfbasilikum gemacht. Ob eine Zusammenarbeit möglich ist, wurde nicht geprüft.
