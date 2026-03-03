/**
 * INVOX SECURITY — security.js
 * ─────────────────────────────────────────────
 * Features:
 *   1) PIN login screen on app load
 *   2) Auto-lock after idle timeout
 *   3) Multiple user PINs supported
 *   4) Wrong PIN lockout after 5 attempts
 *
 * HOW TO USE:
 *   Add this line before </body> in index.html
 *   (add it BEFORE plugins.js):
 *
 *   <script src="security.js"></script>
 *   <script src="plugins.js"></script>
 *
 * TO CHANGE PINs / USERS — edit the USERS list below
 * ─────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════
     ✏️  CONFIGURATION — EDIT THIS SECTION
  ══════════════════════════════════════════ */
  const CONFIG = {
    // Add or remove users here. PIN must be 4-6 digits.
    users: [
      { name: "NEERAJ",  pin: "2005" },
      { name: "Staff",  pin: "1234" },
      { name: "Guest",  pin: "0000" },
    ],

    // Auto-lock after 10 minutes of no activity (set 0 to disable)
    idleMinutes: 10,

    // How many wrong PINs before lockout
    maxAttempts: 5,

    // Lockout duration in seconds
    lockoutSeconds: 30,

    // App name shown on lock screen (change to your app name)
    appName: "INV<span>OX</span>",
  };

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */
  let isUnlocked   = false;
  let attempts     = 0;
  let lockedUntil  = 0;
  let idleTimer    = null;
  let currentUser  = null;
  let enteredPin   = "";

  const SESSION_KEY = "invox_session";

  /* ══════════════════════════════════════════
     SESSION CHECK (stays unlocked on refresh
     for 30 minutes)
  ══════════════════════════════════════════ */
  function checkSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (s && s.expires > Date.now()) {
        currentUser = s.user;
        return true;
      }
    } catch (_) {}
    return false;
  }

  function saveSession(user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      user,
      expires: Date.now() + 30 * 60 * 1000 // 30 min
    }));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /* ══════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════ */
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #sec-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: #0a0a0f;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 0; font-family: 'DM Mono', monospace;
        animation: secFadeIn .3s ease;
      }
      @keyframes secFadeIn { from{opacity:0} to{opacity:1} }
      @keyframes secShake  { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
      @keyframes secFadeOut { from{opacity:1} to{opacity:0;pointer-events:none} }

      #sec-overlay .sec-logo {
        font-family: 'Syne', sans-serif; font-weight: 800;
        font-size: 2rem; margin-bottom: 2rem; letter-spacing: -.03em;
      }
      #sec-overlay .sec-logo span { color: #e8ff47; }

      #sec-card {
        background: #111118; border: 1px solid #1e1e2e;
        border-radius: 20px; padding: 2rem 2.5rem;
        width: 90%; max-width: 340px;
        display: flex; flex-direction: column; align-items: center; gap: 1.2rem;
        box-shadow: 0 0 60px rgba(232,255,71,.04);
      }

      #sec-title {
        font-family: 'Syne', sans-serif; font-weight: 700;
        font-size: .95rem; color: #f0f0f5; text-align: center;
      }
      #sec-subtitle {
        font-size: .72rem; color: #5a5a7a; text-align: center;
        margin-top: -.6rem;
      }

      /* PIN dots */
      #sec-dots {
        display: flex; gap: .65rem; margin: .25rem 0;
      }
      .sec-dot {
        width: 13px; height: 13px; border-radius: 50%;
        border: 2px solid #2a2a3a; background: transparent;
        transition: all .15s;
      }
      .sec-dot.filled {
        background: #e8ff47; border-color: #e8ff47;
        box-shadow: 0 0 8px rgba(232,255,71,.5);
      }
      .sec-dot.error {
        background: #ff4757; border-color: #ff4757;
        box-shadow: 0 0 8px rgba(255,71,87,.5);
      }

      /* Numpad */
      #sec-numpad {
        display: grid; grid-template-columns: repeat(3, 1fr);
        gap: .5rem; width: 100%;
      }
      .sec-key {
        background: #0d0d15; border: 1px solid #1e1e2e;
        border-radius: 12px; padding: .85rem;
        font-family: 'Syne', sans-serif; font-weight: 700;
        font-size: 1.1rem; color: #f0f0f5;
        cursor: pointer; text-align: center;
        transition: all .12s; user-select: none;
      }
      .sec-key:hover { background: #16161f; border-color: #e8ff47; color: #e8ff47; }
      .sec-key:active { transform: scale(.94); }
      .sec-key.del { font-size: .85rem; color: #5a5a7a; }
      .sec-key.del:hover { border-color: #ff4757; color: #ff4757; }
      .sec-key.empty { visibility: hidden; pointer-events: none; }

      #sec-msg {
        font-size: .72rem; min-height: 1rem; text-align: center;
        transition: color .2s;
      }
      #sec-msg.error { color: #ff4757; }
      #sec-msg.warn  { color: #ffa502; }
      #sec-msg.ok    { color: #2ed573; }

      #sec-user-badge {
        font-size: .68rem; color: #5a5a7a;
        display: flex; align-items: center; gap: .35rem;
      }
      #sec-user-badge b { color: #a78bfa; }

      /* Lock icon shown on navbar when session active */
      #sec-lock-btn {
        padding: .5rem .75rem; background: transparent;
        border: 1px solid #1e1e2e; border-radius: 8px;
        color: #5a5a7a; cursor: pointer; font-size: .75rem;
        font-family: 'Syne', sans-serif; font-weight: 600;
        transition: all .15s; white-space: nowrap;
      }
      #sec-lock-btn:hover { border-color: #ff4757; color: #ff4757; }

      /* Idle warning toast */
      #sec-idle-toast {
        position: fixed; bottom: 1.5rem; right: 1.5rem;
        background: #111118; border: 1px solid #ffa502;
        border-radius: 10px; padding: .75rem 1.1rem;
        font-size: .78rem; color: #ffa502;
        z-index: 9998; display: none;
        font-family: 'Syne', sans-serif; font-weight: 600;
        animation: secFadeIn .3s ease;
      }

      /* Shake animation on wrong PIN */
      .sec-shake { animation: secShake .35s ease; }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════
     BUILD LOCK SCREEN
  ══════════════════════════════════════════ */
  function buildLockScreen(reason = "") {
    // Remove existing if any
    const existing = document.getElementById("sec-overlay");
    if (existing) existing.remove();

    enteredPin = "";

    const overlay = document.createElement("div");
    overlay.id = "sec-overlay";
    overlay.innerHTML = `
      <div class="sec-logo">${CONFIG.appName}</div>
      <div id="sec-card">
        <div id="sec-title">🔐 Enter PIN to Continue</div>
        <div id="sec-subtitle">${reason || "Access restricted — please enter your PIN"}</div>
        <div id="sec-dots">
          <div class="sec-dot" id="d0"></div>
          <div class="sec-dot" id="d1"></div>
          <div class="sec-dot" id="d2"></div>
          <div class="sec-dot" id="d3"></div>
        </div>
        <div id="sec-numpad">
          ${[1,2,3,4,5,6,7,8,9].map(n =>
            `<div class="sec-key" onclick="window.__secKey('${n}')">${n}</div>`
          ).join("")}
          <div class="sec-key empty"></div>
          <div class="sec-key" onclick="window.__secKey('0')">0</div>
          <div class="sec-key del" onclick="window.__secDel()">⌫</div>
        </div>
        <div id="sec-msg" class="${reason ? 'warn' : ''}">${reason ? '⏱️ Session expired — please re-enter PIN' : ''}</div>
        <div id="sec-user-badge" style="display:none">Logged in as <b id="sec-uname"></b></div>
      </div>
      <div id="sec-idle-toast">⚠️ Locking in <span id="idle-count">10</span>s due to inactivity</div>
    `;
    document.body.appendChild(overlay);
    updateDots();
    checkLockout();
  }

  /* ══════════════════════════════════════════
     PIN INPUT LOGIC
  ══════════════════════════════════════════ */
  window.__secKey = function (digit) {
    if (Date.now() < lockedUntil) return;
    if (enteredPin.length >= 6) return;
    enteredPin += digit;
    updateDots();
    if (enteredPin.length >= 4) {
      // Try to match after 4+ digits (auto-submit when max length reached or after short delay)
      setTimeout(tryUnlock, 120);
    }
  };

  window.__secDel = function () {
    enteredPin = enteredPin.slice(0, -1);
    updateDots();
    setMsg("", "");
  };

  // Also support keyboard input
  document.addEventListener("keydown", e => {
    const overlay = document.getElementById("sec-overlay");
    if (!overlay) return;
    if (e.key >= "0" && e.key <= "9") window.__secKey(e.key);
    else if (e.key === "Backspace") window.__secDel();
    else if (e.key === "Enter" && enteredPin.length >= 4) tryUnlock();
  });

  function updateDots() {
    for (let i = 0; i < 4; i++) {
      const d = document.getElementById("d" + i);
      if (!d) return;
      d.classList.toggle("filled", i < enteredPin.length);
      d.classList.remove("error");
    }
  }

  function setMsg(text, type) {
    const el = document.getElementById("sec-msg");
    if (!el) return;
    el.textContent = text;
    el.className = type || "";
  }

  function tryUnlock() {
    if (Date.now() < lockedUntil) return;
    const match = CONFIG.users.find(u => u.pin === enteredPin);
    if (match) {
      // ✅ Correct PIN
      attempts = 0;
      currentUser = match.name;
      saveSession(match.name);
      setMsg("✅ Welcome, " + match.name + "!", "ok");
      // Flash green dots
      for (let i = 0; i < 4; i++) {
        const d = document.getElementById("d" + i);
        if (d) { d.classList.add("filled"); d.style.background = "#2ed573"; d.style.borderColor = "#2ed573"; }
      }
      setTimeout(dismissOverlay, 500);
    } else {
      // ❌ Wrong PIN
      attempts++;
      enteredPin = "";
      // Flash red dots
      for (let i = 0; i < 4; i++) {
        const d = document.getElementById("d" + i);
        if (d) d.classList.add("error");
      }
      const card = document.getElementById("sec-card");
      if (card) { card.classList.add("sec-shake"); setTimeout(() => card.classList.remove("sec-shake"), 400); }

      const remaining = CONFIG.maxAttempts - attempts;
      if (attempts >= CONFIG.maxAttempts) {
        lockedUntil = Date.now() + CONFIG.lockoutSeconds * 1000;
        attempts = 0;
        setMsg(`🔒 Too many attempts. Wait ${CONFIG.lockoutSeconds}s`, "error");
        startLockoutCountdown();
      } else {
        setMsg(`❌ Wrong PIN — ${remaining} attempt${remaining !== 1 ? "s" : ""} left`, "error");
      }
      setTimeout(updateDots, 400);
    }
  }

  function startLockoutCountdown() {
    const interval = setInterval(() => {
      const left = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (left <= 0) {
        clearInterval(interval);
        setMsg("Try again", "warn");
      } else {
        setMsg(`🔒 Locked — try again in ${left}s`, "error");
      }
    }, 500);
  }

  function checkLockout() {
    if (Date.now() < lockedUntil) {
      startLockoutCountdown();
    }
  }

  function dismissOverlay() {
    isUnlocked = true;
    const overlay = document.getElementById("sec-overlay");
    if (overlay) {
      overlay.style.animation = "secFadeOut .3s ease forwards";
      setTimeout(() => overlay.remove(), 300);
    }
    addLockButton();
    startIdleWatcher();
  }

  /* ══════════════════════════════════════════
     LOCK BUTTON IN NAVBAR
  ══════════════════════════════════════════ */
  function addLockButton() {
    if (document.getElementById("sec-lock-btn")) return;
    const nav = document.querySelector(".nav-stats");
    if (!nav) return;
    const btn = document.createElement("button");
    btn.id = "sec-lock-btn";
    btn.title = "Lock app";
    btn.innerHTML = `🔒 Lock`;
    btn.onclick = lockApp;
    nav.prepend(btn);

    // Show user badge in lock button
    if (currentUser) btn.innerHTML = `🔒 ${currentUser}`;
  }

  /* ══════════════════════════════════════════
     LOCK APP
  ══════════════════════════════════════════ */
  function lockApp() {
    isUnlocked = false;
    clearSession();
    clearIdleTimer();
    const btn = document.getElementById("sec-lock-btn");
    if (btn) btn.remove();
    buildLockScreen("Locked manually");
  }

  /* ══════════════════════════════════════════
     IDLE WATCHER
  ══════════════════════════════════════════ */
  function startIdleWatcher() {
    if (!CONFIG.idleMinutes || CONFIG.idleMinutes <= 0) return;
    resetIdleTimer();
    ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"].forEach(ev => {
      document.addEventListener(ev, resetIdleTimer, { passive: true });
    });
  }

  function resetIdleTimer() {
    clearIdleTimer();
    hideIdleToast();
    if (!isUnlocked) return;
    const warnMs  = (CONFIG.idleMinutes * 60 - 10) * 1000; // warn 10s before
    const lockMs  = CONFIG.idleMinutes * 60 * 1000;

    idleTimer = setTimeout(() => {
      showIdleToast(10);
      idleTimer = setTimeout(() => {
        lockApp();
        buildLockScreen("Auto-locked due to inactivity");
      }, 10000);
    }, Math.max(warnMs, 1000));
  }

  function clearIdleTimer() {
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  }

  let toastInterval = null;
  function showIdleToast(seconds) {
    const toast = document.getElementById("sec-idle-toast");
    if (!toast) return;
    toast.style.display = "block";
    let s = seconds;
    document.getElementById("idle-count").textContent = s;
    toastInterval = setInterval(() => {
      s--;
      const el = document.getElementById("idle-count");
      if (el) el.textContent = s;
      if (s <= 0) clearInterval(toastInterval);
    }, 1000);
  }

  function hideIdleToast() {
    const toast = document.getElementById("sec-idle-toast");
    if (toast) toast.style.display = "none";
    if (toastInterval) { clearInterval(toastInterval); toastInterval = null; }
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  function init() {
    injectStyles();
    if (checkSession()) {
      // Already logged in this browser session
      isUnlocked = true;
      addLockButton();
      startIdleWatcher();
      console.log("✅ INVOX Security: session restored for", currentUser);
    } else {
      buildLockScreen();
      console.log("🔐 INVOX Security: PIN screen shown");
    }
  }

  // Run immediately — blocks the app before anything loads
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
