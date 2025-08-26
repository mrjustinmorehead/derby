// full Derby-branded KV utility
const kv = require('@netlify/kv');

const envPrice = parseFloat(process.env.PRICE_PER_SQUARE || '5');
const envGrid = parseInt(process.env.GRID_SIZE || '20', 10);
const envHold = parseInt(process.env.HOLD_MINUTES || '10', 10);

async function getJSON(key, fallback) {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}
async function setJSON(key, val) { await kv.set(key, JSON.stringify(val)); }

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

async function ensureInitialized() {
  let pricePerSquare = parseFloat(await kv.get('pricePerSquare')) || envPrice;
  let gridSize = parseInt(await kv.get('gridSize')) || envGrid;
  let grid = await getJSON('grid', null);
  if (!grid) {
    grid = createEmptyGrid(gridSize, pricePerSquare);
    await setJSON('grid', grid);
  }
  let horses = await getJSON('horses', null);
  if (!horses || horses.length !== gridSize) {
    horses = Array.from({ length: gridSize }, (_, i) => `${i + 1}`);
    await setJSON('horses', horses);
  }
  const horsesLocked = (await kv.get('horsesLocked')) === 'true';
  const jp = computeJackpots(grid, pricePerSquare);
  await setJSON('jackpot', jp);
  if (!(await kv.get('potHistory'))) {
    await setJSON('potHistory', [{ ts: nowISO(), paidCount: grid.filter(s => s.status === 'paid').length }]);
  }
  if (!(await kv.get('adminLog'))) await setJSON('adminLog', []);
  return { grid, gridSize, pricePerSquare, horses, horsesLocked };
}

async function addAdminLog(type, details) {
  const log = await getJSON('adminLog', []);
  log.unshift({ ts: nowISO(), type, details });
  await setJSON('adminLog', log.slice(0, 200));
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

module.exports = {
  getJSON, setJSON, ensureInitialized, addAdminLog,
  nowISO, addMinutes, saveGridAndJackpot, releaseExpired, squareId
};
