const { ensure, save } = require('./store');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ error:'Method not allowed' }) };
  try {
    const { name, email } = JSON.parse(event.body || '{}');
    if (!name || !email) return { statusCode:400, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ error:'Missing data' }) };
    const { grid } = await ensure();
    const targets = grid.filter(s => s.status==='held' && s.email===email);
    if (!targets.length) return { statusCode:409, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ error:'No held squares for this email' }) };
    for (const s of targets) { s.status='paid'; s.name=name; }
    await save(grid);
    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ok:true, paid: targets.map(s=>({row:s.row,col:s.col})) }) };
  } catch (e) {
    return { statusCode:500, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
