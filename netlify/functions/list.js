const { ensure } = require('./store');
exports.handler = async () => {
  const {grid,size,price} = await ensure();
  return { statusCode:200, headers:{'Content-Type':'application/json'}, body: JSON.stringify({gridSize:size,price,squares:grid})};
};
