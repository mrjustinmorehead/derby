const { adminFromEvent } = require('./_auth');
const { getJSON } = require('./kv-util');

exports.handler = async (event) => {
  const admin = adminFromEvent(event, true);
  if (!admin) return { statusCode: 403, body: 'Forbidden' };
  const payload = {
    grid: await getJSON('grid', []),
    gridSize: await getJSON('gridSize', 20),
    pricePerSquare: await getJSON('pricePerSquare', 5),
    horses: await getJSON('horses', []),
    horsesLocked: await getJSON('horsesLocked', false),
    jackpot: await getJSON('jackpot', {}),
    potHistory: await getJSON('potHistory', []),
    adminLog: await getJSON('adminLog', []),
  };

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="derby-backup-${Date.now()}.json"`,
    },
    body: JSON.stringify(payload, null, 2),
  };
};
