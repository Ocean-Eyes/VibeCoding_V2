// Reference-derived regressions for the rejected insertion and final-tail poses.
// These check projected material relationships, not complete 3D cloth physics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {paperMotion} from '../src/paper-motion.js';
const frames=JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url)))).frames;
const strip=(state,id)=>state.strips.find(s=>s.material===id);
const panel=(s,name)=>s.fullPanels.find(p=>p.semantic===name);
function innerEdgeClearance(point,face,side){
 const dx=face.to.center[0]-face.from.center[0],dy=face.to.center[1]-face.from.center[1];
 assert.ok(Math.abs(dx)>1e-8,'reference aperture boundaries must span horizontally');
 const slope=dy/dx,y=face.from.center[1]+(point[0]-face.from.center[0])*slope;
 return side*(point[1]-y)/Math.hypot(1,slope)-face.width/2;
}
test('B outlet fits between actual A face edges throughout the observed receiving interval',()=>{
 let samples=0;
 for(let i=990;i<=1059;i++){
  const state=paperMotion(frames[i]),a=strip(state,'A'),b=strip(state,'B'),out=panel(b,'outgoing-end');
  if(!out||b.visibleMaterialS<out.from.materialS)continue;
  samples++;
  for(const edgePoint of out.from.ends){
   for(const [name,side] of [['upper-return',1],['front-cross',-1]]){
    const margin=innerEdgeClearance(edgePoint,panel(a,name),side);
    assert.ok(margin>=out.thickness/2,`${i/60}s B outlet crosses A ${name}: clearance ${margin}`);
   }
  }
 }
 assert.ok(samples>=30,'exercise emergence and handoff, not only the final pose');
});
test('A left insertion travels through a distinct concealed span before its outgoing tail',()=>{
 for(let i=915;i<=1095;i++){
  const a=strip(paperMotion(frames[i]),'A'),upper=panel(a,'upper-return'),pass=panel(a,'left-layer-pass'),tail=panel(a,'outgoing-end');
  assert.ok(pass,`${i/60}s missing the left waist-layer passage`);
  assert.equal(upper.to,pass.from);assert.equal(pass.to,tail.from);
  assert.ok(pass.hidden,`${i/60}s the passage must be behind the outer standing layer`);
  // The authored standing outer layer covers y=.027.. .117. A enters above it
  // and emerges below it, as the source 14.0–15.5s insertion demonstrates.
  assert.ok(pass.from.center[1]<.027,`${i/60}s entry is inside/below the outer-layer top`);
  assert.ok(pass.to.center[1]>.117,`${i/60}s tail appears before passing the outer-layer bottom`);
  assert.ok(pass.to.center[1]>pass.from.center[1]+pass.width);
 }
});
test('final A and B ends retain readable ribbon width rather than collapse into a line',()=>{
 for(let i=1155;i<=1188;i++){
  for(const s of paperMotion(frames[i]).strips){
   const tail=panel(s,'outgoing-end');assert.ok(tail);
   const projectedWidth=tail.width*Math.hypot(tail.N[0],tail.N[1]);
   assert.ok(projectedWidth>=tail.width*.75,`${i/60}s ${s.material} projected width ${projectedWidth}`);
  }
 }
});
test('the existing A return stays in front of the received B end without a repaint fraction',()=>{
 for(let i=1020;i<=1170;i++){
  const state=paperMotion(frames[i]),a=panel(strip(state,'A'),'upper-return'),b=panel(strip(state,'B'),'outgoing-end');
  assert.ok(a.layer>b.layer,`${i/60}s A wrapping face changes side at the crossing`);
  assert.ok(!a.wrapFrontFraction,'do not replace material overlap with an animated overpaint');
 }
});

