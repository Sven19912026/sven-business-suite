# Firebase-Dokumentablage – Einrichtung und Status

Business Suite 5.1 verwendet weiterhin dieselbe Firebase-Struktur wie Version 5.0:

- Dateien: `business-suite/{userId}/{ownerType}/{ownerId}/...` in Firebase Storage
- Metadaten: Unterkollektion `dokumente` beim jeweiligen Lieferanten oder bei der jeweiligen Verhandlung

Die zusätzlichen Felder für Titel, Beschreibung, Tags und Volltextindex liegen im bestehenden Dokument-Metadatensatz. Dafür sind keine neuen Regeln erforderlich.

## Storage-Regel

```text
match /business-suite/{userId}/{ownerType}/{ownerId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 30 * 1024 * 1024;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

## Firestore-Regel

```text
match /lieferanten/{lieferantId}/dokumente/{dokumentId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;
  allow read, update, delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}

match /verhandlungen/{verhandlungId}/dokumente/{dokumentId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;
  allow read, update, delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

## Automatische 30-Tage-Löschung

Die bereits bereitgestellte Function bleibt unverändert:

```bash
firebase deploy --only functions:cleanupExpiredNegotiationDocuments
```

Eine erneute Bereitstellung ist für das Update auf 5.1 nicht notwendig, wenn das Deployment von Version 5.0 erfolgreich abgeschlossen wurde.
