import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readFirebasePublicConfig(): FirebasePublicConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  };
}

export function isFirebaseConfigured(): boolean {
  const config = readFirebasePublicConfig();
  return Object.values(config).every((value) => typeof value === 'string' && value.trim().length > 0);
}

export function getFirebaseAppClient(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;
  const config = readFirebasePublicConfig();
  return getApps().length ? getApp() : initializeApp(config);
}

export function getFirestoreClient(): Firestore | null {
  const app = getFirebaseAppClient();
  if (!app) return null;
  return getFirestore(app);
}

export function getFirebaseAuthClient(): Auth | null {
  const app = getFirebaseAppClient();
  if (!app) return null;
  return getAuth(app);
}
