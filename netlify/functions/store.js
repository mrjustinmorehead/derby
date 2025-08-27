// Storage helpers: try Netlify Blobs; fallback to /tmp JSON for ephemeral dev.
const fs = require('fs');
const TMP = '/tmp/derby-squares.json';

function localStore() {
  let mem = {};
  try { if (fs.existsSync(TMP)) mem = JSON.parse(fs.readFileSync(TMP, 'utf8') || '{}') || {}; } catch {}
  return {
    async get(key, { type } = {}) { return mem[key]; },
    async set(key, val) { mem[key] = typeof val === 'string' ? JSON.parse(val) : val; try { fs.writeFileSync(TMP, JSON.stringify(mem)); } catch {} }
  };
}

let _store = null;
function blob() {
  if (_store) return _store;
  try {
    const { getStore } = require('@netlify/blobs');
    _store = getStore('derby-squares'); // auto-wired on Netlify Functions
    return _store;
  } catch (e) {
      // Always fallback to local store if Blobs is unavailable
    _store = localStore();
    return _store;
  }
}

async function getJSON(key, fallback) {
  try {
    const v = await blob().get(key, { type: 'json' });
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}
async function setJSON(key, val) {
  await blob().set(key, JSON.stringify(val));
}

function id(r,c){ return `${r}-${c}`; }
function makeGrid(size=20, price=5) {
  const arr = [];
  for (let r=1;r<=size;r++) {
    for (let c=1;c<=size;c++) {
      arr.push({ id:id(r,c), row:r, col:c, status: r===c ? 'blocked' : 'available', price, name:null, email:null });
    }
  }
  return arr;
}
async function ensure() {
  const size = 20, price = 5;
  let grid = await getJSON('grid', null);
  if (!Array.isArray(grid) || grid.length !== size*size) {
    grid = makeGrid(size, price);
    await setJSON('grid', grid);
  }
  return { grid, size, price };
}
async function save(grid) { await setJSON('grid', grid); }

module.exports = { ensure, save };
