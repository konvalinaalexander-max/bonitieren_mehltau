// ============================================================================
//  Fotobox für die Mehltau-Bonitur – alle 3D-Druckteile in einer Datei
// ----------------------------------------------------------------------------
//  So benutzt du die Datei (OpenSCAD, kostenlos von openscad.org):
//   1. Datei öffnen. Rechts erscheint der "Customizer"
//      (falls nicht: Menü "Window"/"Fenster" -> Haken bei "Hide Customizer" weg).
//   2. Bei "teil" das gewünschte Teil auswählen.
//   3. Eigene Maße in den Gruppen unten eintragen (alle Maße in Millimetern).
//   4. F5 = schnelle Vorschau, F6 = Rendern, danach F7 bzw.
//      "File -> Export -> Export as STL" speichert die Druckdatei.
//  Alle Werte mit (PLATZHALTER) müssen gemessen und eingetragen werden.
//  Die Teile liegen schon in Druckrichtung (flache Seite unten, ohne Stützen).
//  Hinweise und Warnungen (z. B. "passt nicht aufs Druckbett") stehen
//  im Konsolen-Fenster unter "ECHO".
// ============================================================================

/* [Teil auswählen] */

// Welches Teil soll angezeigt bzw. exportiert werden?
teil = "eckverbinder"; // [eckverbinder, handyhalter, led_leiste, zentrierring, abdeckscheibe, farbkarten_halter, etikettenhalter, massstab_halter]

/* [Allgemein] */

// Passungs-Spiel je Seite in mm für Steckteile (Start 0.3; klemmt es: größer, wackelt es: kleiner)
spiel = 0.3;
// Druckbett: Breite in mm (nur für die Warnung)
druckbett_x = 220;
// Druckbett: Tiefe in mm (nur für die Warnung)
druckbett_y = 220;
// Druckbett: größte Druckhöhe in mm (nur für die Warnung)
druckbett_z = 250;

/* [Box] */

// Innenmaß der Box in mm (Breite = Tiefe, zwischen den Platten)
box_innen = 500;
// Innenhöhe der Box in mm (Boden bis Deckel) = Länge der senkrechten Leisten
box_hoehe = 700;
// Dicke der Platten (Wände, Deckel) in mm
platten_dicke = 5;
// Durchmesser des Kameralochs im Deckel in mm
deckel_loch_d = 30;

/* [Eckverbinder] */

// Leistenmaß in mm (Holzleiste mit dem Messschieber nachmessen; Alu-Profil 2020 = 20)
leiste = 20;
// Wandstärke der Hülsen innen (zur Box-Mitte hin) in mm
eck_wand_innen = 3;
// Wandstärke der Hülsen außen (unter den Platten) in mm, mindestens 0.8
eck_wand_aussen = 1.2;
// Steckhülsentiefe in mm: so weit stecken die waagerechten Leisten im Verbinder
eck_tiefe = 25;
// Schraublöcher in den Hülsen (4 Stück, zur Box-Innenseite)?
eck_schraubloch = true;
// Durchmesser der Schraublöcher in mm (Holzschraube 3.5 mm -> 4; Alu-Profil mit M5 -> 5.5)
eck_schraube_d = 4;
// Senkung für Senkkopfschrauben (bei Alu-Profil mit Linsenkopf: aus)?
eck_senkung = true;

/* [Handyhalter] */

