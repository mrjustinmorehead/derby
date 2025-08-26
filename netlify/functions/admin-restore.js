const { adminFromEvent } = require('./_auth');
const { setJSON, addAdminLog, ensureInitialized, saveGridAndJackpot } = require('./kv-util');

exports.handler = async (event) => {
  const admin = adminFromEvent(event, true);
  if (!admin) return { statusCode: 403, body: 'Forbidden' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { confirm, data } = JSON.parse(event.body || '{}');
    if (!confirm || !data) return { statusCode: 400, body: 'Missing confirm or data' };

    // Minimal validation
    if (!Array.isArray(data.grid) || !Array.isArray(data.horses) || typeof data.gridSize !== 'number') {
      return { statusCode: 400, body: 'Invalid backup payload' };
    }

    await setJSON('grid', data.grid);
    await setJSON('gridSize', data.gridSize);
    if (typeof data.pricePerSquare === 'number') await setJSON('pricePerSquare', data.pricePerSquare);
    await setJSON('horses', data.horses);
    await setJSON('horsesLocked', !!data.horsesLocked);
    await setJSON('potHistory', Array.isArray(data.potHistory) ? data.potHistory : []);
    await setJSON('adminLog', Array.isArray(data.adminLog) ? data.adminLog : []);

    // Recompute jackpot based on restored grid & price
    const { grid, pricePerSquare } = await ensureInitialized();
    await saveGridAndJackpot(grid, pricePerSquare);

    await addAdminLog('restore', { gridSize: data.gridSize, horses: data.horses.length });
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
