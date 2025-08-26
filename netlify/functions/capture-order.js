const { ensureInitialized, saveGridAndJackpot } = require('./kv-util');
const { captureOrder } = require('./_paypal');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { orderID, email, name } = JSON.parse(event.body || '{}');
    if (!orderID || !email || !name) return { statusCode: 400, body: 'Missing data' };

    const capture = await captureOrder(orderID);
    if (capture.status !== 'COMPLETED') return { statusCode: 402, body: JSON.stringify({ message: 'Payment not completed', status: capture.status }) };

    const { grid, pricePerSquare } = await ensureInitialized();
    const toPay = grid.filter(s => s.status === 'held' && s.email === email);
    if (!toPay.length) return { statusCode: 409, body: 'No held squares to mark paid' };

    for (const s of toPay) { s.status = 'paid'; s.orderId = orderID; s.purchaserName = name; s.holdExpiresAt = null; }

    await saveGridAndJackpot(grid, pricePerSquare);
    return { statusCode: 200, body: JSON.stringify({ ok: true, orderID, paidSquares: toPay.map(s => ({ row: s.row, col: s.col })) }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
