# Update auf Business Suite 5.1

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
git commit -m "Business Suite 5.1"
git push
```

Die vorhandene GitHub Action führt anschließend `npm ci` und `npm run check` aus und veröffentlicht die Anwendung.

## Firebase

Für Version 5.1 sind keine zusätzlichen Firebase-Regeln notwendig. Die für Business Suite 5.0 bereits veröffentlichten Storage- und Firestore-Regeln unterstützen auch Tags, Beschreibungen und Volltextindex.

Die Cloud Function `cleanupExpiredNegotiationDocuments` muss nicht erneut bereitgestellt werden, sofern sie bereits erfolgreich läuft.

## Nach dem Update testen

1. Business Suite im Browser öffnen und mit `Strg + Umschalt + R` neu laden.
2. Einen Lieferanten öffnen und den Tab „Dokumente“ auswählen.
3. Eine PDF per Drag & Drop hochladen.
4. Tags ergänzen und nach einem Begriff aus der PDF suchen.
5. Die PDF über das Augen-Symbol in der Vorschau öffnen.
6. Am Handy „Mit Handy scannen“ testen.
7. Einen Vertrag mit Enddatum, Kündigungsfrist und aktiver Überwachung speichern.
8. Die Fristenübersicht auf der Lieferanten-Startseite kontrollieren.

## Bestehende Dokumente

Bestehende Dokumente bleiben vollständig erhalten. Ihr Dateiinhalt ist erst nach einmaligem Klick auf das Lupen-Symbol durchsuchbar. Dateiname, Kategorie und nachträglich gesetzte Tags sind sofort durchsuchbar.
