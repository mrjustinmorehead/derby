const { setJSON, getJSON, nowISO } = require('./kv-util');
exports.handler = async (event) => {
  try {
    const { type, details } = JSON.parse(event.body || '{}');
    if (!type) return { statusCode: 400, body: 'Missing type' };
    const log = (await getJSON('telemetry', []));
    log.unshift({ ts: nowISO(), type, details });
    await setJSON('telemetry', log.slice(0, 500));
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
