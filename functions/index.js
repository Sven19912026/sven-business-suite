const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

initializeApp();

exports.cleanupExpiredNegotiationDocuments = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "Europe/Berlin",
    region: "europe-west3",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async () => {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const abgelaufeneVerhandlungen = await db
      .collection("verhandlungen")
      .where("dokumentLoeschdatum", "<=", Timestamp.now())
      .get();

    let geloescht = 0;

    for (const verhandlung of abgelaufeneVerhandlungen.docs) {
      const dokumente = await verhandlung.ref.collection("dokumente").get();

      await Promise.all(
        dokumente.docs.map(async (eintrag) => {
          const daten = eintrag.data();
          if (daten.storagePath) {
            try {
              await bucket.file(daten.storagePath).delete({ ignoreNotFound: true });
            } catch (error) {
              console.error(`Storage-Datei konnte nicht gelöscht werden: ${daten.storagePath}`, error);
              return;
            }
          }

          await eintrag.ref.delete();
          geloescht += 1;
        })
      );
    }

    console.log(`${geloescht} abgelaufene Verhandlungsdokumente gelöscht.`);
  }
);
