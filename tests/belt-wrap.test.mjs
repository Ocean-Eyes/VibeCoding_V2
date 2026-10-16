import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {wrapPhase} from '../src/belt-wrap-motion.js';
import {paperMotion} from '../src/paper-motion.js';
import {BELT_REVIEW} from '../src/belt-source.js';
const frames=JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url)))).frames;
test('center starts with one waist band and the second wrap advances from both hips',()=>{
 assert.equal(wrapPhase(2).waistBands.length,1);
 let previous=0;
 for(let i=249;i<=324;i++){
  const p=wrapPhase(i/60),width=p.waistBands.filter(b=>b.layer===1).reduce((sum,b)=>sum+b.to-b.from,0);
  assert.ok(width>=previous-1e-10);assert.ok(width<=.86+1e-10);previous=width;
 }
 assert.ok(Math.abs(previous-.86)<1e-10);
});
test('visible wrap and handoff keep both hands in contact with material, including 7-8 seconds',()=>{
 for(let i=120;i<540;i++){
  const state=paperMotion(frames[i]);if(state.behindBody||state.wrap.contactWeight===0)continue;
  assert.equal(state.contacts.length,2,`${i/60}s lost hand contact`);
  for(const c of state.contacts){
   if(c.acquisitionWeight<1)continue; // Acquisition intentionally ramps the contact correction.
   assert.ok(Math.hypot(...c.actualContactPoint.map((x,j)=>x-c.assignedPoint[j]))<1e-8);
  }
 }
});
test('front crossing joins opposite waist sides before the two shortened ends descend',()=>{
 const state=paperMotion(frames[324]);
 for(const strip of state.strips){
  const first=strip.fullPanels[0],tail=strip.fullPanels.at(-1);
  assert.ok(first.from.center[0]*first.to.center[0]<0,`${strip.material} never crosses the midline`);
  assert.ok(tail.to.center[1]>tail.from.center[1]+.2);
  assert.ok(strip.guideEnd[1]<1.02,'display end must stay above the knee');
 }
});
test('the wrap-to-first-pass boundary keeps the same endpoints',()=>{
 const before=paperMotion({...frames[540],originalPTS:9-1e-7}),after=paperMotion(frames[540]);
 for(const material of ['A','B'])assert.ok(Math.hypot(...before.guideEnds[material].position.map((x,j)=>x-after.guideEnds[material].position[j]))<1e-5);
});
test('the shipped wrap helper matches its provenance hash',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../src/belt-wrap-motion.js',import.meta.url))).digest('hex'),BELT_REVIEW.wrapMotionSHA256);
});


test('rear occlusion releases and reacquires contacts continuously',()=>{
 for(const boundary of [2.8,3.95]){
  for(const t of [boundary-1e-7,boundary,boundary+1e-7])assert.ok(wrapPhase(t).contactWeight<1e-6);
 }
 let previous=wrapPhase(2.5).contactWeight;
 for(let i=151;i<=270;i++){
  const weight=wrapPhase(i/60).contactWeight;
  assert.ok(weight>=0&&weight<=1);
  assert.ok(Math.abs(weight-previous)<.11,`contact jump at ${i}`);previous=weight;
 }
});

test('rear exchange cannot expose a full front X on frame226',()=>{
 for(let i=168;i<237;i++){
  const state=paperMotion(frames[i]);assert.equal(state.behindBody,true,`rear source interval ${i}`);
  for(const strip of state.strips)assert.ok(strip.visibleMaterialS<1e-8,`premature front material ${i}`);
 }
 const first=paperMotion(frames[238]);
 for(const strip of first.strips)assert.ok(strip.visibleMaterialS/strip.totalMaterialS<.01,'return must emerge as material, not a full-route pop');
});

test('every returning front frame keeps a broad free face and short ends',()=>{
 for(let i=237;i<=350;i++){
  const state=paperMotion(frames[i]);
  for(const strip of state.strips){
   assert.ok(strip.guideEnd[1]<.9,`${i} ${strip.material}: display end below allowed height`);
   for(const panel of strip.panels)assert.ok(Math.hypot(panel.N[0],panel.N[1])>.95,`${i} ${panel.id}: face collapses edge-on`);
  }
 }
 for(let i=300;i<=324;i++){
  const state=paperMotion(frames[i]);
  for(const strip of state.strips){
   const first=strip.fullPanels[0];assert.ok(first.from.center[0]*first.to.center[0]<0,`${i}: front crossing missing`);
   assert.ok(first.to.center[1]>.12,`${i}: crossing swallowed by standing band`);
  }
 }
});

test('B does not twist into a hanging end while it is still held stationary',()=>{
 for(let i=480;i<=558;i++){
  const b=paperMotion(frames[i]).strips[1];
  for(const p of b.fullPanels)assert.ok(Math.hypot(p.N[0],p.N[1])>.99,`${i} held B rotates edge-on`);
 }
});
