# Sven Business Suite 5.2 – Build-Report

## Umgesetzt

### Dokumente direkt am Vertrag

- Jeder gespeicherte Vertrag besitzt jetzt eine eigene Firebase-Dokumentablage.
- Die Ablage ist direkt im Reiter „Verträge“ der jeweiligen Lieferantenakte erreichbar.
- Zusätzlich steht sie in der zentralen Vertragsverwaltung über das Büroklammer-Symbol bereit.
- Dokumentarten: Vertrag, Nachtrag, Kündigung, Anlage, Korrespondenz und Sonstiges.
- Drag & Drop, Mehrfach-Upload, Handy-Kamera, Tags, Volltextsuche sowie PDF- und Bildvorschau stehen auch bei Vertragsdokumenten zur Verfügung.
- Die Dokumente werden unter dem jeweiligen Vertrag in einer eigenen Firestore-Unterkollektion gespeichert.
- Storage-Dateien verwenden weiterhin den geschützten Pfad `business-suite/{userId}/{ownerType}/{ownerId}/...`.
- Beim Löschen eines Vertrags werden dessen Storage-Dateien und Firestore-Dokumenteinträge zuerst vollständig entfernt.

### Allgemeine Lieferantendokumente bleiben getrennt

- Der bestehende Reiter „Dokumente“ in der Lieferantenakte bleibt unverändert erhalten.
- Preislisten, Bonusvereinbarungen, Angebote und allgemeine Unterlagen können weiterhin dort gespeichert werden.
- Bestehende Dokumente werden nicht verschoben oder verändert.

## Rückwärtskompatibilität

- Bestehende Lieferanten, Verträge, Verhandlungen, Aufgaben und Dokumente bleiben erhalten.
- Verträge aus `suiteVertraege` und ältere CRM-Verträge aus `vertraege` werden unterstützt.
- Die bereits bereitgestellte 30-Tage-Löschfunktion für Verhandlungsdokumente bleibt unverändert.
- Für die aktuell veröffentlichten Firebase-Regeln ist keine zusätzliche Änderung notwendig.

## Prüfung

- `npm run lint`: erfolgreich, keine Fehler.
- `npm run build`: erfolgreich.
- PWA-Service-Worker und Web-App-Manifest wurden erzeugt.
- `node --check functions/index.js`: erfolgreich.
- Die Vite-Meldung zur Größe des Haupt-Bundles ist nur eine Warnung und kein Build-Fehler.

Der vollständige Prüflauf steht in `CHECK-RESULT.txt`.
