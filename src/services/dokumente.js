import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDocs,
} from "firebase/firestore";
import { deleteObject, ref as storageRef } from "firebase/storage";
import {
  trackedDeleteDoc as deleteDoc,
  trackedGetDocs,
  trackedUpdateDoc as updateDoc,
  trackedWriteBatch as writeBatch,
} from "../firebaseUsage";
import { db, storage } from "../firebase";

export const DOKUMENT_KATEGORIEN = [
  "Verträge",
  "Bonusvereinbarungen",
  "Preislisten",
  "Angebote",
  "Sonstiges",
];

export const VERHANDLUNG_DOKUMENT_KATEGORIEN = [
  "Angebote",
  "Verträge",
  "Preislisten",
  "Bonusvereinbarungen",
  "Sonstiges",
];

export const AUFBEWAHRUNG_TAGE = 30;

export function istAbgeschlossenerStatus(status) {
  return ["Abgeschlossen", "Gewonnen", "Verloren"].includes(status);
}

export function addiereTage(datum, tage = AUFBEWAHRUNG_TAGE) {
  const ergebnis = new Date(datum);
  ergebnis.setDate(ergebnis.getDate() + tage);
  return ergebnis;
}

export function timestampZuDatum(wert) {
  if (!wert) return null;
  if (typeof wert.toDate === "function") return wert.toDate();
  if (wert instanceof Date) return wert;
  const datum = new Date(wert);
  return Number.isNaN(datum.getTime()) ? null : datum;
}

export function dokumenteCollection(ownerType, ownerId) {
  const sammlung = ownerType === "verhandlung" ? "verhandlungen" : "lieferanten";
  return collection(db, sammlung, ownerId, "dokumente");
}

export async function dokumentFristenSynchronisieren(ownerId, deleteAfter) {
  if (!ownerId) return;

  const snapshot = await trackedGetDocs(
    collection(db, "verhandlungen", ownerId, "dokumente")
  );

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((eintrag) => {
    batch.update(
      eintrag.ref,
      deleteAfter
        ? { deleteAfter: Timestamp.fromDate(deleteAfter), aktualisiertAm: Timestamp.now() }
        : { deleteAfter: deleteField(), aktualisiertAm: Timestamp.now() }
    );
  });
  await batch.commit();
}

export async function dokumentLoeschen(dokumentRef, daten) {
  if (daten?.storagePath) {
    try {
      await deleteObject(storageRef(storage, daten.storagePath));
    } catch (error) {
      if (error?.code !== "storage/object-not-found") throw error;
    }
  }
  await deleteDoc(dokumentRef);
}

export async function abgelaufeneDokumenteLoeschen(ownerId) {
  if (!ownerId) return 0;

  const snapshot = await getDocs(
    collection(db, "verhandlungen", ownerId, "dokumente")
  );
  const jetzt = new Date();
  const abgelaufen = snapshot.docs.filter((eintrag) => {
    const deleteAfter = timestampZuDatum(eintrag.data().deleteAfter);
    return deleteAfter && deleteAfter <= jetzt;
  });

  await Promise.all(
    abgelaufen.map((eintrag) => dokumentLoeschen(eintrag.ref, eintrag.data()))
  );

  return abgelaufen.length;
}

export async function alleDokumenteLoeschen(ownerType, ownerId) {
  if (!ownerId) return;

  const snapshot = await trackedGetDocs(dokumenteCollection(ownerType, ownerId));
  await Promise.all(
    snapshot.docs.map((eintrag) => dokumentLoeschen(eintrag.ref, eintrag.data()))
  );
}

export async function verhandlungsFristInitialisieren(verhandlung) {
  if (!verhandlung?.id || !istAbgeschlossenerStatus(verhandlung.status)) return null;

  const vorhandeneFrist = timestampZuDatum(verhandlung.dokumentLoeschdatum);
  if (vorhandeneFrist) {
    await abgelaufeneDokumenteLoeschen(verhandlung.id);
    return vorhandeneFrist;
  }

  const frist = addiereTage(new Date());
  await updateDoc(doc(db, "verhandlungen", verhandlung.id), {
    abgeschlossenAm: verhandlung.abgeschlossenAm || Timestamp.now(),
    dokumentLoeschdatum: Timestamp.fromDate(frist),
    geaendertAm: Timestamp.now(),
  });
  await dokumentFristenSynchronisieren(verhandlung.id, frist);
  return frist;
}
