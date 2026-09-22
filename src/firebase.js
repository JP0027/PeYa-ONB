import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAn3wFrzkBOUr3tuthr-pnQZZ0F2lUrTVA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "peya-onb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "peya-onb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "peya-onb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1096388018525",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1096388018525:web:f2edd8dc24c361f90ba8b4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);