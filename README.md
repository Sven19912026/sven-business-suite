# Sven Business Suite 4.0

Moderne, responsive Arbeitsoberfläche für die zentralen Geschäftsprozesse mit Firebase-Authentifizierung und Firestore-Synchronisierung.

## Enthaltene Module

- Dashboard mit Live-Kennzahlen und den nächsten fälligen Aufgaben
- Aufgaben mit bestehenden Kategorien, Filtern, Wiederholungen und Fälligkeiten
- Verträge mit Laufzeiten, Fristen und Ansprechpartnern
- Verhandlungen und Lieferantenverwaltung
- CRM für Firmen, Kontakte, Vorgänge und Aufgaben
- Mitarbeiterverwaltung

## Design 4.0

- Feste Desktop-Sidebar
- Feste Kopfzeile mit Seitenstatus und Benutzerkonto
- Neue Dashboard-Übersicht auf Basis der vorhandenen Firebase-Daten
- Mobile Navigation mit Schnellzugriff und vollständigem Navigationsmenü
- Responsive Darstellung für Smartphone, Tablet und Desktop

## Lokaler Start

Voraussetzung: Node.js 20.19 oder neuer.

```bash
npm ci
npm run dev
```

## Qualitätsprüfung

```bash
npm run check
```

Der Befehl führt ESLint und anschließend den Produktions-Build aus.

## Produktions-Build

```bash
npm run build
```

Die fertigen Dateien werden im Verzeichnis `dist` erzeugt. Durch die relative Vite-Basis kann der Build in einem GitHub-Pages-Unterpfad oder auf einem anderen statischen Webspace veröffentlicht werden.

## GitHub Pages

Der Workflow `.github/workflows/deploy.yml` baut die Anwendung bei Änderungen auf `main` und veröffentlicht den Inhalt von `dist` im Branch `gh-pages`.

## Firebase

Die bestehende Firebase-Konfiguration befindet sich in `src/firebase.js`. Sammlungsnamen, Datenzugriffe und die Aufgaben-Kategorien der Ausgangsversion bleiben erhalten.
