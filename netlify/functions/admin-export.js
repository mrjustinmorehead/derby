const { adminFromEvent } = require('./_auth');
const { getJSON } = require('./kv-util');

function toCSV(rows) {
  const header = ['row','col','status','name','email','orderId'].join(',');
  const body = rows.map(r => [r.row, r.col, r.status, JSON.stringify(r.purchaserName||''), JSON.stringify(r.email||''), JSON.stringify(r.orderId||'')].join(',')).join('\n');
  return header + '\n' + body + '\n';
}

exports.handler = async (event) => {
  const admin = adminFromEvent(event, true);
  if (!admin) return { statusCode: 403, body: 'Forbidden' };

  const format = (event.queryStringParameters && event.queryStringParameters.format) || 'csv';
  const grid = await getJSON('grid', []);

  const paid = grid.filter(s => s.status === 'paid').map(s => ({
    row: s.row, col: s.col, status: s.status, purchaserName: s.purchaserName, email: s.email, orderId: s.orderId
  }));

  if (format === 'json') {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid }, null, 2) };
  } else {
    const csv = toCSV(paid);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="derby-paid-${Date.now()}.csv"`,
      },
      body: csv
    };
  }
};
