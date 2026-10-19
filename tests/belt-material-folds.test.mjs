import test from 'node:test';
import assert from 'node:assert/strict';
import {foldMaterialStrip,planMaterialStrip} from '../src/belt-material-folds.js';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),norm=a=>Math.hypot(...a);
test('finite radius creases preserve intrinsic width, length, orthogonality, thickness and boundary continuity',()=>{
 for(const k of[-1,-.5,0,.5,1])for(const angle of[-Math.PI,-1,1,Math.PI]){
  const strip=foldMaterialStrip('A',{length:.8,creases:[{s:.4,k,angle}]});
  for(let s=.2;s<.6;s+=.0027)for(const u of[-.04,0,.04]){
   const e=1e-6,p=strip.sampleMaterialPoint(s,u),ds=sub(strip.sampleMaterialPoint(s+e,u).center,p.center).map(v=>v/e),du=sub(strip.sampleMaterialPoint(s,u+e).center,p.center).map(v=>v/e);
   assert.ok(Math.abs(norm(ds)-1)<1e-7);assert.ok(Math.abs(norm(du)-1)<1e-7);assert.ok(Math.abs(dot(ds,du))<1e-7);
   assert.ok(Math.abs(norm(sub(strip.sampleMaterialPoint(s,u,1).center,strip.sampleMaterialPoint(s,u,-1).center))-.008)<1e-10);
  }
  for(const sign of[-1,1]){const s=.4+sign*Math.abs(angle)*.008/2*Math.hypot(1,k);assert.ok(norm(sub(strip.sampleMaterialPoint(s-1e-8).center,strip.sampleMaterialPoint(s+1e-8).center))<2.001e-8);}
  assert.ok(strip.vertices3D.flat().every(Number.isFinite));
 }
});
test('sequential opposite creases stay isometric and end within the finite material domain',()=>{
 const strip=foldMaterialStrip('B',{length:1,creases:[{s:.25,k:.5,angle:Math.PI,before:'upper-return'},{s:.65,k:-.5,angle:-Math.PI}]});
 for(let s=.1;s<.9;s+=.003){const p=strip.sampleMaterialPoint(s),q=strip.sampleMaterialPoint(s+1e-6);assert.ok(Math.abs(norm(sub(q.center,p.center))/1e-6-1)<1e-7);}
 assert.equal(strip.segments[0].name,'upper-return');assert.equal(strip.segments.at(-1).name,'outgoing-run');assert.equal(strip.totalMaterialS,1);
});
test('reject intersecting material crease bands, zero inner bend radius, and skewed width basis',()=>{
 assert.throws(()=>foldMaterialStrip('A',{length:.5,creases:[{s:.25,k:1,angle:Math.PI},{s:.26,k:-1,angle:Math.PI}]}),/overlap/);
 assert.throws(()=>foldMaterialStrip('A',{length:.5,creases:[{s:.25,angle:Math.PI,radius:.004}]}),/inner radius/);
 assert.throws(()=>foldMaterialStrip('A',{length:.5,basis:[[1,0,0],[1,1,0],[0,0,1]]}),/basis/);
});

test('planning is geometry-identical without mesh allocation; clipping retains full material identity',()=>{
 const options={length:.8,creases:[{s:.4,k:.5,angle:Math.PI}],visibleMaterialS:.415};
 const plan=planMaterialStrip('B',options),mesh=foldMaterialStrip('B',options);
 assert.equal(plan.vertexData,undefined);
 for(const s of[0,.38,.4,.415,.7])assert.deepEqual(plan.sampleMaterialPoint(s),mesh.sampleMaterialPoint(s));
 assert.equal(mesh.visibleMaterialS,.415);assert.equal(mesh.totalMaterialS,.8);
 assert.equal(mesh.samples.at(-1).materialS,.415);assert.equal(mesh.fullSamples.at(-1).materialS,.8);
 assert.ok(mesh.vertexMaterial.every(v=>v.materialS<=.415));
 const counts=new Map();for(const triangle of mesh.triangles)for(let i=0;i<3;i++){const a=triangle[i],b=triangle[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');counts.set(key,(counts.get(key)??0)+1);}assert.ok([...counts.values()].every(n=>n===2),'actual cut end is a closed mesh');
});

// A bent finite-radius surface must use its exact material map for a grasp.
test('contact lookup follows the bent material surface between sparse samples',async()=>{
 const {contactpointByMaterialS,contactpointBySemantic}=await import('../src/belt-volume.js');
 const strip=foldMaterialStrip('A',{length:1,width:.09,thickness:.008,step:.2,creases:[{s:.5,k:.3,angle:2.7,radius:.025,before:'standing'}]});
 for(const s of [.473,.489,.507,.529]){
  const exact=strip.sampleMaterialPoint(s),contact=contactpointByMaterialS(strip,s,{visible:false});
  assert.deepEqual(contact.center,exact.center);
  assert.deepEqual(contact.tangent,exact.tangent);
 }
 const contact=contactpointBySemantic(strip,'standing',.973);
 assert.deepEqual(contact.center,strip.sampleMaterialPoint(.5*.973).center);
});
