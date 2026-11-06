import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCnnMevby5nAW2Y76JqVplN9v7W66sMatk",
  authDomain: "nabillab-pa2026-3477.firebaseapp.com",
  projectId: "nabillab-pa2026-3477",
  storageBucket: "nabillab-pa2026-3477.firebasestorage.app",
  messagingSenderId: "39114483275",
  appId: "1:39114483275:web:f5a26cdb5b07c74a00cfce",
  measurementId: "G-BQ741267K0"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);