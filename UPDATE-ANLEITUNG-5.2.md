# Update auf Business Suite 5.2

## GitHub-Hauptordner aktualisieren

1. Diese ZIP vollständig entpacken.
2. Den bisherigen, mit GitHub verbundenen Business-Suite-Hauptordner öffnen.
3. Den gesamten Inhalt des entpackten Ordners in den GitHub-Hauptordner kopieren.
4. Bei Windows „Dateien im Ziel ersetzen“ bestätigen.
5. Den versteckten `.git`-Ordner des Hauptordners nicht löschen.
6. Den GitHub-Hauptordner in Visual Studio Code öffnen.
7. Im Terminal ausführen:

```bash
git status
git add .
git commit -m "Business Suite 5.2"
git push
```

Die vorhandene GitHub Action führt anschließend `npm ci` und `npm run check` aus und veröffentlicht die Anwendung.

## Firebase

Für das aktuell eingerichtete Firebase-Projekt ist keine weitere Bereitstellung nötig:

- Die bestehende Storage-Regel erlaubt den neuen Pfadtyp `vertrag` beziehungsweise `crmVertrag` bereits.
- Die aktuell veröffentlichte allgemeine Firestore-Regel für angemeldete Benutzer erlaubt die neuen Vertrags-Unterkollektionen ebenfalls.
- Die Cloud Function `cleanupExpiredNegotiationDocuments` bleibt unverändert und muss nicht erneut bereitgestellt werden.

Bei später strengeren Firestore-Regeln müssen zusätzlich die Vertragsregeln aus `FIREBASE-DOKUMENTABLAGE.md` übernommen werden.

## Nach dem Update testen

1. Business Suite im Browser öffnen und mit `Strg + Umschalt + R` neu laden.
2. Einen Lieferanten öffnen und zum Reiter „Verträge“ wechseln.
3. Einen vorhandenen Vertrag aufklappen.
4. Unter „Vertragsdokumente“ eine PDF oder ein Bild hochladen.
5. Vorschau, Tags und Volltextsuche testen.
6. Danach zum separaten Reiter „Dokumente“ wechseln und kontrollieren, dass die allgemeinen Lieferantenunterlagen weiterhin getrennt vorhanden sind.
7. Optional die zentrale Vertragsverwaltung öffnen und dort das Büroklammer-Symbol eines Vertrags testen.

## Datenbestand

Bestehende Lieferanten, Verträge und Dokumente bleiben unverändert. Vertragsdokumente werden neu und getrennt unter dem jeweiligen Vertrag gespeichert. Allgemeine Dokumente im Lieferanten-Reiter „Dokumente“ werden nicht verschoben.
