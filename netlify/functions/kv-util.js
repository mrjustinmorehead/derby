
// Derby KV utilities on Netlify Blobs
const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');
const store = getStore('derby-squares', { consistency: 'strong' });

const envPrice = parseFloat(process.env.PRICE_PER_SQUARE || '5');
const envGrid = parseInt(process.env.GRID_SIZE || '20', 10);
const envHold = parseInt(process.env.HOLD_MINUTES || '10', 10);

// Basic store helpers
async function getJSON(key, fallback) {
  try {
    const val = await store.get(key, { type: 'json' });
    return (val === undefined || val === null) ? fallback : val;
  } catch {
    return fallback;
  }
}
async function setJSON(key, val) { await store.set(key, JSON.stringify(val)); }
async function getText(key, fallback=null) {
  const val = await store.get(key);
  return (val === undefined || val === null) ? (fallback ?? null) : val;
}
async function setText(key, val) { await store.set(key, String(val)); }

function nowISO() { return new Date().toISOString(); }
function addMinutes(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}
function squareId(row, col) { return `${row}-${col}`; }

function createEmptyGrid(size, price) {
  const grid = [];
  for (let r = 1; r <= size; r++) {
    for (let c = 1; c <= size; c++) {
      const isDiag = r === c;
      grid.push({
        id: squareId(r, c), row: r, col: c,
        status: isDiag ? 'blocked' : 'available',
        price, purchaserName: null, email: null, orderId: null, holdExpiresAt: null
      });
    }
  }
  return grid;
}

function computeJackpots(grid, price) {
  const purchasableStatuses = new Set(['available','held','paid']);
  const possibleCount = grid.filter(s => purchasableStatuses.has(s.status)).length;
  const paidCount = grid.filter(s => s.status === 'paid').length;
  const possible = possibleCount * price;
  const current = paidCount * price;
  return { possible, current, grand: Math.floor(current * 0.9), runner: current - Math.floor(current * 0.9) };
}

// Admin auth: supports plaintext ADMIN_KEY or ADMIN_KEY_SHA256
function sha256(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function isAdmin(event) {
  const hdr = (event.headers['x-admin-key'] || event.headers['X-Admin-Key'] || '').trim();
  if (!hdr) return false;
  const keySha = process.env.ADMIN_KEY_SHA256;
  if (keySha) return sha256(hdr) === keySha;
  const key = process.env.ADMIN_KEY;
  return !!key && hdr === key;
}
function requireAdmin(event) {
  if (!isAdmin(event)) return { statusCode: 403, body: 'Forbidden' };
  return null;
}

// Idempotency helpers
async function idempotencyGet(key) { return await getJSON(`idemp:${key}`, null); }
async function idempotencySet(key, value) { await setJSON(`idemp:${key}`, { ts: nowISO(), value }); }

// Simple retry wrapper for read-modify-write
async function withRetry(fn, times=3, delayMs=60) {
  let lastErr;
  for (let i=0;i<times;i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r=>setTimeout(r, delayMs)); }
  }
  throw lastErr;
}

async function ensureInitialized() {
  // numeric settings (prefer stored, fall back to env)
  let pricePerSquare = Number(await getJSON('pricePerSquare', envPrice));
  let gridSize = Number(await getJSON('gridSize', envGrid));
  let holdMinutes = Number(await getJSON('holdMinutes', envHold));

  let grid = await getJSON('grid', null);
  if (!Array.isArray(grid) || !grid.length) {
    grid = createEmptyGrid(gridSize, pricePerSquare);
    await setJSON('grid', grid);
  }
  let horses = await getJSON('horses', null);
  if (!Array.isArray(horses) || horses.length !== gridSize) {
    horses = Array.from({ length: gridSize }, (_, i) => `${i + 1}`);
    await setJSON('horses', horses);
  }
  const horsesLocked = Boolean(await getJSON('horsesLocked', false));

  const jp = computeJackpots(grid, pricePerSquare);
  await setJSON('jackpot', jp);

  if (!await getJSON('potHistory', null)) {
    await setJSON('potHistory', [{ ts: nowISO(), paidCount: grid.filter(s => s.status === 'paid').length }]);
  }
  if (!await getJSON('adminLog', null)) {
    await setJSON('adminLog', []);
  }
  return { grid, gridSize, pricePerSquare, holdMinutes, horses, horsesLocked };
}

async function addAdminLog(type, details) {
  const log = await getJSON('adminLog', []);
  log.unshift({ ts: nowISO(), type, details });
  await setJSON('adminLog', log.slice(0, 500));
}

async function releaseExpired(grid) {
  const now = nowISO();
  let changed = false;
  for (const s of grid) {
    if (s.status === 'held' && s.holdExpiresAt && new Date(s.holdExpiresAt) < new Date(now)) {
      s.status = 'available';
      s.purchaserName = null;
      s.email = null;
      s.orderId = null;
      s.holdExpiresAt = null;
      changed = true;
    }
  }
  return changed;
}

async function saveGridAndJackpot(grid, pricePerSquare) {
  await setJSON('grid', grid);
  const jp = computeJackpots(grid, pricePerSquare);
  await setJSON('jackpot', jp);
  const history = await getJSON('potHistory', []);
  const paidCount = grid.filter(s => s.status === 'paid').length;
  if (!history.length || history[0].paidCount !== paidCount) {
    history.unshift({ ts: nowISO(), paidCount });
    await setJSON('potHistory', history.slice(0, 500));
  }
}


// --- Idempotency helpers ---
async function getIdem(op, key) {
  if (!key) return null;
  return await getJSON(`idem:${op}:${key}`, null);
}
async function setIdem(op, key, value) {
  if (!key) return;
  await setJSON(`idem:${op}:${key}`, { at: nowISO(), value });
}
module.exports = {
  getJSON, setJSON, getText, setText,
  ensureInitialized, addAdminLog, requireAdmin, isAdmin,
  nowISO, addMinutes, saveGridAndJackpot, releaseExpired, squareId, getIdem, setIdem,
  withRetry, idempotencyGet, idempotencySet
};
