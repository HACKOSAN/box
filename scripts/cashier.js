import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

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

const uuidInput = document.getElementById("uuidInput");
const loadUserBtn = document.getElementById("loadUserBtn");
const scanCardBtn = document.getElementById("scanCardBtn");
const errorMsg = document.getElementById("errorMsg");

const userInfo = document.getElementById("userInfo");
const userName = document.getElementById("userName");
const userUID = document.getElementById("userUID");
const userReward = document.getElementById("userReward");

const addDrinkSection = document.getElementById("addDrinkSection");
const historySection = document.getElementById("historySection");
const purchaseHistory = document.getElementById("purchaseHistory");

const drinkName = document.getElementById("drinkName");
const drinkPrice = document.getElementById("drinkPrice");
const drinkQty = document.getElementById("drinkQty");
const addDrinkBtn = document.getElementById("addDrinkBtn");

let currentUserRef = null;

// Trigger load on Enter key
uuidInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loadUser(uuidInput.value.trim());
  }
});

loadUserBtn.addEventListener("click", () => {
  loadUser(uuidInput.value.trim());
});

scanCardBtn.addEventListener("click", async () => {
  if (!("NDEFReader" in window)) {
    alert("Web NFC not supported on this device/browser.");
    return;
  }

  try {
    const ndef = new NDEFReader();
    await ndef.scan();
    ndef.onreading = (event) => {
      const decoder = new TextDecoder();
      for (const record of event.message.records) {
        const text = decoder.decode(record.data);
        // Extract the number from the URL
        const match = text.match(/id=(\d+)/);
        if (match) {
          const id = match[1];
          uuidInput.value = id;
          loadUser(id);
        }
      }
    };
  } catch (err) {
    console.error("NFC scan failed:", err);
  }
});

async function loadUser(uid) {
  if (!uid) {
    showError("Please enter or scan a UUID.");
    return;
  }

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    showError("User not found.");
    return;
  }

  hideError();
  const data = snap.data();
  currentUserRef = ref;

  userName.textContent = data.name || "User";
  userUID.textContent = `UID: ${uid}`;
  userReward.textContent = data.freeDrink?.claimed
    ? "✅ Claimed"
    : data.freeDrink?.eligible
    ? "🎁 Eligible"
    : "❌ Not yet";

  userInfo.classList.remove("hidden");
  addDrinkSection.classList.remove("hidden");
  historySection.classList.remove("hidden");

  purchaseHistory.innerHTML = "";
  (data.purchaseHistory || []).slice().reverse().forEach(entry => {
    const date = new Date(entry.timestamp.seconds * 1000);
    const li = document.createElement("li");
    li.className = "bg-gray-100 p-2 rounded text-sm";
    li.innerHTML = `<strong>${entry.item}</strong> × ${entry.quantity} - $${entry.price.toFixed(2)} <span class="text-gray-500">(${date.toLocaleString()})</span>`;
    purchaseHistory.appendChild(li);
  });
}

addDrinkBtn.addEventListener("click", async () => {
  if (!currentUserRef) return;

  const item = drinkName.value.trim();
  const price = parseFloat(drinkPrice.value);
  const qty = parseInt(drinkQty.value);

  if (!item || isNaN(price) || qty <= 0) {
    alert("Please fill out drink details correctly.");
    return;
  }

  const entry = {
    item,
    price,
    quantity: qty,
    timestamp: Timestamp.now()
  };

  const snap = await getDoc(currentUserRef);
  const data = snap.data();

  const newTotalPurchases = (data.totalPurchases || 0) + qty;
  const eligible = newTotalPurchases >= 5 && !(data.freeDrink?.eligible || data.freeDrink?.claimed);

  await updateDoc(currentUserRef, {
    purchaseHistory: arrayUnion(entry),
    totalPurchases: newTotalPurchases,
    mostItem: item,
    lastItem: item,
    freeDrink: eligible
      ? { eligible: true, claimed: false, claimedAt: null }
      : data.freeDrink || { eligible: false, claimed: false, claimedAt: null }
  });

  alert("Drink added successfully.");
  loadUser(uidFromText(userUID.textContent));
});

function uidFromText(text) {
  return text.replace("UID: ", "").trim();
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove("hidden");
}

function hideError() {
  errorMsg.classList.add("hidden");
}
