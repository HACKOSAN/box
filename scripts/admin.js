import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// ==================
// Firebase Config
// ==================
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

// ==================
// DOM Elements
// ==================
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("adminPass");
const loginError = document.getElementById("loginError"); // <-- Add this in HTML
const loginSection = document.getElementById("loginSection");
const adminSection = document.getElementById("adminSection");
const userList = document.getElementById("userList");

// ==================
// Password Checker Function
// ==================
async function handleLogin() {
  const pass = passwordInput.value.trim();
  loginError.textContent = ""; // clear old error

  if (!pass) {
    loginError.textContent = "⚠️ Please enter a password.";
    return;
  }

  if (pass !== "boxadmin") {
    loginError.textContent = "❌ Incorrect password.";
    passwordInput.value = "";
    passwordInput.focus();
    return;
  }

  // Passed check → Show loading
  loginSection.classList.add("hidden");
  adminSection.classList.remove("hidden");
  userList.innerHTML = `<p class="text-gray-500">Loading users...</p>`;

  try {
    await loadUsers();
  } catch (err) {
    console.error("Error loading users:", err);
    userList.innerHTML = `<p class="text-red-500">⚠️ Failed to load users.</p>`;
  }
}

// ==================
// Event Listeners
// ==================
loginBtn.addEventListener("click", handleLogin);

// Allow pressing Enter to login
passwordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    handleLogin();
  }
});

// ==================
// Load Users
// ==================
async function loadUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  userList.innerHTML = "";

  if (snapshot.empty) {
    userList.innerHTML = `<p class="text-gray-500">No users found in the database.</p>`;
    return;
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const card = document.createElement("div");
    card.className = "bg-white p-4 rounded shadow cursor-pointer hover:bg-orange-100";
    card.innerHTML = `
      <h3 class="text-lg font-semibold">${data.name || "User"}</h3>
      <p class="text-sm text-gray-600">UID: ${docSnap.id}</p>
      <p class="text-sm text-gray-600">Purchases: ${data.totalPurchases || 0}</p>
    `;
    card.addEventListener("click", () => showUserProfile(docSnap.id));
    userList.appendChild(card);
  });
}

// ==================
// Show User Profile
// ==================
async function showUserProfile(uid) {
  const profile = document.getElementById("userProfile");
  const profileName = document.getElementById("profileName");
  const profileUID = document.getElementById("profileUID");
  const profileTotal = document.getElementById("profileTotal");
  const profileMost = document.getElementById("profileMost");
  const profileLast = document.getElementById("profileLast");
  const profileReward = document.getElementById("profileReward");
  const historyEl = document.getElementById("profileHistory");

  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      alert("User not found in database.");
      return;
    }

    const data = docSnap.data();
    profile.classList.remove("hidden");
    document.getElementById("userList").classList.add("hidden");

    profileName.textContent = data.name || "User";
    profileUID.textContent = uid;
    profileTotal.textContent = data.totalPurchases || 0;
    profileMost.textContent = data.mostItem || "-";
    profileLast.textContent = data.lastItem || "-";

    profileReward.textContent = 
      data.freeDrink?.claimed ? "✅ Claimed" :
      data.freeDrink?.eligible ? "🎁 Eligible" : "❌ Not yet";

    historyEl.innerHTML = "";
    (data.purchaseHistory || []).slice().reverse().forEach(entry => {
      const date = new Date(entry.timestamp?.seconds * 1000);
      const li = document.createElement("li");
      li.className = "bg-gray-100 p-2 rounded text-sm text-left";
      li.innerHTML = `
        <strong>${entry.item}</strong> × ${entry.quantity}<br>
        <span class='text-gray-500'>${date.toLocaleString()} - $${entry.price.toFixed(2)}</span>
      `;
      historyEl.appendChild(li);
    });

  } catch (err) {
    console.error("Error loading user profile:", err);
    alert("⚠️ Failed to load user profile.");
  }
}

// ==================
// Close Profile
// ==================
document.getElementById("closeProfile").addEventListener("click", () => {
  document.getElementById("userProfile").classList.add("hidden");
  document.getElementById("userList").classList.remove("hidden");
});

// ==================
// Search Filter
// ==================
document.getElementById("search").addEventListener("input", function () {
  const val = this.value.toLowerCase();
  const cards = document.querySelectorAll("#userList > div");
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(val) ? "block" : "none";
  });
});
