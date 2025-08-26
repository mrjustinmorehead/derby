
const { ensureInitialized, getJSON } = require('./kv-util');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { finishOrder } = JSON.parse(event.body || '{}');
    if (!Array.isArray(finishOrder) || finishOrder.length < 3) return { statusCode: 400, body: 'Need finishOrder' };

    const win = finishOrder[0], place = finishOrder[1];
    const last = finishOrder[finishOrder.length - 1], secondLast = finishOrder[finishOrder.length - 2];
    const { horses, grid } = await ensureInitialized();
    const jp = await getJSON('jackpot', { possible: 0, current: 0, grand: 0, runner: 0 });

    const label = (n) => horses[n - 1] || `${n}`;
    const findSquare = (r, c) => grid.find(s => s.row === r && s.col === c);
    const grandSq = findSquare(win, place);
    const runnerSq = findSquare(secondLast, last);

    return { statusCode: 200, body: JSON.stringify({
      grand: { row: win, col: place, rowHorse: label(win), colHorse: label(place),
               owner: grandSq && grandSq.status === 'paid' ? { name: grandSq.purchaserName, email: grandSq.email } : null },
      runnerUp: { row: secondLast, col: last, rowHorse: label(secondLast), colHorse: label(last),
                  owner: runnerSq && runnerSq.status === 'paid' ? { name: runnerSq.purchaserName, email: runnerSq.email } : null },
      payout: { grand: jp.grand, runner: jp.runner, current: jp.current },
      split: { grandPct: 0.9, runnerPct: 0.1 }
    })};
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