// Handy: Länge (lange Seite) in mm, ohne Hülle (PLATZHALTER)
handy_laenge = 160;
// Handy: Breite (kurze Seite) in mm, ohne Hülle (PLATZHALTER)
handy_breite = 75;
// Handy: Dicke in mm, ohne Kamera-Buckel (PLATZHALTER)
handy_dicke = 9;
// Mitte der Hauptkamera-Linse: Abstand von der OBEREN Kante in mm, Handy hochkant von HINTEN gesehen (PLATZHALTER)
linse_von_oben = 20;
// Mitte der Hauptkamera-Linse: Abstand von der LINKEN Kante in mm, von HINTEN gesehen (PLATZHALTER)
linse_von_links = 20;
// Wo liegt die Oberkante des Handys im Halter, von oben aufs Display gesehen?
handy_oben = "links"; // [links, rechts]
// Spiel je Seite zwischen Handy und Halter in mm
handy_spiel = 0.5;
// Durchmesser des Linsenlochs im Halter in mm (wie das Loch im Deckel)
halter_linsenloch_d = 30;
// Kamera-Insel (Buckel): Abstand von der oberen Kante in mm, von hinten gesehen (0 = keine Aussparung)
insel_von_oben = 0;
// Kamera-Insel: Abstand von der linken Kante in mm, von hinten gesehen
insel_von_links = 0;
// Kamera-Insel: Breite in mm (quer, von hinten gesehen; 0 = keine Aussparung)
insel_breite = 0;
// Kamera-Insel: Höhe in mm (längs, von hinten gesehen; 0 = keine Aussparung)
insel_hoehe = 0;
// Bodendicke des Halters in mm
handy_boden = 3;
// Wandstärke um das Handy in mm
handy_wand = 3;
// Randhöhe über der Auflage in mm (etwas kleiner als die Handy-Dicke)
handy_randhoehe = 6;
// Breite des Schraubrands rundum in mm
handy_lasche = 10;
// Schraublöcher im Schraubrand in mm (4 Stück; M3-Schraube -> 3.4)
handy_schraube_d = 3.4;
// Breite der Aussparung für den Ladestecker in mm (0 = keine)
kabel_breite = 14;
// Ladebuchse: Versatz aus der Mitte der Unterkante in mm (von vorne gesehen, + = nach rechts)
kabel_versatz = 0;
// Seite der Tasten, Handy hochkant von VORNE (Display) gesehen
tasten_seite = "rechts"; // [rechts, links, keine]
// Tasten-Aussparung beginnt ... mm unter der oberen Kante (PLATZHALTER)
tasten_von = 40;
// Tasten-Aussparung endet ... mm unter der oberen Kante (PLATZHALTER)
tasten_bis = 110;
// Griffmulde in der vorderen Wand, damit man das Handy greifen kann?
griffmulde = true;
// Zentrierdorn mitdrucken (Hilfe zum Ausrichten über dem Deckel-Loch)?
zentrierdorn = true;

/* [LED-Leiste] */

// Breite des LED-Streifens in mm (nachmessen)
led_breite = 10;
// Länge eines Segments in mm (2 Segmente je Boxseite)
led_laenge = 200;
// Abstand LED-Streifen bis Diffusor in mm (größer = weicheres Licht)
led_abstand = 12;
// Dicke der Diffusorfolie bzw. Opal-Platte in mm
diffusor_dicke = 1;
// Wandstärke der Leiste in mm
led_wand = 2;
// Bodendicke der Leiste in mm
led_boden = 2;
// Schraublöcher im Boden der Leiste (2 Stück)?
led_schraubloch = true;
// Durchmesser der Schraublöcher in mm
led_schraube_d = 3.5;

/* [Zentrierring] */

// Maß B: Topf-Durchmesser unten in mm (größter Wert von 3 Töpfen) (PLATZHALTER)
topf_unten_B = 90;
// Zugabe zum Innendurchmesser in mm (Innenmaß = B + Zugabe)
ring_zugabe = 1;
// Ringhöhe in mm (niedrig halten)
ring_hoehe = 5;
// Ringbreite (Wandstärke) in mm
ring_breite = 6;
// Einführschräge oben innen in mm
ring_fase = 1.5;

/* [Abdeckscheibe] */

// Maß A: Topf-Durchmesser oben, Außenkante Rand, in mm (PLATZHALTER)
topf_oben_A = 120;
// Zugabe zum Durchmesser in mm (Scheibe = A + Zugabe)
scheibe_zugabe = 10;
// Maß G: Mittelloch für die Stängel in mm (PLATZHALTER)
stiel_loch_G = 30;
// Dicke der Scheibe in mm
scheibe_dicke = 2;
// Breite des Schlitzes vom Rand bis zur Mitte in mm
schlitz_breite = 10;
// Griffnase mit Aufhängeloch?
griffnase = true;
// Länge der Griffnase über den Rand hinaus in mm
griffnase_laenge = 15;

/* [Farbkarten- und Etikettenhalter] */

