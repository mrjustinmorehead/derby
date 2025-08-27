// Storage helpers with graceful fallback when Netlify Blobs isn't available.
let blobsStore = null;
try {
  const { getStore } = require('@netlify/blobs');
  // This will throw MissingBlobsEnvironmentError if not on Netlify or not enabled
  blobsStore = getStore('derby-min', { consistency: 'strong' });
} catch (e) {
  blobsStore = null;
}

const fs = require('fs');
const path = require('path');
const TMP_FILE = '/tmp/derby-min.json';
let mem = {};

function readTmp() {
  try { if (fs.existsSync(TMP_FILE)) mem = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8') || '{}') || {}; } catch {}
}
function writeTmp() {
  try { fs.writeFileSync(TMP_FILE, JSON.stringify(mem)); } catch {}
}
readTmp();

async function getJSON(key, fallback) {
  if (blobsStore) {
    try {
      const v = await blobsStore.get(key, { type: 'json' });
      return v == null ? fallback : v;
    } catch { return fallback; }
  }
  // Fallback: in-memory + /tmp file
  return key in mem ? mem[key] : fallback;
}

async function setJSON(key, val) {
  if (blobsStore) {
    await blobsStore.set(key, JSON.stringify(val));
    return;
  }
  mem[key] = val;
  writeTmp();
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
  let grid=await getJSON('grid',null);
  if(!Array.isArray(grid)||grid.length!==size*size){
    grid=makeGrid(size,price);
    await setJSON('grid',grid);
  }
  return {grid,size,price};
}

async function save(grid){ await setJSON('grid',grid); }

module.exports={ensure,save,getJSON,setJSON};
