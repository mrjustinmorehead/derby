
const { ensureInitialized, saveGridAndJackpot, addMinutes, withRetry, idempotencyGet, idempotencySet } = require('./kv-util');

exports.handler = async (event) => {
  const idem = event.headers['idempotency-key'] || event.headers['Idempotency-Key'];
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const idk = event.headers['idempotency-key'];
  if (idk) {
    const prior = await idempotencyGet(`lock:${idk}`);
    if (prior) return { statusCode: 200, body: JSON.stringify(prior.value) };
  }
  try {
    const idemPrev = await getIdem('lock-squares', idem);
    if (idemPrev) return { statusCode: 200, body: JSON.stringify(idemPrev.value) };
    const { squares, name, email } = JSON.parse(event.body || '{}');
    if (!Array.isArray(squares) || !name || !email) return { statusCode: 400, body: 'Missing data' };

    const res = await withRetry(async () => {
      const { grid, pricePerSquare, holdMinutes } = await ensureInitialized();
      const holdExpiresAt = addMinutes(new Date().toISOString(), holdMinutes);
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
      if (unavailable.length) return { conflict: true, unavailable };
      await saveGridAndJackpot(grid, pricePerSquare);
      return { held: Array.from(ids).map(id => ({ id })), holdExpiresAt };
    });

    if (res.conflict) return { statusCode: 409, body: JSON.stringify({ message: 'Some squares unavailable', unavailable: res.unavailable }) };
    if (idk) await idempotencySet(`lock:${idk}`, res);
    return { statusCode: 200, body: JSON.stringify(res) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