// Sockelhöhe in mm (0 = flach auf dem Boden; z. B. 100, wenn große Pflanzen die Karte verdecken)
sockel_hoehe = 0;
// Befestigung am Boxboden (schrauben: versenkte Löcher unter der Karte)
befestigung = "kleben"; // [kleben, schrauben]
// Durchmesser der Befestigungsschrauben in mm
befestigung_schraube_d = 3.5;
// Bodendicke unter der Karte in mm
karte_boden = 2;
// Breite des Rahmens um die Karte in mm (schmal)
karte_rand = 3;
// Spiel je Seite um die Karte in mm
karten_spiel = 0.5;
// Dicke der Halte-Lippen über dem Kartenrand in mm
lippe_dicke = 1.2;
// Farbkarte: Breite (kurze Seite) in mm
farbkarte_breite = 63.5;
// Farbkarte: Länge (lange Seite) in mm
farbkarte_laenge = 109;
// Farbkarte: Dicke in mm (PLATZHALTER, nachmessen)
farbkarte_dicke = 2;
// Farbkarte: Lippe über dem Kartenrand in mm (0 = keine, dann verdeckt nichts die Farbfelder)
farbkarte_lippe = 0;
// Topf-Karte (Etikett): Länge in mm
etikett_laenge = 85;
// Topf-Karte: Breite in mm
etikett_breite = 55;
// Topf-Karte: Dicke in mm
etikett_dicke = 0.5;
// Topf-Karte: Lippe über dem Kartenrand in mm (hält Papier flach; Rand der Karte frei lassen)
etikett_lippe = 2;

/* [Maßstab-Halter] */

// Kantenlänge der quadratischen Maßstab-Karte in mm
massstab_karte = 100;
// Dicke der Maßstab-Karte (Papier auf Karton) in mm
massstab_dicke = 1.5;
// Breite des Rands um die Karte in mm
massstab_rand = 8;
// Bodendicke unter der Karte in mm
massstab_boden = 2;

/* [Hidden] */

// ---------------------------------------------------------------------------
// Ab hier: abgeleitete Werte und Zeichenbefehle - normalerweise nichts ändern.
// ---------------------------------------------------------------------------
$fa = 2;      // Kreise: höchstens 2 Grad je Kante
$fs = 0.4;    // Kreise: Kantenlänge höchstens 0.4 mm
e = 0.01;     // kleine Zugabe, damit Schnitte sauber durchgehen

// Eckverbinder
eck_wa = max(eck_wand_aussen, 0.8);          // Außenwand (mindestens 0.8 mm)
eck_h  = leiste + 2 * spiel;                  // Lochweite der Hülse
eck_s  = eck_wa + eck_h + eck_wand_innen;     // Außenmaß einer Hülse (Querschnitt)
eck_E  = eck_wa + eck_h + eck_tiefe;          // Länge jeder Hülse ab der Ecke
// Zuschnitt: senkrechte Leisten = Innenhöhe; waagerechte stoßen an die senkrechten
leiste_senkrecht  = box_hoehe;
leiste_waagerecht = box_innen - 2 * (eck_wa + spiel + leiste);

// ============================================================================
//  Hilfsfunktionen
// ============================================================================

// auf 1 Nachkommastelle runden (für die Meldungen)
function r1(x) = round(x * 10) / 10;

// Meldung, ob ein Teil (Größe gx x gy x gz in mm) aufs Druckbett passt.
// Das Teil darf dafür auch um 90 Grad gedreht werden.
module pruefe_druckbett(name, gx, gy, gz) {
    passt = max(gx, gy) <= max(druckbett_x, druckbett_y)
         && min(gx, gy) <= min(druckbett_x, druckbett_y)
         && gz <= druckbett_z;
    if (passt)
        echo(str("OK: ", name, " ist ", r1(gx), " x ", r1(gy), " x ", r1(gz),
                 " mm und passt auf das Druckbett."));
    else
        echo(str("WARNUNG: ", name, " ist ", r1(gx), " x ", r1(gy), " x ", r1(gz),
                 " mm und passt NICHT auf das Druckbett (", druckbett_x, " x ",
                 druckbett_y, " x ", druckbett_z, " mm)! Maße prüfen."));
}

// Tropfenform (Spitze nach oben): waagerechte Löcher lassen sich so ohne Stützen drucken
module tropfen2d(d) {
    hull() {
        circle(d = d);
        translate([0, d / 2 * sqrt(2) - e]) square(2 * e, center = true);
    }
}
// waagerechtes Loch entlang X bzw. Y (mittig um den Ursprung)
module loch_x(d, l) { rotate([90, 0, 90]) linear_extrude(height = l, center = true) tropfen2d(d); }
module loch_y(d, l) { rotate([90, 0, 0])  linear_extrude(height = l, center = true) tropfen2d(d); }

