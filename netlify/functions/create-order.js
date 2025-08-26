const { ensureInitialized } = require('./kv-util');
const { createOrder } = require('./_paypal');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { email, name } = JSON.parse(event.body || '{}');
    if (!email || !name) return { statusCode: 400, body: 'Missing email or name' };

    const { grid, pricePerSquare } = await ensureInitialized();
    const held = grid.filter(s => s.status === 'held' && s.email === email);
    if (!held.length) return { statusCode: 409, body: 'No valid held squares' };

    const total = held.length * pricePerSquare;
    const order = await createOrder(total, `Derby Squares for ${name} (${email})`);
    return { statusCode: 200, body: JSON.stringify({ orderID: order.id, total, count: held.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
