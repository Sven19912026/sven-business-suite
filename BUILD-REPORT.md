# Sven Business Suite 5.4.0 – Build- und Änderungsbericht

## Umgesetzt

### Aufgaben und Kategorien

- Die Kategorie „Allgemein“ wird pro Bereich nur einmal angezeigt.
- Vorhandene doppelte „Allgemein“-Kategorien werden automatisch bereinigt; zugeordnete Aufgaben werden vorher auf die feste Standardkategorie verschoben.
- Aufgaben desselben Fälligkeitstags werden innerhalb ihrer Prioritätsgruppe gemeinsam dargestellt.
- Der Gruppenkopf enthält ausgeschriebenen Wochentag und vollständiges Datum.
- Jeder Fälligkeitstag ist separat ein- und ausklappbar.
- Der Zustand der Datumsgruppen wird benutzerbezogen im lokalen Speicher erhalten.
- Aufgaben ohne Termin werden in einem eigenen Block zusammengefasst.
- Einzelne Aufgaben bleiben weiterhin separat ausklappbar.
- Notizvorschau mit Zeilenumbrüchen und mobile Darstellung ohne seitliches Scrollen bleiben enthalten.
- Die manuelle Sortierung ist auf Aufgaben derselben Priorität und desselben Fälligkeitstags begrenzt, damit die Datumsgruppen konsistent bleiben.

### Verhandlungsübersicht

- Die breite PC-Darstellung und das feste Tabellenlayout aus Version 5.3 bleiben vollständig enthalten.

### Version

- Anwendung, Seitentitel, Metadaten und GitHub-Workflow wurden auf Version 5.4.0 aktualisiert.

## Prüfung in dieser Umgebung

- TypeScript-/JSX-Parserprüfung aller 14 Dateien unter `src/`: erfolgreich.
- Quellcodeprüfungen für Datumsgruppierung, einzelne Ausklappbarkeit, mobile Umbruchregeln und Kategorie-Deduplizierung: erfolgreich.
- `npm ci`: nicht vollständig möglich, weil der bereitgestellte npm-Paketdienst beim Abruf einer Abhängigkeit mit HTTP 503 geantwortet hat.
- Deshalb konnten `npm run lint` und `npm run build` in dieser Laufzeit nicht vollständig ausgeführt werden.
- Unvollständige `node_modules`-Dateien und alte `dist`-Artefakte werden nicht in die ZIP aufgenommen.

Der vorhandene GitHub-Workflow führt nach dem Hochladen automatisch `npm ci` und anschließend `npm run check` aus.
