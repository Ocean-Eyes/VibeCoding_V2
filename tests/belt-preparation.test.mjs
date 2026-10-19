import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildPreparationBelt} from '../src/belt-preparation.js';
import {buildBlenderBelt} from '../src/belt-blender-motion.js';
import {lessonMotion} from '../src/belt-volume-motion.js';
import {normalizeControls} from '../src/belt-controls.js';
import {bodyFrontDepth,rasterVolume} from '../src/belt-volume-render.js';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const frames=normalizeControls(JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url))))).frames;

test('the same unwrapped midpoint lowers from chest to waist before material is wrapped',()=>{
 const first=buildPreparationBelt(0),waist=buildPreparationBelt(2);
 assert.equal(first.preparation.laid,0);assert.equal(waist.preparation.laid,0);
 assert.ok(first.preparation.midpoint[1]<-.5);assert.ok(Math.abs(waist.preparation.midpoint[1]-.03)<1e-8);
 for(const state of [first,waist]){
  assert.equal(state.displayWidth,.078);assert.equal(state.displayThickness,.006);
  for(const strip of state.strips)assert.ok(strip.samples.at(-1).center[1]>1.8,'full-length free ends hang below the waist');
  assert.ok(state.midsurface.every(p=>p[1]<=2.415),'free ends pass through the floor');
 }
});

test('actual preparation center-line length remains within tessellation error of the material budget',()=>{
 for(const t of [0,1,2,2.8,3.4,4.1,5,6,7,8.49]){
  const v=buildPreparationBelt(t);let length=0,p=v.sampleMaterialPoint(0).center;
  for(let i=1;i<=2400;i++){const q=v.sampleMaterialPoint(v.length*i/2400).center;length+=distance(p,q);p=q;}
  assert.ok(Math.abs(length-v.length)<.004,`${t}: center-line ${length}, material ${v.length}`);
 }
});

test('the preparation surface converges to the unchanged first Blender surface',()=>{
 const a=buildPreparationBelt(8.5-1e-5),b=buildBlenderBelt(8.5);
 assert.equal(a.midsurface.length,b.midsurface.length);assert.deepEqual(a.materialUV,b.materialUV);
 for(let i=0;i<a.midsurface.length;i++)assert.ok(distance(a.midsurface[i],b.midsurface[i])<1e-6);
 for(let i=0;i<a.vertexData.length;i++)assert.ok(Math.abs(a.vertexData[i]-b.vertexData[i])<1e-6,'thick render surface changed at the join');
});

test('preparation and first threading keep grips attached and anatomical hands continuous',()=>{
 let prior=null,held=0;
 for(const frame of frames.slice(0,931)){
  const state=lessonMotion(frame);
  if(frame.originalPTS<8.5)assert.ok(state.contacts.length>=1,'both hands release during the same exchange');
  for(const hand of state.rig.hands){
   assert.ok(distance(hand.grip,hand.inputGrip)<1e-8,`unreachable ${frame.originalPTS} ${hand.identity}`);
   if(prior){const old=prior.rig.hands.find(h=>h.identity===hand.identity);assert.ok(distance(hand.grip,old.grip)<.05,`hand jump at ${frame.originalPTS}`);if(frame.originalPTS<8.5)assert.ok(hand.curl.every((v,i)=>Math.abs(v-old.curl[i])<.12),'finger snap during exchange');}
  }
  for(const c of state.contacts)if(c.acquisitionWeight===1){assert.ok(distance(c.actualContactPoint,c.assignedPoint)<1e-8);held++;}
  prior=state;
 }
 assert.ok(held>1400);
});

test('rear tails are hidden by the skirt and trousers while front tails remain visible',()=>{
 for(const y of [.5,1,1.8,2.15]){
  const patch=z=>new Float32Array([.15,y,z,0,0,1,0,0,.25,y,z,0,0,1,0,0,.20,y+.08,z,0,0,1,0,0]);
  assert.ok(bodyFrontDepth(.2,y)>-.2);
  const bounds=[-.5,-.2,.5,2.4];
  assert.ok(!rasterVolume(patch(-.4),120,260,0,true,bounds).some((v,i)=>i%4===3&&v),'rear belt leaks through clothing');
  assert.ok(rasterVolume(patch(.2),120,260,0,true,bounds).some((v,i)=>i%4===3&&v),'front belt incorrectly hidden');
 }
 assert.equal(bodyFrontDepth(.6,1.2),-Infinity,'beside the body stays visible');
 assert.equal(bodyFrontDepth(0,1.2),-Infinity,'the actual gap between the legs is not a solid mask');
});
