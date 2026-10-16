import {drawPaperEndLabels} from './paper-labels.js';
import {drawSleeve,drawHand} from './retarget-rig.js';
import {drawBeltMannequin} from './belt-mannequin.js';
import {WIDTH} from './paper-motion.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s);
function poly(ctx,vs){ctx.beginPath();vs.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
function drawBand(ctx,state){
 for(const {from:x0,to:x1,y,layer} of state.wrap.waistBands){
  poly(ctx,[[x0,y-.045],[x1,y-.045],[x1,y+.045],[x0,y+.045]]);
  ctx.fillStyle=layer?'#22262a':'#171a1d';ctx.fill();ctx.strokeStyle='#62696e66';ctx.lineWidth=.002;
  ctx.beginPath();ctx.moveTo(x0,y-.045);ctx.lineTo(x1,y-.045);ctx.moveTo(x0,y+.045);ctx.lineTo(x1,y+.045);ctx.stroke();
 }
}
function drawPanel(ctx,p,diagnostic){if(p.vertices.length<3)return;poly(ctx,p.vertices);ctx.fillStyle=diagnostic?(p.material==='A'?'#b9d5df':'#d8ba87'):(p.material==='A'?(p.semantic==='upper-return'?'#34383c':'#24282c'):'#1b2024');ctx.fill();ctx.save();poly(ctx,p.vertices);ctx.clip();const a=p.from.center,b=p.to.center;for(const sign of[-1,1]){const v=sign*WIDTH/2,aa=add(a,mul(p.N,v)),bb=add(b,mul(p.N,v));ctx.beginPath();ctx.moveTo(aa[0]-p.D[0],aa[1]-p.D[1]);ctx.lineTo(bb[0]+p.D[0],bb[1]+p.D[1]);ctx.strokeStyle=diagnostic?'#314550':'#62696e99';ctx.lineWidth=.002;ctx.stroke();for(const stitch of[.24,.30]){const aaa=add(a,mul(p.N,sign*WIDTH*stitch)),bbb=add(b,mul(p.N,sign*WIDTH*stitch));ctx.beginPath();ctx.moveTo(aaa[0]-p.D[0],aaa[1]-p.D[1]);ctx.lineTo(bbb[0]+p.D[0],bbb[1]+p.D[1]);ctx.strokeStyle='#737a8055';ctx.lineWidth=.001;ctx.stroke();}}
 ctx.restore();for(const e of[p.from,p.to])if(e.kind==='true-crease'||e.kind==='free-end'){ctx.beginPath();ctx.moveTo(e.ends[0][0],e.ends[0][1]);ctx.lineTo(e.ends[1][0],e.ends[1][1]);ctx.strokeStyle=diagnostic?'#b33e37':'#656b7060';ctx.lineWidth=.0018;ctx.stroke();}if(diagnostic){ctx.fillStyle='#ae3030';ctx.font='.020px sans-serif';ctx.fillText(p.id,(a[0]+b[0])/2,(a[1]+b[1])/2);}}
export function drawPaperMotion(ctx,anchor,state,{body=true,diagnostic=false,mirror=false,labels=true}={}){
 const local=fn=>{ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*(mirror?-1:1),anchor.scale);fn();ctx.restore();},all=state.strips.flatMap(s=>s.panels),draw=ps=>{for(const p of ps)drawPanel(ctx,p,diagnostic);};
 local(()=>{draw(all.filter(p=>p.behind));for(const h of state.rig.hands)drawSleeve(ctx,h);if(state.behindBody)for(const h of state.rig.hands)drawHand(ctx,h);});
 if(body){ctx.save();if(mirror){ctx.translate(2*anchor.x,0);ctx.scale(-1,1);}drawBeltMannequin(ctx,anchor,{arms:false});ctx.restore();}
 local(()=>{if(!state.behindBody)for(const h of state.rig.hands){drawSleeve(ctx,h,{foregroundOnly:true});drawHand(ctx,h,{part:'palm'});}draw(all.filter(p=>!p.behind&&p.hidden));drawBand(ctx,state);draw(all.filter(p=>!p.behind&&!p.hidden).sort((a,b)=>a.layer-b.layer));if(!state.behindBody)for(const h of state.rig.hands)drawHand(ctx,h,{part:'digits'});});
 if(labels&&!diagnostic)drawPaperEndLabels(ctx,anchor,state,{mirror});
}
