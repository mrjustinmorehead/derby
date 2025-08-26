
const { ensureInitialized, setJSON, nowISO, getIdem, setIdem } = require('./kv-util');
const { createOrder } = require('./_paypal');

exports.handler = async (event) => {
  const idem = event.headers['idempotency-key'] || event.headers['Idempotency-Key'];
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const idemPrev = await getIdem('create-order', idem);
    if (idemPrev) return { statusCode: 200, body: JSON.stringify(idemPrev.value) };
    const { email, name } = JSON.parse(event.body || '{}');
    if (!email || !name) return { statusCode: 400, body: 'Missing email or name' };

    const { grid, pricePerSquare } = await ensureInitialized();
    const held = grid.filter(s => s.status === 'held' && s.email === email);
    if (!held.length) return { statusCode: 409, body: 'No valid held squares' };

    const total = held.length * pricePerSquare;
    const order = await createOrder(total, `Derby Squares for ${name} (${email})`, email);
    const result = { orderID: order.id, total, count: held.length };
    await setJSON(`order:${order.id}`, { email, name, count: held.length, at: nowISO() });
    await setIdem('create-order', idem, result);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
