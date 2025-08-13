// cashier.js
import { db } from "./firebase-config.js";
import {
  collection, getDocs, doc, getDoc, updateDoc, arrayUnion, Timestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const FREE_THRESHOLD = 6;

  // identify
  const $scanNfc = document.getElementById("scanNfc");
  const $startKeyboardScan = document.getElementById("startKeyboardScan");
  const $keyboardBuffer = document.getElementById("keyboardBuffer");
  const $uuidInput = document.getElementById("uuidInput");
  const $loadUser = document.getElementById("loadUser");
  const $idMsg = document.getElementById("idMsg");
  const $custBox = document.getElementById("custBox");
  const $custPfp = document.getElementById("custPfp");
  const $custName = document.getElementById("custName");
  const $custUID = document.getElementById("custUID");
  const $freeInfo = document.getElementById("freeInfo");

  // menu & cart
  const $drinksList = document.getElementById("drinksList");
  const $pastriesList = document.getElementById("pastriesList");
  const $cartList = document.getElementById("cartList");
  const $subtotal = document.getElementById("subtotal");
  const $drinksLeft = document.getElementById("drinksLeft");
  const $campaignNote = document.getElementById("campaignNote");
  const $clearCart = document.getElementById("clearCart");
  const $confirm = document.getElementById("confirm");
  const $decline = document.getElementById("decline");
  const $cashierMsg = document.getElementById("cashierMsg");

  let currentUID = null;
  let userDocRef = null;
  let userData = null;
  let cart = [];

  const money = n => `$${(Number(n) || 0).toFixed(2)}`;

  function parseIdFromText(s) {
    if (!s) return null;
    const q = s.match(/[?&]id=([A-Za-z0-9_-]+)/); if (q) return q[1];
    const d = s.match(/([0-9]{3,8})/); return d ? d[1] : null;
  }

  function getOutstanding(fd = {}, r = {}) {
    if (typeof fd?.eligible === "boolean") return fd.eligible && !fd.claimed;
    return !!r?.outstanding;
  }

  function setIdErr(msg) {
    $idMsg.textContent = msg; $idMsg.classList.remove("hidden");
  }
  function clearIdErr() {
    $idMsg.textContent = ""; $idMsg.classList.add("hidden");
  }
  function setCashierMsg(msg, ok = true) {
    $cashierMsg.textContent = msg; $cashierMsg.classList.remove("hidden");
    $cashierMsg.classList.toggle("text-green-700", ok);
    $cashierMsg.classList.toggle("text-red-600", !ok);
  }

  async function loadCustomer(uid) {
    try {
      clearIdErr();
      if (!uid) return setIdErr("Enter a UID.");
      if (!db) return setIdErr("Missing firebase-config.js");
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return setIdErr("User not found.");
      userDocRef = ref; userData = snap.data(); currentUID = uid;

      $custBox.classList.remove("hidden");
      $custName.textContent = userData.name || "User";
      $custUID.textContent = `UID: ${uid}`;
      if (userData.pfpUrl) { $custPfp.src = userData.pfpUrl; $custPfp.hidden = false; }

      const outstanding = getOutstanding(userData.freeDrink, userData.rewards);
      const total = userData.totalPurchases || 0;
      const cycle = userData.freeDrinkCycle ?? Math.floor(total / FREE_THRESHOLD);
      const inCycle = total - cycle * FREE_THRESHOLD;
      const left = FREE_THRESHOLD - inCycle;
      $freeInfo.textContent = outstanding ? "🎁 Free drink available" : `Drinks left for free: ${left}`;
      $drinksLeft.textContent = outstanding ? "Drinks left: 0 (free available)" : `Drinks left: ${left}`;
    } catch (err) {
      console.error(err);
      setIdErr(err.message || "Failed to load user.");
    }
  }

  // NFC scan (robust decoding)
  $scanNfc.addEventListener("click", async () => {
    if (!("NDEFReader" in window)) return setIdErr("NFC not supported on this browser/device.");
    try {
      const reader = new NDEFReader();
      await reader.scan();
      reader.onreading = (event) => {
        const dec = new TextDecoder();
        for (const rec of event.message.records) {
          try {
            // try decode bytes
            if (rec.data) {
              const txt = dec.decode(rec.data);
              const id = parseIdFromText(txt);
              if (id) { loadCustomer(id); return; }
            }
            // fallback: some browsers supply record.recordType/url differently
            if (rec.recordType === "url" && rec.data) {
              const txt = dec.decode(rec.data);
              const id = parseIdFromText(txt);
              if (id) { loadCustomer(id); return; }
            }
          } catch (e) { console.warn("nfc decode fail", e); }
        }
        setIdErr("No UID parsed from NFC payload.");
      };
    } catch (err) {
      setIdErr("NFC scan failed: " + (err.message || err));
    }
  });

  // keyboard-wedge scanner mode
  $startKeyboardScan.addEventListener("click", () => {
    $keyboardBuffer.value = "";
    $keyboardBuffer.style.position = "absolute"; $keyboardBuffer.style.left = "-9999px";
    $keyboardBuffer.focus();
    setCashierMsg("Keyboard scan active — scan the card now and press Enter.", true);
  });
  $keyboardBuffer.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const id = parseIdFromText($keyboardBuffer.value);
      $keyboardBuffer.value = ""; $keyboardBuffer.blur();
      if (id) loadCustomer(id);
      else setIdErr("Could not parse UID from keyboard scan.");
      setCashierMsg("", true);
    }
  });

  $loadUser.addEventListener("click", () => loadCustomer($uuidInput.value.trim()));
  $uuidInput.addEventListener("keydown", (e) => { if (e.key === "Enter") $loadUser.click(); });

  // load menu from Firestore (if menu collection exists) else fallback to inline items
  async function loadMenu() {
    try {
      if (!db) return renderInlineMenu(); // fallback
      const snap = await getDocs(collection(db, "menu"));
      if (!snap.empty) {
        const drinks = [], pastries = [];
        snap.forEach(d => {
          const m = d.data();
          (m.category === "pastry" ? pastries : drinks).push({ id: d.id, ...m });
        });
        renderMenu(drinks, pastries);
        return;
      }
    } catch (e) {
      console.warn("load menu failed", e);
    }
    renderInlineMenu();
  }

  function renderInlineMenu() {
    const drinks = [
      { id: "latte", name: "Latte", price: 4.5, category: "drink" },
      { id: "cap", name: "Cappuccino", price: 4.2, category: "drink" },
      { id: "espresso", name: "Espresso", price: 2.8, category: "drink" }
    ];
    const pastries = [
      { id: "croissant", name: "Croissant", price: 2.5, category: "pastry" },
      { id: "cookie", name: "Cookie", price: 1.8, category: "pastry" }
    ];
    renderMenu(drinks, pastries);
  }

  function renderMenu(drinks, pastries) {
    $drinksList.innerHTML = ""; $pastriesList.innerHTML = "";
    function addButton(m) {
      const btn = document.createElement("button");
      btn.className = "border rounded-lg p-2 hover:bg-orange-50 text-left";
      btn.innerHTML = `<div class="font-medium">${m.name}</div><div class="text-sm text-slate-600">${money(m.price)}</div>`;
      btn.addEventListener("click", () => addToCart(m));
      return btn;
    }
    drinks.forEach(d => $drinksList.appendChild(addButton(d)));
    pastries.forEach(p => $pastriesList.appendChild(addButton(p)));
  }

  function addToCart(m) {
    const found = cart.find(c => c.name === m.name && c.price === m.price);
    if (found) found.qty += 1; else cart.push({ name: m.name, price: m.price, qty: 1, category: m.category || "drink", free: false });
    renderCart();
  }

  function renderCart() {
    $cartList.innerHTML = "";
    let subtotal = 0;
    cart.forEach((c, idx) => {
      const line = c.free ? 0 : c.qty * c.price;
      subtotal += line;
      const li = document.createElement("li");
      li.className = "bg-slate-50 rounded p-3 text-sm flex items-center gap-2";
      li.innerHTML = `
        <div class="flex-1">
          <div class="font-medium">${c.name}${c.free ? " (FREE)" : ""}</div>
          <div class="text-xs text-slate-500">${c.qty} × ${money(c.price)}</div>
        </div>
        <div class="font-semibold">${money(line)}</div>
        <div class="flex items-center gap-2">
          <button class="px-2 py-1 border rounded dec">-</button>
          <button class="px-2 py-1 border rounded inc">+</button>
          <button class="px-2 py-1 border rounded text-red-600 del">×</button>
        </div>
      `;
      li.querySelector(".dec").addEventListener("click", () => { c.qty = Math.max(1, c.qty - 1); renderCart(); });
      li.querySelector(".inc").addEventListener("click", () => { c.qty += 1; renderCart(); });
      li.querySelector(".del").addEventListener("click", () => { cart.splice(idx, 1); renderCart(); });
      $cartList.appendChild(li);
    });
    $subtotal.textContent = money(subtotal);
    $campaignNote.textContent = ""; // for now
  }

  $clearCart.addEventListener("click", () => { cart = []; renderCart(); });
  $decline.addEventListener("click", () => { cart = []; renderCart(); setCashierMsg("Order canceled.", false); });

  // checkout
  $confirm.addEventListener("click", async () => {
    if (!currentUID || !userDocRef || !userData) return setCashierMsg("Identify customer first.", false);
    if (!cart.length) return setCashierMsg("Cart is empty.", false);

    // apply free drink (one unit) if outstanding
    let appliedFree = false;
    const outstanding = getOutstanding(userData.freeDrink, userData.rewards);
    if (outstanding) {
      // apply to first drink (non-pastry) with qty>=1
      const drink = cart.find(c => c.category !== "pastry");
      if (drink) { drink.free = true; appliedFree = true; }
    }

    // build history entries
    const now = Timestamp.now();
    const entries = [];
    cart.forEach(c => {
      entries.push({
        item: c.name,
        price: c.free ? 0 : c.price,
        quantity: c.qty,
        category: c.category,
        free: !!c.free,
        timestamp: now
      });
    });

    // recalc totalPurchases counting only drinks if that's desired, here we count all items as purchases
    const prevCount = userData.totalPurchases || 0;
    const unitsAdded = cart.reduce((s, c) => s + c.qty, 0);
    const newCount = prevCount + unitsAdded;

    // check awarding free drink (no stacking): award only if crossing threshold and no outstanding
    const prevCycles = Math.floor(prevCount / FREE_THRESHOLD);
    const newCycles = Math.floor(newCount / FREE_THRESHOLD);
    const updates = {
      totalPurchases: newCount,
      purchaseHistory: arrayUnion(...entries),
      lastItem: cart[cart.length - 1]?.name || userData.lastItem || ""
    };

    if (appliedFree) {
      updates.freeDrink = { eligible: false, claimed: true, claimedAt: now };
      updates.rewards = { outstanding: false };
    } else {
      const hasOutstandingNow = getOutstanding(userData.freeDrink, userData.rewards);
      if (!hasOutstandingNow && newCycles > prevCycles) {
        updates.freeDrink = { eligible: true, claimed: false, claimedAt: null };
        updates.rewards = { outstanding: true };
        updates.freeDrinkCycle = newCycles;
      }
    }

    try {
      await updateDoc(userDocRef, updates);
      const fresh = await getDoc(userDocRef);
      userData = fresh.data();
      cart = [];
      renderCart();
      renderCustomerAfterPurchase();
      setCashierMsg("Purchase recorded.", true);
    } catch (err) {
      console.error(err);
      setCashierMsg("Checkout failed: " + (err.message || err), false);
    }
  });

  function renderCustomerAfterPurchase() {
    const outstanding = getOutstanding(userData.freeDrink, userData.rewards);
    const total = userData.totalPurchases || 0;
    const cycle = userData.freeDrinkCycle ?? Math.floor(total / FREE_THRESHOLD);
    const inCycle = total - cycle * FREE_THRESHOLD;
    const left = FREE_THRESHOLD - inCycle;
    $freeInfo.textContent = outstanding ? "🎁 Free drink available" : `Drinks left for free: ${left}`;
    $drinksLeft.textContent = outstanding ? "Drinks left: 0 (free available)" : `Drinks left: ${left}`;
  }

  // auto-load ?id=...
  try {
    const qid = new URLSearchParams(location.search).get("id");
    if (qid) { $uuidInput.value = qid; loadCustomer(qid); }
  } catch (e) { /* ignore */ }

  loadMenu();
});
