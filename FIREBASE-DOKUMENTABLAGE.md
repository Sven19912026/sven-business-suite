# Firebase-Dokumentablage – einmalige Einrichtung

Business Suite 5.0 speichert Dateien unter `business-suite/{userId}/{ownerType}/{ownerId}/...` in Firebase Storage. Die Metadaten liegen als Unterkollektion `dokumente` direkt unter dem jeweiligen Lieferanten oder der jeweiligen Verhandlung.

## 1. Storage-Regel ergänzen

Diesen Block innerhalb von `service firebase.storage { match /b/{bucket}/o { ... } }` ergänzen:

```text
match /business-suite/{userId}/{ownerType}/{ownerId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 30 * 1024 * 1024;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

## 2. Firestore-Regel ergänzen

Jeweils innerhalb der vorhandenen Regeln für `lieferanten/{lieferantId}` und `verhandlungen/{verhandlungId}` ergänzen:

```text
match /dokumente/{dokumentId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;
  allow read, update, delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

## 3. Automatische Löschung aktivieren

Die mitgelieferte Cloud Function prüft stündlich alle Dokumente mit abgelaufener `deleteAfter`-Frist und löscht sowohl die Storage-Datei als auch den Firestore-Metadatensatz.

```bash
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
firebase deploy --only functions:cleanupExpiredNegotiationDocuments
```

Für geplante Cloud Functions muss das Firebase-Projekt den Blaze-Tarif verwenden. Unabhängig davon entfernt die App abgelaufene Dateien zusätzlich beim Öffnen der Verhandlungsverwaltung als Sicherheitsnetz.

## Aufbewahrungslogik

- Laufende Verhandlung: keine automatische Löschfrist.
- Status `Abgeschlossen`, `Gewonnen` oder `Verloren`: vorhandene und neu hochgeladene Dateien erhalten eine Löschfrist von 30 Tagen.
- Wird die Verhandlung wieder geöffnet, wird die Löschfrist der Dokumente entfernt.
- Bereits vor Version 5.0 abgeschlossene Verhandlungen erhalten beim ersten Öffnen der Verhandlungsverwaltung eine neue 30-Tage-Frist, da kein historisches Abschlussdatum vorhanden war.
