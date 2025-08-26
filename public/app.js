
let state = {
  gridSize: 0,
  pricePerSquare: 0,
  holdMinutes: 10,
  squares: [],
  horses: [],
  horsesLocked: false,
  jackpot: { possible: 0, current: 0, grand: 0, runner: 0 },
  adminLog: [],
};
let selected = new Set();
let uiFilter = 'all';
let lastAdjustPreview = null;
let lastScratchPreview = null;
let filters = { available: true, held: true, paid: true, blocked: true, scratched: true };

const $ = (sel) => document.querySelector(sel);
const gridEl = $('#grid');
const horsesEl = $('#horses');
const potEl = $('#pot');
const statusEl = $('#status');
const summaryEl = $('#summary');
const adminPanel = $('#adminPanel');
const adminOutput = $('#adminOutput');
const adminLogEl = $('#adminLog');
const lockBtn = $('#lockBtn');
const nameInput = $('#name');
const emailInput = $('#email');

const cfgPrice = $('#cfgPrice');
const cfgHold = $('#cfgHold');

function dollars(n) { return `$${(n||0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function idFor(r,c){ return `${r}-${c}`; }

async function api(path, init={}) {
  const res = await fetch(path, init);
  const ct = res.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch {}
  } else {
    data = await res.text();
  }
  return { ok: res.ok, status: res.status, data };
}

function setStatusCard(msg, kind='ok'){ const el = document.getElementById('inlineStatus'); el.className = 'status-card ' + (kind||'ok'); el.textContent = msg || ''; }
function setStatus(msg) {
  statusEl.textContent = msg;
  if (msg) console.log('[status]', msg);
}

// Jackpot
function renderPot() {
  const jp = state.jackpot || {};
  potEl.textContent = `Grand: ${dollars(jp.grand)} • Runner-up: ${dollars(jp.runner)} • Current: ${dollars(jp.current)} / Possible: ${dollars(jp.possible)}`;
}

// Horses
function renderHorses() {
  horsesEl.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (let i = 1; i <= state.gridSize; i++) {
    const div = document.createElement('div');
    div.textContent = `${i}. ${state.horses[i-1] || i}`;
    frag.appendChild(div);
  }
  horsesEl.appendChild(frag);
}

// Filters
['Available','Held','Paid','Blocked','Scratched'].forEach(k => {
  const el = document.getElementById('filter'+k);
  el?.addEventListener('change', () => {
    filters[k.toLowerCase()] = el.checked;
    renderGrid();
  });
});

// Grid
function timeLeftFor(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '0:00';
  const sec = Math.floor(ms/1000);
  const m = Math.floor(sec/60);
  const s = (sec % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
}

function renderGrid() {
  gridEl.innerHTML = '';
  gridEl.style.gridTemplateColumns = `repeat(${state.gridSize}, 44px)`;
  const frag = document.createDocumentFragment();
  for (const s of state.squares) {
    if (uiFilter !== 'all' && s.status !== uiFilter) continue;
    if (!filters[s.status]) continue;
    const el = document.createElement('div'); el.setAttribute('role','button'); el.setAttribute('tabindex','0'); el.setAttribute('aria-label', `Square ${s.row} by ${s.col} ${s.status}`);
    el.className = `square ${s.status}` + (selected.has(s.id) ? ' selected' : '');
    el.dataset.id = s.id;
    const diag = (s.row === s.col);
    const rowLabel = state.horses[s.row-1] || s.row; const colLabel = state.horses[s.col-1] || s.col; el.title = `Row ${s.row} (${rowLabel}) × Col ${s.col} (${colLabel}) – ${s.status}` + (s.purchaserName ? ` (${s.purchaserName})` : '');
    el.setAttribute('role', 'gridcell');
    el.setAttribute('aria-label', `Row ${s.row} (${state.horses[s.row-1]||s.row}), Column ${s.col} (${state.horses[s.col-1]||s.col}), Status ${s.status}`);
    if (diag) el.textContent = '×';
    // held countdown
    if (s.status === 'held' && s.holdExpiresAt) {
      const timeLeft = Math.max(0, (new Date(s.holdExpiresAt).getTime() - Date.now())/1000|0);
      el.textContent = timeLeft > 0 ? timeLeft + 's' : '0s';
    }
    el.addEventListener('click', () => {
      if (['available'].includes(s.status)) {
        if (selected.has(s.id)) selected.delete(s.id); else selected.add(s.id);
        renderGrid();
        renderSummary();
      }
    });
    frag.appendChild(el);
  }
  gridEl.appendChild(frag);
}

function renderSummary() {
  const count = selected.size;
  const total = count * (state.pricePerSquare || 0);
  summaryEl.textContent = count ? `${count} selected → ${dollars(total)}` : 'No squares selected.';
}

// Data
async function fetchState() {
  const res = await api('/api/list-squares');
  if (!res.ok) { setStatus('Failed to load state'); return; }
  const data = res.data || {};
  state.gridSize = data.gridSize;
  state.pricePerSquare = data.pricePerSquare;
  state.squares = data.squares || [];
  state.horses = data.horses || [];
  state.horsesLocked = !!data.horsesLocked;
  state.jackpot = data.jackpot || {};
  state.adminLog = data.adminLog || [];
  renderPot();
  renderHorses();
  renderGrid();
  renderAdminLog(state.adminLog);
  cfgPrice.value = state.pricePerSquare;
  cfgHold.value = data.holdMinutes || 10;
}

// Hold & Pay
$('#lockBtn').addEventListener('click', async () => {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  if (!name || !email) { setStatus('Please enter your name and email.'); return; }
  if (!selected.size) { setStatus('Select at least one square.'); return; }

  const squares = Array.from(selected).map(id => {
    const [r,c] = id.split('-').map(Number);
    return { row: r, col: c };
  });

  setStatusCard('Holding selected squares…');
  const res = await api('/api/lock-squares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': cryptoRandom() },
    body: JSON.stringify({ squares, name, email }),
  });
  if (!res.ok) {
    setStatus(res.data && res.data.message ? res.data.message : 'Unable to hold squares.');
    await fetchState();
  wireFilters();
    return;
  }
  setStatusCard('Held. Proceed to PayPal to complete payment.');
  selected.clear();
  await fetchState();
  wireFilters();
  renderPayPal();
});

function renderPayPal() {
  const container = document.getElementById('paypal-button-container');
  container.innerHTML = '';
  if (!window.paypal) {
    const p = document.createElement('p');
    p.textContent = 'PayPal SDK not loaded.';
    container.appendChild(p);
    return;
  }
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  window.paypal.Buttons({
    createOrder: async () => {
      const res = await api('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': cryptoRandom() },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) { throw new Error(res.data && res.data.error || 'Order creation failed'); }
      return res.data.orderID;
    },
    onApprove: async (data) => {
      const res = await api('/api/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': cryptoRandom() },
        body: JSON.stringify({ orderID: data.orderID, name, email }),
      });
      if (!res.ok) { setStatus('Payment capture failed'); return; }
      setStatusCard('Payment complete!');
      await fetchState();
  wireFilters();
    },
    onError: (err) => {
      console.error(err);
      setStatus('PayPal error – see console.');
    }
  }).render('#paypal-button-container');
}

// Admin
function showAdmin() {
  // Admin panel visibility toggled by session check
  checkAdminSession().then(isAdmin => { adminPanel.hidden = !isAdmin; });
}

function renderAdminLog(log) {
  adminLogEl.textContent = (log || []).map(e => `${e.ts} – ${e.type} – ${JSON.stringify(e.details)}`).join('\\n');
}

(function wireAdmin() {
  const assignHorsesBtn = document.getElementById('assignHorsesBtn');
  const forceAssign = document.getElementById('forceAssign');
  const lockHorsesBtn = document.getElementById('lockHorsesBtn');
  const unlockHorsesBtn = document.getElementById('unlockHorsesBtn');
  const adjustCountPreviewBtn = document.getElementById('adjustCountPreviewBtn');
  const applyAdjustCountBtn = document.getElementById('applyAdjustCountBtn');
  const scratchInput = document.getElementById('scratchInput');
  const scratchPreviewBtn = document.getElementById('scratchPreviewBtn');
  const scratchApplyBtn = document.getElementById('scratchApplyBtn');
  const horseNames = document.getElementById('horseNames');
  const setHorsesBtn = document.getElementById('setHorsesBtn');
  const backupBtn = document.getElementById('backupBtn');
  const restoreFile = document.getElementById('restoreFile');
  const restoreBtn = document.getElementById('restoreBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const healthBtn = document.getElementById('healthBtn');
  const saveConfigBtn = document.getElementById('saveConfigBtn');

  assignHorsesBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-assign-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ force: !!forceAssign.checked }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    await fetchState();
  wireFilters();
  });

  lockHorsesBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const { data } = await api('/api/admin-set-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ horses: state.horses, lock: true }),
    });
    adminOutput.textContent = JSON.stringify(data, null, 2);
    await fetchState();
  wireFilters();
  });

  unlockHorsesBtn.addEventListener('click', async () => {
    if (!confirm('Unlock horse assignments?')) return;
    const k = adminKey(); if (!k) return;
    const { data } = await api('/api/admin-set-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ horses: state.horses, lock: false }),
    });
    adminOutput.textContent = JSON.stringify(data, null, 2);
    await fetchState();
  wireFilters();
  });

  adjustCountPreviewBtn.addEventListener('click', async () => {
    const newCount = parseInt(prompt('New total horses (<= current):'), 10);
    if (!newCount) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-adjust-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ newCount, preview: true }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    if (res.ok) { lastAdjustPreview = { newCount, data: res.data }; applyAdjustCountBtn.disabled = false; }
  });

  applyAdjustCountBtn.addEventListener('click', async () => {
    if (!lastAdjustPreview) { setStatus('Run preview first.'); return; }
    if (!confirm(`Apply adjust to ${lastAdjustPreview.newCount}? This will remove rows/cols ${lastAdjustPreview.data.removedRowsCols.join(', ')}`)) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-adjust-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ newCount: lastAdjustPreview.newCount, preview: false }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    applyAdjustCountBtn.disabled = true;
    lastAdjustPreview = null;
    await fetchState();
  wireFilters();
  });

  scratchPreviewBtn.addEventListener('click', async () => {
    const horse = parseInt(scratchInput.value.trim(), 10);
    if (!horse) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-scratch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ horse, preview: true }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    if (res.ok) { lastScratchPreview = { horse, data: res.data }; scratchApplyBtn.disabled = false; }
  });

  scratchApplyBtn.addEventListener('click', async () => {
    if (!lastScratchPreview) { setStatus('Run scratch preview first.'); return; }
    if (!confirm(`Scratch horse ${lastScratchPreview.horse}?`)) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-scratch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ horse: lastScratchPreview.horse, preview: false }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    scratchApplyBtn.disabled = true;
    lastScratchPreview = null;
    await fetchState();
  wireFilters();
  });

  setHorsesBtn.addEventListener('click', async () => {
    const labels = horseNames.value.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (labels.length !== state.gridSize) { setStatus(`Need exactly ${state.gridSize} labels`); return; }
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-set-horses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ horses: labels }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    await fetchState();
  wireFilters();
  });

  backupBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const res = await fetch('/api/admin-backup', { headers: {  } });
    if (!res.ok) { setStatus('Backup failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `derby-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  exportCsvBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const url = '/api/export-squares?type=csv';
    const res = await fetch(url, { headers: {  } });
    const blob = await res.blob();
    const link = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = link; a.download = 'paid-squares.csv'; a.click();
    URL.revokeObjectURL(link);
  });

  exportJsonBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const url = '/api/export-squares?type=json';
    const res = await fetch(url, { headers: {  } });
    const text = await res.text();
    adminOutput.textContent = text;
  });

  restoreBtn.addEventListener('click', async () => {
    const file = document.getElementById('restoreFile').files[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    if (!confirm('Restore from this file? This will overwrite current state.')) return;
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ confirm: true, data }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    await fetchState();
  wireFilters();
  });

  healthBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const res = await api('/api/admin-health', { headers: {  } });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
  });

  saveConfigBtn.addEventListener('click', async () => {
    const k = adminKey(); if (!k) return;
    const pricePerSquare = parseFloat(cfgPrice.value);
    const holdMinutes = parseInt(cfgHold.value, 10);
    const res = await api('/api/admin-set-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idemKey('hold') },
      body: JSON.stringify({ pricePerSquare, holdMinutes }),
    });
    adminOutput.textContent = JSON.stringify(res.data, null, 2);
    await fetchState();
  wireFilters();
  });
})();

