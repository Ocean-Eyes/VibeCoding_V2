import test from 'node:test';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {normalizeControls} from '../src/belt-controls.js';
import {sampleRenderFrame,shortestAngle} from '../src/belt-interpolation.js';
import {clockSegments} from '../src/belt-clock.js';
import {BELT_INTERVALS,sourcePTS} from '../src/belt-sequence.js';
const source=JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url)))),track=normalizeControls(source),digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
import {createBeltTimeline} from '../src/belt-timeline.js';
test('every native PTS returns the exact original frame and original fields',()=>{for(const frame of track.frames){const s=sampleRenderFrame(track,frame.originalPTS);assert.equal(s.frame,frame);assert.equal(s.interpolated,false);assert.equal(s.alpha,0)}});
test('all interval midpoints only interpolate resolved controls, leaving raw observation and physical tips intact',()=>{
 const before=digest(source);
 for(let i=0;i<track.frames.length-1;i++){
  const a=track.frames[i],b=track.frames[i+1],s=sampleRenderFrame(track,(a.originalPTS+b.originalPTS)/2);assert.equal(s.interpolated,true);assert.equal(s.sourceFrame,a);assert.equal(s.frame.beltEnds,a.beltEnds);assert.equal(s.frame.constraints,a.constraints);
  assert.ok(Math.abs(s.alpha-.5)<1e-10);assert.equal(s.frame.renderInference.nextFrameIndex,i+1);
  for(const key of ['Left','Right']){assert.equal(s.frame.hands[key]?.observed,a.hands[key]?.observed);const u=a.hands[key]?.resolved,v=b.hands[key]?.resolved;if(u&&v)for(let d=0;d<2;d++)assert.ok(Math.abs(s.frame.hands[key].resolved.gripCenter[d]-(u.gripCenter[d]+v.gripCenter[d])/2)<1e-10)}
 }
 assert.equal(digest(source),before);
});
test('angular interpolation crosses pi by its shortest arc',()=>{
 const a=179*Math.PI/180,b=-179*Math.PI/180,m=shortestAngle(a,b,.5);assert.ok(Math.abs(m-Math.PI)<1e-10);assert.ok(Math.abs(shortestAngle(b,a,.5)+Math.PI)<1e-10);
});
test('rapid passage alone slows to 0.3x and adds less than one second',()=>{
 const segments=clockSegments(BELT_INTERVALS[3],3),slow=segments.filter(x=>x.rate===.3);assert.equal(slow.length,1);assert.equal(slow[0].sourceFrom,10.65);assert.equal(slow[0].sourceTo,11);
 const added=segments.reduce((s,p)=>s+p.duration,0)-(BELT_INTERVALS[3].to-BELT_INTERVALS[3].from)*1000;assert.ok(Math.abs(added-816.6666666667)<1e-6);
 assert.deepEqual(segments.filter(p=>p.hold).map(p=>p.sourceTo),[9.5,11.5]);
});
test('anime timeline crosses slow boundaries continuously and preserves all source times',()=>{
 const {timeline,head}=createBeltTimeline({step:3});try{let previous=-Infinity;for(let t=0;t<=timeline.duration;t+=4){timeline.seek(t,true);const pts=sourcePTS(3,head.value);assert.ok(pts>=previous-1e-8);assert.ok(pts-previous<.00401||previous===-Infinity);previous=pts}timeline.seek(timeline.duration,true);assert.equal(sourcePTS(3,head.value),12.5);
 let cursor=350;for(const part of clockSegments(BELT_INTERVALS[3],3)){timeline.seek(cursor+part.duration/2,true);assert.ok(Math.abs(sourcePTS(3,head.value)-(part.sourceFrom+part.sourceTo)/2)<1e-6);cursor+=part.duration+part.hold}
 }finally{timeline.cancel()}
});
