
const { ensureInitialized, saveGridAndJackpot, idempotencyGet, idempotencySet } = require('./kv-util');
const { captureOrder } = require('./_paypal');

exports.handler = async (event) => {
  const idem = event.headers['idempotency-key'] || event.headers['Idempotency-Key'];
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const idk = event.headers['idempotency-key'];
  if (idk) {
    const prior = await idempotencyGet(`capture:${idk}`);
    if (prior) return { statusCode: 200, body: JSON.stringify(prior.value) };
  }
  try {
    const idemPrev = await getIdem('capture-order', idem);
    if (idemPrev) return { statusCode: 200, body: JSON.stringify(idemPrev.value) };
    let { orderID, email, name } = JSON.parse(event.body || '{}');
    if ((!email || !name) && orderID) { const m = await getJSON(`order:${orderID}`, null); if (m) { email = email || m.email; name = name || m.name; } }
    if (!orderID || !email || !name) return { statusCode: 400, body: 'Missing data' };

    const capture = await captureOrder(orderID);
    if (!capture || (capture.status !== 'COMPLETED' && capture.result?.status !== 'COMPLETED')) {
      const status = capture?.status || capture?.result?.status || 'UNKNOWN';
      return { statusCode: 402, body: JSON.stringify({ message: 'Payment not completed', status }) };
    }

    const { grid, pricePerSquare } = await ensureInitialized();
    const toPay = grid.filter(s => s.status === 'held' && s.email === email);
    if (!toPay.length) return { statusCode: 409, body: 'No held squares to mark paid' };

    for (const s of toPay) { s.status = 'paid'; s.orderId = orderID; s.purchaserName = name; s.holdExpiresAt = null; }

    await saveGridAndJackpot(grid, pricePerSquare);
    const resp = { ok: true, orderID, paidSquares: toPay.map(s => ({ row: s.row, col: s.col })) };
    if (idk) await idempotencySet(`capture:${idk}`, resp);
    return { statusCode: 200, body: JSON.stringify(resp) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