// Senkung (Kegel 90 Grad) - Spitze unten, breite Seite bei z = 0
module senkung(d) { translate([0, 0, -d / 2]) cylinder(d1 = d, d2 = 2 * d + 2 * e, h = d / 2 + e); }

// ============================================================================
//  1. Eckverbinder (3-Wege) - 8 Stück, alle gleich
// ============================================================================
// Lage: Box-Ecke im Ursprung, die drei Hülsen zeigen nach +X, +Y und +Z.
// Die senkrechte Leiste geht ganz durch (steht unten auf der Bodenplatte),
// die waagerechten Leisten stoßen innen an die senkrechte Leiste.
// Für die oberen Ecken wird derselbe Verbinder einfach umgedreht.
module eckverbinder() {
    wa = eck_wa; h = eck_h; s = eck_s; E = eck_E;
    c  = wa + h / 2;                 // Mitte des Leistenquerschnitts
    zs = (s + E) / 2;                // Höhe der Schraublöcher in der senkrechten Hülse
    xs = wa + h + eck_tiefe / 2;     // Lage der Schraublöcher in den waagerechten Hülsen
    d  = eck_schraube_d;
    difference() {
        union() {
            cube([s, s, E]);         // senkrechte Hülse
            cube([E, s, s]);         // waagerechte Hülse in X
            cube([s, E, s]);         // waagerechte Hülse in Y
        }
        // Löcher für die Leisten (senkrecht durchgehend)
        translate([wa, wa, -1]) cube([h, h, E + 2]);
        translate([wa, wa, wa]) cube([E + 1 - wa, h, h]);
        translate([wa, wa, wa]) cube([h, E + 1 - wa, h]);
        // Schraublöcher, alle in den Innenwänden (zur Box-Mitte hin)
        if (eck_schraubloch) {
            // senkrechte Hülse: zwei Löcher
            translate([wa + h + (s - wa - h) / 2, c, zs]) loch_x(d, s - wa - h + 2);
            translate([c, wa + h + (s - wa - h) / 2, zs]) loch_y(d, s - wa - h + 2);
            // Hülse X: ein Loch durch die Innenwand
            translate([xs, wa + h + (s - wa - h) / 2, c]) loch_y(d, s - wa - h + 2);
            // Hülse Y: ein Loch durch die Innenwand
            translate([wa + h + (s - wa - h) / 2, xs, c]) loch_x(d, s - wa - h + 2);
            if (eck_senkung) {
                translate([s, c, zs]) rotate([0, 90, 0])  senkung(d);
                translate([c, s, zs]) rotate([-90, 0, 0]) senkung(d);
                translate([xs, s, c]) rotate([-90, 0, 0]) senkung(d);
                translate([s, xs, c]) rotate([0, 90, 0])  senkung(d);
            }
        }
    }
    pruefe_druckbett("Eckverbinder", E, E, E);
    if (eck_wand_aussen < 0.8)
        echo("WARNUNG: eck_wand_aussen ist kleiner als 0.8 mm - es wird 0.8 mm verwendet.");
    echo(str("ZUSCHNITT: 4 senkrechte Leisten je ", r1(leiste_senkrecht),
             " mm, 8 waagerechte Leisten je ", r1(leiste_waagerecht),
             " mm (lieber 0.5 mm kürzer als länger)."));
    echo(str("HINWEIS: Die Platten liegen an den Ecken auf den Verbindern auf. Abstand Platte-Leiste = ",
             r1(eck_wa + spiel), " mm -> Montageband in etwa dieser Dicke auf die Leisten."));
    echo(str("HINWEIS: Farbkarten- und Etikettenhalter mindestens ", r1(s),
             " mm von den Wänden entfernt aufkleben (neben dem Eckverbinder)."));
}

// ============================================================================
//  2. Handyhalter - liegt auf dem Deckel, Handy flach, Display nach oben
// ============================================================================
// Koordinaten: Draufsicht aufs Display, X nach rechts, Y nach hinten.
// Die Mitte der Hauptkamera (= Mitte Linsenloch) liegt im Ursprung.
// Umrechnung "Handy hochkant von hinten gesehen" (x von links, y von oben)
// in die Draufsicht im Halter (X von der linken Handykante, Y von der vorderen):
function hx(x, y) = (handy_oben == "links") ? y : handy_laenge - y;
function hy(x, y) = (handy_oben == "links") ? handy_breite - x : x;

