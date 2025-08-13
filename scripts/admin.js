// admin.js
import { db, storage } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, deleteDoc, addDoc, query, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";
import { ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js";

document.addEventListener("DOMContentLoaded", () => {
  const FREE_THRESHOLD = 6;

  // login DOM
  const $login = document.getElementById("loginSection");
  const $admin = document.getElementById("adminSection");
  const $adminPass = document.getElementById("adminPass");
  const $loginBtn = document.getElementById("loginBtn");
  const $loginMsg = document.getElementById("loginMsg");

  // top controls
  const $search = document.getElementById("search");
  const $scanNfcBtn = document.getElementById("scanNfcBtn");
  const $logoutBtn = document.getElementById("logoutBtn");

  // users UI
  const $userList = document.getElementById("userList");
  const $usersEmpty = document.getElementById("usersEmpty");

  // profile UI
  const $userProfile = document.getElementById("userProfile");
  const $closeProfile = document.getElementById("closeProfile");
  const $profilePfp = document.getElementById("profilePfp");
  const $profileName = document.getElementById("profileName");
  const $profileUID = document.getElementById("profileUID");
  const $profileTotal = document.getElementById("profileTotal");
  const $profileMost = document.getElementById("profileMost");
  const $profileLast = document.getElementById("profileLast");
  const $profileSpent = document.getElementById("profileSpent");
  const $profileProgText = document.getElementById("profileProgText");
  const $profileProgBar = document.getElementById("profileProgBar");
  const $profileReward = document.getElementById("profileReward");
  const $profileHistory = document.getElementById("profileHistory");

  const $spent30 = document.getElementById("spent30");
  const $spent90 = document.getElementById("spent90");
  const $spent180 = document.getElementById("spent180");
  const $visits = document.getElementById("visitsCount");

  const $editName = document.getElementById("editName");
  const $editPfp = document.getElementById("editPfp");
  const $saveProfile = document.getElementById("saveProfile");

  const $grantDrink = document.getElementById("grantDrink");
  const $revokeDrink = document.getElementById("revokeDrink");
  const $exportCsv = document.getElementById("exportCsv");

  // campaigns area
  const $campTitle = document.getElementById("campTitle");
  const $campType = document.getElementById("campType");
  const $campValue = document.getElementById("campValue");
  const $campActive = document.getElementById("campActive");
  const $campStart = document.getElementById("campStart");
  const $campEnd = document.getElementById("campEnd");
  const $campSave = document.getElementById("campSave");
  const $campMsg = document.getElementById("campMsg");
  const $campList = document.getElementById("campList");

  let ADMIN_PASSWORD = "boxadmin";
  let usersCache = [];
  let currentUID = null;
  let currentDocRef = null;
  let currentData = null;

  const money = (n) => `$${(n || 0).toFixed(2)}`;

  function showLoginErr(msg) { $loginMsg.textContent = msg; $loginMsg.classList.remove("hidden"); }
  function hideLoginErr() { $loginMsg.textContent = ""; $loginMsg.classList.add("hidden"); }

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
  function parseIdFromText(s) {
    if (!s) return null;
    const q = s.match(/[?&]id=([A-Za-z0-9_-]+)/); if (q) return q[1];
    const d = s.match(/([0-9]{3,8})/); return d ? d[1] : null;
  }

  async function loadAdminPassword() {
    try {
      const sref = doc(db, "settings", "admin");
      const snap = await getDoc(sref);
      if (snap.exists() && snap.data()?.password) ADMIN_PASSWORD = String(snap.data().password);
    } catch (e) {
      console.warn("loadAdminPassword failed:", e);
    }
  }

  // ENTER key fixed: pressing Enter triggers the click handler
  $adminPass.addEventListener("keydown", (e) => { if (e.key === "Enter") $loginBtn.click(); });

  $loginBtn.addEventListener("click", async () => {
    hideLoginErr();
    const pass = $adminPass.value.trim();
    if (!pass) return showLoginErr("Enter password.");
    await loadAdminPassword();
    if (pass === ADMIN_PASSWORD) {
      localStorage.setItem("box_admin", "1");
      $login.classList.add("hidden");
      $admin.classList.remove("hidden");
      await initDashboard();
    } else {
      showLoginErr("Invalid password.");
    }
  });

  $logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("box_admin");
    location.reload();
  });

  // NFC quick open
  $scanNfcBtn.addEventListener("click", async () => {
    if (!("NDEFReader" in window)) return alert("NFC not supported on this device/browser.");
    try {
      const reader = new NDEFReader();
      await reader.scan();
      reader.onreading = async (event) => {
        const dec = new TextDecoder();
        for (const rec of event.message.records) {
          try {
            const text = rec.data ? dec.decode(rec.data) : "";
            const id = parseIdFromText(text);
            if (id) return openUserProfile(id);
          } catch (e) { console.warn("nfc decode", e); }
        }
        alert("No UUID found in NFC payload.");
      };
    } catch (err) {
      alert("NFC scan failed: " + (err.message || err));
    }
  });

  async function initDashboard() {
    await loadUsers();
    await loadCampaigns();
  }

  async function loadUsers() {
    $userList.innerHTML = `<div class="text-sm text-slate-500">Loading users...</div>`;
    usersCache = [];
    try {
      const snap = await getDocs(collection(db, "users"));
      $userList.innerHTML = "";
      snap.forEach(d => usersCache.push({ id: d.id, data: d.data() }));
      usersCache.sort((a, b) => (b.data.totalPurchases || 0) - (a.data.totalPurchases || 0));
      if (!usersCache.length) $usersEmpty.classList.remove("hidden"); else $usersEmpty.classList.add("hidden");
      renderUsers(usersCache);
    } catch (e) {
      console.error("loadUsers error", e);
      $userList.innerHTML = `<div class="text-sm text-red-600">Failed to load users: ${e.message}</div>`;
    }
  }

  function renderUsers(list) {
    $userList.innerHTML = "";
    for (const { id, data } of list) {
      const card = document.createElement("div");
      card.className = "rounded-lg border p-3 hover:bg-orange-50 cursor-pointer";
      card.innerHTML = `
        <div class="font-semibold">${data.name || "User"}</div>
        <div class="text-xs text-slate-500">UID: ${id}</div>
        <div class="text-sm mt-1">Purchases: <b>${data.totalPurchases || 0}</b></div>
      `;
      card.addEventListener("click", () => openUserProfile(id));
      $userList.appendChild(card);
    }
  }

  $search.addEventListener("input", () => {
    const q = $search.value.toLowerCase();
    const filtered = usersCache.filter(u => u.id.toLowerCase().includes(q) || (u.data.name || "").toLowerCase().includes(q));
    renderUsers(filtered);
  });

  async function openUserProfile(uid) {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return alert("User not found.");
      currentUID = uid;
      currentDocRef = ref;
      currentData = snap.data();

      $userProfile.classList.remove("hidden");
      $userProfile.scrollIntoView({ behavior: "smooth", block: "start" });

      $profileName.textContent = currentData.name || "User";
      $profileUID.textContent = `UID: ${uid}`;
      $profileTotal.textContent = currentData.totalPurchases || 0;
      if (currentData.pfpUrl) { $profilePfp.src = currentData.pfpUrl; $profilePfp.hidden = false; }
      $editName.value = currentData.name || "";

      // analytics ranges & visits
      const hist = (currentData.purchaseHistory || []).slice().sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      let spentAll = 0, spent30 = 0, spent90 = 0, spent180 = 0;
      const now = Date.now();
      const d30 = now - 30 * 864e5, d90 = now - 90 * 864e5, d180 = now - 180 * 864e5;
      const counts = new Map(); let lastTs = 0; const visitDays = new Set();

      $profileHistory.innerHTML = "";
      for (const h of hist) {
        const qty = h.quantity || 0, price = h.price || 0, ts = (h.timestamp?.seconds || 0) * 1000;
        const line = qty * price;
        spentAll += line;
        if (ts >= d30) spent30 += line;
        if (ts >= d90) spent90 += line;
        if (ts >= d180) spent180 += line;
        counts.set(h.item, (counts.get(h.item) || 0) + qty);
        if (ts > lastTs) lastTs = ts;
        if (ts) visitDays.add(new Date(ts).toDateString());

        const li = document.createElement("li");
        li.className = "bg-slate-50 rounded p-3 text-sm";
        const when = ts ? new Date(ts).toLocaleString() : "";
        li.innerHTML = `
          <div class="flex justify-between">
            <span class="font-medium">${h.item}${h.free ? " (FREE)" : ""}</span>
            <span>${money(line)}</span>
          </div>
          <div class="text-slate-500 text-xs">${when} • ${qty} × ${money(price)}</div>
          ${h.campaignNote ? `<div class="text-xs mt-1 text-slate-500">Campaign: ${h.campaignNote}</div>` : ""}
        `;
        $profileHistory.appendChild(li);
      }

      $profileMost.textContent = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
      $profileLast.textContent = lastTs ? new Date(lastTs).toLocaleString() : "—";
      $profileSpent.textContent = money(spentAll);
      $spent30.textContent = money(spent30);
      $spent90.textContent = money(spent90);
      $spent180.textContent = money(spent180);
      $visits.textContent = String(visitDays.size);

      const prog = calcProgress(currentData);
      $profileProgText.textContent = `${prog.inCycle}/${FREE_THRESHOLD}`;
      $profileProgBar.style.width = `${prog.pct}%`;

      const outstanding = getOutstanding(currentData.freeDrink, currentData.rewards);
      const status = outstanding ? "🎁 Eligible" : (currentData.freeDrink?.claimed ? "✅ Claimed (last)" : "❌ Not yet");
      $profileReward.textContent = `Free Drink: ${status}`;
    } catch (e) {
      console.error(e);
      alert("Failed to open profile: " + (e.message || e));
    }
  }

  $closeProfile.addEventListener("click", () => $userProfile.classList.add("hidden"));

  // Save profile: update name + optional avatar
  $saveProfile.addEventListener("click", async () => {
    if (!currentDocRef) return alert("No profile loaded.");
    const updates = {};
    const newName = $editName.value.trim();
    if (newName && newName !== (currentData.name || "")) updates.name = newName;
    if ($editPfp.files?.[0]) {
      const f = $editPfp.files[0];
      try {
        const ref = sRef(storage, `pfp/${currentUID}/${Date.now()}_${f.name}`);
        await uploadBytes(ref, f);
        const url = await getDownloadURL(ref);
        updates.pfpUrl = url;
      } catch (e) {
        console.error("upload pfp", e);
        return alert("Failed to upload avatar: " + (e.message || e));
      }
    }
    if (Object.keys(updates).length === 0) return alert("No changes to save.");
    await updateDoc(currentDocRef, updates);
    await openUserProfile(currentUID);
    alert("Saved.");
  });

  $grantDrink.addEventListener("click", async () => {
    if (!currentDocRef) return;
    await updateDoc(currentDocRef, { freeDrink: { eligible: true, claimed: false, claimedAt: null }, rewards: { outstanding: true } });
    await openUserProfile(currentUID);
    alert("Granted free drink.");
  });
  $revokeDrink.addEventListener("click", async () => {
    if (!currentDocRef) return;
    await updateDoc(currentDocRef, { freeDrink: { eligible: false, claimed: false, claimedAt: null }, rewards: { outstanding: false } });
    await openUserProfile(currentUID);
    alert("Revoked.");
  });

  $exportCsv.addEventListener("click", () => {
    if (!currentData) return alert("No user loaded.");
    const rows = [["item", "price", "quantity", "timestamp", "free", "campaignNote"]];
    (currentData.purchaseHistory || []).forEach(h => {
      rows.push([
        h.item || "",
        h.price || 0,
        h.quantity || 0,
        h.timestamp?.seconds ? new Date(h.timestamp.seconds * 1000).toISOString() : "",
        !!h.free,
        h.campaignNote || ""
      ]);
    });
    const csv = rows.map(r => r.map(x => String(x).replace(/"/g, '""')).map(x => `"${x}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `user_${currentUID}_history.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // CAMPAIGNS - simple CRUD (same idea as earlier)
  async function loadCampaigns() {
    $campList.innerHTML = `<li class="py-2 text-sm text-slate-500">Loading...</li>`;
    try {
      const snap = await getDocs(collection(db, "campaigns"));
      $campList.innerHTML = "";
      if (snap.empty) { $campList.innerHTML = `<li class="py-2 text-sm text-slate-500">No campaigns yet.</li>`; return; }
      snap.forEach(d => {
        const c = d.data();
        const li = document.createElement("li");
        li.className = "py-2 flex items-center justify-between";
        const start = c.startsAt?.seconds ? new Date(c.startsAt.seconds * 1000).toLocaleString() : "—";
        const end = c.endsAt?.seconds ? new Date(c.endsAt.seconds * 1000).toLocaleString() : "—";
        li.innerHTML = `
          <div>
            <div class="font-medium">${c.title || d.id} ${c.active ? "" : "(inactive)"}</div>
            <div class="text-xs text-slate-500">${c.type}=${c.value} • ${start} → ${end}</div>
          </div>
          <div class="flex items-center gap-2">
            <button data-toggle class="px-2 py-1 border rounded">${c.active ? "Disable" : "Enable"}</button>
            <button data-del class="px-2 py-1 border rounded text-red-600">Delete</button>
          </div>
        `;
        li.querySelector("[data-toggle]").onclick = async () => { await updateDoc(doc(db, "campaigns", d.id), { active: !c.active }); loadCampaigns(); };
        li.querySelector("[data-del]").onclick = async () => { if (confirm("Delete this campaign?")) { await deleteDoc(doc(db, "campaigns", d.id)); loadCampaigns(); } };
        $campList.appendChild(li);
      });
    } catch (e) {
      console.error("loadCampaigns", e);
      $campList.innerHTML = `<li class="py-2 text-sm text-red-600">Failed to load campaigns</li>`;
    }
  }
  $campSave.addEventListener("click", async () => {
    try {
      const title = $campTitle.value.trim(), type = $campType.value, value = parseFloat($campValue.value), active = $campActive.checked;
      if (!title || isNaN(value)) return $campMsg.textContent = "Enter title + numeric value.";
      const startsAt = $campStart.value ? Timestamp.fromDate(new Date($campStart.value)) : null;
      const endsAt = $campEnd.value ? Timestamp.fromDate(new Date($campEnd.value)) : null;
      await addDoc(collection(db, "campaigns"), { title, type, value, active, startsAt, endsAt });
      $campMsg.textContent = "Saved."; $campMsg.classList.remove("text-red-600"); $campMsg.classList.add("text-green-600");
      $campTitle.value = ""; $campValue.value = ""; $campActive.checked = false; $campStart.value = ""; $campEnd.value = "";
      loadCampaigns();
    } catch (e) {
      console.error("save campaign", e);
      $campMsg.textContent = "Failed to save."; $campMsg.classList.remove("text-green-600"); $campMsg.classList.add("text-red-600");
    }
  });

  // boot
  (async () => {
    try { await loadAdminPassword(); } catch (e) { console.warn(e); }
    if (localStorage.getItem("box_admin") === "1") { $login.classList.add("hidden"); $admin.classList.remove("hidden"); await initDashboard(); }
  })();
});
