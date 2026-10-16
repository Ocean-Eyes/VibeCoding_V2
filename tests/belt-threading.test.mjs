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

test('final A passage unfolds into one coplanar tail without an extra corner',()=>{
 for(let i=1155;i<=1188;i++){
  const a=strip(paperMotion(frames[i]),'A'),pass=panel(a,'left-layer-pass'),tail=panel(a,'outgoing-end');
  const dot=(u,v)=>u.reduce((sum,x,j)=>sum+x*v[j],0);
  assert.equal(pass.to,tail.from);
  assert.ok(dot(pass.D,tail.D)>1-1e-8,`${i/60}s final A tail still has a visible directional knee`);
  assert.ok(dot(pass.N,tail.N)>1-1e-8,`${i/60}s coplanar tail retains an artificial twist`);
  assert.equal(pass.to.kind,'coplanar-boundary',`${i/60}s unnecessary final A crease`);
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
