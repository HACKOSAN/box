// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";



const firebaseConfig = {
  apiKey: "AIzaSyDTzNgpaCQUdq6c3OrXmCUebLbc43HPHdo",
  authDomain: "box-cafe-test.firebaseapp.com",
  projectId: "box-cafe-test",
  storageBucket: "box-cafe-test.firebasestorage.app",
  messagingSenderId: "278224369453",
  appId: "1:278224369453:web:ed68af3b0a02dd0999c5a4",
  measurementId: "G-PTP2V5KPLD"
};


const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);