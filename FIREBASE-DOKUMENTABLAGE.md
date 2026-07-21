# Firebase-Dokumentablage – Einrichtung und Status

Business Suite 5.2 speichert Dokumente getrennt nach ihrem fachlichen Bezug:

- Allgemeine Lieferantendokumente: `lieferanten/{lieferantId}/dokumente`
- Vertragsdokumente: `suiteVertraege/{vertragId}/dokumente`
- Kompatibilität für ältere CRM-Verträge: `vertraege/{vertragId}/dokumente`
- Verhandlungsdokumente: `verhandlungen/{verhandlungId}/dokumente`
- Dateien in Storage: `business-suite/{userId}/{ownerType}/{ownerId}/...`

Der allgemeine Lieferanten-Reiter „Dokumente“ bleibt unabhängig von den Vertragsdokumenten bestehen.

## Storage-Regel

Die bestehende generische Storage-Regel unterstützt auch Vertragsdokumente ohne Änderung:

```text
match /business-suite/{userId}/{ownerType}/{ownerId}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update: if request.auth != null
    && request.auth.uid == userId
    && request.resource.size < 30 * 1024 * 1024;
  allow delete: if request.auth != null && request.auth.uid == userId;
}
```

## Firestore-Regeln bei einer später restriktiven Konfiguration

Das aktuell eingerichtete Projekt besitzt weiterhin einen allgemeinen Zugriff für angemeldete Benutzer und benötigt deshalb für dieses Update keine Regeländerung. Falls diese allgemeine Regel später entfernt wird, ergänze zusätzlich:

```text
match /suiteVertraege/{vertragId}/dokumente/{dokumentId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;
  allow read, update, delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}

match /vertraege/{vertragId}/dokumente/{dokumentId} {
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid;
  allow read, update, delete: if request.auth != null
    && resource.data.userId == request.auth.uid;
}
```

Die bereits vorhandenen Regeln für Lieferanten- und Verhandlungsdokumente bleiben bestehen.

## Löschen von Verträgen

Beim Löschen eines Vertrags entfernt die App zuerst alle zugehörigen Dateien aus Firebase Storage und danach die Dokument-Metadaten aus Firestore. Anschließend wird der Vertrag selbst gelöscht.

## Automatische 30-Tage-Löschung

Die 30-Tage-Löschung gilt weiterhin ausschließlich für Dokumente abgeschlossener oder verlorener Verhandlungen. Vertragsdokumente werden nicht automatisch nach 30 Tagen gelöscht.

Die bestehende Function bleibt unverändert:

```bash
firebase deploy --only functions:cleanupExpiredNegotiationDocuments
```

Eine erneute Bereitstellung ist für Business Suite 5.2 nicht notwendig.
