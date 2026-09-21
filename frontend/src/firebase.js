import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAn3wFrzkBOUr3tuthr-pnQZZ0F2lUrTVA",
  authDomain: "peya-onb.firebaseapp.com",
  projectId: "peya-onb",
  storageBucket: "peya-onb.firebasestorage.app",
  messagingSenderId: "1096388018525",
  appId: "1:1096388018525:web:f2edd8dc24c361f90ba8b4"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);