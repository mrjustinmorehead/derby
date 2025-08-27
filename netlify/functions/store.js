// Netlify Blobs (lazy init) + optional local fallback for dev.
// On Netlify Functions this requires *no* tokens.
let _store = null;

function blob() {
  if (_store) return _store;
  try {
    const { getStore } = require('@netlify/blobs');
    _store = getStore('derby-min'); // auto-wired on Netlify Functions
    return _store;
  } catch (e) {
    // Optional local fallback only if explicitly enabled
    if (process.env.LOCAL_FALLBACK === '1') {
      return (_store = localFallbackStore());
    }
    // Re-throw with friendly message
    const err = new Error('Netlify Blobs not available in this environment. Deploy as a Netlify Function (Node) or set LOCAL_FALLBACK=1 for ephemeral dev storage.');
    err.cause = e;
    throw err;
  }
}

function localFallbackStore() {
  const fs = require('fs');
  const TMP = '/tmp/derby-min.json';
  let mem = {};
  try { if (fs.existsSync(TMP)) mem = JSON.parse(fs.readFileSync(TMP, 'utf8') || '{}') || {}; } catch {}
  return {
    async get(key, { type } = {}) { return mem[key]; },
    async set(key, val) { mem[key] = typeof val === 'string' ? JSON.parse(val) : val; try { fs.writeFileSync(TMP, JSON.stringify(mem)); } catch {} }
  };
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

function makeGrid(size=20, price=5){
  const arr=[];
  for(let r=1;r<=size;r++){
    for(let c=1;c<=size;c++){
      arr.push({id:id(r,c), row:r,col:c,
        status:r===c?'blocked':'available',
        price, name:null,email:null});
    }
  }
  return arr;
}

async function ensure(){
  const size=20, price=5;
  let grid = await getJSON('grid', null);
  if (!Array.isArray(grid) || grid.length !== size*size) {
    grid = makeGrid(size, price);
    await setJSON('grid', grid);
  }
  return { grid, size, price };
}
async function save(grid){ await setJSON('grid', grid); }

module.exports = { ensure, save, getJSON, setJSON };
