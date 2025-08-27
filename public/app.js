const gridEl=document.getElementById('grid');const statusEl=document.getElementById('status');const summaryEl=document.getElementById('summary');
const nameEl=document.getElementById('name');const emailEl=document.getElementById('email');const holdBtn=document.getElementById('holdBtn');const payBtn=document.getElementById('payBtn');
let state={squares:[]};let selected=new Set();
function setStatus(m){statusEl.textContent=m||'';}
function setSummary(){summaryEl.textContent=selected.size?`${selected.size} selected`:"";}
async function fetchState(){const r=await fetch('/api/list');state=await r.json();render();}
function render(){gridEl.innerHTML='';for(const s of state.squares){const el=document.createElement('div');el.className=`square ${s.status}`+(selected.has(s.id)?' selected':'');el.textContent=s.row===s.col?'×':'';el.onclick=()=>{if(s.status!=='available')return;if(selected.has(s.id))selected.delete(s.id);else selected.add(s.id);render();setSummary();};gridEl.appendChild(el);}setSummary();}
holdBtn.onclick=async()=>{const name=nameEl.value.trim(),email=emailEl.value.trim();if(!name||!email){setStatus('Need name/email');return;}const sqs=[...selected].map(id=>{const [r,c]=id.split('-').map(Number);return{row:r,col:c};});const r=await fetch('/api/hold',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,squares:sqs})});if(!r.ok){setStatus('Hold failed');}else{setStatus('Held');selected.clear();}await fetchState();};
payBtn.onclick=async()=>{const name=nameEl.value.trim(),email=emailEl.value.trim();const r=await fetch('/api/pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email})});if(!r.ok){setStatus('Pay failed');}else{setStatus('Paid!');}await fetchState();};
fetchState();
