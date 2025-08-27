const gridEl = document.getElementById('grid');
const statusEl = document.getElementById('status');
const summaryEl = document.getElementById('summary');
const nameEl = document.getElementById('name');
const emailEl = document.getElementById('email');
const holdBtn = document.getElementById('holdBtn');
const payBtn = document.getElementById('payBtn');

let state = { gridSize: 20, price: 5, squares: [] };
let selected = new Set();

function dollars(n){ return `$${(n||0).toFixed(2)}`; }
function setStatus(msg){ statusEl.textContent = msg || ''; }
function setSummary(){
  const count = selected.size;
  summaryEl.textContent = count ? `${count} selected → ${dollars(count * state.price)}` : '';
}

function fallbackDemo(){
  state = { gridSize: 20, price: 5, squares: [] };
  for (let r=1;r<=20;r++){ for (let c=1;c<=20;c++){ state.squares.push({ id:`${r}-${c}`, row:r, col:c, status: r===c?'blocked':'available' }); } }
  const banner = document.createElement('div');
  banner.style.cssText = 'margin:.5rem 0;padding:.5rem;border:1px solid #f39c12;background:#fffbea;border-radius:6px;';
  banner.textContent = 'Live API not reachable. Showing local demo grid. Open /api/list to debug.';
  document.body.insertBefore(banner, gridEl);
  render();
}

async function fetchState(){
  try{
    const res = await fetch('/api/list');
    if (!res.ok) throw new Error('list ' + res.status);
    state = await res.json();
    render();
  }catch(e){
    console.warn(e);
    fallbackDemo();
  }
}

function render(){
  gridEl.innerHTML='';
  const frag=document.createDocumentFragment();
  for(const s of state.squares){
    const el=document.createElement('div');
    el.className=`square ${s.status}` + (selected.has(s.id)?' selected':'');
    el.title = `Square ${s.row}-${s.col} – ${s.status}` + (s.name ? ` (${s.name})` : '');
    el.textContent = s.row===s.col ? '×' : '';
    el.addEventListener('click', ()=>{
      if(s.status!=='available') return;
      if(selected.has(s.id)) selected.delete(s.id); else selected.add(s.id);
      el.classList.toggle('selected');
      setSummary();
    });
    frag.appendChild(el);
  }
  gridEl.appendChild(frag);
  setSummary();
}

holdBtn.addEventListener('click', async () => {
  const name = nameEl.value.trim(); const email = emailEl.value.trim();
  if(!name||!email){ setStatus('Enter name and email'); return; }
  const squares = Array.from(selected).map(id => { const [r,c]=id.split('-').map(Number); return {row:r,col:c}; });
  if (!squares.length){ setStatus('Pick at least one square'); return; }
  setStatus('Holding…');
  const res = await fetch('/api/hold',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email, squares }) });
  if(!res.ok){ let t; try{ const j=await res.json(); t=j.error||JSON.stringify(j); }catch{ t=await res.text(); } setStatus('Hold failed: ' + t); await fetchState(); return; }
  setStatus('Held. Complete Purchase (Demo) to mark paid.');
  selected.clear(); await fetchState();
});

payBtn.addEventListener('click', async () => {
  const name = nameEl.value.trim(); const email = emailEl.value.trim();
  if(!name||!email){ setStatus('Enter name and email'); return; }
  setStatus('Completing purchase (demo)…');
  const res = await fetch('/api/pay',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name, email }) });
  if(!res.ok){ let t; try{ const j=await res.json(); t=j.error||JSON.stringify(j); }catch{ t=await res.text(); } setStatus('Pay failed: ' + t); await fetchState(); return; }
  setStatus('Payment recorded (demo).'); await fetchState();
});

fetchState();
