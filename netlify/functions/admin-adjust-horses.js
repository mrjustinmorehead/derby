const { ensureInitialized, setJSON, saveGridAndJackpot, addAdminLog } = require('./kv-util');

exports.handler = async (event) => {
  if (event.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return { statusCode: 403, body: 'Forbidden' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { newCount, preview = false } = JSON.parse(event.body || '{}');
    const { grid, gridSize, pricePerSquare, horses } = await ensureInitialized();

    if (!newCount || newCount < 1 || newCount > gridSize) {
      return { statusCode: 400, body: 'Invalid newCount' };
    }
    if (newCount === gridSize) {
      return { statusCode: 200, body: JSON.stringify({ message: 'No change', gridSize }) };
    }

    // Determine removed rows/cols
    const removed = [];
    for (let r = newCount + 1; r <= gridSize; r++) removed.push(r);

    // Squares being removed and paid ones to reassign
    const toRemove = grid.filter(s => removed.includes(s.row) || removed.includes(s.col));
    const paidToReassign = toRemove.filter(s => s.status === 'paid');

    // Find vacant squares in remaining grid
    const remaining = grid.filter(s => !removed.includes(s.row) && !removed.includes(s.col));
    const vacant = remaining.filter(s => s.status === 'available');

    // Map paid-to-vacant moves
    const moves = [];
    let vIdx = 0;
    for (const src of paidToReassign) {
      if (vIdx >= vacant.length) break;
      const dst = vacant[vIdx++];
      moves.push({ from: { row: src.row, col: src.col }, to: { row: dst.row, col: dst.col } });
    }

    if (preview) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          gridSizeFrom: gridSize,
          gridSizeTo: newCount,
          removedRowsCols: removed,
          reassignments: moves
        }),
      };
    }

    // Apply removal
    const newGrid = remaining;

    // Apply reassignments
    for (const m of moves) {
      const dst = newGrid.find(s => s.row === m.to.row && s.col === m.to.col);
      const src = paidToReassign.find(s => s.row === m.from.row && s.col === m.from.col);
      if (dst && src) {
        dst.status = 'paid';
        dst.purchaserName = src.purchaserName;
        dst.email = src.email;
        dst.orderId = src.orderId;
      }
    }

    // Persist changes
    await setJSON('grid', newGrid);
    await setJSON('gridSize', newCount);
    await setJSON('horses', horses.slice(0, newCount)); // trim horses array
    await saveGridAndJackpot(newGrid, pricePerSquare);
    await addAdminLog('adjust-horses', { from: gridSize, to: newCount, reassigned: moves.length });

    return { statusCode: 200, body: JSON.stringify({ ok: true, removed, reassigned: moves }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
