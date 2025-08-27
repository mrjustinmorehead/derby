const { ensure, save } = require('./store');
exports.handler = async (event) => {
  if(event.httpMethod!=='POST') return {statusCode:405,body:'Method not allowed'};
  const {name,email,squares} = JSON.parse(event.body||'{}');
  if(!name||!email||!Array.isArray(squares)||!squares.length) return {statusCode:400,body:'Missing data'};
  const {grid} = await ensure();
  const ids=new Set(squares.map(s=>`${s.row}-${s.col}`));
  const unavailable=[];
  for(const s of grid){
    if(!ids.has(s.id)) continue;
    if(s.status==='available'){ s.status='held'; s.name=name; s.email=email; }
    else unavailable.push({row:s.row,col:s.col,status:s.status});
  }
  if(unavailable.length) return {statusCode:409, headers:{'Content-Type':'application/json'}, body:JSON.stringify({message:'Some unavailable',unavailable})};
  await save(grid);
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};
};
