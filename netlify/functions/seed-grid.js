const { ensureInitialized } = require('./kv-util');

exports.handler = async () => {
  try {
    await ensureInitialized();
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
