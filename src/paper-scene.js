import {drawBeltVolume,bodyFrontDepth} from './belt-volume-render.js';
import {drawPaperEndLabels} from './paper-labels.js';
import {drawSleeve,drawHand} from './retarget-rig.js';
import {drawBeltMannequin} from './belt-mannequin.js';
import {WIDTH} from './paper-motion.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s);
function poly(ctx,vs){ctx.beginPath();vs.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();}
function drawBand(ctx,state){
 const sag=.035*Math.max(0,Math.min(1,(state.originalPTS-15.5)/3));
 for(const {from:x0,to:x1,y,layer} of state.wrap.waistBands){
  const middle=x0<0&&x1>0?0:(x0+x1)/2,points=[x0,middle,x1].map(x=>[x,y+sag*(1-Math.abs(x)/.43)]);
  poly(ctx,[...points.map(([x,yy])=>[x,yy-.045]),...points.toReversed().map(([x,yy])=>[x,yy+.045])]);
  ctx.fillStyle=layer?'#22262a':'#171a1d';ctx.fill();ctx.strokeStyle='#62696e66';ctx.lineWidth=.002;
  for(const side of [-1,1]){ctx.beginPath();points.forEach(([x,yy],i)=>i?ctx.lineTo(x,yy+side*.045):ctx.moveTo(x,yy+side*.045));ctx.stroke();}
 }
}
// Split only the rendered material at the waist entry. The same rigid faces,
// shared creases and contact panels remain in the motion state.
function clipAtMaterialS(vertices,boundary,below){
 const result=[];
 for(let i=0;i<vertices.length;i++){
  const a=vertices[i],b=vertices[(i+1)%vertices.length],insideA=below?a.s<=boundary:a.s>=boundary,insideB=below?b.s<=boundary:b.s>=boundary;
  if(insideA)result.push(a);
  if(insideA!==insideB){const u=(boundary-a.s)/(b.s-a.s);result.push({s:boundary,v:a.v+(b.v-a.v)*u,world:a.world.map((x,j)=>x+(b.world[j]-x)*u)});}
 }
 return result;
}
export function paperRenderLayers(state){
 const layers={behindBody:[],underBand:[],front:[]};
 for(const strip of state.strips)for(const panel of strip.panels){
  if(panel.behind){layers.behindBody.push(panel);continue;}
  if(panel.hidden){layers.underBand.push(panel);continue;}
  if(!(strip.buriedMaterialS>0)){layers.front.push(panel);continue;}
  const visible=clipAtMaterialS(panel.materialCoordinates,strip.visibleMaterialS,true);
  for(const [bucket,below] of [['underBand',true],['front',false]]){
   const coordinates=clipAtMaterialS(visible,strip.buriedMaterialS,below);
   if(coordinates.length<3)continue;
   const vertices=coordinates.map(v=>v.world.slice(0,2));
   // An end exactly on the split must not leave a zero-area front sliver.
   const twiceArea=vertices.reduce((a,p,i)=>{const q=vertices[(i+1)%vertices.length];return a+p[0]*q[1]-p[1]*q[0];},0);
   if(Math.abs(twiceArea)<1e-12)continue;
   layers[bucket].push({...panel,vertices,vertices3D:coordinates.map(v=>v.world),renderMaterialCoordinates:coordinates});
  }
 }
 return layers;
}
function drawPanel(ctx,p,diagnostic){if(p.vertices.length<3)return;poly(ctx,p.vertices);ctx.fillStyle=diagnostic?(p.material==='A'?'#b9d5df':'#d8ba87'):(p.material==='A'?(p.semantic==='upper-return'?'#34383c':'#24282c'):(p.semantic==='hidden-return'?'#303438':'#1b2024'));ctx.fill();ctx.save();poly(ctx,p.vertices);ctx.clip();const a=p.from.center,b=p.to.center;for(const sign of[-1,1]){const v=sign*WIDTH/2,aa=add(a,mul(p.N,v)),bb=add(b,mul(p.N,v));ctx.beginPath();ctx.moveTo(aa[0]-p.D[0],aa[1]-p.D[1]);ctx.lineTo(bb[0]+p.D[0],bb[1]+p.D[1]);ctx.strokeStyle=diagnostic?'#314550':'#62696e99';ctx.lineWidth=.002;ctx.stroke();for(const stitch of[.24,.30]){const aaa=add(a,mul(p.N,sign*WIDTH*stitch)),bbb=add(b,mul(p.N,sign*WIDTH*stitch));ctx.beginPath();ctx.moveTo(aaa[0]-p.D[0],aaa[1]-p.D[1]);ctx.lineTo(bbb[0]+p.D[0],bbb[1]+p.D[1]);ctx.strokeStyle='#737a8055';ctx.lineWidth=.001;ctx.stroke();}}
 ctx.restore();if(p.renderMaterialCoordinates){ctx.save();poly(ctx,p.vertices);ctx.clip();}for(const e of[p.from,p.to])if(e.kind==='true-crease'||e.kind==='free-end'){ctx.beginPath();ctx.moveTo(e.ends[0][0],e.ends[0][1]);ctx.lineTo(e.ends[1][0],e.ends[1][1]);ctx.strokeStyle=diagnostic?'#b33e37':'#656b7060';ctx.lineWidth=.0018;ctx.stroke();}if(p.renderMaterialCoordinates)ctx.restore();if(diagnostic){ctx.fillStyle='#ae3030';ctx.font='.020px sans-serif';ctx.fillText(p.id,(a[0]+b[0])/2,(a[1]+b[1])/2);}}
