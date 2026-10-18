/**
 * Ms. Mannequin Invoices - backend (Google Apps Script + Google Sheet)
 * Paste this whole file into the Apps Script editor of your Google Sheet (Extensions > Apps Script).
 * Steps are in SETUP.md. Change SETUP_PIN below BEFORE running setup().
 */
const SETUP_PIN = '1234';            // your 4-digit sign-in PIN (used when you run setup)
const SESSION_DAYS = 30;
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 600;

const SH_CUSTOMERS = 'Customers';
const SH_INVOICES = 'Invoices';
const SH_SETTINGS = 'Settings';
const SH_SESSIONS = 'Sessions';

const COLS = {
  Customers: ['ID', 'Name', 'Mobile', 'Address', 'Opening Balance', 'Balance Due', 'Payments', 'Updated', 'Server Time', 'Deleted', 'Data'],
  Invoices: ['ID', 'Invoice No', 'Date', 'Delivery Date', 'Customer ID', 'Customer', 'Mobile', 'Items', 'Amount', 'Previous Balance', 'Total', 'Advance Paid', 'Balance', 'Notes', 'Created', 'Updated', 'Server Time', 'Deleted', 'Data'],
  Settings: ['Key', 'Value', 'Updated', 'Server Time'],
  Sessions: ['Token Hash', 'Expires']
};

/* Run this once from the editor (select setup, press Run). Safe to run again, e.g. to change the PIN. */
function setup() {
  Object.keys(COLS).forEach(function (n) { table_(n); });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SALT')) props.setProperty('SALT', Utilities.getUuid() + Utilities.getUuid());
  if (!/^\d{4}$/.test(SETUP_PIN)) throw new Error('SETUP_PIN must be exactly 4 digits.');
  props.setProperty('PIN_HASH', hashPin_(SETUP_PIN));
  const s = SpreadsheetApp.getActive().getSheetByName(SH_SESSIONS);
  if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);   // signs everyone out
  Logger.log('Setup complete. PIN is set. Now deploy as a Web app (see SETUP.md).');
}

function doGet() { return out({ ok: true, app: 'Ms. Mannequin Invoices' }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents || '{}');
    if (req.action === 'login') return out(login_(req));
    const sess = auth_(req.token);
    if (!sess) return fail_('SESSION_EXPIRED');
    if (req.action === 'logout') { revoke_(req.token); return out({ ok: true }); }
    if (req.action === 'sync') return out(withLock_(function () { return sync_(req); }));
    return fail_('Unknown action.');
  } catch (err) {
    return fail_('Server error: ' + err.message);
  }
}

/* ---------- sign in ---------- */
function login_(req) {
  const cache = CacheService.getScriptCache();
  const tries = Number(cache.get('tries') || 0);
  if (tries >= MAX_PIN_ATTEMPTS) return { ok: false, error: 'Too many wrong attempts. Try again in 10 minutes.' };
  const pin = String(req.pin || '');
  const stored = PropertiesService.getScriptProperties().getProperty('PIN_HASH');
  if (!stored) return { ok: false, error: 'Setup has not been run yet. See SETUP.md.' };
  if (!/^\d{4}$/.test(pin) || hashPin_(pin) !== stored) {
    cache.put('tries', String(tries + 1), LOCKOUT_SECONDS);
    return { ok: false, error: 'Wrong PIN.' };
  }
  cache.remove('tries');
  const token = 'sess_' + Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const s = table_(SH_SESSIONS);
  s.appendRow([hashPin_(token), Date.now() + SESSION_DAYS * 86400000]);
  return { ok: true, token: token };
}
function auth_(token) {
  if (!token || String(token).indexOf('sess_') !== 0) return null;
  const h = hashPin_(token);
  const s = table_(SH_SESSIONS);
  const n = s.getLastRow() - 1;
  if (n < 1) return null;
  const v = s.getRange(2, 1, n, 2).getValues();
  for (let i = 0; i < v.length; i++) if (v[i][0] === h && Number(v[i][1]) > Date.now()) return true;
  return null;
}
function revoke_(token) {
  const h = hashPin_(token);
  const s = table_(SH_SESSIONS);
  const n = s.getLastRow() - 1;
  if (n < 1) return;
  const v = s.getRange(2, 1, n, 1).getValues();
  for (let i = v.length - 1; i >= 0; i--) if (v[i][0] === h) s.deleteRow(i + 2);
}
function hashPin_(text) {
  const salt = PropertiesService.getScriptProperties().getProperty('SALT') || '';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + text);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/* ---------- sync ----------
 * The phone sends the records it changed; the server keeps the newest version of each (by the phone's
 * "updatedAt") and returns everything that changed in the sheet since the phone's last sync. */
