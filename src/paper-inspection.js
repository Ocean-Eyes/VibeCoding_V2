import {tr} from './i18n.js';
// Instructional emphasis on existing ribbon edges; no new cloth, fold, or loop.
export function drawPaperOpeningCue(ctx,anchor,state,{mirror=false,step}={}){
 if(step!==4&&step!==5)return;
 if(state.volume)return; // Inspect the actual 3D passage in the angled detail view.
 const A=state.strips.find(s=>s.material==='A');
 const spans=[['upper-return',1],['front-cross',-1]];
 ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*(mirror?-1:1),anchor.scale);
 for(const [semantic,vertical] of spans){
  const p=A?.panels.find(p=>p.semantic===semantic);if(!p||p.vertices.length<3)continue;
  const side=(p.N[1]>=0?1:-1)*vertical,offset=p.N.map(v=>v*(p.width??.09)*side/2);
  ctx.save();ctx.beginPath();p.vertices.forEach((v,i)=>i?ctx.lineTo(v[0],v[1]):ctx.moveTo(v[0],v[1]));ctx.closePath();ctx.clip();
  ctx.beginPath();ctx.moveTo(p.from.center[0]+offset[0]-p.D[0],p.from.center[1]+offset[1]-p.D[1]);ctx.lineTo(p.to.center[0]+offset[0]+p.D[0],p.to.center[1]+offset[1]+p.D[1]);
  ctx.strokeStyle='#e2c68e';ctx.lineWidth=.010;ctx.stroke();ctx.restore();
 }
 ctx.restore();
 const B=state.strips.find(s=>s.material==='B'),entry=step===4?(A?.fullPanels.find(p=>p.semantic==='left-layer-pass')?.from.center??[-.18,-.045]):(B?.fullPanels.find(p=>p.semantic==='between-layer')?.from.center??[.15,-.025]);
 const x=anchor.x+entry[0]*anchor.scale*(mirror?-1:1),y=anchor.y+entry[1]*anchor.scale;
 const start=y-Math.min(48,anchor.scale*.18);
 ctx.save();ctx.strokeStyle='#cfad69';ctx.fillStyle='#21313b';ctx.lineWidth=1.8;
 ctx.beginPath();ctx.moveTo(x,start+14);ctx.lineTo(x,y-4);ctx.moveTo(x-4,y-10);ctx.lineTo(x,y-4);ctx.lineTo(x+4,y-10);ctx.stroke();
 ctx.font='600 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const label=(step===4?'A':'B')+tr(' 넣는 곳'),width=ctx.measureText(label).width+12;
 ctx.fillRect(x-width/2,start-1,width,17);ctx.fillStyle='#f3dfb6';ctx.fillText(label,x,start+8);ctx.restore();
}
