const { sign, adminCookie } = require('./_auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const { secret } = JSON.parse(event.body || '{}');
    if (!secret || secret !== process.env.ADMIN_KEY) {
      return { statusCode: 401, body: 'Invalid secret' };
    }
    const jwt = sign({ sub: 'admin' }, process.env.ADMIN_JWT_SECRET || process.env.ADMIN_KEY || 'change-me');
    return {
      statusCode: 200,
      headers: { 'Set-Cookie': adminCookie(jwt), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