function sync_(req) {
  const push = req.push || {};
  const since = Number(req.since || 0);
  const now = Date.now();
  upsert_(SH_CUSTOMERS, push.customers || [], now, customerRow_);
  upsert_(SH_INVOICES, push.invoices || [], now, invoiceRow_);
  if (push.settings) kv_('shop', push.settings, now);
  if (push.catalog) kv_('catalog', push.catalog, now);
  return {
    ok: true, now: now,
    customers: changed_(SH_CUSTOMERS, since, 10),
    invoices: changed_(SH_INVOICES, since, 18),
    settings: kvGet_('shop', since),
    catalog: kvGet_('catalog', since)
  };
}
function customerRow_(r, now) {
  const pay = JSON.stringify(r.payments || []);
  return [r.id, r.name || '', r.mobile || '', r.address || '', Number(r.opening) || 0, Number(r.balance) || 0, pay, Number(r.updatedAt) || 0, now, r.deleted ? 1 : '', JSON.stringify(r)];
}
function invoiceRow_(r, now) {
  const c = r.customer || {};
  const items = (r.items || []).map(function (it) {
    return it.name + ' x' + it.qty + (it.addons && it.addons.length ? ' (' + it.addons.map(function (a) { return a.name + (a.price ? ' ' + a.price : ''); }).join(', ') + ')' : '');
  }).join('; ');
  return [r.id, r.no || '', r.date || '', r.delivery || '', r.customerId || '', c.name || '', c.mobile || '', items,
    Number(r.subtotal) || 0, Number(r.prevBalance) || 0, Number(r.total) || 0, Number(r.advance) || 0, Number(r.balance) || 0, r.notes || '',
    Number(r.createdAt) || 0, Number(r.updatedAt) || 0, now, r.deleted ? 1 : '', JSON.stringify(r)];
}
function upsert_(name, records, now, rowFn) {
  if (!records.length) return;
  const sh = table_(name);
  const width = COLS[name].length;
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
  const upIdx = COLS[name].indexOf('Updated');
  const index = {};
  rows.forEach(function (r, i) { index[r[0]] = i; });
  const appended = [];
  records.forEach(function (r) {
    if (!r || !r.id) return;
    const row = rowFn(r, now);
    if (index.hasOwnProperty(r.id)) {
      const i = index[r.id];
      if (Number(rows[i][upIdx]) > (Number(r.updatedAt) || 0)) return;      // the sheet already has a newer edit
      rows[i] = row;
      sh.getRange(i + 2, 1, 1, width).setValues([row]);
    } else { index[r.id] = rows.length + appended.length; appended.push(row); }
  });
  if (appended.length) sh.getRange(sh.getLastRow() + 1, 1, appended.length, width).setValues(appended);
}
function changed_(name, since, tsCol) {
  const sh = table_(name);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const width = COLS[name].length;
  const rows = sh.getRange(2, 1, n, width).getValues();
  const ts = COLS[name].indexOf('Server Time');
  const data = width - 1;
  const outRows = [];
  rows.forEach(function (r) {
    if (Number(r[ts]) > since && r[data]) {
      try { const o = JSON.parse(r[data]); if (r[COLS[name].indexOf('Deleted')]) o.deleted = true; outRows.push(o); } catch (e) { /* skip bad row */ }
    }
  });
  return outRows;
}
function kv_(key, obj, now) {
  const sh = table_(SH_SETTINGS);
  const n = sh.getLastRow() - 1;
  const keys = n > 0 ? sh.getRange(2, 1, n, 1).getValues() : [];
  const row = [key, JSON.stringify(obj), Number(obj.updatedAt) || 0, now];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i][0] === key) {
      const cur = Number(sh.getRange(i + 2, 3).getValue()) || 0;
      if (cur > row[2]) return;
      sh.getRange(i + 2, 1, 1, 4).setValues([row]);
      return;
    }
  }
  sh.appendRow(row);
}
function kvGet_(key, since) {
  const sh = table_(SH_SETTINGS);
  const n = sh.getLastRow() - 1;
  if (n < 1) return null;
  const v = sh.getRange(2, 1, n, 4).getValues();
  for (let i = 0; i < v.length; i++) {
    if (v[i][0] === key && Number(v[i][3]) > since) { try { return JSON.parse(v[i][1]); } catch (e) { return null; } }
  }
  return null;
}

/* ---------- helpers ---------- */
function table_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  const cols = COLS[name];
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    const have = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), cols.length)).getValues()[0];
    cols.forEach(function (c, i) { if (have[i] !== c && !have[i]) sh.getRange(1, i + 1).setValue(c).setFontWeight('bold'); });
  }
  return sh;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function fail_(msg) { return out({ ok: false, error: msg }); }
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
