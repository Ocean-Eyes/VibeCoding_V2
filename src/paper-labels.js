// Labels identify the two authored teaching ends, independently of nullable
// camera observations. The motion generator decides whether an end is exposed.
export function drawPaperEndLabels(ctx,anchor,state,{mirror=false}={}){
 const ends=(state.strips??[]).filter(s=>s.freeEndVisible===true).map(s=>{
  const p=state.guideEnds?.[s.material]?.position;
  if(!Array.isArray(p)||!p.every(Number.isFinite))return null;
  return {material:s.material,x:anchor.x+p[0]*anchor.scale*(mirror?-1:1),y:anchor.y+p[1]*anchor.scale};
 }).filter(Boolean);
 if(!ends.length)return;
 ctx.save();ctx.font='600 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=1.3;
 for(const e of ends){
  let x=e.x,y=e.y+20;
  if(ends.length===2&&Math.hypot(ends[0].x-ends[1].x,ends[0].y-ends[1].y)<30)x+=(e.material==='A'?-16:16);
  const color=e.material==='A'?'#a7dcef':'#ebcb93';ctx.strokeStyle=color;
  ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(x,y-9);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.fillStyle='#21313bea';ctx.fill();ctx.stroke();
  ctx.fillStyle=color;ctx.fillText(e.material,x,y+.5);
 }
 ctx.restore();
}
