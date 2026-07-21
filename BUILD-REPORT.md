# Sven Business Suite 5.1 – Build-Report

## Umgesetzt

### Dokumentablage bei Lieferanten und Verhandlungen

- Mehrfach-Upload und Drag & Drop am PC.
- Mobile Aufnahme über die Gerätekamera mit dem Button „Mit Handy scannen“.
- Kategorien, frei vergebbare Tags, Titel und Beschreibung.
- Volltextsuche über Dateiname, Titel, Beschreibung, Kategorie, Tags und erkannten Dokumenttext.
- Lokale Texterkennung für digitale PDFs, gescannte PDFs, Bilder und Textdateien.
- Bestehende Dokumente können über das Lupen-Symbol nachträglich indexiert werden.
- PDF- und Bildvorschau direkt innerhalb der Business Suite.
- Öffnen in einem neuen Browserfenster bleibt zusätzlich möglich.
- Mehrere Dateien werden nacheinander hochgeladen und einzeln abgesichert.
- Maximale Dateigröße weiterhin 30 MB pro Datei.
- Die bestehende 30-Tage-Löschung für abgeschlossene oder verlorene Verhandlungen bleibt unverändert aktiv.

### Vertragsüberwachung

- Berechnung des Kündigungsstichtags aus Vertragsende und Kündigungsfrist in Monaten.
- Frei wählbare Erinnerungsabstände, standardmäßig 90, 60, 30, 14 und 7 Tage vorher.
- Zentrale Übersicht über anstehende und abgelaufene Vertragsfristen.
- Warnhinweise direkt in der Lieferantenakte und am jeweiligen Vertrag.
- Optional aktivierbare Browser-Benachrichtigung beim Öffnen der App.
- Bestehende Verträge bleiben kompatibel; vorhandene Freitext-Kündigungsfristen werden weiterhin angezeigt und soweit möglich ausgewertet.

### Datenschutz und KI

- Keine KI-Analyse und kein KI-API-Schlüssel eingebaut.
- PDF-Textauslesung und OCR erfolgen lokal im Browser.
- Dokumente werden ausschließlich wie bisher in Firebase Storage gespeichert.

## Rückwärtskompatibilität

- Bestehende Lieferanten, Verhandlungen, Verträge, Aufgaben und Dokumente werden nicht migriert oder überschrieben.
- Neue Felder werden nur ergänzend gespeichert.
- Vorhandene Dokumente funktionieren weiterhin; für die Suche im Dokumentinhalt kann der Volltextindex einmalig per Lupen-Symbol erstellt werden.
- Die bereits eingerichteten Storage- und Firestore-Regeln aus Version 5.0 reichen weiterhin aus.
- Die bereits bereitgestellte Cloud Function für die 30-Tage-Löschung bleibt unverändert kompatibel.

## Prüfung

- `npm run lint`: erfolgreich, keine Fehler.
- `npm run build`: erfolgreich.
- PWA-Service-Worker und Web-App-Manifest wurden erzeugt.
- `node --check functions/index.js`: erfolgreich.
- Vite weist lediglich auf die Größe des Haupt-Bundles hin; dies ist eine Warnung und kein Build-Fehler.

Der vollständige Prüflauf steht in `CHECK-RESULT.txt`.
