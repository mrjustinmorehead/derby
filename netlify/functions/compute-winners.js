const { ensureInitialized } = require('./kv-util');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { finishOrder } = JSON.parse(event.body || '{}');
    if (!Array.isArray(finishOrder) || finishOrder.length < 3) return { statusCode: 400, body: 'Need finishOrder' };

    const win = finishOrder[0], place = finishOrder[1];
    const last = finishOrder[finishOrder.length - 1], secondLast = finishOrder[finishOrder.length - 2];
    const { horses } = await ensureInitialized();
    const label = (n) => horses[n - 1] || `${n}`;
    return { statusCode: 200, body: JSON.stringify({
      grand: { row: win, col: place, rowHorse: label(win), colHorse: label(place) },
      runnerUp: { row: secondLast, col: last, rowHorse: label(secondLast), colHorse: label(last) },
      split: { grandPct: 0.9, runnerPct: 0.1 }
    })};
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