function cryptoRandom() {
  // quick 16-byte hex string
  const arr = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
}

function showQR() {
  const url = location.origin + location.pathname;
  const img = document.getElementById('qr');
  img.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(url)}`;
}

setInterval(() => {
  // update held countdowns every second
  const held = state.squares.filter(s => s.status === 'held' && s.holdExpiresAt);
  if (held.length) renderGrid();
}, 1000);


// --- Admin Auth & Config ---
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminSecretInput = document.getElementById('adminSecret');
const adminAuthStatus = document.getElementById('adminAuthStatus');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const eventLockedInput = document.getElementById('eventLocked');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');

async function checkAdminSession() {
  // naive check: try to hit an admin-only endpoint (export json) with HEAD-like request
  const res = await fetch('/api/admin-export?format=json', { method: 'GET' });
  return res.status !== 403;
}

adminLoginBtn.addEventListener('click', async () => {
  const secret = adminSecretInput.value.trim();
  if (!secret) { setStatusCard('Enter admin secret', 'warn'); return; }
  const res = await fetch('/api/admin-login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ secret }) });
  if (res.ok) {
    adminAuthStatus.textContent = 'Logged in';
    adminSecretInput.value = '';
    adminPanel.hidden = false;
    await fetchState();
  wireFilters();
  } else {
    adminAuthStatus.textContent = 'Login failed';
  }
});

adminLogoutBtn.addEventListener('click', async () => {
  await fetch('/api/admin-logout', { method: 'POST' });
  adminAuthStatus.textContent = 'Logged out';
  await fetchState();
  wireFilters();
});

saveConfigBtn.addEventListener('click', async () => {
  const updates = { eventLocked: !!eventLockedInput.checked };
  const res = await fetch('/api/admin-set-config', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(updates) });
  adminOutput.textContent = JSON.stringify(await res.json(), null, 2);
});

exportCsvBtn.addEventListener('click', async () => {
  const res = await fetch('/api/admin-export?format=csv');
  if (!res.ok) { setStatusCard('Export failed', 'err'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `derby-paid-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
});
exportJsonBtn.addEventListener('click', async () => {
  const res = await fetch('/api/admin-export?format=json');
  if (!res.ok) { setStatusCard('Export failed', 'err'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `derby-paid-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
});


window.addEventListener('DOMContentLoaded', async () => {
  await fetchState();
  wireFilters();
  renderPayPal();
  showAdmin();
  showQR();
  renderSummary();
});


function wireFilters(){
  document.querySelectorAll('.filters button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      uiFilter = btn.dataset.filter || 'all';
      renderGrid();
    });
  });
}
