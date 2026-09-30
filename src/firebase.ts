import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

if (typeof process !== 'undefined' && typeof process.loadEnvFile === 'function') {
  try { process.loadEnvFile(); } catch {}
}

const env: Record<string, string | undefined> = (typeof import.meta !== 'undefined' && import.meta.env) 
  ? (import.meta.env as unknown as Record<string, string | undefined>)
  : (typeof process !== 'undefined' && process.env ? process.env : {});

const firebaseConfig: Record<string, string | undefined> = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

Object.entries(firebaseConfig).forEach(([key, value]) => {
  if (!value) {
    console.warn(`Missing Firebase env var: ${key}. Please check your .env file.`);
  }
});

const app = initializeApp(firebaseConfig as any);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});
export const db = getFirestore(app);
export { firebaseConfig };
