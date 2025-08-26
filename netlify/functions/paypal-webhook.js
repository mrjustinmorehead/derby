const { getOrder } = require('./_paypal');
const { ensureInitialized, saveGridAndJackpot, getJSON } = require('./kv-util');

// NOTE: We skip signature verification and instead fetch the order from PayPal API to verify.
// Configure this webhook URL in PayPal dashboard to receive ORDER.APPROVED / PAYMENT.CAPTURE.COMPLETED.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const body = JSON.parse(event.body || '{}');
    const resource = body.resource || {};
    const type = body.event_type || '';

    // Try to pull an orderId from resource
    let orderId = resource.id || (resource.supplementary_data && resource.supplementary_data.related_ids && resource.supplementary_data.related_ids.order_id);
    if (!orderId) return { statusCode: 200, body: JSON.stringify({ ok: true, info: 'No order id' }) };

    // Verify order against PayPal API
    const order = await getOrder(orderId);

    // We expect custom_id to contain email (set in create-order)
    const pu = (order.purchase_units && order.purchase_units[0]) || {};
    const email = pu.custom_id || null;
    const name = (order.payer && (order.payer.name && ((order.payer.name.given_name || '') + ' ' + (order.payer.name.surname || '')))) || 'PayPal Payer';

    if (!email) return { statusCode: 200, body: JSON.stringify({ ok: true, info: 'No email custom_id on order' }) };

    const { grid, pricePerSquare } = await ensureInitialized();
    const toPay = grid.filter(s => s.status === 'held' && s.email === email);
    if (!toPay.length) return { statusCode: 200, body: JSON.stringify({ ok: true, info: 'No held squares for email' }) };

    for (const s of toPay) { s.status = 'paid'; s.orderId = orderId; s.purchaserName = name; s.holdExpiresAt = null; }

    await saveGridAndJackpot(grid, pricePerSquare);

    return { statusCode: 200, body: JSON.stringify({ ok: true, orderId, paidCount: toPay.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
