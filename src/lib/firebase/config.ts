import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { initAppCheck, getAppCheckToken } from "./app-check";

export const firebaseConfig = {
  apiKey: "AIzaSyAJ1he5OrzyuuLy9S3Q6efQmRCQsDV5O-s",
  authDomain: "vectorizerr.firebaseapp.com",
  projectId: "vectorizerr",
  storageBucket: "vectorizerr.firebasestorage.app",
  messagingSenderId: "717678476656",
  appId: "1:717678476656:web:f30f352b238e1f506ca3b5",
};

export const isFirebaseConfigured = true;

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  if (typeof window !== "undefined") {
    initAppCheck(app);
  }
} catch (error) {
  console.warn(
    "Firebase initialization warning (using local fallback mode if not configured):",
    error,
  );
  // Ensure we still export safe instances or stubs
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db, initAppCheck, getAppCheckToken };