module handyhalter() {
    Lg = handy_laenge; B = handy_breite;
    a = handy_spiel; w = handy_wand; f = handy_lasche;
    hb = handy_boden; hr = handy_randhoehe;
    xl = hx(linse_von_links, linse_von_oben);   // Linse in der Draufsicht
    yl = hy(linse_von_links, linse_von_oben);
    rl = halter_linsenloch_d / 2;
    aussen = a + w + f;                          // vom Handyrand bis Außenkante
    gx = Lg + 2 * aussen;
    gy = B + 2 * aussen;
    // Zentrierdorn
    dd = min(halter_linsenloch_d, deckel_loch_d) - 2 * spiel;
    dk = dd + 8;                                 // Kragen
    dorn_y = B + aussen + 5 + dk / 2;            // hinter dem Halter

    translate([-xl, -yl, 0]) {
        difference() {
            union() {
                // Grundplatte mit Schraubrand
                translate([-aussen, -aussen, 0]) cube([gx, gy, hb]);
                // Wand um das Handy
                translate([-a - w, -a - w, 0]) cube([Lg + 2 * (a + w), B + 2 * (a + w), hb + hr]);
            }
            // Tasche für das Handy
            translate([-a, -a, hb]) cube([Lg + 2 * a, B + 2 * a, hr + 1]);
            // Linsenloch
            translate([xl, yl, -1]) cylinder(r = rl, h = hb + 2);
            // Aussparung für die Kamera-Insel (Buckel)
            if (insel_breite > 0 && insel_hoehe > 0) {
                x1 = hx(insel_von_links, insel_von_oben);
                x2 = hx(insel_von_links + insel_breite, insel_von_oben + insel_hoehe);
                y1 = hy(insel_von_links, insel_von_oben);
                y2 = hy(insel_von_links + insel_breite, insel_von_oben + insel_hoehe);
                translate([min(x1, x2) - 1, min(y1, y2) - 1, -1])
                    cube([abs(x2 - x1) + 2, abs(y2 - y1) + 2, hb + 2]);
            }
            // Aussparung für den Ladestecker (Unterkante des Handys, Mitte)
            if (kabel_breite > 0) {
                xk = hx(B / 2 - kabel_versatz, Lg);
                yk = hy(B / 2 - kabel_versatz, Lg);
                translate([xk - (a + w + 1), yk - kabel_breite / 2, hb])
                    cube([2 * (a + w + 1), kabel_breite, hr + 1]);
            }
            // Aussparung für die Tasten (Seitenkante)
            if (tasten_seite != "keine") {
                xs = (tasten_seite == "rechts") ? 0 : B;   // von hinten gesehen
                x1 = hx(xs, tasten_von);
                x2 = hx(xs, tasten_bis);
                ys = hy(xs, tasten_von);
                translate([min(x1, x2), ys - (a + w + 1), hb])
                    cube([abs(x2 - x1), 2 * (a + w + 1), hr + 1]);
            }
            // Griffmulde in der vorderen Wand
            if (griffmulde)
                translate([Lg / 2, -a - w / 2, hb]) cylinder(d = 25, h = hr + 1);
            // 4 Schraublöcher im Schraubrand, von oben versenkt
            for (px = [-aussen + f / 2, Lg + aussen - f / 2], py = [-aussen + f / 2, B + aussen - f / 2]) {
                translate([px, py, -1]) cylinder(d = handy_schraube_d, h = hb + 2);
                translate([px, py, hb]) senkung(handy_schraube_d);
            }
            // Zentrier-Kerben: zeigen die Linsenmitte an allen 4 Außenkanten
            for (p = [[xl, -aussen, 0], [xl, B + aussen, 180], [-aussen, yl, -90], [Lg + aussen, yl, 90]])
                translate([p[0], p[1], -1]) rotate([0, 0, p[2]])
                    linear_extrude(height = hb + 2)
                        polygon([[-2.5, -1], [2.5, -1], [0, 3]]);
            // Ritzlinien von den Kerben bis zur Wand (oben auf dem Schraubrand)
            translate([xl - 0.4, -aussen, hb - 0.6]) cube([0.8, f, 1]);
            translate([xl - 0.4, B + a + w, hb - 0.6]) cube([0.8, f, 1]);
            translate([-aussen, yl - 0.4, hb - 0.6]) cube([f, 0.8, 1]);
            translate([Lg + a + w, yl - 0.4, hb - 0.6]) cube([f, 0.8, 1]);
        }
        // Zentrierdorn als eigenes Teilchen hinter dem Halter (Kragen unten)
        if (zentrierdorn)
            translate([xl, dorn_y, 0]) {
                cylinder(d = dk, h = 2);
                cylinder(d = dd, h = 2 + hb + platten_dicke + 2);
                translate([0, 0, 2 + hb + platten_dicke + 2 - e])
                    cylinder(d1 = dd, d2 = dd - 2, h = 1);
            }
    }
    // Meldungen
    pruefe_druckbett("Handyhalter", gx, zentrierdorn ? gy + 5 + dk : gy,
                     zentrierdorn ? max(hb + hr, 2 + hb + platten_dicke + 3) : hb + hr);
    if (min(xl, Lg - xl, yl, B - yl) + a < rl)
        echo(str("WARNUNG: Das Linsenloch (", halter_linsenloch_d,
                 " mm) ragt über das Handy hinaus - dort kann Licht in die Box fallen. ",
                 "halter_linsenloch_d kleiner wählen (höchstens ",
                 r1(2 * (min(xl, Lg - xl, yl, B - yl) + a)), " mm) oder die Linsenposition prüfen."));
    if (handy_randhoehe >= handy_dicke)
        echo("HINWEIS: Der Rand ist so hoch wie das Handy - Tasten und Display-Rand prüfen.");
    echo(str("HINWEIS: Linsenmitte liegt ", r1(xl), " mm von der linken und ", r1(yl),
             " mm von der vorderen Handykante (Draufsicht). Die Kerben am Rand zeigen die Linsenmitte."));
}

