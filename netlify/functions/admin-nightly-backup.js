
const { getJSON, setJSON } = require('./kv-util');

exports.handler = async () => {
  const payload = {
    grid: await getJSON('grid', []),
    gridSize: await getJSON('gridSize', 20),
    pricePerSquare: await getJSON('pricePerSquare', 5),
    horses: await getJSON('horses', []),
    horsesLocked: await getJSON('horsesLocked', false),
    potHistory: await getJSON('potHistory', []),
    adminLog: await getJSON('adminLog', []),
  };
  const key = `auto-backup:${Date.now()}`;
  await setJSON(key, payload);
  return { statusCode: 200, body: JSON.stringify({ ok: true, key }) };
};

exports.config = {
  schedule: "0 9 * * *" // 09:00 UTC daily
};
