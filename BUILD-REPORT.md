# Sven Business Suite 5.0 – Phase 1

## Umgesetzt

- Firebase-Storage-Dokumentablage direkt in jeder Lieferanten-/Dienstleisterakte.
- Dokumentarten: Verträge, Bonusvereinbarungen, Preislisten, Angebote und Sonstiges.
- Dokumentablage direkt im Bearbeitungsdialog jeder bestehenden Verhandlung.
- Upload bis 30 MB mit Fortschrittsanzeige, Dateigröße, Kategorie, Öffnen und vollständigem Löschen aus Storage und Firestore.
- Rückwärtskompatible Unterkollektionen; bestehende Datenmodelle und Funktionen bleiben unverändert.
- Verhandlungsstatus `Abgeschlossen`, `Gewonnen` oder `Verloren` startet eine 30-Tage-Aufbewahrungsfrist.
- Wieder geöffnete Verhandlungen verlieren die automatische Löschfrist.
- Stündliche Firebase Cloud Function löscht nach Fristablauf Datei und Firestore-Metadatensatz.
- Zusätzliche clientseitige Bereinigung als Sicherheitsnetz.
- Beim manuellen Löschen eines Lieferanten oder einer Verhandlung werden zugehörige Dateien ebenfalls entfernt.

## Firebase-Einrichtung

Siehe `FIREBASE-DOKUMENTABLAGE.md`. Die Storage-/Firestore-Regeln müssen in die vorhandenen Regeln eingefügt und die Cloud Function einmalig bereitgestellt werden.

## Prüfung

`npm run check` erfolgreich ausgeführt: ESLint ohne Fehler, Vite-Produktionsbuild erfolgreich, PWA-Service-Worker erzeugt. Der vollständige Lauf steht in `CHECK-RESULT.txt`.
