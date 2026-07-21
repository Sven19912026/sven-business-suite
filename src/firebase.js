import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase-Webkonfiguration. Diese Werte werden im Browser ohnehin ausgeliefert
// und sind deshalb direkt hinterlegt, damit GitHub Actions keine .env-Datei benoetigt.
const firebaseConfig = {
  apiKey: 'AIzaSyDug0PGYd0hqKWb9nQoYnFVBk6XSuvaixE',
  projectId: 'verhandlungsmanager',
  storageBucket: 'verhandlungsmanager.firebasestorage.app',
  messagingSenderId: '551297307175',
  appId: '1:551297307175:web:a95f1d514880f82b827402',
  measurementId: 'G-18V7SVL3ZC',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
