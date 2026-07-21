import {
  addDoc as firebaseAddDoc,
  deleteDoc as firebaseDeleteDoc,
  getDoc as firebaseGetDoc,
  getDocs as firebaseGetDocs,
  onSnapshot as firebaseOnSnapshot,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  writeBatch as firebaseWriteBatch,
} from "firebase/firestore";

const STORAGE_KEY = "sven-suite-firestore-usage-v1";
const EVENT_NAME = "sven-suite-firestore-usage-changed";

function emptyUsage() {
  return {
    version: 1,
    total: { reads: 0, writes: 0, deletes: 0 },
    days: {},
    months: {},
    collections: {},
    updatedAt: null,
  };
}

function localDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function monthKey(date = new Date()) {
  return localDateKey(date).slice(0, 7);
}

function safeAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.round(number)
    : 0;
}

function readUsage() {
  if (typeof window === "undefined") return emptyUsage();

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!stored || stored.version !== 1) return emptyUsage();

    return {
      ...emptyUsage(),
      ...stored,
      total: { ...emptyUsage().total, ...(stored.total || {}) },
      days: stored.days || {},
      months: stored.months || {},
      collections: stored.collections || {},
    };
  } catch {
    return emptyUsage();
  }
}

function writeUsage(usage) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function incrementBucket(bucket, type, amount) {
  const next = {
    reads: Number(bucket?.reads || 0),
    writes: Number(bucket?.writes || 0),
    deletes: Number(bucket?.deletes || 0),
  };

  next[type] += amount;
  return next;
}

function normalizeCollectionName(value) {
  return String(value || "Unbekannt")
    .split("/")
    .filter(Boolean)
    .slice(-1)[0] || "Unbekannt";
}

function collectionNameFromReference(reference, snapshot) {
  const snapshotCollection = snapshot?.docs?.[0]?.ref?.parent?.id;
  if (snapshotCollection) return snapshotCollection;

  if (reference?.parent?.id) return reference.parent.id;
  if (reference?.id && reference?.type === "collection") return reference.id;

  const path =
    reference?.path ||
    reference?._path?.segments?.join("/") ||
    reference?._query?.path?.canonicalString?.() ||
    "";

  const parts = String(path).split("/").filter(Boolean);

  if (reference?.type === "document" && parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return normalizeCollectionName(parts[parts.length - 1]);
}

function recordOperation(type, amount = 1, collectionName = "Unbekannt") {
  const safe = safeAmount(amount);
  if (!safe || !["reads", "writes", "deletes"].includes(type)) return;

  const usage = readUsage();
  const day = localDateKey();
  const month = monthKey();
  const collectionNameSafe = normalizeCollectionName(collectionName);

  usage.total = incrementBucket(usage.total, type, safe);
  usage.days[day] = incrementBucket(usage.days[day], type, safe);
  usage.months[month] = incrementBucket(
    usage.months[month],
    type,
    safe
  );
  usage.collections[collectionNameSafe] = incrementBucket(
    usage.collections[collectionNameSafe],
    type,
    safe
  );
  usage.updatedAt = new Date().toISOString();

  const dayLimit = new Date();
  dayLimit.setDate(dayLimit.getDate() - 95);
  const oldestDay = localDateKey(dayLimit);

  Object.keys(usage.days).forEach((key) => {
    if (key < oldestDay) delete usage.days[key];
  });

  writeUsage(usage);
}

function recordSnapshot(snapshot, reference) {
  const collectionName = collectionNameFromReference(reference, snapshot);

  if (typeof snapshot?.docChanges === "function") {
    const changed = snapshot.docChanges().length;

    // Auch eine leere Abfrage verursacht mindestens einen Lesevorgang.
    recordOperation(
      "reads",
      changed > 0 ? changed : snapshot.empty ? 1 : 0,
      collectionName
    );
    return;
  }

  recordOperation("reads", 1, collectionName);
}

export function getFirebaseUsage() {
  return readUsage();
}

export function subscribeFirebaseUsage(callback) {
  if (typeof window === "undefined") return () => {};

  const handler = () => callback(readUsage());

  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", handler);
  };
}

export function resetFirebaseUsage() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function trackedOnSnapshot(reference, ...args) {
  const wrappedArgs = [...args];

  const observerIndex = wrappedArgs.findIndex(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.next === "function"
  );

  if (observerIndex >= 0) {
    const observer = wrappedArgs[observerIndex];

    wrappedArgs[observerIndex] = {
      ...observer,
      next(snapshot) {
        recordSnapshot(snapshot, reference);
        observer.next(snapshot);
      },
    };
  } else {
    const nextIndex = wrappedArgs.findIndex(
      (item) => typeof item === "function"
    );

    if (nextIndex >= 0) {
      const next = wrappedArgs[nextIndex];

      wrappedArgs[nextIndex] = (snapshot) => {
        recordSnapshot(snapshot, reference);
        next(snapshot);
      };
    }
  }

  return firebaseOnSnapshot(reference, ...wrappedArgs);
}

export async function trackedAddDoc(reference, data) {
  const result = await firebaseAddDoc(reference, data);
  recordOperation(
    "writes",
    1,
    collectionNameFromReference(reference)
  );
  return result;
}

export async function trackedSetDoc(reference, ...args) {
  const result = await firebaseSetDoc(reference, ...args);
  recordOperation(
    "writes",
    1,
    collectionNameFromReference(reference)
  );
  return result;
}

export async function trackedUpdateDoc(reference, ...args) {
  const result = await firebaseUpdateDoc(reference, ...args);
  recordOperation(
    "writes",
    1,
    collectionNameFromReference(reference)
  );
  return result;
}

export async function trackedDeleteDoc(reference) {
  const result = await firebaseDeleteDoc(reference);
  recordOperation(
    "deletes",
    1,
    collectionNameFromReference(reference)
  );
  return result;
}

export async function trackedGetDoc(reference) {
  const result = await firebaseGetDoc(reference);
  recordOperation(
    "reads",
    1,
    collectionNameFromReference(reference, result)
  );
  return result;
}

export async function trackedGetDocs(reference) {
  const result = await firebaseGetDocs(reference);
  recordOperation(
    "reads",
    result.size > 0 ? result.size : 1,
    collectionNameFromReference(reference, result)
  );
  return result;
}

export function trackedWriteBatch(database) {
  const batch = firebaseWriteBatch(database);
  const operations = [];

  let proxy;

  proxy = new Proxy(batch, {
    get(target, property) {
      if (property === "set" || property === "update") {
        return (reference, ...args) => {
          operations.push({
            type: "writes",
            collection: collectionNameFromReference(reference),
          });

          target[property](reference, ...args);
          return proxy;
        };
      }

      if (property === "delete") {
        return (reference) => {
          operations.push({
            type: "deletes",
            collection: collectionNameFromReference(reference),
          });

          target.delete(reference);
          return proxy;
        };
      }

      if (property === "commit") {
        return async () => {
          const result = await target.commit();

          const grouped = {};

          operations.forEach((operation) => {
            const key = `${operation.type}:${operation.collection}`;
            grouped[key] = {
              ...operation,
              amount: Number(grouped[key]?.amount || 0) + 1,
            };
          });

          Object.values(grouped).forEach((operation) => {
            recordOperation(
              operation.type,
              operation.amount,
              operation.collection
            );
          });

          return result;
        };
      }

      const value = target[property];
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  return proxy;
}
