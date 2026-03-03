/**
 * INVOX EXPENSES — expenses.js
 * ─────────────────────────────────────────────
 * Features:
 *   1) Add / edit / delete expenses
 *   2) Categories: Rent, Electricity, Salary etc.
 *   3) Monthly expense report with bar chart
 *   4) Export expenses as CSV
 *   5) Admin + Staff can add expenses
 *
 * HOW TO USE:
 *   <script src="security.js"></script>
 *   <script src="plugins.js"></script>
 *   <script src="reports.js"></script>
 *   <script src="expenses.js"></script>  ← add this
 *
 * ─────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════
     CONFIG
  ══════════════════════════════════════════ */
  const CATEGORIES = [
    { name: "Rent",                  icon: "🏠", color: "#e8ff47" },
    { name: "Electricity / Water",   icon: "⚡", color: "#47ffe8" },
    { name: "Staff Salary",          icon: "👷", color: "#a78bfa" },
    { name: "Packaging & Supplies",  icon: "📦", color: "#fb923c" },
    { name: "Transport / Delivery",  icon: "🚚", color: "#34d399" },
    { name: "Maintenance & Repairs", icon: "🔧", color: "#f472b6" },
    { name: "Miscellaneous",         icon: "📋", color: "#60a5fa" },
  ];

  const STORE_KEY   = "invox_expenses";
  const ADMIN_NAME  = "NEERAJ"; // must match security.js

  /* ══════════════════════════════════════════
     STATE
  ══════════════════════════════════════════ */
  let expenses     = [];
  let editExpId    = null;
  let filterMonth  = currentMonthKey(); // "YYYY-MM"

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  const $    = id => document.getElementById(id);
  const fmt  = n  => "₹" + Number(n || 0).toFixed(2);
  const fmtK = n  => n >= 100000 ? "₹" + (n/100000).toFixed(1) + "L"
                   : n >= 1000   ? "₹" + (n/1000).toFixed(1) + "k"
                   : fmt(n);
  const esc  = s  => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const genId = () => "EXP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();

  function currentMonthKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  function monthLabel(key) {
    const [y, m] = key.split("-");
    return new Date(+y, +m - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
  }

  function getCurrentUser() {
    try {
      const s = JSON.parse(sessionStorage.getItem("invox_session") || "null");
      return s ? s.user : "Unknown";
    } catch (_) { return "Unknown"; }
  }

  function isAdmin() {
    return getCurrentUser() === ADMIN_NAME;
  }

  function getCatMeta(name) {
    return CATEGORIES.find(c => c.name === name) || { icon: "📋", color: "#60a5fa" };
  }

  /* ══════════════════════════════════════════
     STORAGE
  ══════════════════════════════════════════ */
  function loadExpenses() {
    try { expenses = JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); }
    catch (_) { expenses = []; }
  }

  function saveExpenses() {
    localStorage.setItem(STORE_KEY, JSON.stringify(expenses));
  }

  /* ══════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════ */
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      /* ── Page ── */
      #page-expenses { display:none; position:relative; z-index:1; max-width:1200px; margin:0 auto; padding:2rem; animation:fadeUp .3s ease; }
      #page-expenses.active { display:block; }

      /* ── Top KPI strip ── */
      .exp-kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:.75rem; margin-bottom:1.5rem; }
      @media(max-width:700px){ .exp-kpi-row{grid-template-columns:1fr 1fr;} }
      .exp-kpi { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1rem 1.2rem; }
      .exp-kpi-val { font-family:'Syne',sans-serif; font-weight:800; font-size:1.3rem; margin-bottom:.2rem; }
      .exp-kpi-lbl { font-size:.62rem; color:var(--muted); text-transform:uppercase; letter-spacing:.1em; font-family:'Syne',sans-serif; }
      .exp-kpi-sub { font-size:.68rem; color:var(--muted); margin-top:.2rem; }

      /* ── Month selector ── */
      .exp-month-bar { display:flex; align-items:center; gap:.75rem; margin-bottom:1.25rem; flex-wrap:wrap; }
      .exp-month-nav { background:var(--surface); border:1px solid var(--border); border-radius:8px; color:var(--text); padding:.45rem .85rem; cursor:pointer; font-family:'Syne',sans-serif; font-size:.82rem; font-weight:700; transition:all .15s; }
      .exp-month-nav:hover { border-color:var(--accent); color:var(--accent); }
      .exp-month-label { font-family:'Syne',sans-serif; font-weight:700; font-size:.95rem; color:var(--accent); min-width:160px; text-align:center; }

      /* ── Two col layout ── */
      .exp-layout { display:grid; grid-template-columns:1fr 1.4fr; gap:1.25rem; }
      @media(max-width:750px){ .exp-layout{grid-template-columns:1fr;} }

      /* ── Add expense form ── */
      .exp-form-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.4rem; height:fit-content; }
      .exp-form-card h3 { font-family:'Syne',sans-serif; font-weight:700; font-size:.88rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-bottom:1.2rem; }
      .exp-form-grid { display:flex; flex-direction:column; gap:.75rem; margin-bottom:1rem; }
      .exp-field { display:flex; flex-direction:column; gap:.3rem; }
      .exp-field label { font-size:.65rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-family:'Syne',sans-serif; font-weight:600; }
      .exp-field input, .exp-field select, .exp-field textarea {
        background:var(--bg); border:1px solid var(--border); border-radius:8px;
        padding:.6rem .85rem; color:var(--text); font-family:'DM Mono',monospace;
        font-size:.83rem; outline:none; transition:border-color .2s; width:100%;
      }
      .exp-field input:focus, .exp-field select:focus, .exp-field textarea:focus { border-color:var(--accent); }
      .exp-field textarea { resize:vertical; min-height:60px; }
      .exp-cat-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:.4rem; }
      .exp-cat-btn {
        padding:.5rem .6rem; border-radius:8px; border:1px solid var(--border);
        background:transparent; cursor:pointer; font-size:.72rem;
        font-family:'DM Mono',monospace; color:var(--muted);
        transition:all .15s; text-align:left; display:flex; align-items:center; gap:.4rem;
      }
      .exp-cat-btn:hover { border-color:var(--accent2); color:var(--text); }
      .exp-cat-btn.selected { border-color:var(--accent); color:var(--accent); background:rgba(232,255,71,.06); }
      .exp-form-actions { display:flex; gap:.6rem; justify-content:flex-end; }

      /* ── Expense list ── */
      .exp-list-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
      .exp-list-header { padding:.85rem 1.1rem; background:var(--surface2); border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
      .exp-list-title { font-family:'Syne',sans-serif; font-weight:700; font-size:.82rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
      .exp-list-body { max-height:420px; overflow-y:auto; }
      .exp-item { display:flex; align-items:center; gap:.85rem; padding:.85rem 1.1rem; border-bottom:1px solid var(--border); transition:background .15s; animation:rowIn .2s ease; }
      .exp-item:last-child { border-bottom:none; }
      .exp-item:hover { background:#14141e; }
      .exp-item-icon { font-size:1.3rem; flex-shrink:0; }
      .exp-item-info { flex:1; min-width:0; }
      .exp-item-name { font-size:.82rem; font-weight:500; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .exp-item-meta { font-size:.68rem; color:var(--muted); margin-top:.15rem; }
      .exp-item-right { display:flex; flex-direction:column; align-items:flex-end; gap:.25rem; flex-shrink:0; }
      .exp-item-amt { font-family:'Syne',sans-serif; font-weight:700; font-size:.9rem; }
      .exp-item-actions { display:flex; gap:.3rem; }
      .exp-list-footer { padding:.75rem 1.1rem; background:var(--surface2); border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; font-size:.78rem; color:var(--muted); }
      .exp-list-footer b { font-family:'Syne',sans-serif; font-size:.95rem; color:var(--accent); }

      /* ── Category breakdown ── */
      .exp-breakdown { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.2rem; margin-top:1.25rem; }
      .exp-breakdown h3 { font-family:'Syne',sans-serif; font-weight:700; font-size:.78rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:1rem; }
      .exp-bars { display:flex; flex-direction:column; gap:.6rem; }
      .exp-bar-row { display:grid; grid-template-columns:140px 1fr 80px; align-items:center; gap:.65rem; font-size:.75rem; }
      .exp-bar-label { display:flex; align-items:center; gap:.35rem; color:var(--text); }
      .exp-bar-track { height:8px; background:#1e1e2e; border-radius:999px; overflow:hidden; }
      .exp-bar-fill { height:100%; border-radius:999px; transition:width .5s cubic-bezier(.4,0,.2,1); }
      .exp-bar-val { font-family:'Syne',sans-serif; font-weight:600; text-align:right; }

      /* ── Empty ── */
      .exp-empty { text-align:center; padding:3rem 1rem; color:var(--muted); }
      .exp-empty .big { font-size:2.5rem; margin-bottom:.5rem; }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════
     NAV TAB
  ══════════════════════════════════════════ */
  function addNavTab() {
    const nav    = document.querySelector("nav.nav");
    const spacer = nav.querySelector(".nav-spacer");
    const tab    = document.createElement("button");
    tab.className  = "nav-tab";
    tab.id         = "nav-expenses";
    tab.textContent = "💸 Expenses";
    tab.onclick = function () { window.showPage("expenses", tab); };
    nav.insertBefore(tab, spacer);
  }

  /* ══════════════════════════════════════════
     PAGE HTML
  ══════════════════════════════════════════ */
  function buildPage() {
    const page = document.createElement("div");
    page.className = "page";
    page.id        = "page-expenses";
    page.innerHTML = `
      <!-- KPI strip -->
      <div class="exp-kpi-row" id="exp-kpi-row"></div>

      <!-- Month navigator -->
      <div class="exp-month-bar">
        <button class="exp-month-nav" onclick="window.__expPrevMonth()">◀ Prev</button>
        <div class="exp-month-label" id="exp-month-label"></div>
        <button class="exp-month-nav" onclick="window.__expNextMonth()">Next ▶</button>
        <button class="btn btn-ghost btn-sm" onclick="window.__expExport()">⬇ Export CSV</button>
      </div>

      <!-- Main layout -->
      <div class="exp-layout">

        <!-- Add expense form -->
        <div class="exp-form-card">
          <h3 id="exp-form-title">➕ Add Expense</h3>
          <div class="exp-form-grid">

            <div class="exp-field">
              <label>Category *</label>
              <div class="exp-cat-grid" id="exp-cat-grid">
                ${CATEGORIES.map(c => `
                  <button class="exp-cat-btn" data-cat="${esc(c.name)}" onclick="window.__expSelectCat('${esc(c.name)}')" style="--cc:${c.color}">
                    <span>${c.icon}</span><span>${esc(c.name)}</span>
                  </button>`).join("")}
              </div>
            </div>

            <div class="exp-field">
              <label>Description *</label>
              <input type="text" id="exp-desc" placeholder="e.g. Monthly rent payment">
            </div>

            <div class="exp-field">
              <label>Amount (₹) *</label>
              <input type="number" id="exp-amt" placeholder="0.00" min="0" step="0.01">
            </div>

            <div class="exp-field">
              <label>Date</label>
              <input type="date" id="exp-date">
            </div>

            <div class="exp-field">
              <label>Notes</label>
              <textarea id="exp-notes" placeholder="Optional notes..."></textarea>
            </div>

          </div>
          <div class="exp-form-actions">
            <button class="btn btn-ghost" onclick="window.__expClear()">Clear</button>
            <button class="btn btn-primary" onclick="window.__expSave()">Save Expense</button>
          </div>
        </div>

        <!-- Expense list -->
        <div>
          <div class="exp-list-card">
            <div class="exp-list-header">
              <div class="exp-list-title">📋 Expenses</div>
              <input class="search-box" type="text" id="exp-search"
                placeholder="Search..." oninput="window.__expRender()"
                style="max-width:180px;padding:.4rem .75rem;font-size:.78rem">
            </div>
            <div class="exp-list-body" id="exp-list-body"></div>
            <div class="exp-list-footer">
              <span id="exp-list-count">0 expenses</span>
              <span>Total: <b id="exp-list-total">₹0.00</b></span>
            </div>
          </div>

          <!-- Category breakdown -->
          <div class="exp-breakdown">
            <h3>📊 Breakdown by Category</h3>
            <div class="exp-bars" id="exp-bars"></div>
          </div>
        </div>

      </div>
    `;
    document.body.appendChild(page);

    // Set default date to today
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("exp-date").value = today;
  }

  /* ══════════════════════════════════════════
     SELECTED CATEGORY STATE
  ══════════════════════════════════════════ */
  let selectedCat = "";

  window.__expSelectCat = function (name) {
    selectedCat = name;
    document.querySelectorAll(".exp-cat-btn").forEach(b => {
      b.classList.toggle("selected", b.dataset.cat === name);
    });
  };

  /* ══════════════════════════════════════════
     MONTH NAVIGATION
  ══════════════════════════════════════════ */
  window.__expPrevMonth = function () {
    const [y, m] = filterMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    filterMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    window.__expRender();
  };

  window.__expNextMonth = function () {
    const [y, m] = filterMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    filterMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    window.__expRender();
  };

  /* ══════════════════════════════════════════
     SAVE EXPENSE
  ══════════════════════════════════════════ */
  window.__expSave = function () {
    const desc = ($("exp-desc")?.value || "").trim();
    const amt  = parseFloat($("exp-amt")?.value) || 0;
    const date = $("exp-date")?.value || new Date().toISOString().split("T")[0];

    if (!selectedCat)  { alert("Please select a category."); return; }
    if (!desc)         { alert("Please enter a description."); return; }
    if (amt <= 0)      { alert("Please enter a valid amount."); return; }

    if (editExpId) {
      // Update existing
      const idx = expenses.findIndex(e => e.id === editExpId);
      if (idx >= 0) {
        expenses[idx] = { ...expenses[idx], category: selectedCat, desc, amount: amt, date, notes: $("exp-notes")?.value.trim() || "", updatedAt: Date.now(), updatedBy: getCurrentUser() };
      }
      editExpId = null;
      if ($("exp-form-title")) $("exp-form-title").textContent = "➕ Add Expense";
    } else {
      // New expense
      expenses.unshift({
        id: genId(), category: selectedCat, desc, amount: amt,
        date, notes: $("exp-notes")?.value.trim() || "",
        createdAt: Date.now(), createdBy: getCurrentUser()
      });
    }

    saveExpenses();
    window.__expClear();
    window.__expRender();
  };

  /* ══════════════════════════════════════════
     EDIT EXPENSE
  ══════════════════════════════════════════ */
  window.__expEdit = function (id) {
    const e = expenses.find(x => x.id === id);
    if (!e) return;
    editExpId = id;
    window.__expSelectCat(e.category);
    if ($("exp-desc"))  $("exp-desc").value  = e.desc;
    if ($("exp-amt"))   $("exp-amt").value   = e.amount;
    if ($("exp-date"))  $("exp-date").value  = e.date;
    if ($("exp-notes")) $("exp-notes").value = e.notes || "";
    if ($("exp-form-title")) $("exp-form-title").textContent = "✏️ Edit Expense";
    // Scroll form into view
    document.querySelector(".exp-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* ══════════════════════════════════════════
     DELETE EXPENSE (Admin only)
  ══════════════════════════════════════════ */
  window.__expDelete = function (id) {
    if (!isAdmin()) { alert("Only Admin can delete expenses."); return; }
    if (!confirm("Delete this expense?")) return;
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    window.__expRender();
  };

  /* ══════════════════════════════════════════
     CLEAR FORM
  ══════════════════════════════════════════ */
  window.__expClear = function () {
    editExpId   = null;
    selectedCat = "";
    document.querySelectorAll(".exp-cat-btn").forEach(b => b.classList.remove("selected"));
    ["exp-desc","exp-amt","exp-notes"].forEach(id => { if ($(id)) $(id).value = ""; });
    const today = new Date().toISOString().split("T")[0];
    if ($("exp-date")) $("exp-date").value = today;
    if ($("exp-form-title")) $("exp-form-title").textContent = "➕ Add Expense";
  };

  /* ══════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════ */
  window.__expRender = function () {
    loadExpenses();
    const search = ($("exp-search")?.value || "").toLowerCase();

    // Filter by month + search
    const monthExp = expenses.filter(e => {
      const monthMatch = e.date && e.date.startsWith(filterMonth);
      const searchMatch = !search ||
        e.desc.toLowerCase().includes(search) ||
        e.category.toLowerCase().includes(search);
      return monthMatch && searchMatch;
    });

    // Update month label
    if ($("exp-month-label")) $("exp-month-label").textContent = monthLabel(filterMonth);

    // ── KPI strip ──
    const totalAmt  = monthExp.reduce((s, e) => s + e.amount, 0);
    const byDay     = [...new Set(monthExp.map(e => e.date))].length;
    const topCat    = (() => {
      const m = {};
      monthExp.forEach(e => { m[e.category] = (m[e.category]||0) + e.amount; });
      return Object.entries(m).sort((a,b)=>b[1]-a[1])[0];
    })();
    const prevMonth = (() => {
      const [y, m] = filterMonth.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      const key = d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0");
      return expenses.filter(e => e.date?.startsWith(key)).reduce((s,e)=>s+e.amount,0);
    })();
    const diff = totalAmt - prevMonth;
    const diffStr = prevMonth === 0 ? "" : (diff >= 0 ? `▲ ${fmtK(diff)} vs last month` : `▼ ${fmtK(Math.abs(diff))} vs last month`);
    const diffColor = diff > 0 ? "#ff4757" : "#2ed573";

    if ($("exp-kpi-row")) $("exp-kpi-row").innerHTML = `
      <div class="exp-kpi">
        <div class="exp-kpi-val" style="color:#e8ff47">${fmtK(totalAmt)}</div>
        <div class="exp-kpi-lbl">Total Expenses</div>
        ${diffStr ? `<div class="exp-kpi-sub" style="color:${diffColor}">${diffStr}</div>` : ""}
      </div>
      <div class="exp-kpi">
        <div class="exp-kpi-val" style="color:#a78bfa">${monthExp.length}</div>
        <div class="exp-kpi-lbl">Transactions</div>
        <div class="exp-kpi-sub">across ${byDay} day${byDay!==1?"s":""}</div>
      </div>
      <div class="exp-kpi">
        <div class="exp-kpi-val" style="color:#47ffe8">${topCat ? getCatMeta(topCat[0]).icon + " " + topCat[0].split("/")[0].trim() : "—"}</div>
        <div class="exp-kpi-lbl">Top Category</div>
        <div class="exp-kpi-sub">${topCat ? fmtK(topCat[1]) : ""}</div>
      </div>
      <div class="exp-kpi">
        <div class="exp-kpi-val" style="color:#fb923c">${fmtK(totalAmt / (new Date(filterMonth.split("-")[0], filterMonth.split("-")[1], 0).getDate()) * 30)}</div>
        <div class="exp-kpi-lbl">Monthly Run Rate</div>
        <div class="exp-kpi-sub">projected</div>
      </div>
    `;

    // ── Expense list ──
    const body = $("exp-list-body");
    if (body) {
      if (monthExp.length === 0) {
        body.innerHTML = `<div class="exp-empty"><div class="big">💸</div><p>No expenses for ${monthLabel(filterMonth)}.</p></div>`;
      } else {
        body.innerHTML = monthExp.map(e => {
          const meta = getCatMeta(e.category);
          const canEdit = true;
          const canDel  = isAdmin();
          return `
            <div class="exp-item">
              <div class="exp-item-icon">${meta.icon}</div>
              <div class="exp-item-info">
                <div class="exp-item-name">${esc(e.desc)}</div>
                <div class="exp-item-meta">
                  <span style="color:${meta.color}">${esc(e.category)}</span>
                  · ${esc(e.date)}
                  · Added by <b style="color:var(--text)">${esc(e.createdBy||"—")}</b>
                  ${e.notes ? `· <span title="${esc(e.notes)}">📝</span>` : ""}
                </div>
              </div>
              <div class="exp-item-right">
                <div class="exp-item-amt" style="color:${meta.color}">${fmt(e.amount)}</div>
                <div class="exp-item-actions">
                  ${canEdit ? `<button class="act-btn" onclick="window.__expEdit('${e.id}')">Edit</button>` : ""}
                  ${canDel  ? `<button class="act-btn del" onclick="window.__expDelete('${e.id}')">Del</button>` : ""}
                </div>
              </div>
            </div>`;
        }).join("");
      }
    }

    if ($("exp-list-count")) $("exp-list-count").textContent = `${monthExp.length} expense${monthExp.length!==1?"s":""}`;
    if ($("exp-list-total")) $("exp-list-total").textContent = fmt(totalAmt);

    // ── Category breakdown bars ──
    const catTotals = {};
    monthExp.forEach(e => { catTotals[e.category] = (catTotals[e.category]||0) + e.amount; });
    const catEntries = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    const maxCat = catEntries[0]?.[1] || 1;
    const barsEl = $("exp-bars");
    if (barsEl) {
      barsEl.innerHTML = catEntries.length === 0
        ? `<div style="color:var(--muted);font-size:.78rem">No data</div>`
        : catEntries.map(([cat, amt]) => {
            const m = getCatMeta(cat);
            return `<div class="exp-bar-row">
              <div class="exp-bar-label">${m.icon} ${esc(cat.split("/")[0].trim())}</div>
              <div class="exp-bar-track">
                <div class="exp-bar-fill" style="width:${(amt/maxCat*100).toFixed(1)}%;background:${m.color}"></div>
              </div>
              <div class="exp-bar-val" style="color:${m.color}">${fmtK(amt)}</div>
            </div>`;
          }).join("");
    }
  };

  /* ══════════════════════════════════════════
     EXPORT CSV
  ══════════════════════════════════════════ */
  window.__expExport = function () {
    const monthExp = expenses.filter(e => e.date?.startsWith(filterMonth));
    const rows = [["ID","Date","Category","Description","Amount","Notes","Added By"]];
    monthExp.forEach(e => rows.push([e.id, e.date, e.category, e.desc, e.amount.toFixed(2), e.notes||"", e.createdBy||""]));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(
      [rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")],
      { type: "text/csv" }
    ));
    a.download = `expenses-${filterMonth}.csv`;
    a.click();
  };

  /* ══════════════════════════════════════════
     PATCH showPage
  ══════════════════════════════════════════ */
  function patchShowPage() {
    const orig = window.showPage.bind(window);
    window.showPage = function (name, btn) {
      orig(name, btn);
      if (name === "expenses") {
        filterMonth = currentMonthKey();
        window.__expRender();
      }
    };
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  function waitFor(fn, cb, ms = 300, max = 15000) {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fn()) { clearInterval(iv); cb(); }
      else if (Date.now() - t0 > max) clearInterval(iv);
    }, ms);
  }

  waitFor(
    () => typeof window.showPage === "function" && document.querySelector("nav.nav"),
    () => {
      injectStyles();
      addNavTab();
      buildPage();
      loadExpenses();
      patchShowPage();
      console.log("✅ INVOX Expenses loaded");
    }
  );

})();
