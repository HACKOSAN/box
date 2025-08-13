// user.js
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const FREE_THRESHOLD = 6;

  const $uuidInput = document.getElementById("uuidInput");
  const $loadBtn = document.getElementById("loadBtn");
  const $uuidError = document.getElementById("uuidError");

  const $userCard = document.getElementById("userCard");
  const $userName = document.getElementById("userName");
  const $userUID = document.getElementById("userUID");
  const $userPfp = document.getElementById("userPfp");
  const $freeStatus = document.getElementById("freeStatus");
  const $progressText = document.getElementById("progressText");
  const $progressBar = document.getElementById("progressBar");
  const $drinksLeft = document.getElementById("drinksLeft");

  const $totalSpent = document.getElementById("totalSpent");
  const $mostItem = document.getElementById("mostItem");
  const $lastPurchase = document.getElementById("lastPurchase");

  const $historyCard = document.getElementById("historyCard");
  const $historyList = document.getElementById("historyList");

  const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

  function showErr(msg) {
    $uuidError.textContent = msg;
    $uuidError.classList.remove("hidden");
  }
  function hideErr() {
    $uuidError.textContent = "";
    $uuidError.classList.add("hidden");
  }

  function parseIdFromText(s) {
    if (!s) return null;
    // common patterns: ?id=0001 or /user/0001 or bare digits
    const q = s.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (q) return q[1];
    const path = s.match(/\/([A-Za-z0-9_-]{3,})\/?$/);
    if (path) return path[1];
    const digits = s.match(/([0-9]{3,8})/);
    if (digits) return digits[1];
    return null;
  }

  function getOutstanding(fd = {}, rewards = {}) {
    if (typeof fd?.eligible === "boolean") return fd.eligible && !fd.claimed;
    return !!rewards?.outstanding;
  }

  function calcProgress(user) {
    const total = user.totalPurchases || 0;
    const cycle = user.freeDrinkCycle ?? Math.floor(total / FREE_THRESHOLD);
    const inCycle = total - cycle * FREE_THRESHOLD;
    const pct = Math.min(100, Math.round((inCycle / FREE_THRESHOLD) * 100));
    const left = FREE_THRESHOLD - inCycle;
    return { inCycle, pct, left: left === FREE_THRESHOLD ? 0 : left };
  }

  async function loadUser(uid) {
    hideErr();
    $historyList.innerHTML = "";
    try {
      if (!uid) return showErr("Please enter your ID.");
      // defensive: ensure db exists
      if (!db) return showErr("Missing Firebase configuration (firebase-config.js).");
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return showErr("User not found.");
      const d = snap.data();

      $userCard.classList.remove("hidden");
      $historyCard.classList.remove("hidden");

      $userName.textContent = d.name || "User";
      $userUID.textContent = `UID: ${uid}`;
      if (d.pfpUrl) { $userPfp.src = d.pfpUrl; $userPfp.hidden = false; }

      const outstanding = getOutstanding(d.freeDrink, d.rewards);
      $freeStatus.textContent = outstanding ? "🎁 Available" : (d.freeDrink?.claimed ? "✅ Claimed (last)" : "❌ Not yet");

      const prog = calcProgress(d);
      $progressText.textContent = `${prog.inCycle}/${FREE_THRESHOLD}`;
      $progressBar.style.width = `${prog.pct}%`;
      $drinksLeft.textContent = outstanding ? "Drinks left: 0 (free available)" : `Drinks left: ${prog.left}`;

      // analytics + history
      let spent = 0;
      const counts = new Map();
      let lastTs = 0;

      const hist = (d.purchaseHistory || []).slice().sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      $historyList.innerHTML = "";
      hist.forEach(h => {
        const qty = h.quantity || 0, price = h.price || 0;
        spent += qty * price;
        counts.set(h.item, (counts.get(h.item) || 0) + qty);
        const ts = h.timestamp?.seconds || 0;
        if (ts > lastTs) lastTs = ts;

        const li = document.createElement("li");
        li.className = "bg-slate-50 rounded p-3 text-sm";
        const when = ts ? new Date(ts * 1000).toLocaleString() : "";
        li.innerHTML = `
          <div class="flex justify-between">
            <span class="font-medium">${h.item}${h.free ? " (FREE)" : ""}</span>
            <span>${money(qty * price)}</span>
          </div>
          <div class="text-slate-500 text-xs">${when} • ${qty} × ${money(price)}</div>
          ${h.campaignNote ? `<div class="text-xs mt-1 text-slate-500">Campaign: ${h.campaignNote}</div>` : ""}
        `;
        $historyList.appendChild(li);
      });

      $totalSpent.textContent = money(spent);
      $mostItem.textContent = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      $lastPurchase.textContent = lastTs ? new Date(lastTs * 1000).toLocaleString() : "—";
    } catch (err) {
      console.error(err);
      showErr(err.message || "Failed to load user.");
    }
  }

  // events
  $loadBtn.addEventListener("click", () => loadUser($uuidInput.value.trim()));
  $uuidInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadUser($uuidInput.value.trim());
  });

  // auto-load from ?id=... (robust)
  try {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      $uuidInput.value = id;
      loadUser(id);
    }
  } catch (e) {
    // ignore
  }
});
