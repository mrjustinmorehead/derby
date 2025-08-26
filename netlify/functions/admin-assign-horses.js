const { ensureInitialized, setJSON, addAdminLog } = require('./kv-util');
exports.handler = async (event) => {
  if (event.headers['x-admin-key'] !== process.env.ADMIN_KEY) return { statusCode: 403, body: 'Forbidden' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const { force = false } = JSON.parse(event.body || '{}');
  const { horses, horsesLocked } = await ensureInitialized();
  if (horsesLocked && !force) return { statusCode: 409, body: 'Locked' };
  const shuffled = horses.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  await setJSON('horses', shuffled);
  await addAdminLog('assign-horses', { force });
  return { statusCode: 200, body: JSON.stringify({ horses: shuffled }) };
};
