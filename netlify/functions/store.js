const { getStore } = require('@netlify/blobs');
const store = getStore('derby-min', { consistency: 'strong' });

async function getJSON(key, fallback) {
  try { const v = await store.get(key, { type: 'json' }); return v == null ? fallback : v; }
  catch { return fallback; }
}
async function setJSON(key, val) { await store.set(key, JSON.stringify(val)); }
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
module.exports={ensure,save};
