const { ensure } = require('./store');
exports.handler = async () => {
  try {
    const {grid, size, price} = await ensure();
    const stats = {
      total: grid.length,
      available: grid.filter(s=>s.status==='available').length,
      held: grid.filter(s=>s.status==='held').length,
      paid: grid.filter(s=>s.status==='paid').length
    };
    return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ gridSize:size, price, squares:grid, stats }) };
  } catch (e) {
    return { statusCode:500, headers:{'Content-Type':'application/json'}, body: JSON.stringify({ error: String(e && e.message || e) }) };
  }
};
