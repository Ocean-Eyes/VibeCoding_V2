// Game input only: RGB positions cannot measure pressure or grip effectiveness.
export function crossedGrip(points, target, frame) {
  if (!frame || !points || [15,16].some(i=>!points[i] || (points[i].visibility??1)<.65)) return false;
  const a=points[15],b=points[16];
  return (a.x-b.x)*frame.x.x+(a.y-b.y)*frame.x.y < -frame.scale*.05 &&
    [15,16].every(i=>Math.hypot(points[i].x-target[i].x,points[i].y-target[i].y)<frame.scale*.45);
}

// Schematic grip viewed from above: palm-up exposes palm creases; palm-down exposes knuckles.
export function drawGripHand(ctx, x, y, size, palmUp, left=false) {
  ctx.save();ctx.translate(x,y);ctx.scale(left?-size:size,size);
  ctx.lineJoin='round';ctx.lineCap='round';ctx.lineWidth=.035;
  const path=(points,fill)=>{ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle='#674b3b';ctx.stroke()};
  // A contrasting strip of lapel runs through the grip.
  path([[-.18,-.85],[.12,-.85],[.32,.66],[.02,.66]],'#faf7ee');
  path([[-.24,.7],[-.28,.2],[-.4,-.08],[-.34,-.43],[.24,-.46],[.36,-.14],[.26,.28],[.2,.7]],palmUp?'#efd0b2':'#cfa482');
  for(let i=0;i<4;i++){
    ctx.beginPath();ctx.roundRect(-.35+i*.17,-.52,.17,.35,.07);ctx.fillStyle=palmUp?'#e6b995':'#d9b18e';ctx.fill();ctx.strokeStyle='#674b3b';ctx.stroke();
  }
  path([[-.3,.25],[-.53,-.03],[-.48,-.22],[-.34,-.2],[-.12,.04]],'#e3b38e');
  ctx.beginPath();
  if(palmUp){ctx.moveTo(-.16,-.02);ctx.quadraticCurveTo(.05,.11,.21,-.01);ctx.moveTo(-.16,.09);ctx.quadraticCurveTo(-.02,.15,-.1,.33)}
  else{for(let i=0;i<3;i++){ctx.moveTo(-.17+i*.14,-.1);ctx.lineTo(-.15+i*.14,.18)}}
  ctx.strokeStyle='#936b51';ctx.lineWidth=.025;ctx.stroke();ctx.restore();
}

export function drawOpponent(ctx, frame, target, current, progress=0, tapTime=0, mirrored=false, directions=['↓','↓']) {
  const {origin,scale,x,y}=frame;
  const visible=i=>current?.[i]&&(current[i].visibility??1)>=.65;
  const local=p=>({x:((p.x-origin.x)*x.x+(p.y-origin.y)*x.y)/scale,y:((p.x-origin.x)*y.x+(p.y-origin.y)*y.y)/scale});
  const grips=[15,16].filter(visible).map(i=>local(current[i]));
  const lean=grips.length?Math.max(-.08,Math.min(.08,grips.reduce((v,p)=>v+p.x,0)/grips.length*.12)):0;
  ctx.save();ctx.transform(scale*x.x,scale*x.y,scale*y.x,scale*y.y,origin.x,origin.y);
  const shape=(points,fill,stroke='#9c998f',width=.014)=>{ctx.beginPath();points.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()};
  const ellipse=(a,b,rx,ry,fill)=>{ctx.beginPath();ctx.ellipse(a,b,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()};
  ctx.save();ctx.translate(lean,progress*.035);ctx.globalAlpha=.88;
  // Broad sleeves, layered lapels and a black belt make the partner readable without bones.
  shape([[-.34,.14],[-.69,.28],[-.86,.92],[-.57,1.02],[-.35,.57]],'#deded8');
  shape([[.34,.14],[.69,.28],[.86,.92],[.57,1.02],[.35,.57]],'#deded8');
  ellipse(-.71,1,.105,.13,'#c9a387');ellipse(.71,1,.105,.13,'#c9a387');
  shape([[-.42,.16],[-.19,.08],[.19,.08],[.42,.16],[.52,1.49],[-.52,1.49]],'#f4f1e8');
  shape([[-.18,.06],[.18,.06],[.13,.42],[0,.55],[-.13,.42]],'#c9a387');
  shape([[-.2,.05],[-.3,.16],[.17,1.19],[.29,1.16]],'#e6e3d9');
  shape([[.2,.05],[.3,.16],[-.13,1.19],[-.27,1.16]],'#fffdf4');
  shape([[-.49,1.13],[.49,1.13],[.5,1.25],[-.5,1.25]],'#292a2c','#292a2c');
  shape([[-.055,1.19],[.1,1.2],[.2,1.65],[.08,1.68]],'#333438');
  shape([[.055,1.19],[-.1,1.2],[-.16,1.57],[-.05,1.59]],'#292a2c');
  ellipse(0,-.22,.235,.3,'#c9a387');
  shape([[-.225,-.24],[-.23,-.43],[-.12,-.54],[.12,-.54],[.23,-.41],[.225,-.24],[.15,-.4],[-.13,-.4]],'#343231','#343231');
  ellipse(-.085,-.22,.019,.014,'#393635');ellipse(.085,-.22,.019,.014,'#393635');
  shape([[-.055,-.09],[.055,-.09],[0,-.075]],'#896952','#896952',.006);
  // Lapel folds follow the live wrist positions; they relax immediately on release.
  for(const p of grips){const a=Math.sign(p.x)*.18;ctx.beginPath();ctx.moveTo(a,.26);ctx.quadraticCurveTo(p.x*.3,.48+progress*.1,a*.6,.88);ctx.strokeStyle='#a4a39c';ctx.lineWidth=.012;ctx.stroke()}
  if(tapTime>0){const t=(Math.sin(tapTime*19)+1)/2;shape([[.6,.75],[.38,.93],[.1+t*.1,.62],[.21+t*.1,.5],[.49,.64]],'#eeeae0');ellipse(.16+t*.1,.52,.11,.08,'#c9a387')}
  ctx.restore();
  for(const [n,i]of [15,16].entries()){
    const p=local(target[i]);ctx.beginPath();ctx.arc(p.x,p.y,.16,0,Math.PI*2);ctx.fillStyle='#b3394555';ctx.fill();ctx.strokeStyle='#f5a0a7';ctx.lineWidth=.012;ctx.stroke();
    drawGripHand(ctx,p.x,p.y,.27,directions[n]==='↑',n===0);
    // Counter-transform text so labels remain readable with mirrored camera coordinates.
    ctx.save();ctx.translate(p.x,p.y-.29);ctx.transform(x.x,y.x,x.y,y.y,0,0);if(mirrored)ctx.scale(-1,1);ctx.font='.09px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(n?'R':'L',0,0);ctx.restore();
    if(visible(i)){const q=local(current[i]);ellipse(q.x,q.y,.065,.08,'#80baff');ctx.beginPath();ctx.arc(q.x,q.y,.085,0,Math.PI*2);ctx.strokeStyle='#e5f4ff';ctx.lineWidth=.009;ctx.stroke()}
  }
  ctx.restore();
}
