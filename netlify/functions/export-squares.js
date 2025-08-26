
const { requireAdmin, getJSON } = require('./kv-util');

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))].join('\n');
}

exports.handler = async (event) => {
  const forbidden = requireAdmin(event);
  if (forbidden) return forbidden;

  const type = (event.queryStringParameters && event.queryStringParameters.type) || 'csv';
  const grid = await getJSON('grid', []);
  const rows = grid
    .filter(s => s.status === 'paid')
    .map(s => ({ row: s.row, col: s.col, name: s.purchaserName, email: s.email, orderId: s.orderId }));

  if (type === 'json') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows, null, 2) };
  } else {
    return { statusCode: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="paid-squares.csv"' }, body: toCSV(rows) };
  }
};
