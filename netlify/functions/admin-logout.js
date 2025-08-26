const { clearCookie } = require('./_auth');
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Set-Cookie': clearCookie(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  };
};
