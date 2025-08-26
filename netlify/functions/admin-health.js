const { getJSON, nowISO } = require('./kv-util');

exports.handler = async () => {
  const grid = await getJSON('grid', []);
  const counts = grid.reduce((acc, s) => { acc[s.status] = (acc[s.status]||0)+1; return acc; }, {});
  const meta = { at: nowISO(), total: grid.length, counts };
  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta) };
};
