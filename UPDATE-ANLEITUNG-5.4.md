# Sven Business Suite 5.4.0

## Neu in dieser Version

### Aufgaben

- Der doppelte Eintrag „Allgemein“ wird in Kategorieauswahl und Kategorienliste nur noch einmal angezeigt.
- Bereits vorhandene doppelte „Allgemein“-Kategorien werden automatisch auf die feste Standardkategorie des jeweiligen Bereichs zusammengeführt.
- Aufgaben mit demselben Fälligkeitsdatum werden innerhalb ihrer Prioritätsgruppe unter einem gemeinsamen Datumsblock zusammengefasst.
- Jeder Datumsblock zeigt den ausgeschriebenen Wochentag und das vollständige Datum, zum Beispiel „Samstag, 25.07.2026“.
- Datumsblöcke sind einzeln ein- und ausklappbar; der Zustand wird lokal gespeichert.
- Aufgaben ohne Fälligkeitsdatum erscheinen gesammelt im Block „Ohne Fälligkeitsdatum“.
- Die einzelne Aufgabe bleibt zusätzlich separat ausklappbar.
- Notizvorschau und mobile Umbruchregeln aus Version 5.3 bleiben erhalten.

### Verhandlungsübersicht

- Die breite PC-Darstellung ohne horizontalen Regler aus Version 5.3 bleibt unverändert enthalten.

## Lokal starten

```bash
npm install
npm run dev
```

## Prüfung und Produktions-Build

```bash
npm run lint
npm run build
```

Alternativ führt der vorhandene GitHub-Workflow nach dem Hochladen automatisch `npm ci` und `npm run check` aus.