function inside(point,vs){
 let yes=false;
 for(let i=0,j=vs.length-1;i<vs.length;j=i++){
  const a=vs[j],b=vs[i],dx=b[0]-a[0],dy=b[1]-a[1],q=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  if(Math.hypot(point[0]-a[0]-q*dx,point[1]-a[1]-q*dy)<1e-8)return true;
  if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}
test('final A return is concealed by belt material without relying on a hand to hide it',()=>{
 for(let i=1170;i<=1284;i++){
  const state=paperMotion(frames[i]),a=strip(state,'A'),pass=panel(a,'left-layer-pass'),tail=panel(a,'outgoing-end');
  assert.equal(pass.to,tail.from);assert.ok(pass.hidden);
  // Conservative interior of the waist bands, plus the actual exposed belt faces.
  const cover=[[[-.4,.04],[.4,.04],[.4,.117],[-.4,.117]],...state.strips.flatMap(s=>s.panels.filter(p=>!p.hidden).map(p=>p.vertices))];
  const v=pass.vertices;
  for(let u=0;u<=10;u++)for(let w=0;w<=10;w++){
   const q=u/10,r=w/10,pt=[0,1].map(j=>(1-q)*((1-r)*v[0][j]+r*v[1][j])+q*((1-r)*v[3][j]+r*v[2][j]));
   assert.ok(cover.some(poly=>inside(pt,poly)),`${i/60}s concealed return protrudes as an extra fold at ${pt}`);
  }
 }
});
test('receiving and tightening retain broad stiff tails through every frame, not only the final pose',()=>{
 for(let i=990;i<=1284;i++)for(const s of paperMotion(frames[i]).strips){
  const tail=panel(s,'outgoing-end');
  assert.ok(Math.hypot(tail.N[0],tail.N[1])>.9,`${i/60}s ${s.material} tail turns edge-on`);
 }
});
test('finished knot remains fixed when source hands release and lower',()=>{
 const shape=s=>s.strips.map(st=>st.fullPanels.map(p=>p.vertices3D));
 const final=shape(paperMotion(frames[1170]));
 for(let i=1170;i<=1284;i++)assert.deepEqual(shape(paperMotion(frames[i])),final);
 for(let i=1176;i<=1284;i++)assert.equal(paperMotion(frames[i]).contacts.length,0,'released hands must not keep belt contacts');
});
test('receiving and regripping hands move continuously across contact changes',()=>{
 for(const boundary of [9.5,10.78,16.75,17.15,18,18.25,19.48,19.6]){
  const f=frames[Math.round(boundary*60)],state=t=>paperMotion({...f,originalPTS:t});
  const before=state(boundary-1e-7),after=state(boundary+1e-7);
  for(const h of before.rig.hands){const next=after.rig.hands.find(x=>x.identity===h.identity);assert.ok(Math.hypot(...h.grip.map((v,j)=>v-next.grip[j]))<.0001,`${boundary}s ${h.identity} contact teleport`);}
 }
});
test('tightening phase boundaries converge with decreasing time increments for unchanged hand input',()=>{
 const points=state=>state.strips.flatMap(s=>[s.guideEnd,...panel(s,'outgoing-end').to.ends]);
 const distance=(a,b)=>Math.max(...a.map((v,i)=>Math.hypot(...v.map((x,j)=>x-b[i][j]))));
 for(const t of [18.25,18.6,18.88,19.5,19.8]){
  const frame=frames[Math.round(t*60)],sample=delta=>points(paperMotion({...frame,originalPTS:t+delta}));
  // A genuine phase jump remains as epsilon shrinks; a continuous move shrinks.
  // Freeze the source hand sample so hand tracking motion cannot mask this check.
  const large=distance(sample(-1e-5),sample(1e-5)),small=distance(sample(-5e-6),sample(5e-6));
  assert.ok(small<=large*.6+1e-9,`${t}s phase discontinuity: ${large} -> ${small}`);
 }
});

// Source 17s has a low lower return, not a third hanging end. Source 19.5s
// closes into a compact knot; external free ends remain broad, straight strips.
test('receiving return stays within one belt width below the standing layers',()=>{
 for(let i=990;i<=1080;i++){
  const a=strip(paperMotion(frames[i]),'A');
  const lower=panel(a,'front-cross'),back=panel(a,'first-underpass');
  const bottom=Math.max(...[lower,back].flatMap(p=>p.vertices.map(v=>v[1])));
  const standingBottom=.117+.035;
  assert.ok(bottom-standingBottom<=lower.width,`${i/60}s lower return resembles a third tail: ${bottom}`);
 }
});
test('completed knot keeps its return folds central and both free ends straight',()=>{
 for(let i=1155;i<=1188;i++){
  const state=paperMotion(frames[i]);
  for(const s of state.strips){
   for(const edge of s.edges.filter(e=>e.kind==='true-crease')){
    assert.ok(Math.abs(edge.center[0])<.25,`${i/60}s ${edge.id} folds outside the knot`);
    assert.ok(edge.center[1]>-.10&&edge.center[1]<.20,`${i/60}s ${edge.id} oversized return`);
   }
   const tail=panel(s,'outgoing-end');
   assert.equal(tail.to.kind,'free-end');
   assert.ok(tail.length>4*tail.width,'usable straight free end');
  }
  const a=strip(state,'A'),b=strip(state,'B'),front=panel(a,'upper-return');
  assert.equal(panel(a,'first-underpass').to,front.from,'upper shoulder joins the front wrap');
  const opposing=panel(b,'hidden-return');
  assert.equal(opposing.to,panel(b,'outgoing-end').from,'opposing face joins the other tail');
  assert.ok(opposing.layer>panel(a,'front-cross').layer&&opposing.layer<front.layer,'opposing return remains visible between the wrap faces');
 }
});

test('B feed boundary converges without exposing forced extra crease length',()=>{
 const f=frames[990],sample=t=>paperMotion({...f,originalPTS:t});
 const a=sample(16.5-1e-7),b=sample(16.5+1e-7);
 for(const s of a.strips){const next=strip(b,s.material);assert.ok(Math.hypot(...s.guideEnd.map((v,j)=>v-next.guideEnd[j]))<1e-5);}
 for(const h of a.rig.hands){const next=b.rig.hands.find(x=>x.identity===h.identity);assert.ok(Math.hypot(...h.grip.map((v,j)=>v-next.grip[j]))<1e-5);}
});
