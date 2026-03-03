/**
 * INVOX PLUGINS — plugins.js
 * ─────────────────────────────────────────────
 * Adds:  1) WhatsApp message sender for invoices
 *        2) Purchase Order (Stock-In) with supplier details
 *
 * HOW TO USE:
 *   Add this ONE line before </body> in index.html:
 *   <script src="plugins.js"></script>
 * ─────────────────────────────────────────────
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════
     WAIT FOR APP TO FULLY LOAD
  ══════════════════════════════════════════ */
  function waitFor(condFn, cb, interval = 300, maxWait = 15000) {
    const start = Date.now();
    const t = setInterval(() => {
      if (condFn()) { clearInterval(t); cb(); }
      else if (Date.now() - start > maxWait) clearInterval(t);
    }, interval);
  }

  waitFor(
    () => typeof window.saveInvoice === "function" && typeof window.renderInvoices === "function",
    initPlugins
  );

  /* ══════════════════════════════════════════
     SHARED STYLES INJECTION
  ══════════════════════════════════════════ */
  function injectStyles() {
    const s = document.createElement("style");
    s.textContent = `
      /* ── WhatsApp Button ── */
      .act-btn.wa { color: #25d366; }
      .act-btn.wa:hover { border-color: #25d366; color: #25d366; background: rgba(37,211,102,.08); }

      /* ── Purchase Tab & Page ── */
      #page-purchase { display:none; position:relative; z-index:1; max-width:1200px; margin:0 auto; padding:2rem; animation:fadeUp .3s ease; }
      #page-purchase.active { display:block; }

      /* ── Purchase Form ── */
      .po-builder { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.5rem; }
      .po-builder h3 { font-family:'Syne',sans-serif; font-weight:700; font-size:.9rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); margin-bottom:1.2rem; }
      .po-section { margin-bottom:1.5rem; }
      .po-sec-title { font-family:'Syne',sans-serif; font-size:.72rem; font-weight:700; text-transform:uppercase; letter-spacing:.12em; color:var(--muted); margin-bottom:.75rem; padding-bottom:.5rem; border-bottom:1px solid var(--border); }
      .po-supplier-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:.75rem; }
      .po-items-header { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr auto; gap:.5rem; margin-bottom:.5rem; }
      .po-items-header span { font-size:.65rem; font-family:'Syne',sans-serif; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); }
      .po-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr 1fr auto; gap:.5rem; align-items:center; margin-bottom:.5rem; animation:rowIn .2s ease; }
      .po-row input, .po-row select { background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:.5rem .65rem; color:var(--text); font-family:'DM Mono',monospace; font-size:.8rem; outline:none; width:100%; transition:border-color .2s; }
      .po-row input:focus, .po-row select:focus { border-color:#a78bfa; }
      .po-row-total { font-family:'Syne',sans-serif; font-weight:600; color:#a78bfa; font-size:.82rem; text-align:right; }
      .po-totals { border-top:1px solid var(--border); padding-top:1rem; display:flex; flex-direction:column; align-items:flex-end; gap:.4rem; }
      .po-trow { display:flex; gap:2rem; align-items:center; font-size:.82rem; }
      .po-trow .lbl { color:var(--muted); min-width:150px; text-align:right; }
      .po-trow .val { font-family:'Syne',sans-serif; font-weight:600; min-width:100px; text-align:right; }
      .po-trow.grand .val { font-size:1.1rem; color:#a78bfa; }
      .po-trow.grand .lbl { color:var(--text); }
      .pct-input-po { width:55px; background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:.3rem .5rem; color:var(--text); font-family:'DM Mono',monospace; font-size:.78rem; outline:none; display:inline-block; }

      /* ── Purchase Orders List ── */
      .po-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:1rem; margin-top:1.5rem; }
      .po-card { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; transition:all .2s; animation:rowIn .25s ease; }
      .po-card:hover { border-color:rgba(167,139,250,.3); transform:translateY(-1px); }
      .po-card-hdr { padding:1rem 1.2rem; display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--border); }
      .po-id { font-family:'Syne',sans-serif; font-weight:700; font-size:.9rem; }
      .po-date { font-size:.72rem; color:var(--muted); margin-top:2px; }
      .po-status-chip { padding:.22rem .65rem; border-radius:999px; font-size:.68rem; font-family:'Syne',sans-serif; font-weight:700; }
      .po-received { background:rgba(46,213,115,.12); color:#2ed573; border:1px solid rgba(46,213,115,.25); }
      .po-ordered  { background:rgba(167,139,250,.1);  color:#a78bfa; border:1px solid rgba(167,139,250,.3); }
      .po-card-body { padding:1rem 1.2rem; }
      .po-supplier-name { font-size:.85rem; font-weight:500; margin-bottom:.3rem; }
      .po-card-summary { font-size:.72rem; color:var(--muted); margin-bottom:.75rem; }
      .po-card-footer { display:flex; justify-content:space-between; align-items:center; }
      .po-amount { font-family:'Syne',sans-serif; font-weight:700; font-size:1.1rem; color:#a78bfa; }

      /* ── PO History section title ── */
      .po-hist-title { font-family:'Syne',sans-serif; font-weight:700; font-size:.78rem; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin:1.5rem 0 .75rem; padding-bottom:.5rem; border-bottom:1px solid var(--border); }

      /* ── WhatsApp Modal ── */
      .wa-modal-inner { max-width:480px; }
      .wa-preview-box { background:var(--bg); border:1px solid var(--border); border-radius:10px; padding:1rem 1.2rem; font-size:.8rem; line-height:1.7; white-space:pre-wrap; margin-bottom:1.2rem; color:var(--text); font-family:'DM Mono',monospace; max-height:280px; overflow-y:auto; }
      .wa-phone-row { display:flex; gap:.65rem; align-items:center; margin-bottom:1rem; }
      .wa-phone-row input { flex:1; background:var(--bg); border:1px solid var(--border); border-radius:8px; padding:.6rem .85rem; color:var(--text); font-family:'DM Mono',monospace; font-size:.83rem; outline:none; transition:border-color .2s; }
      .wa-phone-row input:focus { border-color:#25d366; }
      .btn-wa { background:#25d366; color:#0a0a0f; font-family:'Syne',sans-serif; font-weight:700; border:none; border-radius:8px; padding:.65rem 1.2rem; cursor:pointer; font-size:.82rem; transition:all .15s; }
      .btn-wa:hover { background:#1db954; transform:translateY(-1px); }
      .wa-note { font-size:.68rem; color:var(--muted); text-align:center; }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════
     MAIN INIT
  ══════════════════════════════════════════ */
  function initPlugins() {
    injectStyles();
    addPurchaseTab();
    buildPurchasePage();
    buildWAModal();
    patchRenderInvoices();
    console.log("✅ INVOX Plugins loaded: WhatsApp + Purchase Order");
  }

  /* ══════════════════════════════════════════
     1. WHATSAPP FEATURE
  ══════════════════════════════════════════ */

  // Build WhatsApp modal once, reuse it
  function buildWAModal() {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "wa-modal";
    overlay.style.display = "none";
    overlay.onclick = e => { if (e.target.id === "wa-modal") closeWAModal(); };
    overlay.innerHTML = `
      <div class="modal wa-modal-inner">
        <h2>📲 Send on WhatsApp</h2>
        <div class="wa-preview-box" id="wa-preview"></div>
        <div class="wa-phone-row">
          <input type="tel" id="wa-phone" placeholder="Phone number with country code e.g. 919876543210">
        </div>
        <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-bottom:.75rem">
          <button class="btn btn-ghost" onclick="window.closeWAModal()">Cancel</button>
          <button class="btn-wa" onclick="window.sendWA()">Send on WhatsApp ➤</button>
        </div>
        <div class="wa-note">Opens WhatsApp Web / App with pre-filled message</div>
      </div>`;
    document.body.appendChild(overlay);
  }

  // Build message from invoice data
  function buildWAMessage(inv) {
    const fmt = n => "₹" + Number(n || 0).toFixed(2);
    const items = (inv.rows || [])
      .map(r => `  • ${r.name || "—"} × ${r.qty} = ${fmt(r.total)}`)
      .join("\n");

    let msg =
      `🧾 *INVOX Invoice*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📄 *Invoice:* ${inv.id}\n` +
      `📅 *Date:* ${inv.date}\n` +
      `👤 *Customer:* ${inv.customer}\n\n` +
      `🛒 *Items:*\n${items}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n`;

    if (inv.discPct > 0)
      msg += `🏷️ Discount (${inv.discPct}%): -${fmt(inv.discAmt)}\n`;
    msg += `🧮 Tax (${inv.taxPct}%): ${fmt(inv.taxAmt)}\n`;
    msg += `💰 *Grand Total: ${fmt(inv.grand)}*\n`;

    if (inv.status === "pending") {
      msg += `\n⚠️ *Payment Status: PENDING*\n`;
      msg += `Please clear your dues at the earliest. Thank you! 🙏`;
    } else {
      msg += `\n✅ *Payment Status: PAID*\nThank you for your business! 🙏`;
    }
    return msg;
  }

  // Open WA modal for a given invoice id
  window.openWAModal = function (invId) {
    // Access invoices from main app scope via the global onSnapshot-updated array
    const inv = _getInvoices().find(i => i.id === invId);
    if (!inv) return alert("Invoice not found.");
    const msg = buildWAMessage(inv);
    document.getElementById("wa-preview").textContent = msg;
    // Pre-fill phone if contact looks like a number
    const phone = (inv.contact || "").replace(/\D/g, "");
    document.getElementById("wa-phone").value = phone.length >= 10 ? phone : "";
    document.getElementById("wa-modal").style.display = "flex";
    // Store current invoice id for sendWA
    document.getElementById("wa-modal").dataset.invId = invId;
  };

  window.closeWAModal = function () {
    document.getElementById("wa-modal").style.display = "none";
  };

  window.sendWA = function () {
    const invId = document.getElementById("wa-modal").dataset.invId;
    const inv = _getInvoices().find(i => i.id === invId);
    if (!inv) return;
    const phone = document.getElementById("wa-phone").value.replace(/\D/g, "");
    if (!phone || phone.length < 10) {
      alert("Please enter a valid phone number with country code.\nExample: 919876543210");
      return;
    }
    const msg = buildWAMessage(inv);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Patch renderInvoices to inject WhatsApp button into each invoice card
  function patchRenderInvoices() {
    const orig = window.renderInvoices.bind(window);
    window.renderInvoices = function () {
      orig();
      // After original render, inject WA button into every invoice card
      setTimeout(injectWAButtons, 50);
    };
    // Also inject on first load after a delay
    setTimeout(injectWAButtons, 1000);
  }

  function injectWAButtons() {
    const grid = document.getElementById("invoices-grid");
    if (!grid) return;
    grid.querySelectorAll(".invoice-card").forEach(card => {
      const actions = card.querySelector(".inv-actions");
      if (!actions || actions.querySelector(".wa")) return; // already added
      // Get invoice id from existing View button onclick
      const viewBtn = actions.querySelector(".act-btn");
      if (!viewBtn) return;
      const match = viewBtn.getAttribute("onclick").match(/'([^']+)'/);
      if (!match) return;
      const invId = match[1];
      const waBtn = document.createElement("button");
      waBtn.className = "act-btn wa";
      waBtn.title = "Send on WhatsApp";
      waBtn.textContent = "WhatsApp";
      waBtn.onclick = () => window.openWAModal(invId);
      actions.appendChild(waBtn);
    });
  }

  // Helper to safely get invoices array from main app
  function _getInvoices() {
    // The main app stores invoices in a module-scoped variable.
    // We piggyback by reading rendered cards' IDs and matching
    // against a plugin-maintained mirror updated via MutationObserver.
    return window.__pluginInvoices || [];
  }

  // Keep a mirror of invoices by observing DOM + reading data attributes
  // We intercept saveInvoice to capture invoice objects
  const _origSave = window.saveInvoice;
  window.saveInvoice = async function (status) {
    await _origSave(status);
  };

  // Mirror invoices by hooking into Firestore snapshot indirectly:
  // We observe the invoices grid and re-read invoice data from cards.
  // Better approach: expose invoices via a custom event from main app.
  // Since we can't edit index.html's JS, we use a polling mirror via
  // reading the rendered invoice cards and matching stored objects.
  window.__pluginInvoices = [];

  // MutationObserver on invoices-grid to re-sync our mirror
  function startInvoiceMirror() {
    const grid = document.getElementById("invoices-grid");
    if (!grid) return setTimeout(startInvoiceMirror, 500);

    const obs = new MutationObserver(() => {
      syncInvoiceMirror();
      injectWAButtons();
    });
    obs.observe(grid, { childList: true, subtree: true });
    syncInvoiceMirror();
  }

  // We read invoice data stored in card HTML + augment with a global store
  // The cleanest way: wrap onSnapshot by patching setDoc globally via proxy
  // Since Firebase is module-scoped, we patch window fetch to intercept writes
  // and capture invoice payloads.
  function patchFirebaseCaptureInvoices() {
    const origFetch = window.fetch.bind(window);
    window.fetch = async function (...args) {
      const res = await origFetch(...args);
      try {
        const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
        if (url.includes("firestore") && url.includes("invoices")) {
          // Clone response to read body without consuming it
          const clone = res.clone();
          clone.json().then(data => {
            if (data?.fields) {
              const inv = firestoreFieldsToObj(data.fields);
              if (inv.id) {
                const idx = window.__pluginInvoices.findIndex(i => i.id === inv.id);
                if (idx >= 0) window.__pluginInvoices[idx] = inv;
                else window.__pluginInvoices.unshift(inv);
              }
            }
          }).catch(() => {});
        }
      } catch (_) {}
      return res;
    };
  }

  // Convert Firestore REST field format to plain object
  function firestoreFieldsToObj(fields) {
    const obj = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v.stringValue !== undefined) obj[k] = v.stringValue;
      else if (v.integerValue !== undefined) obj[k] = Number(v.integerValue);
      else if (v.doubleValue !== undefined) obj[k] = Number(v.doubleValue);
      else if (v.booleanValue !== undefined) obj[k] = v.booleanValue;
      else if (v.arrayValue) obj[k] = (v.arrayValue.values || []).map(val => firestoreFieldsToObj(val.mapValue?.fields || {}));
      else if (v.mapValue) obj[k] = firestoreFieldsToObj(v.mapValue.fields || {});
    }
    return obj;
  }

  // Also capture from Firestore SDK via patching global XMLHttpRequest
  function syncInvoiceMirrorFromCards() {
    const grid = document.getElementById("invoices-grid");
    if (!grid) return;
    grid.querySelectorAll(".invoice-card").forEach(card => {
      const idEl = card.querySelector(".inv-id");
      const dateEl = card.querySelector(".inv-date");
      const statusEl = card.querySelector(".inv-status");
      const amtEl = card.querySelector(".inv-amount");
      const custEl = card.querySelector(".inv-cust");
      const summaryEl = card.querySelector(".inv-summary");
      if (!idEl) return;
      const id = idEl.textContent.trim();
      if (!id || window.__pluginInvoices.find(i => i.id === id)) return;
      // Build minimal invoice object from card DOM for WA message
      const custRaw = custEl ? custEl.childNodes[0]?.textContent?.trim() : "";
      const contactSpan = custEl ? custEl.querySelector("span") : null;
      const contact = contactSpan ? contactSpan.textContent.trim() : "";
      const grand = parseFloat((amtEl?.textContent || "0").replace("₹", "")) || 0;
      const statusText = statusEl ? statusEl.textContent.trim() : "pending";
      const summary = summaryEl ? summaryEl.textContent : "";
      // Parse items from summary (best-effort)
      const rows = summary.split("·")[1]?.trim().split(",").map(n => ({
        name: n.trim().replace(/…$/, ""), qty: 1, total: 0, price: 0
      })) || [];
      window.__pluginInvoices.unshift({
        id, date: dateEl?.textContent.trim() || "",
        customer: custRaw, contact,
        grand, status: statusText,
        rows, subtotal: grand, taxPct: 0, taxAmt: 0, discPct: 0, discAmt: 0
      });
    });
  }

  function syncInvoiceMirror() {
    syncInvoiceMirrorFromCards();
  }

  patchFirebaseCaptureInvoices();
  startInvoiceMirror();

  /* ══════════════════════════════════════════
     2. PURCHASE ORDER FEATURE
  ══════════════════════════════════════════ */

  let poRows = [];
  let purchaseOrders = []; // stored in localStorage as Firebase is module-scoped
  const PO_KEY = "invox_purchase_orders";

  function loadPOs() {
    try { purchaseOrders = JSON.parse(localStorage.getItem(PO_KEY) || "[]"); }
    catch (_) { purchaseOrders = []; }
  }

  function savePOs() {
    localStorage.setItem(PO_KEY, JSON.stringify(purchaseOrders));
  }

  function genPOId() {
    return "PO-" + String(Date.now()).slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();
  }

  function addPurchaseTab() {
    const nav = document.querySelector("nav.nav");
    const spacer = nav.querySelector(".nav-spacer");
    const tab = document.createElement("button");
    tab.className = "nav-tab";
    tab.textContent = "🛒 Purchases";
    tab.onclick = function () { window.showPage("purchase", tab); renderPurchasePage(); };
    nav.insertBefore(tab, spacer);
  }

  function buildPurchasePage() {
    loadPOs();
    const page = document.createElement("div");
    page.className = "page";
    page.id = "page-purchase";
    page.innerHTML = `
      <div class="po-builder">
        <h3>New Purchase Order</h3>

        <div class="po-section">
          <div class="po-sec-title">Supplier Details</div>
          <div class="po-supplier-row">
            <div class="form-group">
              <label>Supplier Name *</label>
              <input type="text" id="po-supplier" placeholder="e.g. Sharma Traders" list="supplier-list">
              <datalist id="supplier-list"></datalist>
            </div>
            <div class="form-group">
              <label>Phone / Email</label>
              <input type="text" id="po-contact" placeholder="phone or email">
            </div>
            <div class="form-group">
              <label>Order Date</label>
              <input type="text" id="po-date">
            </div>
          </div>
          <div class="po-supplier-row" style="margin-top:.65rem">
            <div class="form-group">
              <label>Invoice / Bill No.</label>
              <input type="text" id="po-ref" placeholder="Supplier's bill number">
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="po-status" class="fform">
                <option value="ordered">Ordered</option>
                <option value="received">Received</option>
              </select>
            </div>
            <div class="form-group">
              <label>Notes</label>
              <input type="text" id="po-notes" placeholder="Optional notes">
            </div>
          </div>
        </div>

        <div class="po-section">
          <div class="po-sec-title">Items Purchased</div>
          <div class="po-items-header">
            <span>Product / Item</span><span>Qty</span><span>Purchase Price</span><span>Tax %</span><span>Total</span><span></span>
          </div>
          <div id="po-rows"></div>
          <button class="btn btn-ghost btn-sm" style="margin-top:.5rem" onclick="window.addPORow()">+ Add Item</button>
        </div>

        <div class="po-totals">
          <div class="po-trow"><span class="lbl">Subtotal</span><span class="val" id="po-sub">₹0.00</span></div>
          <div class="po-trow">
            <span class="lbl" style="display:flex;align-items:center;gap:.5rem;justify-content:flex-end">
              Extra Charges <input class="pct-input-po" type="number" id="po-extra" value="0" min="0" oninput="window.calcPOTotals()"> ₹
            </span>
            <span class="val" id="po-extra-amt">₹0.00</span>
          </div>
          <div class="po-trow grand"><span class="lbl">Grand Total</span><span class="val" id="po-grand">₹0.00</span></div>
        </div>

        <div style="display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.25rem;padding-top:1rem;border-top:1px solid var(--border)">
          <button class="btn btn-ghost" onclick="window.clearPO()">Clear</button>
          <button class="btn btn-ghost" onclick="window.previewPO()">Preview</button>
          <button class="btn btn-purple" onclick="window.savePO()">Save Purchase Order</button>
        </div>
      </div>

      <div class="po-hist-title">Purchase History</div>
      <div class="toolbar" style="margin-bottom:1rem">
        <input class="search-box" type="text" id="po-search" placeholder="Search supplier, PO#..." oninput="window.renderPurchasePage()">
        <select class="fsel" id="po-status-f" onchange="window.renderPurchasePage()">
          <option value="">All Status</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
        </select>
        <button class="btn btn-ghost" onclick="window.exportPOCSV()">Export CSV</button>
      </div>
      <div id="po-grid" class="po-grid"></div>
      <div id="po-empty" class="empty-state" style="display:none"><div class="big">🛒</div><p>No purchase orders yet.</p></div>
    `;
    document.body.appendChild(page);

    // PO Preview Modal
    const poModal = document.createElement("div");
    poModal.className = "modal-overlay";
    poModal.id = "po-preview-modal";
    poModal.style.display = "none";
    poModal.onclick = e => { if (e.target.id === "po-preview-modal") poModal.style.display = "none"; };
    poModal.innerHTML = `
      <div class="modal" style="max-width:600px">
        <h2>Purchase Order Preview</h2>
        <div id="po-preview-content"></div>
        <div class="modal-actions" style="margin-top:1rem">
          <button class="btn btn-ghost" onclick="document.getElementById('po-preview-modal').style.display='none'">Close</button>
          <button class="btn btn-ghost" onclick="window.printPO()">🖨️ Print</button>
        </div>
      </div>`;
    document.body.appendChild(poModal);

    // Init first row + date
    document.getElementById("po-date").value = new Date().toLocaleDateString("en-IN");
    window.addPORow();
    renderSupplierList();
  }

  function renderSupplierList() {
    const suppliers = [...new Set(purchaseOrders.map(p => p.supplier).filter(Boolean))].sort();
    const dl = document.getElementById("supplier-list");
    if (dl) dl.innerHTML = suppliers.map(s => `<option value="${s}">`).join("");
  }

  window.addPORow = function () {
    poRows.push({ id: Date.now(), name: "", qty: 1, price: 0, tax: 0 });
    renderPORows();
  };

  window.removePORow = function (id) {
    poRows = poRows.filter(r => r.id !== id);
    if (poRows.length === 0) window.addPORow();
    else { renderPORows(); window.calcPOTotals(); }
  };

  function renderPORows() {
    const c = document.getElementById("po-rows");
    if (!c) return;
    c.innerHTML = "";
    poRows.forEach(row => {
      const d = document.createElement("div");
      d.className = "po-row";
      d.id = "por-" + row.id;
      d.innerHTML = `
        <input type="text" value="${esc(row.name)}" placeholder="Item / product name" oninput="window.poFieldChange(${row.id},'name',this.value)" list="inv-items-list">
        <input type="number" value="${row.qty}" min="1" oninput="window.poFieldChange(${row.id},'qty',this.value)">
        <input type="number" value="${row.price || ""}" step="0.01" min="0" placeholder="₹0.00" oninput="window.poFieldChange(${row.id},'price',this.value)">
        <input type="number" value="${row.tax || 0}" step="0.1" min="0" max="100" placeholder="0" oninput="window.poFieldChange(${row.id},'tax',this.value)">
        <div class="po-row-total">${fmt(row.qty * (row.price || 0) * (1 + (row.tax || 0) / 100))}</div>
        <button class="rmv-btn" onclick="window.removePORow(${row.id})">✕</button>`;
      c.appendChild(d);
    });
    // Inject inventory item suggestions
    let dl = document.getElementById("inv-items-list");
    if (!dl) { dl = document.createElement("datalist"); dl.id = "inv-items-list"; document.body.appendChild(dl); }
    // Read item names from inventory table
    const itemNames = [...document.querySelectorAll("#inv-body tr td:first-child div:first-child")].map(el => el.textContent.trim());
    dl.innerHTML = itemNames.map(n => `<option value="${n}">`).join("");
    window.calcPOTotals();
  }

  window.poFieldChange = function (id, field, val) {
    const r = poRows.find(r => r.id === id);
    if (!r) return;
    if (field === "name") r.name = val;
    else if (field === "qty") r.qty = parseFloat(val) || 1;
    else if (field === "price") r.price = parseFloat(val) || 0;
    else if (field === "tax") r.tax = parseFloat(val) || 0;
    const totalEl = document.querySelector(`#por-${id} .po-row-total`);
    if (totalEl) totalEl.textContent = fmt(r.qty * (r.price || 0) * (1 + (r.tax || 0) / 100));
    window.calcPOTotals();
  };

  window.calcPOTotals = function () {
    const sub = poRows.reduce((s, r) => s + r.qty * (r.price || 0) * (1 + (r.tax || 0) / 100), 0);
    const extra = parseFloat(document.getElementById("po-extra")?.value) || 0;
    const grand = sub + extra;
    const subEl = document.getElementById("po-sub");
    const extraEl = document.getElementById("po-extra-amt");
    const grandEl = document.getElementById("po-grand");
    if (subEl) subEl.textContent = fmt(sub);
    if (extraEl) extraEl.textContent = fmt(extra);
    if (grandEl) grandEl.textContent = fmt(grand);
    return { sub, extra, grand };
  };

  function getPOData() {
    const t = window.calcPOTotals();
    return {
      supplier: document.getElementById("po-supplier")?.value.trim() || "",
      contact: document.getElementById("po-contact")?.value.trim() || "",
      date: document.getElementById("po-date")?.value || new Date().toLocaleDateString("en-IN"),
      ref: document.getElementById("po-ref")?.value.trim() || "",
      status: document.getElementById("po-status")?.value || "ordered",
      notes: document.getElementById("po-notes")?.value.trim() || "",
      rows: poRows.map(r => ({ ...r, total: r.qty * (r.price || 0) * (1 + (r.tax || 0) / 100) })),
      ...t
    };
  }

  function buildPOHTML(data, id) {
    return `<div style="font-family:'DM Mono',monospace;font-size:.82rem;color:var(--text)">
      <div style="display:flex;justify-content:space-between;margin-bottom:1.2rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">
        <div><div style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.3rem">INV<span style="color:var(--accent)">OX</span></div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">Purchase Order</div></div>
        <div style="text-align:right">
          <div style="font-family:'Syne',sans-serif;font-weight:700">${esc(id)}</div>
          <div style="color:var(--muted);font-size:.72rem">${esc(data.date)}</div>
          ${data.ref ? `<div style="color:var(--muted);font-size:.7rem">Ref: ${esc(data.ref)}</div>` : ""}
        </div>
      </div>
      <div style="margin-bottom:1rem">
        <div style="font-size:.65rem;color:var(--muted);font-family:'Syne',sans-serif;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.3rem">Supplier</div>
        <div style="font-weight:500">${esc(data.supplier)}</div>
        ${data.contact ? `<div style="color:var(--muted);font-size:.78rem">${esc(data.contact)}</div>` : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1rem">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:.5rem .3rem;text-align:left;font-size:.65rem;color:var(--muted);font-family:'Syne',sans-serif;text-transform:uppercase">Item</th>
          <th style="padding:.5rem .3rem;text-align:right;font-size:.65rem;color:var(--muted);font-family:'Syne',sans-serif">Qty</th>
          <th style="padding:.5rem .3rem;text-align:right;font-size:.65rem;color:var(--muted);font-family:'Syne',sans-serif">Price</th>
          <th style="padding:.5rem .3rem;text-align:right;font-size:.65rem;color:var(--muted);font-family:'Syne',sans-serif">Tax</th>
          <th style="padding:.5rem .3rem;text-align:right;font-size:.65rem;color:var(--muted);font-family:'Syne',sans-serif">Total</th>
        </tr></thead>
        <tbody>${data.rows.map(r => `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:.45rem .3rem">${esc(r.name || "—")}</td>
          <td style="padding:.45rem .3rem;text-align:right">${r.qty}</td>
          <td style="padding:.45rem .3rem;text-align:right">${fmt(r.price)}</td>
          <td style="padding:.45rem .3rem;text-align:right">${r.tax || 0}%</td>
          <td style="padding:.45rem .3rem;text-align:right;font-family:'Syne',sans-serif;font-weight:600">${fmt(r.total)}</td>
        </tr>`).join("")}</tbody>
      </table>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem">
        <div style="display:flex;gap:2rem"><span style="color:var(--muted)">Subtotal</span><span>${fmt(data.sub)}</span></div>
        ${data.extra > 0 ? `<div style="display:flex;gap:2rem"><span style="color:var(--muted)">Extra Charges</span><span>${fmt(data.extra)}</span></div>` : ""}
        <div style="display:flex;gap:2rem;border-top:1px solid var(--border);padding-top:.5rem;margin-top:.3rem">
          <span style="font-family:'Syne',sans-serif;font-weight:700">Grand Total</span>
          <span style="font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#a78bfa">${fmt(data.grand)}</span>
        </div>
      </div>
      ${data.notes ? `<div style="margin-top:1rem;font-size:.75rem;color:var(--muted)">Notes: ${esc(data.notes)}</div>` : ""}
    </div>`;
  }

  window.previewPO = function () {
    const d = getPOData();
    if (!d.supplier) { alert("Enter supplier name."); return; }
    document.getElementById("po-preview-content").innerHTML = buildPOHTML(d, "PREVIEW");
    document.getElementById("po-preview-modal").style.display = "flex";
  };

  window.savePO = function () {
    const d = getPOData();
    if (!d.supplier) { alert("Enter supplier name."); return; }
    if (!d.rows.length || d.rows.every(r => !r.name)) { alert("Add at least one item."); return; }
    const id = genPOId();
    const po = { ...d, id, createdAt: Date.now() };
    purchaseOrders.unshift(po);
    savePOs();
    renderSupplierList();
    renderPurchasePage();
    window.clearPO();
    alert(`✅ Purchase Order ${id} saved!\n${d.status === "received" ? "📦 Mark items as received in Inventory to update stock." : "📋 Order placed with " + d.supplier}`);
  };

  window.clearPO = function () {
    ["po-supplier","po-contact","po-ref","po-notes"].forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
    const dateEl = document.getElementById("po-date");
    if (dateEl) dateEl.value = new Date().toLocaleDateString("en-IN");
    const statusEl = document.getElementById("po-status");
    if (statusEl) statusEl.value = "ordered";
    const extraEl = document.getElementById("po-extra");
    if (extraEl) extraEl.value = "0";
    poRows = [];
    window.addPORow();
  };

  window.renderPurchasePage = function () {
    loadPOs();
    const s = (document.getElementById("po-search")?.value || "").toLowerCase();
    const sf = document.getElementById("po-status-f")?.value || "";
    const filtered = purchaseOrders.filter(p =>
      (!s || p.supplier.toLowerCase().includes(s) || p.id.toLowerCase().includes(s)) &&
      (!sf || p.status === sf)
    );
    const grid = document.getElementById("po-grid");
    const empty = document.getElementById("po-empty");
    if (!grid) return;
    grid.innerHTML = "";
    if (empty) empty.style.display = filtered.length === 0 ? "block" : "none";
    filtered.forEach(po => {
      const card = document.createElement("div");
      card.className = "po-card";
      const itemSummary = (po.rows || []).slice(0, 2).map(r => r.name || "—").join(", ") + ((po.rows || []).length > 2 ? "…" : "");
      card.innerHTML = `
        <div class="po-card-hdr">
          <div>
            <div class="po-id">${esc(po.id)}</div>
            <div class="po-date">${esc(po.date)}${po.ref ? ` · Ref: ${esc(po.ref)}` : ""}</div>
          </div>
          <span class="po-status-chip ${po.status === "received" ? "po-received" : "po-ordered"}">${po.status}</span>
        </div>
        <div class="po-card-body">
          <div class="po-supplier-name">🏭 ${esc(po.supplier)}${po.contact ? ` <span style="color:var(--muted);font-size:.72rem">· ${esc(po.contact)}</span>` : ""}</div>
          <div class="po-card-summary">${(po.rows||[]).length} items · ${esc(itemSummary)}</div>
          <div class="po-card-footer">
            <span class="po-amount">${fmt(po.grand)}</span>
            <div class="actions">
              <button class="act-btn" onclick="window.viewPO('${po.id}')">View</button>
              <button class="act-btn" onclick="window.togglePOStatus('${po.id}')">${po.status === "received" ? "→ Ordered" : "→ Received"}</button>
              <button class="act-btn wa" onclick="window.sendWASupplier('${po.id}')">WhatsApp</button>
              <button class="act-btn del" onclick="window.deletePO('${po.id}')">Del</button>
            </div>
          </div>
        </div>`;
      grid.appendChild(card);
    });
  };

  window.viewPO = function (id) {
    const po = purchaseOrders.find(p => p.id === id);
    if (!po) return;
    document.getElementById("po-preview-content").innerHTML = buildPOHTML(po, po.id);
    document.getElementById("po-preview-modal").style.display = "flex";
  };

  window.togglePOStatus = function (id) {
    const po = purchaseOrders.find(p => p.id === id);
    if (!po) return;
    po.status = po.status === "received" ? "ordered" : "received";
    savePOs();
    renderPurchasePage();
  };

  window.deletePO = function (id) {
    if (!confirm("Delete this purchase order?")) return;
    purchaseOrders = purchaseOrders.filter(p => p.id !== id);
    savePOs();
    renderPurchasePage();
  };

  window.printPO = function () {
    const c = document.getElementById("po-preview-content").innerHTML;
    const pa = document.getElementById("printArea");
    if (pa) { pa.innerHTML = c; pa.style.display = "block"; window.print(); pa.style.display = "none"; }
  };

  // WhatsApp for supplier (Purchase Order)
  window.sendWASupplier = function (id) {
    const po = purchaseOrders.find(p => p.id === id);
    if (!po) return;
    const items = (po.rows || []).map(r => `  • ${r.name || "—"} × ${r.qty} @ ${fmt(r.price)}`).join("\n");
    const msg =
      `🛒 *Purchase Order — INVOX*\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📄 *PO#:* ${po.id}\n` +
      `📅 *Date:* ${po.date}\n` +
      `🏭 *Supplier:* ${po.supplier}\n` +
      `${po.ref ? `📋 *Ref:* ${po.ref}\n` : ""}` +
      `\n🛍️ *Items Ordered:*\n${items}\n\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `💰 *Total Amount: ${fmt(po.grand)}*\n` +
      `${po.notes ? `\n📝 Notes: ${po.notes}` : ""}`;

    const phone = (po.contact || "").replace(/\D/g, "");
    document.getElementById("wa-preview").textContent = msg;
    document.getElementById("wa-phone").value = phone.length >= 10 ? phone : "";
    document.getElementById("wa-modal").dataset.invId = "__po__" + po.id;
    document.getElementById("wa-modal").style.display = "flex";

    // Override sendWA for this PO message
    window.__waCurrentMsg = msg;
  };

  // Patch sendWA to handle PO messages too
  const _origSendWA = window.sendWA;
  window.sendWA = function () {
    const invId = document.getElementById("wa-modal").dataset.invId || "";
    if (invId.startsWith("__po__")) {
      const phone = document.getElementById("wa-phone").value.replace(/\D/g, "");
      if (!phone || phone.length < 10) { alert("Please enter a valid phone number with country code.\nExample: 919876543210"); return; }
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(window.__waCurrentMsg || "")}`, "_blank");
      return;
    }
    _origSendWA();
  };

  window.exportPOCSV = function () {
    const rows = [["PO#","Supplier","Contact","Date","Ref","Status","Items","Subtotal","Extra","Grand","Notes"]];
    purchaseOrders.forEach(po => {
      rows.push([po.id, po.supplier, po.contact||"", po.date, po.ref||"", po.status,
        (po.rows||[]).map(r=>`${r.name}×${r.qty}`).join("; "),
        (po.sub||0).toFixed(2), (po.extra||0).toFixed(2), (po.grand||0).toFixed(2), po.notes||""]);
    });
    dlCSV(rows, "purchase_orders.csv");
  };

  function dlCSV(rows, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(
      [rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n")],
      { type: "text/csv" }
    ));
    a.download = name;
    a.click();
  }

  // Tiny helpers
  function fmt(n) { return "₹" + Number(n || 0).toFixed(2); }
  function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

})();
