const { ensureInitialized, releaseExpired, saveGridAndJackpot, getJSON } = require('./kv-util');

exports.handler = async () => {
  try {
    const { grid, gridSize, pricePerSquare, horses, horsesLocked } = await ensureInitialized();
    const changed = await releaseExpired(grid);
    if (changed) await saveGridAndJackpot(grid, pricePerSquare);

    const jackpot = await getJSON('jackpot', { possible: 0, current: 0, grand: 0, runner: 0 });
    const adminLog = await getJSON('adminLog', []);
    const potHistory = await getJSON('potHistory', []);

    return {
      statusCode: 200,
      body: JSON.stringify({
        gridSize, pricePerSquare, squares: grid, horses, horsesLocked,
        jackpot, adminLog: adminLog.slice(0, 15), potHistory: potHistory.slice(0, 50)
      }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
