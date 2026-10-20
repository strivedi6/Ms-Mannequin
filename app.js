/* Ms. Mannequin Invoices: invoices, customers and balances. Built on the same structure as the hotel team app. */
(function () {
  'use strict';

  const CONFIG = window.APP_CONFIG || {};
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const REMOTE = !!CONFIG.apiUrl;

  /* ---------------- Storage ---------------- */
  const LS = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  /* ---------------- Small helpers ---------------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const todayIso = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fmtDate = (s) => { if (!s) return ''; const d = new Date(s + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
  const fmt = (n) => num(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = (n) => { const c = String(db.settings.currency || '').trim(); return (c ? c + ' ' : '') + fmt(n); };
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,'; };
  const igHandle = (u) => String(u || '').split('?')[0].replace(/\/+$/, '').split('/').pop().replace(/^@/, '');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
  }

  /* ---------------- Icons ---------------- */
  const sv = (d, w) => `<svg width="${w || 22}" height="${w || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const svf = (d) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    back: sv('<path d="M15 18l-6-6 6-6"/>', 20),
    home: sv('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    file: sv('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
    users: sv('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.7c1.8.7 3 2.5 3.5 5.3"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>'),
    plus: sv('<path d="M12 5v14M5 12h14"/>', 24),
    plusS: sv('<path d="M12 5v14M5 12h14"/>', 18),
    search: sv('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 18),
    check: sv('<path d="M5 12l5 5L20 7"/>', 20),
    x: sv('<path d="M6 6l12 12M18 6L6 18"/>', 16),
    share: sv('<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>', 20),
    chat: sv('<path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.3A8.5 8.5 0 1 1 21 12z"/>', 20),
    image: sv('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>', 20),
    edit: sv('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>', 20),
    trash: sv('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', 18),
    chevron: sv('<path d="M9 6l6 6-6 6"/>', 18),
    addHome: sv('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>', 22),
    cloud: sv('<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 10.5a3.75 3.75 0 0 1-.5 7.5z"/>', 18),
    refresh: sv('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>', 18),
    logout: sv('<path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/>', 18),
    store: sv('<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9"/><path d="M5 12v8h14v-8"/>', 18),
    card: sv('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>', 18),
    tag: sv('<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>', 18),
    list: sv('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', 18),
    moon: sv('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', 18),
    haptic: sv('<path d="M7 4v16M12 7v10M17 4v16M3 9v6M21 9v6"/>', 18),
    db: sv('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>', 18),
    inbox: sv('<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>', 40)
  };
  const IF = {
    home: svf('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'),
    invoices: svf('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/>'),
    customers: svf('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.6-5.5 6.5-5.5s5.5 2 6.5 5.5z"/><circle cx="16.5" cy="8" r="3"/><path d="M17 14.6c2 .5 3.6 2.3 4.4 5.4H17.6c-.3-2-1.2-3.8-2.5-5z"/>'),
    settings: svf('<circle cx="12" cy="12" r="4"/><path d="M12 2l1.6 3.2 3.4-1 .6 3.5 3.4 1.2-1.6 3.1 1.6 3.1-3.4 1.2-.6 3.5-3.4-1L12 22l-1.6-3.2-3.4 1-.6-3.5-3.4-1.2 1.6-3.1-1.6-3.1 3.4-1.2.6-3.5 3.4 1z" opacity=".35"/>')
  };

  /* ---------------- Defaults ---------------- */
  const DEFAULT_SETTINGS = {
    shopName: CONFIG.shopName || 'Ms. Mannequin',
    userName: 'Gayatri',
    tagline: CONFIG.subtitle || 'Custom Fashion Designing',
    phone: '', email: '', address: '', trn: '',
    instagram: 'https://www.instagram.com/ms_mannequin_11',
    currency: 'AED', prefix: 'MM', countryCode: '971',
    payLink: '', payLabel: 'Pay Online',
    terms: 'Thank you for your order! Balance is payable at delivery.'
  };
  const DEFAULT_ITEMS = ['Blouse', 'Kurti', 'Salwar Suit', 'Churidar', 'Lehenga', 'Saree Blouse', 'Gown', 'Abaya', 'Kaftan', 'Alteration'];
  const DEFAULT_ADDONS = ['Stitching', 'Lining', 'Fabric', 'Neck Design', 'Lace', 'Buttons', 'Sleeve Design', 'Embroidery', 'Piping', 'Zip', 'Hand Work', 'Padding'];

  /* ---------------- Data (kept on this phone; synced to the Google Sheet when connected) ---------------- */
  let db = LS.get('mm_db');
  if (!db || typeof db !== 'object') db = {};
  db.customers = Array.isArray(db.customers) ? db.customers : [];
  db.invoices = Array.isArray(db.invoices) ? db.invoices : [];
  db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
  db.settings.updatedAt = db.settings.updatedAt || 0;
  db.catalog = db.catalog && Array.isArray(db.catalog.items) ? db.catalog : { items: DEFAULT_ITEMS.slice(), addons: DEFAULT_ADDONS.map((n) => ({ name: n, price: 0 })), updatedAt: 0 };
  db.since = db.since || 0;
  db.lastSync = db.lastSync || 0;
  db.customers.forEach((c) => { c.payments = c.payments || []; });

  let saveTimer = 0;
  function persist() { clearTimeout(saveTimer); if (!LS.set('mm_db', db)) toast('Phone storage is full or blocked: please sync or back up.'); }
  function saveDb() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 200); }
  window.addEventListener('pagehide', persist);
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });

  const liveCustomers = () => db.customers.filter((c) => !c.deleted);
  const liveInvoices = () => db.invoices.filter((i) => !i.deleted);
  const getCust = (id) => db.customers.find((c) => c.id === id && !c.deleted);
  const getInv = (id) => db.invoices.find((i) => i.id === id && !i.deleted);
  function touch(rec) { rec.updatedAt = Date.now(); rec._d = 1; saveDb(); scheduleSync(); }

  /* ---------------- Invoice maths ---------------- */
  const addonSum = (it) => (it.addons || []).reduce((s, a) => s + num(a.price), 0);
  const lineTotal = (it) => (num(it.qty) || 1) * (num(it.price) + addonSum(it));
  const grossOf = (items) => (items || []).reduce((s, it) => s + lineTotal(it), 0);
  /** Discount in money: either a percentage of the items total or a flat amount (never more than the items total). */
  function discountAmt(items, d) {
    const gross = grossOf(items), v = Math.max(0, num(d && d.value));
    if (!v) return 0;
    const amt = d.type === 'flat' ? Math.min(v, gross) : gross * Math.min(v, 100) / 100;
    return Math.round(amt * 100) / 100;
  }
  /** The invoice amount: items total less any discount. */
  const subtotalOf = (items, d) => grossOf(items) - discountAmt(items, d);

  /** Rebuilds a customer's running balance: opening dues, then each invoice and payment in the order they happened. */
  function recalcCustomer(cid) {
    const c = db.customers.find((x) => x.id === cid);
    if (!c) return;
    const events = [
      ...liveInvoices().filter((i) => i.customerId === cid).map((i) => ({ t: i.createdAt, inv: i })),
      ...(c.payments || []).map((p) => ({ t: p.createdAt, pay: p }))
    ].sort((a, b) => a.t - b.t);
    let bal = num(c.opening);
    for (const e of events) {
      if (e.inv) {
        const i = e.inv;
        const next = { subtotal: subtotalOf(i.items, i.discount), prevBalance: bal };
        next.total = next.subtotal + bal;
        next.balance = next.total - num(i.advance);
        if (['subtotal', 'prevBalance', 'total', 'balance'].some((k) => num(i[k]) !== next[k])) { Object.assign(i, next); i.updatedAt = Date.now(); i._d = 1; }
        bal = i.balance;
      } else bal -= num(e.pay.amount);
    }
    if (num(c.balance) !== bal || c.balance === undefined) { c.balance = bal; c.updatedAt = Date.now(); c._d = 1; }
  }
  function balanceBefore(cid, t) {
    const c = getCust(cid);
    if (!c) return 0;
    let bal = num(c.opening);
    liveInvoices().filter((i) => i.customerId === cid && i.createdAt < t).forEach((i) => { bal += subtotalOf(i.items, i.discount) - num(i.advance); });
    (c.payments || []).filter((p) => p.createdAt < t).forEach((p) => { bal -= num(p.amount); });
    return bal;
  }
  function recalcAll() { db.customers.forEach((c) => recalcCustomer(c.id)); }

  /* ---------------- Invoice numbers: random, like a voucher code (MM-4K7P-X2QD) ---------------- */
  const NO_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function genNo() {
    const p = String(db.settings.prefix || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    let no;
    do {
      const r = crypto.getRandomValues(new Uint32Array(8));
      const code = Array.from(r).map((x) => NO_CHARS[x % NO_CHARS.length]).join('');
      no = (p ? p + '-' : '') + code.slice(0, 4) + '-' + code.slice(4);
    } while (db.invoices.some((i) => i.no === no));
    return no;
  }

  /* ---------------- The invoice being written (kept until saved) ---------------- */
  const blankItem = () => ({ name: '', qty: 1, price: '', addons: [], note: '' });
  const newDraft = () => ({ editId: null, createdAt: null, no: null, date: todayIso(), delivery: '', customerId: '', items: [blankItem()], discount: { type: 'pct', value: '' }, advance: '', notes: '' });
  let draft = LS.get('mm_draft') || newDraft();
  const saveDraft = () => LS.set('mm_draft', draft);
  function draftCalc() {
    if (!draft.discount) draft.discount = { type: 'pct', value: '' };
    const gross = grossOf(draft.items), disc = discountAmt(draft.items, draft.discount), sub = gross - disc;
    const prev = draft.customerId ? balanceBefore(draft.customerId, draft.createdAt || Infinity) : 0;
    const total = sub + prev, adv = num(draft.advance);
    return { gross, disc, sub, prev, total, adv, bal: total - adv };
  }

  /* ---------------- Appearance (Settings › Appearance): light, dark, or automatic ---------------- */
  const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const appearance = () => LS.get('mm_appearance') || 'auto';
  const isDark = () => appearance() === 'dark' || (appearance() === 'auto' && !!(darkQuery && darkQuery.matches));
  function applyAppearance() {
    document.documentElement.dataset.theme = isDark() ? 'dark' : 'light';
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', isDark() ? '#000000' : '#F2F2F7');
  }
  if (darkQuery) {
    const onScheme = () => { if (appearance() === 'auto') applyAppearance(); };
    if (darkQuery.addEventListener) darkQuery.addEventListener('change', onScheme); else if (darkQuery.addListener) darkQuery.addListener(onScheme);
  }

  /* ---------------- Session and server ---------------- */
  const QUOTES = ["Small steps every day still take you far.", "Make today beautiful, one stitch at a time.", "Your talent is the thread that holds it all together.", "Great things are sewn with patience.", "Believe in your craft. Your clients already do.", "Every masterpiece starts with a single measurement.", "Do it with care and it will speak for itself.", "Today is a fresh piece of fabric. Create something lovely.", "Progress, not perfection.", "Confidence looks good on you. So does that dress.", "Work gently, finish proudly.", "Good work builds a good name.", "Start where you are. Use what you have.", "The best designs are made with heart.", "You are building something wonderful.", "One happy client at a time.", "Keep going. Your hard work is showing.", "Dream big, cut carefully.", "Kind words and neat seams bring customers back.", "A little effort each day adds up to something big.", "Create with joy. It always shows in the finish.", "Stay patient. Beautiful things take time.", "You make people feel special. That is a gift.", "Today's effort is tomorrow's success.", "Be proud of how far you have come.", "Every order is a chance to delight someone.", "Calm mind, steady hands.", "Your shop grows because you do.", "Courage looks like trying again.", "Make it simple, make it lovely, make it yours.", "Quality is remembered long after the price is forgotten.", "Let your work shine today.", "Focus on the next good thing.", "Organised today, relaxed tomorrow.", "You've got this, Gayatri.", "Good things come to those who keep stitching.", "Be the reason someone loves what they wear.", "Smile. Today will bring something good.", "Slow and steady still wins.", "Make every detail count."];
  function nextQuote() {
    const last = LS.get('mm_lastq');
    let i;
    do { i = Math.floor(Math.random() * QUOTES.length); } while (i === last && QUOTES.length > 1);
    LS.set('mm_lastq', i);
    return QUOTES[i];
  }
  const state = {
    quote: '',
    token: LS.get('mm_token'),
    route: { name: 'home', params: {} },
    syncing: false,
    syncError: '',
    invFilter: 'all', invQ: '', custQ: '', range: 'month', topBy: 'paid',
    shareCache: {},
    busy: false
  };

  async function api(action, data) {
    const payload = Object.assign({ action }, data || {});
    if (state.token) payload.token = state.token;
    if (!CONFIG.apiUrl) throw new Error('The app is not connected yet: paste the Apps Script link into config.js (apiUrl).');
    let res;
    try {
      res = await fetch(CONFIG.apiUrl, { method: 'POST', body: JSON.stringify(payload) });
    } catch (e) {
      throw new Error('No connection. Check your internet and try again.');
    }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('The server is not responding properly. Please try again in a moment.'); }
    if (!j.ok) {
      if (j.error === 'SESSION_EXPIRED') {
        signOut('Please sign in again.');
        const err = new Error('handled');
        err.handled = true;
        throw err;
      }
      throw new Error(j.error || 'Something went wrong.');
    }
    return j;
  }
  function showError(e) { if (e && e.handled) return; toast((e && e.message) || 'Something went wrong.'); }

  function signOut(message) {
    const token = state.token;
    if (token && CONFIG.apiUrl) fetch(CONFIG.apiUrl, { method: 'POST', body: JSON.stringify({ action: 'logout', token }) }).catch(() => {});
    LS.del('mm_token');
    state.token = null;
    go('login', {}, true);
    if (message) toast(message);
  }

  /* ---------------- Sync with the Google Sheet ----------------
   * Everything works on the phone first. Changed records are marked, then sent to the sheet in the background;
   * anything newer in the sheet (e.g. from another phone) is brought in. The newest edit wins. */
  let syncTimer = 0;
  function scheduleSync(ms) {
    if (!REMOTE || !state.token) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => sync(), ms || 900);
  }
  const clean = (r) => { const o = Object.assign({}, r); delete o._d; return o; };
  function mergeList(local, incoming) {
    (incoming || []).forEach((r) => {
      const k = local.findIndex((x) => x.id === r.id);
      if (k < 0) { local.push(r); return; }
      const mine = local[k];
      if (!mine._d || num(r.updatedAt) >= num(mine.updatedAt)) local[k] = r;
    });
  }
  async function sync(manual) {
    if (!REMOTE || !state.token || state.syncing) return false;
    state.syncing = true;
    refreshSyncUi();
    persist();
    const sentCust = db.customers.filter((c) => c._d);
    const sentInv = db.invoices.filter((i) => i._d);
    const sentAt = { c: new Map(sentCust.map((c) => [c.id, c.updatedAt])), i: new Map(sentInv.map((i) => [i.id, i.updatedAt])) };
    const push = { customers: sentCust.map(clean), invoices: sentInv.map(clean) };
    const sentSettings = db.settings._d ? db.settings.updatedAt : null;
    const sentCatalog = db.catalog._d ? db.catalog.updatedAt : null;
    if (sentSettings !== null) push.settings = clean(db.settings);
    if (sentCatalog !== null) push.catalog = clean(db.catalog);
    try {
      const j = await api('sync', { since: db.since, push });
      sentCust.forEach((c) => { if (c.updatedAt === sentAt.c.get(c.id)) delete c._d; });
      sentInv.forEach((i) => { if (i.updatedAt === sentAt.i.get(i.id)) delete i._d; });
      if (sentSettings !== null && db.settings.updatedAt === sentSettings) delete db.settings._d;
      if (sentCatalog !== null && db.catalog.updatedAt === sentCatalog) delete db.catalog._d;
      mergeList(db.customers, j.customers);
      mergeList(db.invoices, j.invoices);
      if (j.settings && (!db.settings._d || num(j.settings.updatedAt) >= num(db.settings.updatedAt))) db.settings = Object.assign({}, DEFAULT_SETTINGS, j.settings);
      if (j.catalog && (!db.catalog._d || num(j.catalog.updatedAt) >= num(db.catalog.updatedAt))) db.catalog = j.catalog;
      db.since = j.now || db.since;
      db.lastSync = Date.now();
      state.syncError = '';
      recalcAll();
      persist();
      if (db.customers.some((c) => c._d) || db.invoices.some((i) => i._d)) scheduleSync(1500);
    } catch (e) {
      state.syncError = (e && e.message) || 'Could not sync.';
      if (manual) showError(e);
    }
    state.syncing = false;
    refreshSyncUi();
    if (['home', 'invoices', 'customers', 'customer', 'invoice'].indexOf(state.route.name) >= 0 && !state.editing) render();
    return !state.syncError;
  }
  function syncLabel() {
    if (!REMOTE) return 'Saved on this phone only';
    if (state.syncing) return 'Syncing…';
    if (state.syncError) return 'Saved on this phone · sync paused';
    return db.lastSync ? 'Synced ' + new Date(db.lastSync).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Not synced yet';
  }
  function refreshSyncUi() { document.querySelectorAll('[data-sync-label]').forEach((n) => { n.textContent = syncLabel(); }); }

  /* ---------------- The invoice as a picture and a PDF (what the customer receives) ---------------- */
  const INK = '#2A3940', ROSE = '#DFB7B4', ROSE_D = '#B9837F', BLUSH = '#F6ECEB', LINE = '#ECDCD9', MUTED = '#66737A', SOFT = '#47555B';
  const F_SERIF = '-apple-system, "SF Pro Display", BlinkMacSystemFont, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif';
  const F_SANS = '-apple-system, "SF Pro Text", BlinkMacSystemFont, system-ui, "Helvetica Neue", Helvetica, Arial, sans-serif';

  /** Text with letter-spacing. align: left, center, right. Returns the drawn width. */
  function fillTracked(ctx, text, x, y, track, align, draw) {
    const chars = Array.from(String(text || ''));
    const w = chars.reduce((n, ch) => n + ctx.measureText(ch).width, 0) + track * Math.max(0, chars.length - 1);
    if (draw === false) return w;
    const prev = ctx.textAlign;
    ctx.textAlign = 'left';
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    chars.forEach((ch) => { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + track; });
    ctx.textAlign = prev;
    return w;
  }
  function wrapLines(ctx, text, maxW) {
    const out = [];
    String(text || '').split('\n').forEach((para) => {
      let line = '';
      para.split(/\s+/).forEach((word) => {
        const test = line ? line + ' ' + word : word;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
      });
      out.push(line);
    });
    return out;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ellipsize(ctx, text, maxW) {
    let t = String(text || '');
    if (ctx.measureText(t).width <= maxW) return t;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return t + '…';
  }
  function drawQr(ctx, x, y, size, url) {
    try {
      const q = qrcode(0, 'M');
      q.addData(url);
      q.make();
      const n = q.getModuleCount(), quiet = 2, cell = size / (n + quiet * 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, size, size);
      ctx.fillStyle = INK;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        if (q.isDark(r, c)) {
          const px = x + (c + quiet) * cell, py = y + (r + quiet) * cell;
          ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(cell) + 0.5, Math.ceil(cell) + 0.5);
        }
      }
      return true;
    } catch (e) { return false; }
  }
  function loadImg(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  /** Draws the invoice. Layout units are 1080 wide; the canvas is scaled up for full resolution. Returns the height and tappable areas. */
  function drawInvoice(ctx, inv, A, measureOnly) {
    const s = db.settings, cu = inv.customer || {};
    const W = 1080, PAD = 64, R = W - PAD, INNER = W - PAD * 2;
    const draw = !measureOnly;
    const links = [];
    let y = 0;
    const font = (f, color) => { ctx.font = f; ctx.fillStyle = color; };
    const text = (str, x, yy, f, color, align) => {
      font(f, color);
      if (!draw) return;
      ctx.textAlign = align || 'left';
      ctx.fillText(str, x, yy);
      ctx.textAlign = 'left';
    };
    const hline = (yy, color, w, x1, x2) => { if (draw) { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1 == null ? PAD : x1, yy); ctx.lineTo(x2 == null ? R : x2, yy); ctx.stroke(); } };
    const label = (str, x, yy, align) => { font(`700 19px ${F_SANS}`, MUTED); if (draw) fillTracked(ctx, str, x, yy, 3, align || 'left'); };

    if (draw) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, 99999); }
    ctx.textBaseline = 'alphabetic';

    /* Header: logo and contact on the left, invoice number and dates on the right */
    y = 60;
    const LOGO = 136;
    let leftY = y;
    if (A.logo) { if (draw) ctx.drawImage(A.logo, PAD, y, LOGO, LOGO); leftY = y + LOGO + 34; }
    else { text(s.shopName, PAD, y + 60, `700 50px ${F_SERIF}`, INK); leftY = y + 100; }
    if (s.tagline) { text(s.tagline, PAD, leftY, `italic 26px ${F_SANS}`, ROSE_D); leftY += 14; }
    font(`22px ${F_SANS}`, MUTED);
    const contact = [];
    if (s.address) wrapLines(ctx, s.address, 500).forEach((l) => contact.push(l));
    if (s.phone) contact.push(s.phone);
    if (s.email) contact.push(s.email);
    if (s.trn) contact.push('TRN: ' + s.trn);
    contact.forEach((l) => { leftY += 32; text(l, PAD, leftY, `22px ${F_SANS}`, MUTED); });

    let ry = y + 50;
    font(`400 48px ${F_SERIF}`, INK);
    if (draw) fillTracked(ctx, 'INVOICE', R, ry, 9, 'right');
    ry += 50;
    text(inv.no, R, ry, `700 30px ${F_SANS}`, INK, 'right');
    ry += 40;
    text('Date: ' + fmtDate(inv.date), R, ry, `24px ${F_SANS}`, SOFT, 'right');
    if (inv.delivery) { ry += 36; text('Delivery: ' + fmtDate(inv.delivery), R, ry, `24px ${F_SANS}`, SOFT, 'right'); }
    y = Math.max(leftY, ry) + 28;
    hline(y, INK, 3);

    /* Bill to */
    y += 30;
    const boxY = y;
    font(`24px ${F_SANS}`, MUTED);
    const addrLines = cu.address ? wrapLines(ctx, cu.address, 520) : [];
    const boxH = Math.max(150, 100 + (cu.mobile ? 36 : 0) + addrLines.length * 34 + 28);
    if (draw) { ctx.fillStyle = BLUSH; roundRect(ctx, PAD, boxY, INNER, boxH, 22); ctx.fill(); }
    label('BILL TO', PAD + 30, boxY + 46);
    font(`700 34px ${F_SANS}`, INK);
    text(ellipsize(ctx, cu.name || '', 520), PAD + 30, boxY + 94, `700 34px ${F_SANS}`, INK);
    let by = boxY + 94;
    if (cu.mobile) { by += 38; text(cu.mobile, PAD + 30, by, `24px ${F_SANS}`, MUTED); }
    addrLines.forEach((l) => { by += 34; text(l, PAD + 30, by, `24px ${F_SANS}`, MUTED); });
    label('BALANCE DUE', R - 30, boxY + 46, 'right');
    text(money(Math.max(0, num(inv.balance))), R - 30, boxY + 104, `700 46px ${F_SERIF}`, INK, 'right');
    const paid = num(inv.balance) <= 0;
    if (paid && draw) {
      ctx.save();
      ctx.translate(PAD + INNER - 380, boxY + boxH / 2 + 4);
      ctx.rotate(-0.2);
      ctx.globalAlpha = 0.78;
      font(`800 54px ${F_SANS}`, '#2F7D4F');
      const tw = fillTracked(ctx, 'PAID', 0, 0, 10, 'left', false);
      ctx.strokeStyle = '#2F7D4F'; ctx.lineWidth = 6;
      roundRect(ctx, -24, -62, tw + 48, 86, 12); ctx.stroke();
      fillTracked(ctx, 'PAID', 0, 0, 10, 'left');
      ctx.restore();
    }
    y = boxY + boxH + 40;

    /* Items */
    label('ITEM & DETAILS', PAD + 2, y);
    label(`AMOUNT (${String(s.currency || '').toUpperCase()})`, R - 2, y, 'right');
    y += 18;
    hline(y, LINE, 2);
    inv.items.forEach((it, k) => {
      y += 18;
      font(`700 30px ${F_SANS}`, INK);
      const title = `${k + 1}. ${it.name}`;
      const titleLines = wrapLines(ctx, title, INNER - 230);
      const qtyTxt = num(it.qty) > 1 ? ` × ${num(it.qty)}` : '';
      titleLines.forEach((l, li) => {
        y += li ? 38 : 30;
        text(l, PAD + 2, y, `700 30px ${F_SANS}`, INK);
        if (li === titleLines.length - 1 && qtyTxt) {
          font(`700 30px ${F_SANS}`, INK);
          const w = ctx.measureText(l).width;
          text(qtyTxt, PAD + 2 + w, y, `24px ${F_SANS}`, MUTED);
        }
        if (li === 0) text(fmt(lineTotal(it)), R - 2, y, `700 30px ${F_SANS}`, INK, 'right');
      });
      const priced = (it.addons || []).filter((a) => num(a.price));
      const plain = (it.addons || []).filter((a) => !num(a.price));
      priced.forEach((a) => {
        y += 40;
        text(ellipsize(ctx, a.name, INNER - 260), PAD + 30, y, `24px ${F_SANS}`, SOFT);
        text(fmt(a.price), R - 2, y, `24px ${F_SANS}`, SOFT, 'right');
      });
      if (plain.length) {
        font(`24px ${F_SANS}`, SOFT);
        wrapLines(ctx, plain.map((a) => a.name).join(', '), INNER - 80).forEach((l) => { y += 38; text(l, PAD + 30, y, `24px ${F_SANS}`, SOFT); });
      }
      if (it.note) {
        font(`italic 22px ${F_SANS}`, MUTED);
        wrapLines(ctx, it.note, INNER - 80).forEach((l) => { y += 34; text(l, PAD + 30, y, `italic 22px ${F_SANS}`, MUTED); });
      }
      y += 24;
      hline(y, LINE, 1.5);
    });

    /* Totals */
    y += 22;
    const TW = 500, bx = R - TW;
    const row = (l, v, bold) => {
      y += 50;
      text(l, bx, y - 2, `${bold ? '700 ' : ''}26px ${F_SANS}`, bold ? INK : SOFT);
      text(v, R, y - 2, `${bold ? '700 ' : ''}26px ${F_SANS}`, bold ? INK : SOFT, 'right');
    };
    const dAmt = discountAmt(inv.items, inv.discount);
    if (dAmt > 0) {
      row('Items total', money(grossOf(inv.items)));
      row(inv.discount.type === 'flat' ? 'Discount' : `Discount (${num(inv.discount.value)}%)`, '− ' + money(dAmt));
    }
    row('Invoice amount', money(inv.subtotal));
    row('Previous balance', money(inv.prevBalance));
    hline(y + 14, LINE, 2, bx, R);
    y += 6;
    row('Total', money(inv.total), true);
    row('Advance paid', '− ' + money(inv.advance));
    y += 22;
    if (draw) { ctx.fillStyle = INK; roundRect(ctx, bx, y, TW, 78, 18); ctx.fill(); }
    text('Current balance', bx + 26, y + 50, `700 23px ${F_SANS}`, '#fff');
    text(money(inv.balance), R - 26, y + 51, `700 28px ${F_SANS}`, '#fff', 'right');
    y += 78 + 44;

    /* Pay online */
    const pay = safeUrl(s.payLink);
    if (pay && num(inv.balance) > 0) {
      const PH = 226;
      if (draw) {
        ctx.save(); ctx.setLineDash([12, 9]); ctx.strokeStyle = ROSE; ctx.lineWidth = 3;
        roundRect(ctx, PAD, y, INNER, PH, 22); ctx.stroke(); ctx.restore();
        drawQr(ctx, PAD + 26, y + 38, 150, pay);
      }
      const tx = PAD + 26 + 150 + 32;
      label('PAY YOUR BALANCE ONLINE', tx, y + 54);
      text(money(inv.balance), tx, y + 100, `700 36px ${F_SERIF}`, INK);
      const btn = String(s.payLabel || 'Pay Online');
      font(`700 25px ${F_SANS}`, '#fff');
      const bw = Math.min(INNER - (tx - PAD) - 26, Math.max(260, ctx.measureText(btn).width + 70));
      if (draw) { ctx.fillStyle = INK; roundRect(ctx, tx, y + 122, bw, 58, 29); ctx.fill(); }
      text(btn, tx + bw / 2, y + 160, `700 25px ${F_SANS}`, '#fff', 'center');
      links.push({ x: tx, y: y + 122, w: bw, h: 58, url: pay });
      font(`19px ${F_SANS}`, MUTED);
      text(ellipsize(ctx, pay.replace(/^https:\/\//, ''), INNER - (tx - PAD) - 26), tx, y + 206, `19px ${F_SANS}`, MUTED);
      y += PH + 40;
    }

    /* Notes */
    if (inv.notes) {
      label('NOTES', PAD + 2, y + 4);
      font(`24px ${F_SANS}`, SOFT);
      wrapLines(ctx, inv.notes, INNER).forEach((l) => { y += 38; text(l, PAD + 2, y + 6, `24px ${F_SANS}`, SOFT); });
      y += 46;
    }

    /* Footer */
    y += 6;
    hline(y, LINE, 2);
    y += 18;
    if (s.terms) {
      font(`22px ${F_SANS}`, MUTED);
      wrapLines(ctx, s.terms, INNER - 120).forEach((l) => { y += 34; text(l, W / 2, y, `22px ${F_SANS}`, MUTED, 'center'); });
      y += 16;
    }
    const ig = safeUrl(s.instagram);
    if (ig) {
      const handle = '@' + igHandle(ig);
      font(`22px ${F_SANS}`, INK);
      const lead = 'Follow us on Instagram ';
      const w1 = ctx.measureText(lead).width;
      font(`700 22px ${F_SANS}`, INK);
      const w2 = ctx.measureText(handle).width;
      const pw = Math.min(INNER, 34 + 24 + 14 + w1 + w2 + 34), ph = 60, px = (W - pw) / 2, py = y + 14;
      if (draw) {
        ctx.fillStyle = BLUSH; roundRect(ctx, px, py, pw, ph, 30); ctx.fill();
        ctx.strokeStyle = ROSE; ctx.lineWidth = 2; roundRect(ctx, px, py, pw, ph, 30); ctx.stroke();
        const ix = px + 34, iy = py + 18;
        ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
        roundRect(ctx, ix, iy, 24, 24, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(ix + 12, iy + 12, 5.6, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(ix + 19, iy + 5, 1.7, 0, 6.2832); ctx.fill();
      }
      text(lead, px + 34 + 24 + 14, py + 38, `22px ${F_SANS}`, INK);
      text(handle, px + 34 + 24 + 14 + w1, py + 38, `700 22px ${F_SANS}`, INK);
      links.push({ x: px, y: py, w: pw, h: ph, url: ig });
      y = py + ph;
    }
    y += 64;
    return { height: Math.ceil(y), links };
  }

  /** Minimal one-page PDF: the invoice picture, with tappable links over the Pay button and the Instagram badge. */
  function makePdf(jpeg, wPx, hPx, links) {
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let len = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const f = (n) => (Math.round(n * 100) / 100).toString();
    const pw = 595.28, ph = pw * hPx / wPx, k = pw / wPx;
    const obj = (n, body) => { offsets[n] = len; push(n + ' 0 obj\n'); body(); push('\nendobj\n'); };
    const annIds = links.map((_, i) => 6 + i);
    push(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
    obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pw)} ${f(ph)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R${annIds.length ? ' /Annots [' + annIds.map((n) => n + ' 0 R').join(' ') + ']' : ''} >>`));
    obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); push(jpeg); push('\nendstream'); });
    const content = `q ${f(pw)} 0 0 ${f(ph)} 0 0 cm /Im0 Do Q`;
    obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    links.forEach((l, i) => {
      const x1 = l.x * k, x2 = (l.x + l.w) * k, y2 = ph - l.y * k, y1 = ph - (l.y + l.h) * k;
      const uri = l.url.replace(/[\\()]/g, (c) => '\\' + c);
      obj(6 + i, () => push(`<< /Type /Annot /Subtype /Link /Rect [${f(x1)} ${f(y1)} ${f(x2)} ${f(y2)}] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`));
    });
    const count = 6 + links.length;
    const xref = len;
    let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let n = 1; n < count; n++) x += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach((b) => { out.set(b, o); o += b.length; });
    return out;
  }

  /* ---------------- Sharing: the invoice as an image and PDF ---------------- */
  const Share = {
    current: null,
    building: false,
    failedId: null,
    async build(inv) {
      const A = { logo: await loadImg('logo.png') };
      const probe = document.createElement('canvas').getContext('2d');
      const m = drawInvoice(probe, inv, A, true);
      const H = Math.max(m.height, Math.round(1080 * 1.4142)); // at least A4 proportions
      const SCALE = Math.max(1, Math.min(2, Math.sqrt(15.5e6 / (1080 * H)))); // stays inside the iPhone canvas limit
      const c = document.createElement('canvas');
      c.width = Math.round(1080 * SCALE); c.height = Math.round(H * SCALE);
      const ctx = c.getContext('2d');
      ctx.scale(SCALE, SCALE);
      const res = drawInvoice(ctx, inv, A, false);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not prepare the invoice.');
      const links = res.links.map((l) => ({ x: l.x * SCALE, y: l.y * SCALE, w: l.w * SCALE, h: l.h * SCALE, url: l.url }));
      const pdf = makePdf(new Uint8Array(await blob.arrayBuffer()), c.width, c.height, links);
      if (this.current && this.current.url) URL.revokeObjectURL(this.current.url);
      this.current = { id: inv.id, stamp: inv.updatedAt + '|' + db.settings.updatedAt, image: blob, pdf: new Blob([pdf], { type: 'application/pdf' }), base: 'Invoice-' + inv.no, no: inv.no, url: URL.createObjectURL(blob) };
      return this.current;
    },
    async send(kind) {
      const cur = this.current;
      if (!cur) return;
      const blob = kind === 'pdf' ? cur.pdf : cur.image;
      const name = cur.base + (kind === 'pdf' ? '.pdf' : '.jpg');
      const file = new File([blob], name, { type: blob.type });
      const inv = getInv(cur.id);
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Invoice ' + cur.no, text: inv ? 'Invoice ' + cur.no + ' from ' + db.settings.shopName : '' });
          return;
        }
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('Saved to your Downloads.');
    }
  };

  function waNumber(m) {
    let d = String(m || '').replace(/\D/g, '');
    const cc = String(db.settings.countryCode || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.indexOf('00') === 0) return d.slice(2);
    if (d[0] === '0') return cc + d.slice(1);
    if (cc && d.length <= 9) return cc + d;
    return d;
  }
  function shareText(inv) {
    const s = db.settings, cu = inv.customer || {};
    let t = `Hello ${cu.name || ''},\nThank you for choosing ${s.shopName}.\n\nInvoice: ${inv.no}\nDate: ${fmtDate(inv.date)}\n` +
      inv.items.map((it) => `• ${it.name}${num(it.qty) > 1 ? ' × ' + num(it.qty) : ''} – ${money(lineTotal(it))}`).join('\n') +
      `\n\nInvoice amount: ${money(inv.subtotal)}\nPrevious balance: ${money(inv.prevBalance)}\nTotal: ${money(inv.total)}\nAdvance paid: ${money(inv.advance)}\n*Current balance: ${money(inv.balance)}*`;
    if (inv.delivery) t += `\nDelivery date: ${fmtDate(inv.delivery)}`;
    if (safeUrl(s.payLink) && num(inv.balance) > 0) t += `\n\nPay online: ${s.payLink}`;
    if (safeUrl(s.instagram)) t += `\n\nFollow us on Instagram: ${s.instagram}`;
    return t;
  }
  function whatsappInvoice(inv) {
    const ph = waNumber((inv.customer || {}).mobile);
    const url = `https://wa.me/${ph}?text=${encodeURIComponent(shareText(inv))}`;
    if (!ph) toast('Add a mobile number for this customer to send straight to their WhatsApp.');
    window.open(url, '_blank');
  }
  /* ---------------- Router ---------------- */
  const VIEWS = {};
  const TABS = ['home', 'invoices', 'customers', 'settings'];
  const NAV_SCREENS = ['home', 'invoices', 'customers', 'customer', 'settings', 'setShop', 'setPay', 'setItems', 'setAddons', 'appearance', 'setData'];

  function go(name, params, replace) {
    state.route = { name, params: params || {} };
    const st = { name, params: state.route.params };
    if (replace) history.replaceState(st, ''); else history.pushState(st, '');
    render({ dir: replace ? 'fade' : 'forward', top: true });
  }
  window.addEventListener('popstate', (e) => {
    const st = e.state || { name: 'home', params: {} };
    state.route = { name: st.name, params: st.params || {} };
    render({ dir: 'back' });
  });
  function back(fallback) {
    if (history.state && history.length > 1) history.back();
    else go(fallback || 'home', {}, true);
  }

  const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function screenName() {
    let name = state.route.name;
    if (REMOTE && !state.token) name = 'login';
    else if (name === 'login') name = 'home';
    return VIEWS[name] ? name : 'home';
  }
  function paint(top) {
    const name = screenName();
    app.innerHTML = VIEWS[name](state.route.params || {});
    if (top) window.scrollTo(0, 0);
    const auto = app.querySelector('[data-autofocus]');
    if (auto && !('ontouchstart' in window)) auto.focus();
  }
  function render(opts) {
    opts = opts || {};
    const name = screenName();
    const key = name + '|' + JSON.stringify(state.route.params || {});
    const changed = key !== state.lastScreen;
    const prev = state.lastName;
    state.lastScreen = key;
    state.lastName = name;
    Transit.finish();
    if (!changed || !prev || reduceMotion()) { paint(opts.top); return; }
    let dir = opts.dir || 'fade';
    if (TABS.indexOf(name) >= 0 && TABS.indexOf(prev) >= 0) dir = 'tab';
    Transit.run(dir, () => paint(opts.top));
  }

  /* Screen changes without blank frames: the old screen stays as a still copy while the new one moves in. */
  const Transit = {
    snap: null, timer: 0, holder: null, scr: null,
    finish() {
      clearTimeout(this.timer);
      if (this.snap) { this.snap.remove(); this.snap = null; }
      if (this.holder) {
        if (this.scr && this.scr.isConnected) [...this.holder.children].forEach((n) => this.scr.appendChild(n));
        this.holder.remove();
        this.holder = null;
      }
      const s = app.querySelector('.screen.tr-in');
      if (s) s.className = s.className.replace(/\btr-in(-\w+)?\b/g, '').trim();
      document.documentElement.classList.remove('in-transit');
    },
    run(dir, paintNew) {
      const y = window.scrollY;
      const rect = app.getBoundingClientRect();
      const snap = document.createElement('div');
      snap.className = 'tr-snap tr-out-' + dir;
      snap.setAttribute('aria-hidden', 'true');
      snap.style.left = rect.left + 'px';
      snap.style.width = rect.width + 'px';
      const inner = document.createElement('div');
      inner.className = 'tr-inner';
      inner.style.marginTop = -y + 'px';
      inner.innerHTML = app.innerHTML;
      inner.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      inner.querySelectorAll('.hap-ov, input, select, textarea').forEach((n) => { if (n.classList.contains('hap-ov')) n.remove(); else n.setAttribute('tabindex', '-1'); });
      snap.appendChild(inner);
      document.documentElement.classList.add('in-transit');
      document.body.appendChild(snap);
      this.snap = snap;
      paintNew();
      const scr = app.querySelector('.screen');
      if (scr) {
        // The bottom bar stays perfectly still while the screen moves.
        const fixed = [...scr.children].filter((n) => n.matches('.nav'));
        if (fixed.length) {
          const holder = document.createElement('div');
          holder.className = 'tr-fixed';
          fixed.forEach((n) => holder.appendChild(n));
          document.body.appendChild(holder);
          this.holder = holder;
        }
        this.scr = scr;
        scr.classList.add('tr-in', 'tr-in-' + dir);
      }
      this.timer = setTimeout(() => this.finish(), dir === 'tab' || dir === 'fade' ? 340 : 460);
    }
  };

  /* ---------------- Shared pieces ---------------- */
  function nav(active) {
    const map = { customer: 'customers', setShop: 'settings', setPay: 'settings', setItems: 'settings', setAddons: 'settings', appearance: 'settings', setData: 'settings' };
    active = map[active] || active;
    const items = [['home', 'Home', I.home, IF.home], ['invoices', 'Invoices', I.file, IF.invoices], ['new', 'New', I.plus, I.plus], ['customers', 'Customers', I.users, IF.customers], ['settings', 'Settings', I.gear, IF.settings]];
    return `<nav class="nav" aria-label="Main">
      ${items.map(([k, label, ic, icOn]) => k === 'new'
        ? `<button type="button" class="nav-new" data-act="compose" aria-label="New invoice"><span class="ic">${ic}</span><span class="lb">${label}</span></button>`
        : `<button type="button" data-act="nav" data-to="${k}" ${active === k ? 'aria-current="page"' : ''}><span class="ic">${active === k ? icOn : ic}</span><span class="lb">${label}</span></button>`).join('')}
    </nav>`;
  }
  const topbar = (title, right) => `<div class="topbar"><button class="icon-btn" type="button" data-act="back" aria-label="Back">${I.back}</button><h1>${esc(title)}</h1>${right || '<span style="width:44px"></span>'}</div>`;
  const notFound = (what) => `<div class="screen"><div class="page">${topbar('Not found')}<div class="empty">${I.inbox}<p>${esc(what)} could not be found.</p></div></div></div>`;
  const emptyState = (text) => `<div class="empty">${I.inbox}<p>${text}</p></div>`;

  function itemSummary(i) { return (i.items || []).map((it) => it.name).join(', '); }
  function invoiceCard(i) {
    const bal = num(i.balance);
    return `<button type="button" class="icard" data-act="openInvoice" data-id="${esc(i.id)}">
      <span class="mid"><span class="no">${esc(i.no)} · ${esc(fmtDate(i.date))}</span><span class="nm">${esc((i.customer || {}).name)}</span><span class="ds">${esc(itemSummary(i))}</span></span>
      <span class="rt"><span class="am">${esc(money(i.subtotal))}</span><span class="tag ${bal > 0 ? 'tag-red' : 'tag-green'}">${bal > 0 ? 'Bal ' + esc(fmt(bal)) : 'Paid'}</span></span>
    </button>`;
  }
  function customerRow(c) {
    const bal = num(c.balance);
    const n = liveInvoices().filter((i) => i.customerId === c.id).length;
    return `<button type="button" class="crow" data-act="openCustomer" data-id="${esc(c.id)}">
      <span class="avatar">${esc(initials(c.name))}</span>
      <span class="mid"><span class="nm">${esc(c.name)}</span><span class="ds">${esc(c.mobile || 'No mobile')} · ${n} invoice${n === 1 ? '' : 's'}</span></span>
      <span class="rt">${bal > 0 ? `<span class="tag tag-red">Due ${esc(fmt(bal))}</span>` : bal < 0 ? `<span class="tag tag-rose">Credit ${esc(fmt(-bal))}</span>` : '<span class="tag tag-green">Clear</span>'}</span>
    </button>`;
  }
  function invoiceListHtml() {
    const q = state.invQ.trim().toLowerCase();
    const list = liveInvoices().sort((a, b) => b.createdAt - a.createdAt).filter((i) => {
      if (state.invFilter === 'due' && num(i.balance) <= 0) return false;
      if (state.invFilter === 'paid' && num(i.balance) > 0) return false;
      return !q || i.no.toLowerCase().includes(q) || String((i.customer || {}).name).toLowerCase().includes(q) || String((i.customer || {}).mobile).includes(q) || itemSummary(i).toLowerCase().includes(q);
    });
    return list.length ? list.map(invoiceCard).join('') : emptyState(liveInvoices().length ? 'No invoices match.' : 'No invoices yet.<br>Tap <b>New</b> to create the first one.');
  }
  function customerListHtml() {
    const q = state.custQ.trim().toLowerCase();
    const qd = q.replace(/\D/g, '');
    const list = liveCustomers().filter((c) => !q || c.name.toLowerCase().includes(q) || (qd && String(c.mobile).replace(/\D/g, '').includes(qd))).sort((a, b) => a.name.localeCompare(b.name));
    return list.length ? list.map(customerRow).join('') : emptyState(liveCustomers().length ? 'No customers match.' : 'No customers yet.<br>Tap <b>Add</b> to save the first one.');
  }

  /* ---------------- Sign-in and install ---------------- */
  VIEWS.login = () => `
    <div class="screen">
      <div class="hero">
        <img class="hero-logo" src="logo.png" alt="">
        <h1>${esc(db.settings.shopName)}</h1>
        <p>${esc(db.settings.tagline)}</p>
      </div>
      <form class="auth-card login-card" data-form="login" novalidate>
        <h2>Welcome back, ${esc(db.settings.userName || 'Gayatri')}</h2>
        <p class="quote">“${esc(state.quote)}”</p>
        <label class="pin-label" for="l-pin">Enter your passcode</label>
        <div class="pin-wrap">
          <div class="pin-boxes" aria-hidden="true"><span class="pin-box on"></span><span class="pin-box"></span><span class="pin-box"></span><span class="pin-box"></span></div>
          <input class="pin-real" id="l-pin" name="pin" type="tel" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" autocorrect="off" required data-autofocus aria-label="4-digit passcode">
        </div>
        <div class="error-box" id="form-error" hidden></div>
        <p class="small muted center">Forgot it? Set a new PIN in Code.gs and run setup again.</p>
      </form>
      <div class="auth-foot"><p class="muted small">${esc(db.settings.shopName)} · ${esc(db.settings.tagline)}</p></div>
    </div>`;

  VIEWS.install = () => `
    <div class="screen"><div class="page">
      <div class="stack" style="gap:8px">
        <span class="eyebrow">One last step</span>
        <h1 class="title-lg">Add the app to your Home Screen</h1>
        <p class="muted small">So it opens full screen like a normal app and keeps your invoices safe on your iPhone. It takes 20 seconds.</p>
      </div>
      <div class="stack">
        <div class="step"><div class="num">1</div><div class="spacer"><b>Tap the Share button</b><p class="small muted">At the bottom of Safari</p></div><div class="ic">${I.share}</div></div>
        <div class="step"><div class="num">2</div><div class="spacer"><b>Choose “Add to Home Screen”</b><p class="small muted">Scroll down the menu if needed</p></div><div class="ic">${I.addHome}</div></div>
        <div class="step"><div class="num">3</div><div class="spacer"><b>Open it from the new icon</b><p class="small muted">The Ms. Mannequin logo</p></div><div class="ic" style="padding:0;overflow:hidden"><img src="logo.png" alt="" width="48" height="48"></div></div>
      </div>
      <div class="spacer"></div>
      <button class="btn" type="button" data-act="installDone">Done</button>
    </div></div>`;

  /* ---------------- Home ---------------- */
  /* Business analytics for the home screen */
  const RANGES = [['month', 'Month'], ['quarter', '3 Months'], ['year', 'Year'], ['all', 'All time']];
  const isoOf = (y, m, d) => { const t = new Date(y, m, d); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  const msIso = (ms) => { const d = new Date(ms || 0); return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); };
  function rangeBounds(r) {
    const d = new Date(), y = d.getFullYear(), m = d.getMonth();
    if (r === 'month') return { from: isoOf(y, m, 1), to: isoOf(y, m + 1, 1), pf: isoOf(y, m - 1, 1), pt: isoOf(y, m, 1), vs: 'last month' };
    if (r === 'quarter') return { from: isoOf(y, m - 2, 1), to: isoOf(y, m + 1, 1), pf: isoOf(y, m - 5, 1), pt: isoOf(y, m - 2, 1), vs: 'previous 3 months' };
    if (r === 'year') return { from: isoOf(y, 0, 1), to: isoOf(y + 1, 0, 1), pf: isoOf(y - 1, 0, 1), pt: isoOf(y, 0, 1), vs: 'last year' };
    return { from: '', to: '9999', pf: null, pt: null, vs: '' };
  }
  function periodStats(from, to) {
    const invs = liveInvoices().filter((i) => i.date >= from && i.date < to);
    let invoiced = 0, collected = 0;
    invs.forEach((i) => { invoiced += num(i.subtotal); collected += num(i.advance); });
    liveCustomers().forEach((c) => (c.payments || []).forEach((p) => { if (p.date >= from && p.date < to) collected += num(p.amount); }));
    return { invs, invoiced, collected, count: invs.length, avg: invs.length ? invoiced / invs.length : 0 };
  }
  const compact = (n) => { n = num(n); return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n)); };
  const m0 = (n) => { const c = String(db.settings.currency || '').trim(); n = num(n); return (c ? c + ' ' : '') + (Math.abs(n - Math.round(n)) < 0.005 ? Math.round(n).toLocaleString('en-US') : fmt(n)); };
  function topClients(from, to, by) {
    const inR = (d) => d >= from && d < to;
    const rows = liveCustomers().map((c) => {
      const invs = liveInvoices().filter((i) => i.customerId === c.id && inR(i.date));
      const billed = invs.reduce((s, i) => s + num(i.subtotal), 0);
      const paid = invs.reduce((s, i) => s + num(i.advance), 0) + (c.payments || []).filter((p) => inR(p.date)).reduce((s, p) => s + num(p.amount), 0);
      return { c, n: invs.length, billed, paid, due: Math.max(0, num(c.balance)) };
    });
    const key = by === 'freq' ? 'n' : by === 'due' ? 'due' : 'paid';
    return rows.filter((r) => r[key] > 0).sort((a, b) => b[key] - a[key] || b.billed - a.billed).slice(0, 5).map((r) => ({
      c: r.c, v: r[key], main: by === 'freq' ? r.n + (r.n === 1 ? ' invoice' : ' invoices') : m0(r[key]),
      sub: by === 'freq' ? m0(r.billed) + ' billed' : by === 'due' ? 'Outstanding now' : r.n + (r.n === 1 ? ' invoice' : ' invoices') + ' · ' + m0(r.billed) + ' billed'
    }));
  }
  function anaHtml() {
    const rb = rangeBounds(state.range);
    const cur = periodStats(rb.from, rb.to);
    const prev = rb.pf ? periodStats(rb.pf, rb.pt) : null;
    const custs = liveCustomers();
    const outstanding = custs.reduce((s, c) => s + Math.max(0, num(c.balance)), 0);
    const owing = custs.filter((c) => num(c.balance) > 0).length;
    const activeIds = new Set(cur.invs.map((i) => i.customerId));
    const newC = rb.pf ? custs.filter((c) => { const d = msIso(c.createdAt); return d >= rb.from && d < rb.to; }).length : 0;
    let delta = '';
    if (prev && prev.invoiced > 0) {
      const p = ((cur.invoiced - prev.invoiced) / prev.invoiced) * 100;
      delta = `<span class="delta ${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span><span class="muted small"> vs ${rb.vs}</span>`;
    } else if (rb.vs) delta = `<span class="muted small">No invoices in ${rb.vs} to compare</span>`;
    // last six months bars
    const d0 = new Date(), months = [];
    for (let k = 5; k >= 0; k--) {
      const f = isoOf(d0.getFullYear(), d0.getMonth() - k, 1), t = isoOf(d0.getFullYear(), d0.getMonth() - k + 1, 1);
      months.push({ l: new Date(d0.getFullYear(), d0.getMonth() - k, 1).toLocaleDateString('en-GB', { month: 'short' }), v: periodStats(f, t).invoiced, now: k === 0 });
    }
    const max = Math.max(1, ...months.map((m) => m.v));
    const bars = months.map((m) => `<div class="bar ${m.now ? 'now' : ''}"><span class="bv">${m.v ? compact(m.v) : ''}</span><div class="bt"><i style="height:${Math.max(m.v ? 4 : 0, (m.v / max) * 100)}%"></i></div><span class="bl">${m.l}</span></div>`).join('');
    const top = topClients(rb.from, rb.to, state.topBy);
    const topMax = Math.max(1, ...top.map((t) => t.v));
    const items = {};
    cur.invs.forEach((i) => (i.items || []).forEach((it) => { const k = String(it.name).trim() || 'Item'; const o = items[k] || (items[k] = { name: k, q: 0, rev: 0 }); o.q += num(it.qty) || 1; o.rev += lineTotal(it); }));
    const pop = Object.values(items).sort((a, b) => b.rev - a.rev).slice(0, 5);
    const popMax = Math.max(1, ...pop.map((p) => p.rev));
    const rank = (n) => `<span class="rk">${n}</span>`;
    return `
      <div class="seg" role="tablist">${RANGES.map(([k, l]) => `<button type="button" data-act="anaRange" data-v="${k}" aria-pressed="${state.range === k}">${l}</button>`).join('')}</div>
      <div class="card ana-rev">
        <span class="lbl">Revenue invoiced</span>
        <span class="rev-big">${esc(m0(cur.invoiced))}</span>
        <span class="row" style="gap:0;flex-wrap:wrap">${delta}</span>
        <div class="bars" aria-label="Revenue, last six months">${bars}</div>
        <span class="hint">Last 6 months</span>
      </div>
      <div class="grid-2">
        <div class="tile"><span class="lbl">Collected</span><b class="c-ok">${esc(m0(cur.collected))}</b><span class="sub">Advances and payments</span></div>
        <div class="tile"><span class="lbl">Outstanding</span><b class="c-red">${esc(m0(outstanding))}</b><span class="sub">${owing} client${owing === 1 ? '' : 's'} owe${owing === 1 ? 's' : ''}</span></div>
        <div class="tile"><span class="lbl">Clients</span><b>${custs.length}</b><span class="sub">${rb.pf ? `${activeIds.size} active · ${newC} new` : `${activeIds.size} with invoices`}</span></div>
        <div class="tile"><span class="lbl">Average invoice</span><b>${esc(m0(cur.avg))}</b><span class="sub">${cur.count} invoice${cur.count === 1 ? '' : 's'}</span></div>
      </div>
      <div class="sec-h"><span class="section-title">Top clients</span></div>
      <div class="seg">${[['paid', 'Highest paid'], ['freq', 'Most frequent'], ['due', 'Most due']].map(([k, l]) => `<button type="button" data-act="topBy" data-v="${k}" aria-pressed="${state.topBy === k}">${l}</button>`).join('')}</div>
      <div class="list">${top.length ? top.map((t, i) => `<button type="button" class="crow rankrow" data-act="openCustomer" data-id="${esc(t.c.id)}">${rank(i + 1)}<span class="mid"><span class="nm">${esc(t.c.name)}</span><span class="ds">${esc(t.sub)}</span><span class="meter"><i style="width:${Math.max(4, (t.v / topMax) * 100)}%"></i></span></span><span class="rt"><b>${esc(t.main)}</b></span></button>`).join('') : emptyState('Nothing to show for this period yet.')}</div>
      ${pop.length ? `<div class="sec-h"><span class="section-title">Best-selling items</span></div>
      <div class="list">${pop.map((p, i) => `<div class="crow rankrow" style="cursor:default">${rank(i + 1)}<span class="mid"><span class="nm">${esc(p.name)}</span><span class="ds">× ${p.q}</span><span class="meter"><i style="width:${Math.max(4, (p.rev / popMax) * 100)}%"></i></span></span><span class="rt"><b>${esc(m0(p.rev))}</b></span></div>`).join('')}</div>` : ''}`;
  }

  VIEWS.home = () => {
    const invs = liveInvoices().sort((a, b) => b.createdAt - a.createdAt);
    return `
    <div class="screen"><div class="page with-nav">
      <div class="row between">
        <div class="greet"><p class="muted">${greeting().replace(',', '')}, ${esc(db.settings.userName || 'Gayatri')}</p><h1 class="title-lg">${esc(db.settings.shopName)}</h1><p class="muted small" data-sync-label>${esc(syncLabel())}</p></div>
        <img src="logo.png" alt="" width="52" height="52" style="border-radius:50%;flex-shrink:0">
      </div>
      <div class="quote-card"><span class="qm">“</span><p>${esc(state.quote)}</p></div>
      <div class="stack" id="ana" style="gap:16px">${anaHtml()}</div>
      <div class="sec-h"><span class="section-title">Recent invoices</span>${invs.length ? '<button class="link-btn" type="button" data-act="nav" data-to="invoices" style="min-height:24px">See all</button>' : ''}</div>
      <div class="list">${invs.length ? invs.slice(0, 5).map(invoiceCard).join('') : emptyState('No invoices yet.<br>Tap <b>New</b> to create the first one.')}</div>
    </div>${nav('home')}</div>`;
  };

  /* ---------------- Invoices ---------------- */
  VIEWS.invoices = () => `
    <div class="screen"><div class="page with-nav">
      <h1 class="title-lg" style="margin-top:6px">Invoices</h1>
      <div class="search">${I.search}<input class="input" id="inv-q" type="search" placeholder="Search number, name or mobile" value="${esc(state.invQ)}" data-input="invSearch" autocomplete="off"></div>
      <div class="seg">${[['all', 'All'], ['due', 'Balance due'], ['paid', 'Paid']].map(([k, l]) => `<button type="button" data-act="invFilter" data-v="${k}" aria-pressed="${state.invFilter === k}">${l}</button>`).join('')}</div>
      <div class="list" id="inv-list">${invoiceListHtml()}</div>
    </div>${nav('invoices')}</div>`;

  /* Invoice screen: the picture the customer receives, and every way to send it */
  VIEWS.invoice = ({ id }) => {
    const inv = getInv(id);
    if (!inv) return notFound('Invoice');
    const stamp = inv.updatedAt + '|' + db.settings.updatedAt;
    const ready = Share.current && Share.current.id === id && Share.current.stamp === stamp;
    const failed = Share.failedId === id + stamp;
    if (!ready && !Share.building && !failed) {
      Share.building = true;
      Share.build(inv).then(() => { Share.failedId = null; })
        .catch((e) => { Share.failedId = id + stamp; showError(e); })
        .finally(() => { Share.building = false; if (state.route.name === 'invoice') render(); });
    }
    return `
    <div class="screen"><div class="page">
      ${topbar(inv.no, `<button class="icon-btn" type="button" data-act="editInvoice" data-id="${esc(id)}" aria-label="Edit">${I.edit}</button>`)}
      ${ready ? `<img class="inv-img" src="${esc(Share.current.url)}" alt="Invoice ${esc(inv.no)}">`
        : failed ? `<div class="card center"><p>Could not prepare the invoice.</p><button class="btn btn-outline" type="button" data-act="retryShare">Try again</button></div>`
        : '<div class="card center"><div class="spinner"></div><p class="small muted">Preparing the invoice…</p></div>'}
      <div class="sticky-actions">
        <div class="grid-2">
          <button class="btn" type="button" data-act="shareFile" data-kind="pdf" ${ready ? '' : 'disabled'}>${I.share} Share</button>
          <button class="btn btn-danger" type="button" data-act="deleteInvoice" data-id="${esc(id)}">${I.trash} Delete</button>
        </div>
      </div>
    </div></div>`;
  };

  /* ---------------- Writing an invoice ---------------- */
  function itemCard(it, i) {
    const chips = db.catalog.addons.filter((a) => a.name).map((a) => `<button type="button" class="chip" aria-pressed="${it.addons.some((x) => x.name === a.name)}" data-act="toggleAddon" data-name="${esc(a.name)}">${esc(a.name)}</button>`).join('');
    return `<div class="item-card" data-i="${i}">
      <div class="row between"><span class="eyebrow">Item ${i + 1}</span><button class="icon-btn sm" type="button" data-act="delItem" aria-label="Remove item">${I.x}</button></div>
      <input class="input" list="item-names" placeholder="Item name (e.g. Blouse)" value="${esc(it.name)}" data-input="item" data-f="name" autocapitalize="words" style="font-weight:700">
      <div class="grid-2">
        <div class="field"><label>Qty</label><input class="input" type="number" inputmode="numeric" min="1" value="${esc(it.qty)}" data-input="item" data-f="qty"></div>
        <div class="field"><label>Base price</label><input class="input" type="number" inputmode="decimal" placeholder="0" value="${esc(it.price)}" data-input="item" data-f="price"></div>
      </div>
      <div class="label">Add-ons <span class="hint">· tap to add</span></div>
      <div class="chips">${chips}<button type="button" class="chip add" data-act="customAddon">+ Other</button></div>
      <div class="addon-rows">${it.addons.map((a, j) => `
        <div class="addon-row" data-j="${j}"><input class="input" placeholder="Add-on name" value="${esc(a.name)}" data-input="addon" data-f="name"><input class="input price" type="number" inputmode="decimal" placeholder="Price" value="${esc(a.price)}" data-input="addon" data-f="price"><button class="icon-btn sm" type="button" data-act="delAddon" aria-label="Remove add-on">${I.x}</button></div>`).join('')}</div>
      <input class="input" placeholder="Notes / measurements (optional)" value="${esc(it.note)}" data-input="item" data-f="note">
      <div class="line-total"><span class="lt-lbl">${lineLbl(it)}</span><b>${esc(money(lineTotal(it)))}</b></div>
    </div>`;
  }
  const lineLbl = (it) => 'Item total' + ((num(it.qty) || 1) > 1 ? ' (× ' + (num(it.qty) || 1) + ')' : '');
  function custInfoHtml() {
    const c = getCust(draft.customerId);
    if (!c) return '';
    return `${c.address ? `<span>${esc(c.address)}</span>` : ''}${num(c.balance) > 0 && !draft.editId ? `<span class="tag tag-red">Previous due ${esc(money(c.balance))}</span>` : ''}`;
  }
  function custOptions() {
    return '<option value="">Choose customer…</option>' +
      liveCustomers().sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${esc(c.id)}" ${c.id === draft.customerId ? 'selected' : ''}>${esc(c.name)}${c.mobile ? ' – ' + esc(c.mobile) : ''}</option>`).join('') +
      '<option value="__new">+ Add new customer</option>';
  }
  function paintTotals() {
    const t = draftCalc();
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = money(v); };
    const dr = document.getElementById('t-disc-row'), gr = document.getElementById('t-gross-row');
    if (dr) dr.hidden = !(t.disc > 0);
    if (gr) gr.hidden = !(t.disc > 0);
    set('t-gross', t.gross);
    const dn = document.getElementById('t-disc'); if (dn) dn.textContent = '− ' + money(t.disc);
    set('t-sub', t.sub); set('t-prev', t.prev); set('t-total', t.total); set('t-bal', t.bal);
  }

  VIEWS.compose = () => {
    if (!draft.editId && !draft.no) { draft.no = genNo(); saveDraft(); }
    return `
    <div class="screen"><div class="page">
      ${topbar(draft.editId ? 'Edit invoice' : 'New invoice', `<button class="link-btn" type="button" data-act="startOver">${draft.editId ? 'Cancel' : 'Start over'}</button>`)}
      <div class="card">
        <div class="row between"><span class="label">Invoice no.</span><span class="inv-no">${esc(draft.no)}</span></div>
        <div class="grid-2">
          <div class="field"><label for="iv-date">Invoice date</label><input class="input" id="iv-date" type="date" value="${esc(draft.date)}" data-input="invDate"></div>
          <div class="field"><label for="iv-del">Delivery date</label><input class="input" id="iv-del" type="date" value="${esc(draft.delivery)}" data-input="invDelivery"></div>
        </div>
      </div>
      <div class="card">
        <div class="row between"><span class="label">Customer</span><button class="link-btn" type="button" data-act="newCustomerFromInvoice" style="min-height:28px">+ New customer</button></div>
        <select class="select" id="iv-cust" data-change="invCust" aria-label="Customer">${custOptions()}</select>
        <div class="cust-info" id="cust-info">${custInfoHtml()}</div>
      </div>
      <div class="card">
        <span class="section-title">Items</span>
        <div class="stack" id="items">${draft.items.map(itemCard).join('')}</div>
        <datalist id="item-names">${db.catalog.items.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
        <button class="btn btn-outline" type="button" data-act="addItem">${I.plusS} Add item</button>
      </div>
      <div class="card" style="gap:0">
        <div class="tot-row" id="t-gross-row" hidden><span>Items total</span><b id="t-gross"></b></div>
        <div class="tot-row disc-row"><span>Discount</span>
          <div class="disc-ctl">
            <div class="seg" role="group" aria-label="Discount type"><button type="button" data-act="discType" data-v="pct" aria-pressed="${(draft.discount || {}).type !== 'flat'}">%</button><button type="button" data-act="discType" data-v="flat" aria-pressed="${(draft.discount || {}).type === 'flat'}">${esc(db.settings.currency || 'Flat')}</button></div>
            <input class="input" id="iv-disc" type="number" inputmode="decimal" min="0" placeholder="0" value="${esc((draft.discount || {}).value)}" data-input="invDiscount" aria-label="Discount">
          </div>
        </div>
        <div class="tot-row" id="t-disc-row" hidden><span>Discount applied</span><b id="t-disc" style="color:var(--ok)"></b></div>
        <div class="tot-row"><span>Invoice amount</span><b id="t-sub"></b></div>
        <div class="tot-row"><span>Previous balance</span><b id="t-prev"></b></div>
        <div class="tot-row big"><span>Total</span><b id="t-total"></b></div>
        <div class="tot-row"><span>Advance paid</span><input class="input" id="iv-adv" type="number" inputmode="decimal" placeholder="0" value="${esc(draft.advance)}" data-input="invAdvance"></div>
        <div class="tot-row big"><span>Current balance</span><b id="t-bal"></b></div>
      </div>
      <div class="card"><div class="field"><label for="iv-notes">Notes on the invoice (optional)</label><textarea class="textarea" id="iv-notes" style="min-height:76px" placeholder="e.g. Trial on 10 Oct" data-input="invNotes">${esc(draft.notes)}</textarea></div></div>
      <div class="sticky-actions"><button class="btn" type="button" data-act="saveInvoice">${draft.editId ? 'Update invoice' : 'Save invoice'}</button>${draft.editId ? `<button class="btn btn-danger" type="button" data-act="deleteInvoice" data-id="${esc(draft.editId)}">${I.trash} Delete this invoice</button>` : ''}</div>
    </div></div>
    ${setTimeout(paintTotals, 0) && ''}`;
  };

  /* ---------------- Customers ---------------- */
  VIEWS.customers = () => `
    <div class="screen"><div class="page with-nav">
      <div class="row between"><h1 class="title-lg" style="margin-top:6px">Customers</h1><button class="btn btn-sm" type="button" data-act="newCustomer">${I.plusS} Add</button></div>
      <div class="search">${I.search}<input class="input" id="cust-q" type="search" placeholder="Search name or mobile" value="${esc(state.custQ)}" data-input="custSearch" autocomplete="off"></div>
      <div class="list" id="cust-list">${customerListHtml()}</div>
    </div>${nav('customers')}</div>`;

  VIEWS.customer = ({ id }) => {
    const c = getCust(id);
    if (!c) return notFound('Customer');
    const invs = liveInvoices().filter((i) => i.customerId === id);
    const events = [
      ...invs.map((i) => ({ t: i.createdAt, html: `<button type="button" class="hist-row" data-act="openInvoice" data-id="${esc(i.id)}"><span class="mid"><b>${esc(i.no)}</b> <span class="small">${esc(fmtDate(i.date))}</span><div class="small">Amount ${esc(money(i.subtotal))} · Advance ${esc(money(i.advance))}</div></span><span class="tag ${num(i.balance) > 0 ? 'tag-red' : 'tag-green'}">${num(i.balance) > 0 ? 'Bal ' + esc(fmt(i.balance)) : 'Paid'}</span></button>` })),
      ...(c.payments || []).map((p) => ({ t: p.createdAt, html: `<div class="hist-row" style="cursor:default"><span class="mid"><b>Payment received</b> <span class="small">${esc(fmtDate(p.date))}</span><div class="small">${esc(p.note || '')}</div></span><span style="color:var(--ok);font-weight:700">− ${esc(money(p.amount))}</span><button class="icon-btn sm" type="button" data-act="delPayment" data-id="${esc(c.id)}" data-pid="${esc(p.id)}" aria-label="Remove payment">${I.x}</button></div>` }))
    ].sort((a, b) => b.t - a.t);
    const bal = num(c.balance);
    return `
    <div class="screen"><div class="page with-nav">
      ${topbar('Customer', `<button class="icon-btn" type="button" data-act="editCustomer" data-id="${esc(id)}" aria-label="Edit">${I.edit}</button>`)}
      <div class="stack" style="align-items:center;text-align:center;gap:6px">
        <span class="avatar lg">${esc(initials(c.name))}</span>
        <h2 style="font-size:26px">${esc(c.name)}</h2>
        ${c.mobile ? `<p class="muted">${esc(c.mobile)}</p>` : ''}
        ${c.address ? `<p class="muted small">${esc(c.address)}</p>` : ''}
      </div>
      <div class="grid-2">
        <div class="tile"><span class="lbl">Current due</span><b style="color:${bal > 0 ? 'var(--notice)' : 'var(--ok)'}">${esc(money(Math.max(0, bal)))}</b></div>
        <div class="tile"><span class="lbl">Invoices</span><b>${invs.length}</b></div>
      </div>
      <div class="grid-2">
        <button class="btn" type="button" data-act="invoiceFor" data-id="${esc(id)}">${I.plusS} New invoice</button>
        <button class="btn btn-outline" type="button" data-act="receivePayment" data-id="${esc(id)}">Receive payment</button>
      </div>
      ${c.mobile ? `<button class="btn btn-ghost" type="button" data-act="chatCustomer" data-id="${esc(id)}">${I.chat} Message on WhatsApp</button>` : ''}
      <div class="card" style="gap:0;padding:6px 16px">
        <div class="kv"><span>Opening balance</span><b>${esc(money(c.opening))}</b></div>
        ${events.length ? events.map((e) => e.html).join('') : '<div class="kv"><span>No invoices or payments yet.</span></div>'}
      </div>
      <button class="btn btn-danger" type="button" data-act="deleteCustomer" data-id="${esc(id)}">${I.trash} Delete customer</button>
    </div>${nav('customer')}</div>`;
  };

  VIEWS.customerForm = ({ id, from }) => {
    const c = id ? getCust(id) : null;
    return `
    <div class="screen"><div class="page">
      ${topbar(c ? 'Edit customer' : 'New customer')}
      <form class="card" data-form="customer" data-id="${esc(id || '')}" data-from="${esc(from || '')}" novalidate>
        <div class="field"><label for="c-name">Name</label><input class="input" id="c-name" name="name" value="${esc(c ? c.name : '')}" autocomplete="off" autocapitalize="words" required data-autofocus></div>
        <div class="field"><label for="c-mob">Mobile</label><input class="input" id="c-mob" name="mobile" type="tel" inputmode="tel" placeholder="e.g. 0501234567" value="${esc(c ? c.mobile : '')}" autocomplete="off"><span class="hint">Used to send invoices straight to their WhatsApp.</span></div>
        <div class="field"><label for="c-addr">Address</label><textarea class="textarea" id="c-addr" name="address" style="min-height:76px">${esc(c ? c.address : '')}</textarea></div>
        <div class="field"><label for="c-open">Opening balance (old dues before using this app)</label><input class="input" id="c-open" name="opening" type="number" inputmode="decimal" placeholder="0" value="${c && num(c.opening) ? esc(c.opening) : ''}"></div>
        <div class="error-box" id="form-error" hidden></div>
        <button class="btn" type="submit">Save customer</button>
      </form>
    </div></div>`;
  };

  VIEWS.payment = ({ id }) => {
    const c = getCust(id);
    if (!c) return notFound('Customer');
    return `
    <div class="screen"><div class="page">
      ${topbar('Receive payment')}
      <form class="card" data-form="payment" data-id="${esc(id)}" novalidate>
        <p class="muted">${esc(c.name)} · current due <b>${esc(money(c.balance))}</b></p>
        <div class="field"><label for="p-amt">Amount received</label><input class="input" id="p-amt" name="amount" type="number" inputmode="decimal" value="${num(c.balance) > 0 ? esc(num(c.balance)) : ''}" required data-autofocus></div>
        <div class="field"><label for="p-date">Date</label><input class="input" id="p-date" name="date" type="date" value="${todayIso()}"></div>
        <div class="field"><label for="p-note">Note (cash, card, link…)</label><input class="input" id="p-note" name="note" autocomplete="off"></div>
        <div class="error-box" id="form-error" hidden></div>
        <button class="btn" type="submit">Save payment</button>
      </form>
    </div></div>`;
  };

  /* ---------------- Settings ---------------- */
  function setRow(o) {
    const inner = `<span class="set-ic" style="background:${o.color}">${o.icon}</span>
      <span class="set-tx"><b>${o.title}</b>${o.sub ? `<span>${o.sub}</span>` : ''}</span>${o.right || I.chevron}`;
    return o.tag === 'label' ? `<label class="set-row">${inner}</label>`
      : `<button type="button" class="set-row ${o.danger ? 'danger' : ''}" ${o.attrs || ''}>${inner}</button>`;
  }
  const subPage = (title, intro, icon, color, body, key) => `
    <div class="screen"><div class="page with-nav">
      ${topbar(title)}
      <div class="set-intro"><span class="set-intro-ic" style="background:${color}">${icon}</span><h2>${esc(title)}</h2><p>${intro}</p></div>
      ${body}
    </div>${nav(key)}</div>`;
  const sField = (label, key, o) => { o = o || {}; return `<div class="field"><label>${label}</label>${o.area
    ? `<textarea class="textarea" style="min-height:76px" data-input="setting" data-key="${key}">${esc(db.settings[key])}</textarea>`
    : `<input class="input" ${o.type ? `type="${o.type}"` : ''} ${o.mode ? `inputmode="${o.mode}"` : ''} placeholder="${esc(o.ph || '')}" value="${esc(db.settings[key])}" data-input="setting" data-key="${key}" autocomplete="off">`}${o.hint ? `<span class="hint">${o.hint}</span>` : ''}</div>`; };

  VIEWS.settings = () => `
    <div class="screen"><div class="page with-nav">
      <h1 class="title-lg" style="margin-top:6px">Settings</h1>
      <div class="set-group">
        <button type="button" class="me-row" data-act="nav" data-to="setShop">
          <img class="logo-sm" src="logo.png" alt="">
          <span class="set-tx"><b style="font-size:19px">${esc(db.settings.shopName)}</b><span>${esc(db.settings.tagline)}</span><span data-sync-label>${esc(syncLabel())}</span></span>
          ${I.chevron}
        </button>
      </div>
      <div class="set-group">
        ${setRow({ attrs: 'data-act="nav" data-to="setShop"', icon: I.store, color: '#C98D88', title: 'Shop details', sub: 'Name, contact and Instagram on the invoice' })}
        ${setRow({ attrs: 'data-act="nav" data-to="setPay"', icon: I.card, color: '#2E9E5B', title: 'Invoice &amp; payment', sub: 'Currency, number prefix, payment link, terms' })}
        ${setRow({ attrs: 'data-act="nav" data-to="setItems"', icon: I.list, color: '#E8833A', title: 'Item names', sub: 'Blouse, Kurti, Gown…' })}
        ${setRow({ attrs: 'data-act="nav" data-to="setAddons"', icon: I.tag, color: '#7A4BC2', title: 'Add-ons &amp; prices', sub: 'Stitching, Lining, Lace…' })}
      </div>
      <div class="set-group">
        ${setRow({ attrs: 'data-act="nav" data-to="appearance"', icon: I.moon, color: '#3B3F4A', title: 'Appearance', right: `<span class="set-val">${{ light: 'Light', dark: 'Dark', auto: 'Automatic' }[appearance()]}</span>${I.chevron}` })}
        ${setRow({ tag: 'label', icon: I.haptic, color: '#7A4BC2', title: 'Haptic feedback', sub: 'A light tick when you tap',
          right: `<span class="switch"><input type="checkbox" role="switch" aria-label="Haptic feedback" data-change="haptics" ${Haptics.on() ? 'checked' : ''}><span></span></span>` })}
        ${setRow({ attrs: 'data-act="nav" data-to="setData"', icon: I.db, color: '#2F6FDB', title: 'Data &amp; backup', sub: REMOTE ? 'Google Sheet sync, backup and restore' : 'Backup and restore' })}
        ${!isStandalone() ? setRow({ attrs: 'data-act="nav" data-to="install"', icon: I.addHome, color: '#2F6FDB', title: 'Add to Home Screen' }) : ''}
      </div>
      ${REMOTE ? `<div class="set-group">${setRow({ attrs: 'data-act="signOut"', icon: I.logout, color: '#9B2C2C', title: 'Sign out', danger: true, right: ' ' })}</div>` : ''}
      <p class="small muted center">${esc(CONFIG.appName)} · version ${esc(CONFIG.appVersion || '1.0.0')}</p>
    </div>${nav('settings')}</div>`;

  VIEWS.setShop = () => subPage('Shop details', 'Shown at the top of every invoice. The logo is the Ms. Mannequin logo.', I.store, '#C98D88', `
    <div class="card">
      ${sField('Your name (shown in the greeting)', 'userName')}
      ${sField('Shop name', 'shopName')}${sField('Tagline', 'tagline')}
      <div class="grid-2">${sField('Phone', 'phone', { type: 'tel' })}${sField('Email', 'email', { type: 'email' })}</div>
      ${sField('Address', 'address', { area: true })}
      ${sField('TRN / Tax number (optional)', 'trn')}
      ${sField('Instagram link', 'instagram', { type: 'url', ph: 'https://www.instagram.com/…', hint: 'Shown on every invoice so customers can follow you.' })}
    </div>`, 'setShop');

  VIEWS.setPay = () => subPage('Invoice & payment', 'The payment link adds a Pay button and a QR code to invoices that still have a balance.', I.card, '#2E9E5B', `
    <div class="card">
      <div class="grid-2">${sField('Currency', 'currency')}${sField('Invoice no. prefix', 'prefix', { ph: 'e.g. MM' })}</div>
      ${sField('Payment link', 'payLink', { type: 'url', ph: 'https://…' })}
      ${sField('Payment button text', 'payLabel')}
      ${sField('Country code for WhatsApp', 'countryCode', { mode: 'numeric', ph: '971', hint: 'Added to mobile numbers that start with 0, e.g. 050… becomes 97150…' })}
      ${sField('Terms / footer note', 'terms', { area: true })}
    </div>`, 'setPay');

  VIEWS.setItems = () => subPage('Item names', 'One per line. They appear as suggestions when you type an item name on an invoice.', I.list, '#E8833A', `
    <div class="card"><textarea class="textarea" style="min-height:240px" data-input="catItems" aria-label="Item names">${esc(db.catalog.items.join('\n'))}</textarea></div>`, 'setItems');

  function catAddonRows() {
    return db.catalog.addons.map((a, k) => `<div class="cat-row" data-k="${k}"><input class="input" placeholder="Add-on name" value="${esc(a.name)}" data-input="catAddon" data-f="name"><input class="input price" type="number" inputmode="decimal" placeholder="Price" value="${a.price ? esc(a.price) : ''}" data-input="catAddon" data-f="price"><button class="icon-btn sm" type="button" data-act="delCatAddon" aria-label="Remove">${I.x}</button></div>`).join('');
  }
  VIEWS.setAddons = () => subPage('Add-ons & prices', 'The options you tap on each item. A default price is filled in when you choose one; you can still change it on the invoice.', I.tag, '#7A4BC2', `
    <div class="card"><div class="stack" id="cat-addons" style="gap:8px">${catAddonRows()}</div><button class="btn btn-outline" type="button" data-act="addCatAddon">${I.plusS} Add an add-on</button></div>`, 'setAddons');

  VIEWS.appearance = () => {
    const cur = appearance();
    const opt = (k, title, sub, prev) => `<button type="button" class="look-opt" data-act="setAppearance" data-v="${k}" aria-pressed="${cur === k}">
        <span class="look-prev look-${prev}"><i></i><i></i><i></i></span><b>${title}</b><span class="small muted">${sub}</span><span class="look-tick">${I.check}</span></button>`;
    return subPage('Appearance', 'Choose a light or dark look, or let the app follow your iPhone, for example dark at night.', I.moon, '#3B3F4A', `
      <div class="look-grid">${opt('light', 'Light', 'Always light', 'light')}${opt('dark', 'Dark', 'Easier at night', 'dark')}${opt('auto', 'Automatic', 'Matches your phone', 'auto')}</div>
      <p class="hint">Saved on this phone only. Invoices you share are always light.</p>`, 'appearance');
  };

  VIEWS.setData = () => subPage('Data & backup', REMOTE ? 'Your invoices and customers are saved on this phone and in your Google Sheet.' : 'Your invoices and customers are saved on this phone.', I.db, '#2F6FDB', `
    ${REMOTE ? '' : `<div class="banner soft">${I.cloud}<p>Not connected to a Google Sheet yet, so everything lives on this phone only. Follow SETUP.md to connect it, and use Backup regularly until then.</p></div>`}
    <div class="card" style="gap:0">
      <div class="kv"><span>Invoices</span><b>${liveInvoices().length}</b></div>
      <div class="kv"><span>Customers</span><b>${liveCustomers().length}</b></div>
      <div class="kv"><span>Status</span><b data-sync-label>${esc(syncLabel())}</b></div>
    </div>
    ${REMOTE ? `<button class="btn" type="button" data-act="syncNow">${I.refresh} Sync now</button>` : ''}
    <div class="grid-2">
      <button class="btn btn-outline" type="button" data-act="backup">Backup</button>
      <button class="btn btn-outline" type="button" data-act="restore">Restore</button>
    </div>
    <input type="file" id="restore-file" accept=".json,application/json" hidden data-change="restoreFile">
    <p class="hint">Backup saves a file with all your customers, invoices and settings. Restore replaces what is on this phone with that file.</p>`, 'setData');

  /* ---------------- Haptics (iPhone: a hidden switch gives a real tick) ---------------- */
  const Haptics = {
    on() { return LS.get('mm_haptics') !== false; },
    tick() {
      if (!this.on()) return;
      try {
        if (isIOS()) {
          const ov = document.createElement('label');
          ov.className = 'hap-ov';
          ov.innerHTML = '<input type="checkbox" switch class="haptic-proxy" tabindex="-1">';
          document.body.appendChild(ov);
          ov.querySelector('input').click();
          setTimeout(() => ov.remove(), 60);
        } else if (navigator.vibrate) navigator.vibrate(8);
      } catch (e) { /* no haptics */ }
    }
  };
  const TAPPABLE = 'button, .set-row, .chip, [data-act]';

  /* ---------------- Actions ---------------- */
  const confirmBox = (msg) => window.confirm(msg);
  function fileFromDraft() { draft.items = draft.items.length ? draft.items : [blankItem()]; }
  function cleanItems() {
    return draft.items.filter((it) => String(it.name).trim() || num(it.price) || it.addons.length).map((it) => ({
      name: String(it.name).trim() || 'Item', qty: num(it.qty) || 1, price: num(it.price), note: String(it.note || '').trim(),
      addons: it.addons.filter((a) => String(a.name).trim()).map((a) => ({ name: String(a.name).trim(), price: num(a.price) }))
    }));
  }
  function rememberItemNames(items) {
    const set = new Set(db.catalog.items.map((x) => x.toLowerCase()));
    let add = false;
    items.forEach((it) => { if (it.name !== 'Item' && !set.has(it.name.toLowerCase())) { db.catalog.items.push(it.name); set.add(it.name.toLowerCase()); add = true; } });
    if (add) { db.catalog.updatedAt = Date.now(); db.catalog._d = 1; }
  }
  function openCompose(customerId) {
    if (!draft.editId && draft.items.length === 1 && !draft.items[0].name && !draft.customerId && !draft.advance) draft = newDraft();
    if (customerId) { draft = newDraft(); draft.customerId = customerId; }
    saveDraft();
    go('compose');
  }
  function startEdit(id) {
    const inv = getInv(id);
    if (!inv) return;
    draft = {
      editId: inv.id, createdAt: inv.createdAt, no: inv.no, date: inv.date, delivery: inv.delivery || '', customerId: inv.customerId,
      items: JSON.parse(JSON.stringify(inv.items)).map((it) => Object.assign(blankItem(), it)), discount: Object.assign({ type: 'pct', value: '' }, inv.discount || {}), advance: inv.advance || '', notes: inv.notes || ''
    };
    saveDraft();
    go('compose');
  }
  function saveInvoice() {
    const cust = getCust(draft.customerId);
    if (!cust) { toast('Choose a customer first.'); return; }
    const items = cleanItems();
    if (!items.length) { toast('Add at least one item.'); return; }
    if (!draft.date) { toast('Choose the invoice date.'); return; }
    const now = Date.now();
    let inv = draft.editId ? getInv(draft.editId) : null;
    const isNew = !inv;
    if (isNew) {
      inv = { id: uid(), no: draft.no || genNo(), createdAt: now };
      db.invoices.push(inv);
    }
    Object.assign(inv, {
      date: draft.date, delivery: draft.delivery || '', customerId: cust.id,
      customer: { name: cust.name, mobile: cust.mobile, address: cust.address },
      items, discount: num(draft.discount && draft.discount.value) > 0 ? { type: draft.discount.type === 'flat' ? 'flat' : 'pct', value: num(draft.discount.value) } : { type: 'pct', value: 0 }, advance: num(draft.advance), notes: String(draft.notes || '').trim()
    });
    touch(inv);
    rememberItemNames(items);
    recalcAll();
    persist();
    draft = newDraft();
    saveDraft();
    Share.current = null;
    toast(isNew ? 'Invoice saved.' : 'Invoice updated.');
    if (isNew) go('invoice', { id: inv.id }, true); else back('invoices');
  }
  function removeCustomer(id) {
    const c = getCust(id);
    if (!c) return;
    const n = liveInvoices().filter((i) => i.customerId === id).length;
    if (!confirmBox(n ? `Delete ${c.name}? Their ${n} invoice${n === 1 ? '' : 's'} will stay in your list.` : `Delete ${c.name}?`)) return;
    c.deleted = true; touch(c);
    toast('Customer deleted.');
    back('customers');
  }

  const ACT = {
    nav(el) { go(el.dataset.to, {}, TABS.indexOf(el.dataset.to) >= 0 && TABS.indexOf(state.route.name) >= 0); },
    back() { back(); },
    compose() { openCompose(); },
    startOver() {
      if (draft.editId) { draft = newDraft(); saveDraft(); back('invoices'); return; }
      if (confirmBox('Clear this invoice and start again?')) { draft = newDraft(); saveDraft(); render({ dir: 'fade' }); }
    },
    discType(el) {
      draft.discount = Object.assign({ value: '' }, draft.discount, { type: el.dataset.v === 'flat' ? 'flat' : 'pct' });
      saveDraft();
      document.querySelectorAll('[data-act="discType"]').forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
      paintTotals();
    },
    addItem() { draft.items.push(blankItem()); saveDraft(); render(); const l = document.querySelectorAll('.item-card'); if (l.length) l[l.length - 1].scrollIntoView({ block: 'center' }); },
    delItem(el) { const i = +el.closest('.item-card').dataset.i; draft.items.splice(i, 1); fileFromDraft(); saveDraft(); render(); },
    toggleAddon(el) {
      const it = draft.items[+el.closest('.item-card').dataset.i];
      const name = el.dataset.name;
      const k = it.addons.findIndex((a) => a.name === name);
      if (k >= 0) it.addons.splice(k, 1);
      else { const cat = db.catalog.addons.find((a) => a.name === name); it.addons.push({ name, price: cat && cat.price ? cat.price : '' }); }
      saveDraft(); render();
    },
    customAddon(el) { draft.items[+el.closest('.item-card').dataset.i].addons.push({ name: '', price: '' }); saveDraft(); render(); },
    delAddon(el) { const it = draft.items[+el.closest('.item-card').dataset.i]; it.addons.splice(+el.closest('.addon-row').dataset.j, 1); saveDraft(); render(); },
    newCustomerFromInvoice() { go('customerForm', { from: 'compose' }); },
    saveInvoice,
    openInvoice(el) { go('invoice', { id: el.dataset.id }); },
    editInvoice(el) { startEdit(el.dataset.id); },
    deleteInvoice(el) {
      const inv = getInv(el.dataset.id);
      if (!inv || !confirmBox(`Delete invoice ${inv.no}? This cannot be undone.`)) return;
      inv.deleted = true; touch(inv); recalcAll(); persist();
      if (draft.editId === inv.id) { draft = newDraft(); saveDraft(); }
      Share.current = null;
      toast('Invoice deleted.');
      go('invoices', {}, true);
    },
    retryShare() { Share.failedId = null; render(); },
    async shareFile(el) { try { await Share.send(el.dataset.kind); } catch (e) { showError(e); } },
    newCustomer() { go('customerForm', {}); },
    editCustomer(el) { go('customerForm', { id: el.dataset.id }); },
    openCustomer(el) { go('customer', { id: el.dataset.id }); },
    deleteCustomer(el) { removeCustomer(el.dataset.id); },
    invoiceFor(el) { openCompose(el.dataset.id); },
    receivePayment(el) { go('payment', { id: el.dataset.id }); },
    delPayment(el) {
      const c = getCust(el.dataset.id);
      if (!c || !confirmBox('Remove this payment?')) return;
      c.payments = c.payments.filter((p) => p.id !== el.dataset.pid);
      touch(c); recalcAll(); persist(); render();
    },
    chatCustomer(el) {
      const c = getCust(el.dataset.id);
      if (!c) return;
      const ph = waNumber(c.mobile);
      if (!ph) { toast('Add a valid mobile number first.'); return; }
      window.location.href = 'https://wa.me/' + ph;
    },
    anaRange(el) { state.range = el.dataset.v; const n = document.getElementById('ana'); if (n) n.innerHTML = anaHtml(); },
    topBy(el) { state.topBy = el.dataset.v; const n = document.getElementById('ana'); if (n) n.innerHTML = anaHtml(); },
    invFilter(el) { state.invFilter = el.dataset.v; render({ dir: 'fade' }); },
    async syncNow() { if (!REMOTE) return; const ok = await sync(true); if (ok) toast('Everything is up to date.'); },
    async backup() {
      const data = JSON.stringify({ app: 'msm-invoices', exportedAt: new Date().toISOString(), customers: db.customers, invoices: db.invoices, settings: db.settings, catalog: db.catalog }, null, 1);
      const blob = new Blob([data], { type: 'application/json' });
      const file = new File([blob], 'MsMannequin-backup-' + todayIso() + '.json', { type: 'application/json' });
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Invoice backup' }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      toast('Backup saved to your Downloads.');
    },
    restore() { const f = document.getElementById('restore-file'); if (f) f.click(); },
    signOut() { if (confirmBox('Sign out of the app on this phone?')) signOut(); },
    installDone() { LS.set('mm_install_seen', 1); go('home', {}, true); },
    setAppearance(el) { LS.set('mm_appearance', el.dataset.v); applyAppearance(); render({ dir: 'fade' }); },
    addCatAddon() { db.catalog.addons.push({ name: '', price: 0 }); catTouch(); const b = document.getElementById('cat-addons'); if (b) { b.innerHTML = catAddonRows(); const r = b.querySelectorAll('.cat-row'); r[r.length - 1].querySelector('input').focus(); } },
    delCatAddon(el) { db.catalog.addons.splice(+el.closest('.cat-row').dataset.k, 1); catTouch(); const b = document.getElementById('cat-addons'); if (b) b.innerHTML = catAddonRows(); }
  };
  function catTouch() { db.catalog.updatedAt = Date.now(); db.catalog._d = 1; saveDb(); scheduleSync(); }

  /* ---------------- Forms ---------------- */
  const formError = (msg) => { const e = document.getElementById('form-error'); if (e) { e.textContent = msg; e.hidden = !msg; } };
  const FORMS = {
    async login(form) {
      const input = form.querySelector('.pin-real');
      const pin = String(input.value || '').replace(/\D/g, '');
      if (pin.length !== 4) { formError('Enter your 4-digit passcode.'); return; }
      input.disabled = true; formError('');
      try {
        const j = await api('login', { pin });
        state.token = j.token;
        LS.set('mm_token', j.token);
        state.quote = nextQuote();
        if (!isStandalone() && isIOS() && !LS.get('mm_install_seen')) go('install', {}, true); else go('home', {}, true);
        sync();
      } catch (e) {
        formError(e.message);
        input.disabled = false; input.value = ''; pinPaint(input);
        const w = form.querySelector('.pin-boxes'); if (w) { w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); }
        input.focus();
      }
    },
    customer(form) {
      const f = new FormData(form);
      const name = String(f.get('name') || '').trim();
      if (!name) { formError('Please enter the customer name.'); return; }
      const id = form.dataset.id;
      let c = id ? getCust(id) : null;
      if (!c) { c = { id: uid(), createdAt: Date.now(), payments: [], balance: 0 }; db.customers.push(c); }
      Object.assign(c, { name, mobile: String(f.get('mobile') || '').trim(), address: String(f.get('address') || '').trim(), opening: num(f.get('opening')) });
      touch(c); recalcAll(); persist();
      if (form.dataset.from === 'compose') { draft.customerId = c.id; saveDraft(); toast('Customer added.'); back('compose'); }
      else { toast('Customer saved.'); if (id) back(); else go('customer', { id: c.id }, true); }
    },
    payment(form) {
      const f = new FormData(form);
      const amount = num(f.get('amount'));
      if (amount <= 0) { formError('Enter the amount received.'); return; }
      const c = getCust(form.dataset.id);
      if (!c) return;
      c.payments.push({ id: uid(), amount, date: String(f.get('date') || todayIso()), note: String(f.get('note') || '').trim(), createdAt: Date.now() });
      touch(c); recalcAll(); persist();
      toast('Payment saved.');
      back();
    }
  };

  /* ---------------- Change / input handlers ---------------- */
  const CHANGE = {
    invCust(el) {
      if (el.value === '__new') { el.value = draft.customerId || ''; go('customerForm', { from: 'compose' }); return; }
      draft.customerId = el.value; saveDraft();
      const n = document.getElementById('cust-info'); if (n) n.innerHTML = custInfoHtml();
      paintTotals();
    },
    haptics(el) { LS.set('mm_haptics', !!el.checked); if (el.checked) Haptics.tick(); },
    restoreFile(el) {
      const f = el.files && el.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const j = JSON.parse(r.result);
          if (!j || !Array.isArray(j.customers) || !Array.isArray(j.invoices)) throw new Error('bad');
          if (!confirmBox(`Restore ${j.invoices.length} invoices and ${j.customers.length} customers? This replaces what is on this phone.`)) return;
          const mark = (x) => { x._d = 1; return x; };
          db.customers = j.customers.map(mark); db.invoices = j.invoices.map(mark);
          if (j.settings) { db.settings = Object.assign({}, DEFAULT_SETTINGS, j.settings, { _d: 1, updatedAt: Date.now() }); }
          if (j.catalog && Array.isArray(j.catalog.items)) { db.catalog = Object.assign({}, j.catalog, { _d: 1, updatedAt: Date.now() }); }
          db.customers.forEach((c) => { c.payments = c.payments || []; });
          db.since = 0;
          recalcAll(); persist(); scheduleSync(500);
          toast('Backup restored.');
          render();
        } catch (e) { toast('That file is not a valid backup.'); }
      };
      r.readAsText(f);
      el.value = '';
    }
  };
  const INPUT = {
    invDate(el) { draft.date = el.value; saveDraft(); },
    invDelivery(el) { draft.delivery = el.value; saveDraft(); },
    invAdvance(el) { draft.advance = el.value; saveDraft(); paintTotals(); },
    invDiscount(el) { draft.discount = Object.assign({ type: 'pct' }, draft.discount, { value: el.value }); saveDraft(); paintTotals(); },
    invNotes(el) { draft.notes = el.value; saveDraft(); },
    item(el) {
      const card = el.closest('.item-card');
      const it = draft.items[+card.dataset.i];
      it[el.dataset.f] = el.value;
      saveDraft();
      const lt = card.querySelector('.line-total');
      lt.querySelector('b').textContent = money(lineTotal(it));
      lt.querySelector('.lt-lbl').textContent = lineLbl(it);
      paintTotals();
    },
    addon(el) {
      const card = el.closest('.item-card');
      const it = draft.items[+card.dataset.i];
      it.addons[+el.closest('.addon-row').dataset.j][el.dataset.f] = el.value;
      saveDraft();
      card.querySelector('.line-total b').textContent = money(lineTotal(it));
      paintTotals();
    },
    setting(el) {
      const k = el.dataset.key;
      db.settings[k] = el.value;
      db.settings.updatedAt = Date.now(); db.settings._d = 1;
      if (k === 'prefix' && !draft.editId) { draft.no = null; saveDraft(); }
      saveDb(); scheduleSync();
    },
    catItems(el) {
      db.catalog.items = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      catTouch();
    },
    catAddon(el) {
      const a = db.catalog.addons[+el.closest('.cat-row').dataset.k];
      a[el.dataset.f] = el.dataset.f === 'price' ? num(el.value) : el.value;
      catTouch();
    },
    invSearch(el) { state.invQ = el.value; const l = document.getElementById('inv-list'); if (l) l.innerHTML = invoiceListHtml(); },
    custSearch(el) { state.custQ = el.value; const l = document.getElementById('cust-list'); if (l) l.innerHTML = customerListHtml(); }
  };

  function pinPaint(input) {
    const boxes = input.closest('.pin-wrap').querySelectorAll('.pin-box');
    const n = input.value.length;
    boxes.forEach((b, i) => { b.classList.toggle('filled', i < n); b.classList.toggle('on', document.activeElement === input && i === Math.min(n, 3)); });
  }
  document.addEventListener('focusin', (e) => { if (e.target.classList && e.target.classList.contains('pin-real')) pinPaint(e.target); });
  document.addEventListener('focusout', (e) => { if (e.target.classList && e.target.classList.contains('pin-real')) pinPaint(e.target); });

  /* ---------------- Event wiring ---------------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el && app.contains(el) || (el && el.closest('#app'))) {
      if (el.disabled) return;
      const fn = ACT[el.dataset.act];
      if (fn) { Haptics.tick(); try { fn(el, e); } catch (err) { showError(err); } }
    }
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    const fn = FORMS[form.dataset.form];
    if (fn) { Haptics.tick(); fn(form); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && CHANGE[el.dataset.change]) CHANGE[el.dataset.change](el);
  });
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList && t.classList.contains('pin-real')) {
      t.value = t.value.replace(/\D/g, '').slice(0, 4);
      pinPaint(t);
      if (t.value.length === 4) { Haptics.tick(); setTimeout(() => { const f = t.closest('form'); if (f && t.value.length === 4) FORMS.login(f); }, 120); }
    }
    const el = t.closest && t.closest('[data-input]');
    if (el && INPUT[el.dataset.input]) INPUT[el.dataset.input](el);
  });

  // The app is portrait-only and does not zoom
  ['gesturestart', 'gesturechange'].forEach((n) => document.addEventListener(n, (e) => e.preventDefault()));
  const rotate = document.createElement('div');
  rotate.id = 'rotate-note';
  rotate.innerHTML = '<div><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="3" width="10" height="18" rx="2"/></svg><span>Please turn your phone upright</span></div>';
  document.body.appendChild(rotate);

  /* ---------------- Start ---------------- */
  applyAppearance();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* ignore */ }
  recalcAll();
  persist();
  state.quote = nextQuote();

  let first = REMOTE && !state.token ? 'login' : 'home';
  if (first === 'home' && isIOS() && !isStandalone() && !LS.get('mm_install_seen')) first = 'install';
  state.route = { name: first, params: {} };
  history.replaceState({ name: first, params: {} }, '');
  render();

  /* Pull down on any screen to sync with the Google Sheet */
  (function pullToRefresh() {
    const el = document.createElement('div');
    el.id = 'ptr';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
    let y0 = null, pull = 0, busy = false;
    const LIMIT = 64;
    const show = (p) => { el.style.transform = `translateY(${Math.min(p, 90) - 54}px)`; el.style.opacity = String(Math.min(1, p / LIMIT)); };
    const reset = () => { el.classList.remove('drag', 'on'); el.style.transform = ''; el.style.opacity = ''; pull = 0; };
    document.addEventListener('touchstart', (e) => {
      const t = e.target;
      y0 = (!busy && e.touches.length === 1 && window.scrollY <= 0 && !state.editing && !(t.closest && t.closest('input, textarea, select'))) ? e.touches[0].clientY : null;
      pull = 0;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy <= 0 || window.scrollY > 0) { if (pull) reset(); return; }
      pull = dy * 0.5;
      el.classList.add('drag');
      show(pull);
    }, { passive: true });
    const end = async () => {
      if (y0 === null) return;
      y0 = null;
      el.classList.remove('drag');
      if (pull < LIMIT) { reset(); return; }
      busy = true;
      el.classList.add('on');
      show(LIMIT);
      try {
        if (REMOTE) {
          while (state.syncing) await new Promise((r) => setTimeout(r, 150));
          const ok = await sync(true);
          if (ok) toast('Everything is up to date.');
        } else { render(); }
      } catch (e) { /* sync reports its own errors */ }
      busy = false;
      reset();
    };
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', () => { y0 = null; reset(); }, { passive: true });
  })();
  sync();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { sync(); } else persist(); });
  window.addEventListener('pagehide', persist);
  window.addEventListener('online', () => sync());
  setInterval(() => { if (!document.hidden) sync(); }, 120000);
})();
