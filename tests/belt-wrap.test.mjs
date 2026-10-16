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
  const state=paperMotion(frames[i]);if(state.behindBody)continue;
  assert.equal(state.contacts.length,2,`${i/60}s lost hand contact`);
  for(const c of state.contacts)assert.ok(Math.hypot(...c.actualContactPoint.map((x,j)=>x-c.assignedPoint[j]))<1e-8);
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
