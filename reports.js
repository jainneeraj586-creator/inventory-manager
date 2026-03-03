/**
 * INVOX REPORTS — reports.js
 * ─────────────────────────────────────────────
 * Admin-only Sales Report injected into Dashboard
 * Shows: Daily/Weekly/Monthly Sales, Top Items,
 *        Revenue by Category, Customer-wise Sales
 *
 * HOW TO USE:
 *   Add AFTER security.js and plugins.js:
 *
 *   <script src="security.js"></script>
 *   <script src="plugins.js"></script>
 *   <script src="reports.js"></script>
 *
 * Only visible when logged in as "Admin"
 * ─────────────────────────────────────────────
 */

(function () {
  "use strict";

  // ── Wait for app + security to be ready ──
  function waitFor(fn, cb, ms = 300, max = 20000) {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (fn()) { clearInterval(iv); cb(); }
      else if (Date.now() - t0 > max) clearInterval(iv);
    }, ms);
  }

  waitFor(
    () => typeof window.renderInvoices === "function" &&
          document.getElementById("page-dashboard"),
    initReports
  );

  /* ══════════════════════════════════════════
     HELPERS
  ══════════════════════════════════════════ */
  const fmt  = n => "₹" + Number(n || 0).toFixed(2);
  const fmtK = n => n >= 100000 ? "₹" + (n/100000).toFixed(1) + "L"
                  : n >= 1000   ? "₹" + (n/1000).toFixed(1) + "k"
                  : fmt(n);
  const esc  = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  function isAdmin() {
    try {
      const s = JSON.parse(sessionStorage.getItem("invox_session") || "null");
      return s && s.user === "NEERAJ";
    } catch (_) { return false; }
  }

  function getInvoices() {
    // Read from rendered invoice cards + fallback to window mirror
    return window.__pluginInvoices || [];
  }

  // Better: hook into Firestore snapshot via MutationObserver on dashboard
  let _invoiceData = [];
  function syncInvoiceData() {
    // We observe the invoices grid to keep a full data mirror
    const grid = document.getElementById("invoices-grid");
    if (!grid) return;
    new MutationObserver(() => rebuildReport()).observe(grid, { childList: true, subtree: false });
  }

  // Expose a setter so main app can push data to us
  window.__reportSetInvoices = function (data) {
    _invoiceData = data;
    if (isAdmin()) rebuildReport();
  };

  // Patch renderInvoices to capture invoice data
  function patchRenderInvoices() {
    const orig = window.renderInvoices.bind(window);
    window.renderInvoices = function () {
      orig();
      if (isAdmin()) setTimeout(rebuildReport, 80);
    };
  }

  // Read invoice objects from window.__pluginInvoices (set by plugins.js)
  // and also from DOM as fallback
  function getAllInvoices() {
    const fromMirror = (window.__pluginInvoices || []);
    if (fromMirror.length > 0) return fromMirror;
    return _invoiceData;
  }

  /* ══════════════════════════════════════════
     STYLES
  ══════════════════════════════════════════ */
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      #admin-report {
        margin-top: 1.5rem;
        border: 1px solid rgba(232,255,71,.15);
        border-radius: 14px;
        overflow: hidden;
        background: linear-gradient(135deg, rgba(232,255,71,.02), rgba(167,139,250,.02));
      }
      #admin-report .rpt-header {
        padding: 1rem 1.4rem;
        background: rgba(232,255,71,.04);
        border-bottom: 1px solid rgba(232,255,71,.1);
        display: flex; justify-content: space-between; align-items: center;
        flex-wrap: wrap; gap: .75rem;
      }
      #admin-report .rpt-title {
        font-family: 'Syne', sans-serif; font-weight: 800;
        font-size: .88rem; color: #e8ff47;
        display: flex; align-items: center; gap: .5rem;
      }
      #admin-report .rpt-badge {
        background: rgba(232,255,71,.12); color: #e8ff47;
        border: 1px solid rgba(232,255,71,.25);
        border-radius: 999px; padding: .15rem .55rem;
        font-size: .62rem; font-family: 'Syne', sans-serif; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
      }
      .rpt-period-tabs {
        display: flex; gap: .35rem;
      }
      .rpt-tab {
        padding: .3rem .75rem; border-radius: 999px;
        border: 1px solid #1e1e2e; background: transparent;
        color: #5a5a7a; font-family: 'Syne', sans-serif;
        font-size: .7rem; font-weight: 600; cursor: pointer;
        transition: all .15s;
      }
      .rpt-tab:hover { border-color: #e8ff47; color: #e8ff47; }
      .rpt-tab.active {
        background: #e8ff47; color: #0a0a0f;
        border-color: #e8ff47;
      }
      #admin-report .rpt-body {
        padding: 1.25rem 1.4rem;
        display: flex; flex-direction: column; gap: 1.5rem;
      }

      /* ── KPI row ── */
      .rpt-kpi-row {
        display: grid; grid-template-columns: repeat(4,1fr); gap: .75rem;
      }
      @media(max-width:700px){ .rpt-kpi-row { grid-template-columns: 1fr 1fr; } }
      .rpt-kpi {
        background: #0d0d15; border: 1px solid #1e1e2e;
        border-radius: 10px; padding: .9rem 1rem;
      }
      .rpt-kpi-val {
        font-family: 'Syne', sans-serif; font-weight: 800;
        font-size: 1.2rem; margin-bottom: .2rem;
      }
      .rpt-kpi-lbl {
        font-size: .62rem; color: #5a5a7a; text-transform: uppercase;
        letter-spacing: .1em; font-family: 'Syne', sans-serif;
      }
      .rpt-kpi-sub {
        font-size: .68rem; color: #5a5a7a; margin-top: .15rem;
      }

      /* ── Section title ── */
      .rpt-sec-title {
        font-family: 'Syne', sans-serif; font-weight: 700;
        font-size: .72rem; text-transform: uppercase;
        letter-spacing: .12em; color: #5a5a7a;
        margin-bottom: .75rem; padding-bottom: .4rem;
        border-bottom: 1px solid #1e1e2e;
        display: flex; justify-content: space-between; align-items: center;
      }
      .rpt-sec-title span { color: #a78bfa; }

      /* ── Bar chart ── */
      .rpt-bars { display: flex; flex-direction: column; gap: .5rem; }
      .rpt-bar-row {
        display: grid; grid-template-columns: 110px 1fr 80px;
        align-items: center; gap: .65rem; font-size: .75rem;
      }
      .rpt-bar-label { color: #f0f0f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .rpt-bar-track {
        height: 8px; background: #1e1e2e; border-radius: 999px; overflow: hidden;
      }
      .rpt-bar-fill {
        height: 100%; border-radius: 999px;
        transition: width .5s cubic-bezier(.4,0,.2,1);
      }
      .rpt-bar-val {
        font-family: 'Syne', sans-serif; font-weight: 600;
        text-align: right; white-space: nowrap;
      }

      /* ── Two col grid ── */
      .rpt-two-col {
        display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
      }
      @media(max-width:650px){ .rpt-two-col { grid-template-columns: 1fr; } }
      .rpt-panel {
        background: #0d0d15; border: 1px solid #1e1e2e;
        border-radius: 10px; padding: 1rem;
      }

      /* ── Sales timeline ── */
      .rpt-timeline {
        display: flex; flex-direction: column; gap: .4rem;
      }
      .rpt-tl-row {
        display: flex; justify-content: space-between;
        align-items: center; padding: .4rem 0;
        border-bottom: 1px solid #1a1a28; font-size: .78rem;
      }
      .rpt-tl-row:last-child { border-bottom: none; }
      .rpt-tl-date { color: #5a5a7a; font-size: .7rem; }
      .rpt-tl-amt {
        font-family: 'Syne', sans-serif; font-weight: 700;
        color: #e8ff47;
      }
      .rpt-tl-count {
        font-size: .68rem; color: #5a5a7a;
        background: #1e1e2e; padding: .1rem .4rem;
        border-radius: 999px;
      }

      /* ── Customer table ── */
      .rpt-cust-table { width: 100%; border-collapse: collapse; font-size: .78rem; }
      .rpt-cust-table th {
        text-align: left; padding: .4rem .5rem;
        font-size: .62rem; color: #5a5a7a;
        font-family: 'Syne', sans-serif; font-weight: 700;
        text-transform: uppercase; letter-spacing: .08em;
        border-bottom: 1px solid #1e1e2e;
      }
      .rpt-cust-table td {
        padding: .5rem .5rem; border-bottom: 1px solid #14141e;
        vertical-align: middle;
      }
      .rpt-cust-table tr:last-child td { border-bottom: none; }
      .rpt-cust-table tr:hover td { background: #111118; }
      .rpt-cust-name { font-weight: 500; color: #f0f0f5; }
      .rpt-cust-contact { font-size: .65rem; color: #5a5a7a; }

      /* ── Empty ── */
      .rpt-empty {
        text-align: center; padding: 2rem; color: #5a5a7a; font-size: .78rem;
      }

      /* ── Export btn ── */
      .rpt-export-btn {
        background: transparent; border: 1px solid #1e1e2e;
        border-radius: 6px; color: #5a5a7a; cursor: pointer;
        padding: .3rem .65rem; font-size: .7rem;
        font-family: 'Syne', sans-serif; font-weight: 600;
        transition: all .15s;
      }
      .rpt-export-btn:hover { border-color: #47ffe8; color: #47ffe8; }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════
     BUILD REPORT SECTION IN DASHBOARD
  ══════════════════════════════════════════ */
  function buildReportShell() {
    const dash = document.getElementById("page-dashboard");
    if (!dash || document.getElementById("admin-report")) return;

    const div = document.createElement("div");
    div.id = "admin-report";
    div.innerHTML = `
      <div class="rpt-header">
        <div class="rpt-title">
          📊 Sales Report
          <span class="rpt-badge">Admin Only</span>
        </div>
        <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
          <div class="rpt-period-tabs">
            <button class="rpt-tab active" data-period="daily"   onclick="window.__rptPeriod('daily',this)">Today</button>
            <button class="rpt-tab"        data-period="weekly"  onclick="window.__rptPeriod('weekly',this)">Week</button>
            <button class="rpt-tab"        data-period="monthly" onclick="window.__rptPeriod('monthly',this)">Month</button>
            <button class="rpt-tab"        data-period="all"     onclick="window.__rptPeriod('all',this)">All Time</button>
          </div>
          <button class="rpt-export-btn" onclick="window.__rptExport()">⬇ Export CSV</button>
        </div>
      </div>
      <div class="rpt-body" id="rpt-body">
        <div class="rpt-empty">Loading report...</div>
      </div>
    `;
    dash.appendChild(div);
  }

  let currentPeriod = "daily";

  window.__rptPeriod = function (period, btn) {
    currentPeriod = period;
    document.querySelectorAll(".rpt-tab").forEach(t => t.classList.remove("active"));
    if (btn) btn.classList.add("active");
    rebuildReport();
  };

  /* ══════════════════════════════════════════
     DATA FILTERING BY PERIOD
  ══════════════════════════════════════════ */
  function filterByPeriod(invoices, period) {
    const now = new Date();
    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today   = startOf(now);
    const weekAgo = today - 6 * 86400000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return invoices.filter(inv => {
      const t = inv.createdAt || 0;
      if (period === "daily")   return t >= today;
      if (period === "weekly")  return t >= weekAgo;
      if (period === "monthly") return t >= monthStart;
      return true; // all
    });
  }

  /* ══════════════════════════════════════════
     REPORT BUILDER
  ══════════════════════════════════════════ */
  function rebuildReport() {
    if (!isAdmin()) return;
    const body = document.getElementById("rpt-body");
    if (!body) return;

    const all      = getAllInvoices();
    const filtered = filterByPeriod(all, currentPeriod);
    const paid     = filtered.filter(i => i.status === "paid");
    const pending  = filtered.filter(i => i.status === "pending");

    if (filtered.length === 0) {
      body.innerHTML = `<div class="rpt-empty">📭 No sales data for this period yet.</div>`;
      return;
    }

    const totalRev     = paid.reduce((s, i) => s + (i.grand || 0), 0);
    const totalPending = pending.reduce((s, i) => s + (i.grand || 0), 0);
    const avgOrder     = paid.length ? totalRev / paid.length : 0;

    // ── KPIs ──
    const kpiHTML = `
      <div class="rpt-kpi-row">
        <div class="rpt-kpi">
          <div class="rpt-kpi-val" style="color:#e8ff47">${fmtK(totalRev)}</div>
          <div class="rpt-kpi-lbl">Total Revenue</div>
          <div class="rpt-kpi-sub">${paid.length} paid invoice${paid.length !== 1 ? "s" : ""}</div>
        </div>
        <div class="rpt-kpi">
          <div class="rpt-kpi-val" style="color:#ffa502">${fmtK(totalPending)}</div>
          <div class="rpt-kpi-lbl">Pending Amount</div>
          <div class="rpt-kpi-sub">${pending.length} unpaid invoice${pending.length !== 1 ? "s" : ""}</div>
        </div>
        <div class="rpt-kpi">
          <div class="rpt-kpi-val" style="color:#2ed573">${fmtK(avgOrder)}</div>
          <div class="rpt-kpi-lbl">Avg Order Value</div>
          <div class="rpt-kpi-sub">per paid invoice</div>
        </div>
        <div class="rpt-kpi">
          <div class="rpt-kpi-val" style="color:#a78bfa">${filtered.length}</div>
          <div class="rpt-kpi-lbl">Total Invoices</div>
          <div class="rpt-kpi-sub">${paid.length} paid · ${pending.length} pending</div>
        </div>
      </div>`;

    // ── Timeline (group by date) ──
    const byDate = {};
    filtered.forEach(inv => {
      const d = inv.date || new Date(inv.createdAt).toLocaleDateString("en-IN");
      if (!byDate[d]) byDate[d] = { rev: 0, count: 0 };
      if (inv.status === "paid") byDate[d].rev += inv.grand || 0;
      byDate[d].count++;
    });
    const dateEntries = Object.entries(byDate)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 7);

    const timelineHTML = dateEntries.length === 0 ? `<div class="rpt-empty">No data</div>` :
      `<div class="rpt-timeline">${dateEntries.map(([date, d]) =>
        `<div class="rpt-tl-row">
          <span class="rpt-tl-date">📅 ${esc(date)}</span>
          <span class="rpt-tl-count">${d.count} invoice${d.count !== 1 ? "s" : ""}</span>
          <span class="rpt-tl-amt">${fmtK(d.rev)}</span>
        </div>`).join("")}
      </div>`;

    // ── Top selling items ──
    const itemMap = {};
    filtered.forEach(inv => {
      (inv.rows || []).forEach(r => {
        const name = r.name || "Unknown";
        if (!itemMap[name]) itemMap[name] = { qty: 0, rev: 0 };
        itemMap[name].qty += r.qty || 0;
        itemMap[name].rev += r.total || 0;
      });
    });
    const topItems = Object.entries(itemMap)
      .sort((a, b) => b[1].rev - a[1].rev)
      .slice(0, 6);
    const maxItemRev = topItems[0]?.[1].rev || 1;

    const topItemsHTML = topItems.length === 0 ? `<div class="rpt-empty">No items</div>` :
      `<div class="rpt-bars">${topItems.map(([name, d]) =>
        `<div class="rpt-bar-row">
          <div class="rpt-bar-label" title="${esc(name)}">${esc(name)}</div>
          <div class="rpt-bar-track">
            <div class="rpt-bar-fill" style="width:${(d.rev/maxItemRev*100).toFixed(1)}%;background:linear-gradient(90deg,#e8ff47,#47ffe8)"></div>
          </div>
          <div class="rpt-bar-val" style="color:#e8ff47">${fmtK(d.rev)}</div>
        </div>`).join("")}
      </div>`;

    // ── Revenue by category ──
    const catMap = {};
    filtered.forEach(inv => {
      (inv.rows || []).forEach(r => {
        // Try to get category from item name match (best effort)
        const cat = r.category || "Uncategorised";
        if (!catMap[cat]) catMap[cat] = 0;
        catMap[cat] += r.total || 0;
      });
    });
    // Also try window items array for category lookup
    const itemsArr = window.__invoxItems || [];
    if (itemsArr.length > 0) {
      // Reset and rebuild with proper categories
      Object.keys(catMap).forEach(k => delete catMap[k]);
      filtered.forEach(inv => {
        (inv.rows || []).forEach(r => {
          const item = itemsArr.find(it => it.name === r.name || it.id === r.itemId);
          const cat  = (item && item.category) ? item.category : "Uncategorised";
          if (!catMap[cat]) catMap[cat] = 0;
          catMap[cat] += r.total || 0;
        });
      });
    }
    const topCats = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxCatRev = topCats[0]?.[1] || 1;
    const catColors = ["#e8ff47","#47ffe8","#a78bfa","#fb923c","#f472b6"];

    const catHTML = topCats.length === 0 ? `<div class="rpt-empty">No category data</div>` :
      `<div class="rpt-bars">${topCats.map(([cat, rev], i) =>
        `<div class="rpt-bar-row">
          <div class="rpt-bar-label" title="${esc(cat)}">${esc(cat)}</div>
          <div class="rpt-bar-track">
            <div class="rpt-bar-fill" style="width:${(rev/maxCatRev*100).toFixed(1)}%;background:${catColors[i%catColors.length]}"></div>
          </div>
          <div class="rpt-bar-val" style="color:${catColors[i%catColors.length]}">${fmtK(rev)}</div>
        </div>`).join("")}
      </div>`;

    // ── Customer wise sales ──
    const custMap = {};
    filtered.forEach(inv => {
      const k = (inv.customer || "Unknown").trim();
      if (!custMap[k]) custMap[k] = { name: k, contact: inv.contact || "", rev: 0, count: 0, pending: 0 };
      if (inv.status === "paid")    custMap[k].rev     += inv.grand || 0;
      if (inv.status === "pending") custMap[k].pending += inv.grand || 0;
      custMap[k].count++;
    });
    const topCusts = Object.values(custMap)
      .sort((a, b) => b.rev - a.rev).slice(0, 8);

    const custHTML = topCusts.length === 0 ? `<div class="rpt-empty">No customer data</div>` :
      `<table class="rpt-cust-table">
        <thead><tr>
          <th>Customer</th><th>Invoices</th><th>Paid</th><th>Pending</th>
        </tr></thead>
        <tbody>${topCusts.map(c =>
          `<tr>
            <td>
              <div class="rpt-cust-name">${esc(c.name)}</div>
              ${c.contact ? `<div class="rpt-cust-contact">${esc(c.contact)}</div>` : ""}
            </td>
            <td style="color:#5a5a7a">${c.count}</td>
            <td style="font-family:'Syne',sans-serif;font-weight:700;color:#2ed573">${fmtK(c.rev)}</td>
            <td style="font-family:'Syne',sans-serif;font-weight:700;color:${c.pending>0?"#ffa502":"#5a5a7a"}">${c.pending > 0 ? fmtK(c.pending) : "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`;

    // ── Assemble ──
    body.innerHTML = `
      ${kpiHTML}

      <div>
        <div class="rpt-sec-title">
          Sales Timeline <span>${currentPeriod === "daily" ? "Today" : currentPeriod === "weekly" ? "Last 7 Days" : currentPeriod === "monthly" ? "This Month" : "All Time"}</span>
        </div>
        ${timelineHTML}
      </div>

      <div class="rpt-two-col">
        <div class="rpt-panel">
          <div class="rpt-sec-title">Top Selling Items <span>by revenue</span></div>
          ${topItemsHTML}
        </div>
        <div class="rpt-panel">
          <div class="rpt-sec-title">Revenue by Category <span>by revenue</span></div>
          ${catHTML}
        </div>
      </div>

      <div>
        <div class="rpt-sec-title">Customer-wise Sales <span>top 8 customers</span></div>
        ${custHTML}
      </div>
    `;
  }

  /* ══════════════════════════════════════════
     EXPORT REPORT AS CSV
  ══════════════════════════════════════════ */
  window.__rptExport = function () {
    if (!isAdmin()) return;
    const all      = getAllInvoices();
    const filtered = filterByPeriod(all, currentPeriod);
    const rows     = [["Invoice ID","Date","Customer","Contact","Status","Items","Subtotal","Discount","Tax","Grand Total"]];
    filtered.forEach(inv => {
      rows.push([
        inv.id, inv.date, inv.customer, inv.contact || "",
        inv.status,
        (inv.rows || []).map(r => `${r.name}×${r.qty}`).join("; "),
        (inv.subtotal || 0).toFixed(2),
        (inv.discAmt  || 0).toFixed(2),
        (inv.taxAmt   || 0).toFixed(2),
        (inv.grand    || 0).toFixed(2)
      ]);
    });
    const period = { daily:"today", weekly:"this-week", monthly:"this-month", all:"all-time" }[currentPeriod];
    dlCSV(rows, `sales-report-${period}.csv`);
  };

  function dlCSV(rows, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(
      [rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")],
      { type: "text/csv" }
    ));
    a.download = name; a.click();
  }

  /* ══════════════════════════════════════════
     EXPOSE ITEMS ARRAY FOR CATEGORY LOOKUP
  ══════════════════════════════════════════ */
  function patchInventory() {
    const origRI = window.renderInventory?.bind(window);
    if (!origRI) return;
    window.renderInventory = function () {
      origRI();
      // Capture items from DOM for category lookup
      const rows = document.querySelectorAll("#inv-body tr.item-row");
      // We rely on window.__invoxItems being set by a future patch
    };
  }

  // Watch for items snapshot via MutationObserver on inv-body
  function watchItems() {
    const tb = document.getElementById("inv-body");
    if (!tb) return setTimeout(watchItems, 600);
    new MutationObserver(() => {
      // items data is in main app scope; category lookup done best-effort
      if (isAdmin()) rebuildReport();
    }).observe(tb, { childList: true });
  }

  /* ══════════════════════════════════════════
     WATCH FOR LOGIN/LOGOUT (security.js)
  ══════════════════════════════════════════ */
  function watchSecurityState() {
    // Poll every second to detect login/logout
    let wasAdmin = isAdmin();
    setInterval(() => {
      const nowAdmin = isAdmin();
      if (nowAdmin !== wasAdmin) {
        wasAdmin = nowAdmin;
        if (nowAdmin) {
          buildReportShell();
          rebuildReport();
        } else {
          const r = document.getElementById("admin-report");
          if (r) r.remove();
        }
      }
    }, 1000);
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  function initReports() {
    injectStyles();
    patchRenderInvoices();
    watchItems();
    watchSecurityState();

    if (isAdmin()) {
      buildReportShell();
      rebuildReport();
    }

    // Re-render when dashboard tab is clicked
    const origShow = window.showPage?.bind(window);
    if (origShow) {
      window.showPage = function (name, btn) {
        origShow(name, btn);
        if (name === "dashboard" && isAdmin()) {
          if (!document.getElementById("admin-report")) buildReportShell();
          setTimeout(rebuildReport, 100);
        }
      };
    }

    console.log("✅ INVOX Reports loaded — Admin only");
  }

})();
