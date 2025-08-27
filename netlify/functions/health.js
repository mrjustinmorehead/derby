const { ensure } = require('./store');
exports.handler = async () => {
  try {
    const { grid } = await ensure();
    const stats = {
      total: grid.length,
      available: grid.filter(s=>s.status==='available').length,
      held: grid.filter(s=>s.status==='held').length,
      paid: grid.filter(s=>s.status==='paid').length
    };
    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify(stats) };
  } catch (e) {
    return { statusCode:500, headers:{'Content-Type':'text/plain'}, body: String(e.message||e) };
  }
};
