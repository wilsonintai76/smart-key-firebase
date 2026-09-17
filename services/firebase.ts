/**
 * Firebase bootstrap — Hosting (deploy), Realtime Database (data) and
 * Google Sign-In (auth) for SecureKey.
 *
 * Web app config values are public by design (they ship in the bundle);
 * access control lives in `database.rules.json`.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';

interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';

const firebaseConfig: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || (projectId ? `${projectId}.firebaseapp.com` : ''),
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : ''),
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || (projectId ? `${projectId}.firebasestorage.app` : ''),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

/** True when a usable web config is present (apiKey + projectId). */
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Database | null = null;

function getApp(): FirebaseApp | null {
  if (!isFirebaseConfigured) return null;
  if (!app) app = initializeApp(firebaseConfig);
  return app;
}

/** Firebase Auth instance, or null when Firebase is not configured. */
export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;
  const instance = getApp();
  if (!instance) return null;
  auth = getAuth(instance);
  return auth;
}

/** Realtime Database instance, or null when Firebase is not configured. */
export function getFirebaseDb(): Database | null {
  if (db) return db;
  const instance = getApp();
  if (!instance) return null;
  db = getDatabase(instance);
  return db;
}
