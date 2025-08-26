const { adminFromEvent } = require('./_auth');
const { ensureInitialized, saveGridAndJackpot, setJSON, getJSON, addAdminLog } = require('./kv-util');

exports.handler = async (event) => {
  const admin = adminFromEvent(event, true);
  if (!admin) return { statusCode: 403, body: 'Forbidden' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  try {
    const { horse, preview = false } = JSON.parse(event.body || '{}');
    const n = Number(horse);
    if (!n || n < 1) return { statusCode: 400, body: 'Invalid horse' };

    const { grid, gridSize, pricePerSquare } = await ensureInitialized();
    const eventLocked = !!(await getJSON('eventLocked', false));
    if (eventLocked) return { statusCode: 409, body: 'Event is locked' };
    if (n > gridSize) return { statusCode: 400, body: 'Horse out of range' };

    // Squares that are invalidated by this scratch
    const affected = grid.filter(s => s.row === n || s.col === n);
    const paidToReassign = affected.filter(s => s.status === 'paid');

    // Vacant destinations must be in unaffected area and available
    const unaffected = grid.filter(s => s.row !== n && s.col !== n);
    const vacant = unaffected.filter(s => s.status === 'available');

    const moves = [];
    let v = 0;
    for (const src of paidToReassign) {
      if (v >= vacant.length) break;
      const dst = vacant[v++];
      moves.push({ from: { row: src.row, col: src.col }, to: { row: dst.row, col: dst.col } });
    }

    if (preview) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          horse: n,
          affectedCount: affected.length,
          paidToReassign: paidToReassign.length,
          canReassignAll: moves.length === paidToReassign.length,
          reassignments: moves
        }),
      };
    }

    // If not enough vacancies, fail
    if (moves.length !== paidToReassign.length) {
      return { statusCode: 409, body: JSON.stringify({ message: 'Not enough available squares to reassign all paid squares', needed: paidToReassign.length, available: vacant.length }) };
    }

    // Apply scratch: mark affected as 'scratched'
    for (const s of affected) {
      s.status = 'scratched';
      if (s.status !== 'paid') {
        s.purchaserName = null;
        s.email = null;
        s.orderId = null;
      }
      s.holdExpiresAt = null;
    }
    // Apply reassignments for paid ones
    for (const m of moves) {
      const src = grid.find(s => s.row === m.from.row && s.col === m.from.col);
      const dst = grid.find(s => s.row === m.to.row && s.col === m.to.col);
      if (src && dst) {
        dst.status = 'paid';
        dst.purchaserName = src.purchaserName;
        dst.email = src.email;
        dst.orderId = src.orderId;
      }
    }

    await saveGridAndJackpot(grid, pricePerSquare);
    await addAdminLog('scratch', { horse: n, reassigned: moves.length, actor: admin.sub, ip: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.ip || 'unknown' });
    return { statusCode: 200, body: JSON.stringify({ ok: true, horse: n, reassigned: moves }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
