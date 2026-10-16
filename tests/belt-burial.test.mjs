import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {paperMotion} from '../src/paper-motion.js';
import {paperRenderLayers} from '../src/paper-scene.js';
const frames=JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url)))).frames;
const area=vertices=>Math.abs(vertices.reduce((sum,a,i)=>{const b=vertices[(i+1)%vertices.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;
const frontArea=state=>paperRenderLayers(state).front.filter(p=>p.material==='B').reduce((sum,p)=>sum+area(p.vertices),0);

test('waist entry partitions existing B faces without changing contact geometry or adding crease edges',()=>{
 for(let i=960;i<990;i++){
  const state=paperMotion(frames[i]),before=JSON.stringify(state),b=state.strips.find(s=>s.material==='B'),layers=paperRenderLayers(state);
  const fragments=[...layers.underBand,...layers.front].filter(p=>p.material==='B');
  assert.equal(JSON.stringify(state),before,'render decomposition must not mutate motion/contact panels');
  for(const original of b.panels){
   const parts=fragments.filter(p=>p.id===original.id);
   assert.ok(Math.abs(parts.reduce((sum,p)=>sum+area(p.vertices),0)-area(original.vertices))<1e-9,'partition must preserve the visible physical face area');
   for(const part of parts){assert.equal(part.from,original.from);assert.equal(part.to,original.to);assert.equal(part.N,original.N);assert.equal(part.D,original.D);}
  }
  for(const part of layers.front.filter(p=>p.material==='B'))for(const vertex of part.renderMaterialCoordinates??[]){assert.ok(vertex.s>=b.buriedMaterialS-1e-9);assert.ok(vertex.s<=b.visibleMaterialS+1e-9);}
  for(const part of layers.underBand.filter(p=>p.material==='B'))for(const vertex of part.renderMaterialCoordinates??[])assert.ok(vertex.s<=b.buriedMaterialS+1e-9);
 }
});

test('B front-facing area converges before 16.5 rather than disappearing as a whole face at entry',()=>{
 assert.ok(frontArea(paperMotion(frames[960]))>.05,'exercise visible pre-entry material');
 assert.ok(frontArea(paperMotion(frames[980]))<.02);
 assert.ok(frontArea(paperMotion(frames[989]))<.00005,'last native frame must have only a tiny remaining front sliver');
 const before=paperMotion({...frames[990],originalPTS:16.5-1e-5}),at=paperMotion(frames[990]);
 assert.ok(frontArea(before)<1e-9,'dense boundary sample must approach zero front area');
 assert.equal(frontArea(at),0);
});

test('render-only burial leaves other materials and other lesson phases untouched',()=>{
 for(const i of [120,899,900,959,990,1050,1170]){
  const state=paperMotion(frames[i]),layers=paperRenderLayers(state);
  for(const panel of state.strips.flatMap(s=>s.panels))assert.ok(Object.values(layers).flat().includes(panel),'outside burial interval render keeps the original panel');
 }
 for(const i of [960,970,980,989]){
  const state=paperMotion(frames[i]),layers=paperRenderLayers(state);
  for(const panel of state.strips[0].panels)assert.ok(Object.values(layers).flat().includes(panel),'A topology/layers must not be affected by B entry');
 }
});
