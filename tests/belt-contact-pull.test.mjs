import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBlenderBelt} from '../src/belt-blender-motion.js';

const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const sample=(strip,s,v=0,side=0)=>strip.sampleMaterialPoint(strip.sourceToMaterial(s),v,side).center;

test('closing the blue loop preserves the accepted yellow lower fold',()=>{
 // Captured from the user-accepted A correction before the subsequent B edit.
 const expected=JSON.parse(readFileSync(new URL('./fixtures/belt-accepted-a-contact.json',import.meta.url)));
 const a=buildBlenderBelt(19.8).strips[0];
 for(const {s,v,point} of expected.filter(p=>p.s<.59))assert.ok(distance(sample(a,s,v),point)<1e-7,`accepted lower A changed at ${s}, ${v}`);
});

test('both blue returns close against yellow while retaining their finite thickness',()=>{
 const [a,b]=buildBlenderBelt(19.8).strips;
 // Material slides as the blue face moves right. Search only the two named
 // returns against their opposing A spans. The tightened lower blue return
 // contacts outgoing A; restricting both to standing A misses that contact.
 const standing=[];
 for(let s=.15;s<.9;s+=.002)for(let v=-.039;v<=.039;v+=.0039)standing.push(sample(a,s,v));
 for(const [lo,hi] of [[.35,.45],[.51,.623]])for(const v of [-.0312,0,.0312]){
  let gap=Infinity;
  for(let s=lo;s<=hi;s+=.001){const p=sample(b,s,v);for(const q of standing)gap=Math.min(gap,distance(p,q));}
  assert.ok(gap<.010,'the return remains loose against its opposing material');
  assert.ok(gap>.006,'opposing mid-surfaces overlap their combined thickness');
 }
 assert.ok(sample(b,.5)[0]>-.06,'the blue front face has not cinched farther rightward');
 for(const strip of [a,b])for(const s of [.36,.42,.48,.54,.6])for(const v of [-.039,0,.039]){
  assert.ok(Math.abs(distance(sample(strip,s,v,-1),sample(strip,s,v,1))-.006)<1e-9,'contact was closed by thinning the belt');
 }
});

test('different cross-section resolutions form one closed material surface at every join',()=>{
 const mesh=buildBlenderBelt(19.8),edges=new Map();
 for(const face of mesh.midTriangles)for(let i=0;i<3;i++){
  const a=face[i],b=face[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');
  const entry=edges.get(key)??{count:0,a,b};entry.count++;edges.set(key,entry);
 }
 for(const {count,a,b} of edges.values()){
  assert.ok(count<=2,'non-manifold material edge');
  if(count===2)continue;
  const p=mesh.materialUV[a],q=mesh.materialUV[b];
  const widthEdge=Math.abs(Math.abs(p[1])-.039)<1e-8&&Math.abs(p[1]-q[1])<1e-8;
  const tipEdge=Math.abs(p[0]-q[0])<1e-8&&(p[0]<1e-8||Math.abs(p[0]-mesh.length)<1e-8);
  assert.ok(widthEdge||tipEdge,`internal seam left open at ${p} / ${q}`);
 }
});

test('the additional blue cinch retains the user-accepted yellow upper silhouette',()=>{
 const a=buildBlenderBelt(19.8).strips[0];
 const expected=JSON.parse(readFileSync(new URL('./fixtures/belt-accepted-upper-contact.json',import.meta.url)));
 // Finite-radius smoothing removes an inner-skin pinch. Bound its visible
 // displacement against the accepted pose captured before the blue-only edit.
 for(const {s,v,point} of expected){const p=sample(a,s,v);assert.ok(Math.hypot(p[0]-point[0],p[1]-point[1])<.001,'accepted yellow silhouette changed');}
});
