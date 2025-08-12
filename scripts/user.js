import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('id');

async function loadUser() {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const count = data.totalPurchases || 0;
    const remaining = 6 - (count % 6);
    const percent = ((count % 6) / 6) * 100;

    document.getElementById("remaining").textContent = remaining;
    document.getElementById("lastItem").textContent = data.lastItem || "N/A";
    document.getElementById("mostItem").textContent = data.mostItem || "N/A";
    document.getElementById("progressBar").style.width = `${percent}%`;

    document.getElementById("loading").style.display = "none";
    document.getElementById("content").classList.remove("hidden");
  } else {
    document.getElementById("loading").textContent = "Card not recognized!";
  }
}

loadUser();
