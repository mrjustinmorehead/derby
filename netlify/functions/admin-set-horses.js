const { adminFromEvent } = require('./_auth');
const { ensureInitialized, setJSON, addAdminLog } = require('./kv-util');

exports.handler = async (event) => {
  const admin = adminFromEvent(event, true);
  if (!admin) return { statusCode: 403, body: 'Forbidden' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { horses, lock } = JSON.parse(event.body || '{}');
    const { gridSize } = await ensureInitialized();

    let updated = {};
    if (Array.isArray(horses)) {
      if (horses.length !== gridSize) return { statusCode: 400, body: `Need exactly ${gridSize} horse labels` };
      await setJSON('horses', horses);
      updated.horses = horses;
    }

    if (typeof lock === 'boolean') {
      await setJSON('horsesLocked', lock);
      updated.horsesLocked = lock;
    }

    await addAdminLog('set-horses', { ...updated, actor: admin.sub, ip: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.ip || 'unknown' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, ...updated }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