// ============================================================================
//  3. LED-Leiste - U-Kanal für den LED-Streifen mit Nut für den Diffusor
// ============================================================================
// Druckrichtung: Boden unten, Öffnung oben. In der Box wird der Boden
// innen an die obere Leiste geschraubt oder geklebt, die Öffnung zeigt in die Box.
// Der Diffusorstreifen wird von der Stirnseite in die Nuten geschoben.
module led_leiste() {
    wk = led_breite + 2 * spiel;                    // lichte Breite des Kanals
    lw = led_wand; lb = led_boden;
    W  = wk + 2 * lw;                               // Außenbreite
    gt = min(1, lw - 0.8);                          // Nuttiefe in der Wand
    gh = diffusor_dicke + 2 * spiel;                // Nuthöhe
    zd = lb + led_abstand;                          // Unterkante Diffusor
    H  = zd + gh + gt + 1;                          // Gesamthöhe (1 mm Lippe)
    difference() {
        // Querschnitt (Breite in Y, Höhe in Z), entlang X gezogen
        rotate([90, 0, 90]) linear_extrude(height = led_laenge)
            difference() {
                square([W, H]);
                translate([lw, lb]) square([wk, H]);
                // Nuten mit 45-Grad-Dach (ohne Stützen druckbar)
                for (m = [0, 1])
                    translate([m * W, 0]) mirror([m, 0])
                        polygon([[lw + e, zd], [lw - gt, zd], [lw - gt, zd + gh], [lw + e, zd + gh + gt + e]]);
            }
        // Schraublöcher im Boden, innen versenkt (Kopf liegt unter dem LED-Streifen)
        if (led_schraubloch)
            for (x = [20, led_laenge - 20]) {
                translate([x, W / 2, -1]) cylinder(d = led_schraube_d, h = lb + 2);
                translate([x, W / 2, lb]) senkung(led_schraube_d);
            }
    }
    frei = box_innen - 2 * eck_E;                   // Platz je Seite zwischen den Eckverbindern
    n = floor(frei / led_laenge);
    pruefe_druckbett("LED-Leiste", led_laenge, W, H);
    echo(str("HINWEIS: Diffusorstreifen ", r1(wk + 2 * gt - 0.4), " mm breit zuschneiden."));
    echo(str("HINWEIS: Je Boxseite ist ", r1(frei), " mm Platz zwischen den Eckverbindern -> ",
             n, " Segmente je Seite, ", 4 * n, " Stück insgesamt."));
    if (n < 1) echo("WARNUNG: Ein LED-Segment ist länger als der Platz zwischen den Eckverbindern!");
    if (led_breite > leiste) echo("WARNUNG: Der LED-Streifen ist breiter als die Leiste.");
}