export function drawPaperMotion(ctx,anchor,state,{body=true,occludeBody=body,diagnostic=false,mirror=false,labels=true,yaw=0}={}){
 if(state.volume){
  const hidden=h=>occludeBody&&h.materialContactDepth!=null&&h.materialContactDepth<bodyFrontDepth(...h.grip);
  const labelState=occludeBody?{...state,strips:state.strips.filter(s=>{const p=state.guideEnds[s.material]?.position3D;return !p||p[2]>=bodyFrontDepth(p[0],p[1]);})}:state;
  const local=fn=>{ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*(mirror?-1:1),anchor.scale);fn();ctx.restore()};
  if(!yaw){local(()=>{for(const h of state.rig.hands){if(body||!hidden(h))drawSleeve(ctx,h);if(body&&hidden(h))drawHand(ctx,h)}});if(body){ctx.save();if(mirror){ctx.translate(2*anchor.x,0);ctx.scale(-1,1)}drawBeltMannequin(ctx,anchor,{arms:false});ctx.restore()}local(()=>{for(const h of state.rig.hands)if(!hidden(h)){drawSleeve(ctx,h,{foregroundOnly:true});drawHand(ctx,h,{part:"palm"})}})}
  drawBeltVolume(ctx,anchor,state.volume,{mirror,yaw,bodyOcclusion:occludeBody});
  if(!yaw){local(()=>{for(const h of state.rig.hands)if(!hidden(h))drawHand(ctx,h,{part:"digits"})});if(labels)drawPaperEndLabels(ctx,anchor,labelState,{mirror})}return;
 }
 const local=fn=>{ctx.save();ctx.translate(anchor.x,anchor.y);ctx.scale(anchor.scale*(mirror?-1:1),anchor.scale);fn();ctx.restore();},layers=paperRenderLayers(state),draw=ps=>{for(const p of ps)drawPanel(ctx,p,diagnostic);};
 local(()=>{draw(layers.behindBody);for(const h of state.rig.hands)drawSleeve(ctx,h);if(state.behindBody)for(const h of state.rig.hands)drawHand(ctx,h);});
 if(body){ctx.save();if(mirror){ctx.translate(2*anchor.x,0);ctx.scale(-1,1);}drawBeltMannequin(ctx,anchor,{arms:false});ctx.restore();}
 local(()=>{if(!state.behindBody)for(const h of state.rig.hands){drawSleeve(ctx,h,{foregroundOnly:true});drawHand(ctx,h,{part:'palm'});}draw(layers.underBand);drawBand(ctx,state);draw(layers.front.sort((a,b)=>a.layer-b.layer));if(!state.behindBody)for(const h of state.rig.hands)drawHand(ctx,h,{part:'digits'});});
 if(labels&&!diagnostic)drawPaperEndLabels(ctx,anchor,state,{mirror});
}
