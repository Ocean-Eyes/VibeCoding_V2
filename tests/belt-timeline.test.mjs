import test from 'node:test';
import assert from 'node:assert/strict';
import {BELT_INTERVALS,sourcePTS} from '../src/belt-sequence.js';
const beltInspectionPoints=step=>{const s=BELT_INTERVALS[step];return s.holds.map(t=>(t-s.from)/(s.to-s.from))};
import {createBeltTimeline} from '../src/belt-timeline.js';
test('anime.js timeline progresses monotonically and holds before completing insertion',()=>{
 const {timeline,head}=createBeltTimeline({step:4});let last=0,holds=0;
 try{for(let t=0;t<=timeline.duration;t+=50){timeline.seek(t,true);assert.ok(head.value>=last-1e-8&&head.value>=0&&head.value<=1);if(Math.abs(head.value-beltInspectionPoints(4)[0])<1e-6)holds++;last=head.value}
 timeline.seek(timeline.duration,true);assert.equal(head.value,1);assert.ok(holds>=15,'insertion inspection lasts at least 750ms');
 }finally{timeline.cancel()}
});
test('seeking does not advance lesson callbacks and cancel stops playback',()=>{
 let completed=0;const {timeline,head}=createBeltTimeline({step:5,onComplete:()=>completed++});
 timeline.seek(timeline.duration,true);assert.equal(completed,0);assert.equal(head.value,1);timeline.seek(0,true);assert.equal(head.value,0);timeline.cancel();assert.equal(timeline.paused,true);
});

test('B threading separately pauses at the waist entry and the front opening exit',()=>{
 const {timeline,head}=createBeltTimeline({step:5});const stops=beltInspectionPoints(5),counts=stops.map(()=>0);
 try{
  for(let t=0;t<timeline.duration;t+=25){timeline.seek(t,true);stops.forEach((value,i)=>{if(Math.abs(head.value-value)<1e-6)counts[i]++})}
  assert.ok(counts.every(n=>n>=35),'each physical event holds for at least 875 ms');
 }finally{timeline.cancel()}
});

test('inspection callback reports the exact held pose from its first frame',()=>{
 const stops=beltInspectionPoints(5),seen=[];
 const {timeline}=createBeltTimeline({step:5,onUpdate:(value,hold)=>{if(hold)seen.push(value)}});
 try{
  for(let t=0;t<timeline.duration;t+=17)timeline.seek(t);
  assert.ok(seen.length>50);assert.ok(seen.every(value=>stops.includes(value)));
 }finally{timeline.cancel()}
});

test('all seven intervals join without skipping original source motion',()=>{
 assert.equal(BELT_INTERVALS[0].from,0);assert.equal(BELT_INTERVALS.at(-1).to,19.8);
 for(let i=1;i<7;i++)assert.equal(BELT_INTERVALS[i-1].to,BELT_INTERVALS[i].from);
 assert.deepEqual(BELT_INTERVALS[4].holds,[13.75]);assert.deepEqual(BELT_INTERVALS[5].holds,[16.25,17.5]);
});
test('source PTS advances linearly between holds and stage five plays at 0.65x',()=>{
 const {timeline,head}=createBeltTimeline({step:4});
 try{timeline.seek(450,true);const a=sourcePTS(4,head.value);timeline.seek(950,true);const b=sourcePTS(4,head.value);assert.ok(Math.abs(b-a-.325)<.001)}finally{timeline.cancel()}
});