// ============================================================================
//  4. Zentrierring - flacher Ring am Boden, in den der Topf gestellt wird
// ============================================================================
module zentrierring() {
    di = topf_unten_B + ring_zugabe;
    da = di + 2 * ring_breite;
    f  = min(ring_fase, ring_hoehe - 1, ring_breite - 1);
    difference() {
        cylinder(d = da, h = ring_hoehe);
        translate([0, 0, -1]) cylinder(d = di, h = ring_hoehe + 2);
        // Einführschräge oben innen
        translate([0, 0, ring_hoehe - f]) cylinder(d1 = di, d2 = di + 2 * f + 2 * e, h = f + e);
    }
    pruefe_druckbett("Zentrierring", da, da, ring_hoehe);
    echo(str("HINWEIS: Zentrierring innen ", r1(di), " mm, außen ", r1(da), " mm."));
}

// ============================================================================
//  5. Abdeckscheibe - deckt Erde und Topfrand ab (matt schwarz drucken)
// ============================================================================
module abdeckscheibe() {
    D  = topf_oben_A + scheibe_zugabe;
    t  = scheibe_dicke;
    sb = min(schlitz_breite, stiel_loch_G);
    nb = 22;                                         // Breite der Griffnase
    difference() {
        union() {
            cylinder(d = D, h = t);
            if (griffnase)                           // Griffnase gegenüber dem Schlitz
                hull() {
                    translate([-D / 2 + 5, 0, 0]) cylinder(d = nb, h = t);
                    translate([-D / 2 - griffnase_laenge + nb / 2, 0, 0]) cylinder(d = nb, h = t);
                }
        }
        // Mittelloch für die Stängel
        translate([0, 0, -1]) cylinder(d = stiel_loch_G, h = t + 2);
        // Schlitz vom Rand bis zur Mitte
        translate([0, -sb / 2, -1]) cube([D / 2 + 1, sb, t + 2]);
        // Einführtrichter am Rand
        translate([0, 0, -1]) linear_extrude(height = t + 2)
            polygon([[D / 2 - 10, sb / 2], [D / 2 + 1, sb / 2 + 6],
                     [D / 2 + 1, -sb / 2 - 6], [D / 2 - 10, -sb / 2]]);
        // Aufhängeloch in der Griffnase
        if (griffnase)
            translate([-D / 2 - griffnase_laenge + nb / 2, 0, -1]) cylinder(d = 6, h = t + 2);
    }
    pruefe_druckbett("Abdeckscheibe", D + (griffnase ? griffnase_laenge : 0), D, t);
    if (griffnase && D <= min(druckbett_x, druckbett_y) && D + griffnase_laenge > max(druckbett_x, druckbett_y))
        echo("HINWEIS: Ohne Griffnase (griffnase = false) passt die Scheibe aufs Druckbett.");
    echo(str("HINWEIS: Abdeckscheibe Durchmesser ", r1(D), " mm, Mittelloch ", r1(stiel_loch_G), " mm."));
    if (schlitz_breite > stiel_loch_G)
        echo("HINWEIS: Der Schlitz ist breiter als das Mittelloch - es wird die Lochgröße verwendet.");
}

