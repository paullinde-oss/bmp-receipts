import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase web config is public by design; access is governed by the
// Firestore/Storage security rules.
const firebaseConfig = {
  apiKey: "AIzaSyBb0LwSbH5ZdJkrn-QIgQY4Kj718UmGxYs",
  authDomain: "bmp-receipt-tracker.firebaseapp.com",
  projectId: "bmp-receipt-tracker",
  storageBucket: "bmp-receipt-tracker.firebasestorage.app",
  messagingSenderId: "464596621925",
  appId: "1:464596621925:web:c086bbc69df9017d8d448c",
};

// db/storage stay undefined if init fails; callers check before use.
export let db;
export let storage;

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.warn("Firebase not configured:", error.message);
}
