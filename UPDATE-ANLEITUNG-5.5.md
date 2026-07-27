# Sven Business Suite 5.5.0 – Rich-Text-Felder

## Neu

- Verhandlungen: Das Feld **Notizen** unterstützt jetzt Fett, Kursiv, Unterstrichen und frei auswählbare Schriftfarbe.
- Aufgaben: Die Felder **Beschreibung** und **Notizen** besitzen denselben Rich-Text-Editor.
- Formatierungen und Zeilenumbrüche werden in den bestehenden Firestore-Stringfeldern gespeichert.
- Rich Text wird in den Aufgabenansichten sowie in der mobilen und der Desktop-Verhandlungsübersicht formatiert dargestellt.
- Die Volltextsuche durchsucht weiterhin den sichtbaren Text und ignoriert HTML-Tags.
- Die PDF-Urlaubsübergabe gibt Verhandlungsnotizen ohne HTML-Tags und mit Zeilenumbrüchen aus.

## Kompatibilität

- Es wurden keine Firestore-Collections oder Feldnamen geändert.
- Bestehende reine Textinhalte bleiben vollständig lesbar und bearbeitbar.
- Erst beim Bearbeiten können bestehende Inhalte um Formatierungen ergänzt werden.
- Eingefügter Fremdinhalt wird als Klartext übernommen; gespeicherter Rich Text wird vor der Darstellung bereinigt.

## Installation / Aktualisierung

```bash
npm install
npm run lint
npm run build
```

Der fertige Produktionsstand befindet sich anschließend im Ordner `dist`.