// ============================================================================
//  6./7. Kartenhalter (Farbkarte und Topf-Karte) - flach, Karte parallel zur Kamera
// ============================================================================
// kl, kb, kd: Länge, Breite, Dicke der Karte; ue: Lippe über dem Rand (0 = keine)
// Ohne Lippe liegt die Karte bündig in einer Mulde (Griffmulden an den Enden).
// Mit Lippe hält ein Rahmen die Karte an drei Seiten; die vordere Seite (-Y,
// zur Klappe) ist offen zum Einschieben.
module kartenhalter(name, kl, kb, kd, ue) {
    r  = karte_rand; ks = karten_spiel;
    px = kl + 2 * ks;  py = kb + 2 * ks;             // Mulde
    ox = px + 2 * r;   oy = py + 2 * r;              // außen
    zf = karte_boden + sockel_hoehe;                 // Oberkante Boden unter der Karte
    ph = (ue > 0) ? kd + ks : kd;                    // Höhe der Mulde bzw. des Schlitzes
    H  = zf + ph + ((ue > 0) ? lippe_dicke : 0);     // Gesamthöhe
    m  = min(1.5, zf - 0.6);                         // Tiefe der Griffmulden im Boden
    d  = befestigung_schraube_d;
    difference() {
        cube([ox, oy, H]);
        if (ue > 0) {
            // Schlitz für die Karte, vorne offen
            translate([r, -1, zf]) cube([px, py + r + 1, ph]);
            // Fenster über der Karte (Lippen links, rechts und hinten)
            translate([r + ue, -1, zf + ph - e]) cube([px - 2 * ue, py + r + 1 - ue, lippe_dicke + 1]);
            // Griffmulde vorne in der Mitte
            translate([ox / 2, r, zf - m]) cylinder(d = 20, h = H);
        } else {
            // offene Mulde
            translate([r, r, zf]) cube([px, py, ph + 1]);
            // Griffmulden an beiden schmalen Enden
            for (x = [r, r + px]) translate([x, oy / 2, zf - m]) cylinder(d = 18, h = H);
        }
        // Schraublöcher unter der Karte (Kopf versenkt, bei Sockel in einem Schacht)
        if (befestigung == "schrauben")
            for (x = [ox / 2 - px / 4, ox / 2 + px / 4]) {
                zk = (zf > 3) ? 3 : zf;              // Höhe, auf der der Schraubenkopf sitzt
                translate([x, oy / 2, -1]) cylinder(d = d, h = zf + 2);
                translate([x, oy / 2, zk]) senkung(d);
                if (zf > 3) translate([x, oy / 2, zk]) cylinder(d = 2 * d + 1, h = H);
            }
    }
    pruefe_druckbett(name, ox, oy, H);
    if (ue > 0 && ue > 4)
        echo(str("HINWEIS: Die Lippe am ", name, " ist breit (", ue, " mm) - prüfen, ob sie nichts Wichtiges verdeckt."));
}

module farbkarten_halter() {
    kartenhalter("Farbkarten-Halter", farbkarte_laenge, farbkarte_breite, farbkarte_dicke, farbkarte_lippe);
}

module etikettenhalter() {
    kartenhalter("Etikettenhalter", etikett_laenge, etikett_breite, etikett_dicke, etikett_lippe);
    echo("HINWEIS: Die offene Seite (Einschub) gehört nach vorne zur Klappe.");
}

// ============================================================================
//  8. Maßstab-Halter - flache Platte mit Mulde für die 10-x-10-cm-Karte
// ============================================================================
module massstab_halter() {
    k  = massstab_karte + 2 * karten_spiel;
    r  = massstab_rand;
    o  = k + 2 * r;
    zb = massstab_boden;
    H  = zb + massstab_dicke;
    difference() {
        cube([o, o, H]);
        translate([r, r, zb]) cube([k, k, H]);
        // Griffmulden links und rechts
        for (x = [r, r + k]) translate([x, o / 2, zb - min(1, zb - 0.6)]) cylinder(d = 18, h = H);
        // Mittenkerben an allen 4 Außenkanten (zum Ausrichten unter der Kamera)
        for (p = [[o / 2, 0, 0], [o / 2, o, 180], [0, o / 2, -90], [o, o / 2, 90]])
            translate([p[0], p[1], -1]) rotate([0, 0, p[2]])
                linear_extrude(height = H + 2) polygon([[-2.5, -1], [2.5, -1], [0, 3]]);
    }
    pruefe_druckbett("Maßstab-Halter", o, o, H);
}

// ============================================================================
//  Auswahl: welches Teil wird gezeichnet?
// ============================================================================
if      (teil == "eckverbinder")      eckverbinder();
else if (teil == "handyhalter")       handyhalter();
else if (teil == "led_leiste")        led_leiste();
else if (teil == "zentrierring")      zentrierring();
else if (teil == "abdeckscheibe")     abdeckscheibe();
else if (teil == "farbkarten_halter") farbkarten_halter();
else if (teil == "etikettenhalter")   etikettenhalter();
else if (teil == "massstab_halter")   massstab_halter();
else echo(str("WARNUNG: Unbekanntes Teil \"", teil, "\"."));
