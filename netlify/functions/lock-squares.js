const { ensureInitialized, saveGridAndJackpot, addMinutes } = require('./kv-util');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { squares, name, email } = JSON.parse(event.body || '{}');
    if (!Array.isArray(squares) || !name || !email) return { statusCode: 400, body: 'Missing data' };

    const { grid, pricePerSquare } = await ensureInitialized();
    const holdExpiresAt = addMinutes(new Date().toISOString(), parseInt(process.env.HOLD_MINUTES || '10', 10));
    const ids = new Set(squares.map(s => `${s.row}-${s.col}`));
    const unavailable = [];

    for (const s of grid) {
      if (!ids.has(s.id)) continue;
      if (s.status === 'available') {
        s.status = 'held'; s.purchaserName = name; s.email = email; s.holdExpiresAt = holdExpiresAt;
      } else {
        unavailable.push({ row: s.row, col: s.col, status: s.status });
      }
    }
    if (unavailable.length) return { statusCode: 409, body: JSON.stringify({ message: 'Some squares unavailable', unavailable }) };

    await saveGridAndJackpot(grid, pricePerSquare);
    return { statusCode: 200, body: JSON.stringify({ held: Array.from(ids).map(id => ({ id })), holdExpiresAt }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
