const { adminFromEvent } = require('./_auth');
const { setJSON, getJSON, addAdminLog } = require('./kv-util');

exports.handler = async (event) => {
  const admin = adminFromEvent(event, true);
  if (!admin) return { statusCode: 403, body: 'Forbidden' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const allowed = ['pricePerSquare', 'gridSize', 'holdMinutes', 'eventLocked'];
    const updates = {};
    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k];
    }
    if (updates.pricePerSquare !== undefined) await setJSON('pricePerSquare', Number(updates.pricePerSquare));
    if (updates.gridSize !== undefined) await setJSON('gridSize', Number(updates.gridSize));
    if (updates.holdMinutes !== undefined) await setJSON('holdMinutes', Number(updates.holdMinutes));
    if (updates.eventLocked !== undefined) await setJSON('eventLocked', !!updates.eventLocked);
    await addAdminLog('set-config', { ...updates, actor: admin.sub, ip: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.ip || 'unknown' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, updates }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
