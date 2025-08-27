const { ensure, save } = require('./store');
exports.handler = async (event) => {
  if(event.httpMethod!=='POST') return {statusCode:405,body:'Method not allowed'};
  const {name,email} = JSON.parse(event.body||'{}');
  if(!name||!email) return {statusCode:400,body:'Missing data'};
  const {grid} = await ensure();
  const targets=grid.filter(s=>s.status==='held'&&s.email===email);
  if(!targets.length) return {statusCode:409,body:'No held squares'};
  for(const s of targets){ s.status='paid'; s.name=name; }
  await save(grid);
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true,paid:targets.map(s=>({row:s.row,col:s.col}))})};
};
