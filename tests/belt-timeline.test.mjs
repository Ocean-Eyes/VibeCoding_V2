import test from 'node:test';
import assert from 'node:assert/strict';
import {createBeltTimeline} from '../src/belt-timeline.js';
test('anime.js timeline progresses monotonically and holds before completing insertion',()=>{
 const {timeline,head}=createBeltTimeline({step:4});let last=0,holds=0;
 try{for(let t=0;t<=timeline.duration;t+=50){timeline.seek(t,true);assert.ok(head.value>=last-1e-8&&head.value>=0&&head.value<=1);if(Math.abs(head.value-.58)<1e-6)holds++;last=head.value}
 timeline.seek(timeline.duration,true);assert.equal(head.value,1);assert.ok(holds>=15,'insertion inspection lasts at least 750ms');
 }finally{timeline.cancel()}
});
test('seeking does not advance lesson callbacks and cancel stops playback',()=>{
 let completed=0;const {timeline,head}=createBeltTimeline({step:5,onComplete:()=>completed++});
 timeline.seek(timeline.duration,true);assert.equal(completed,0);assert.equal(head.value,1);timeline.seek(0,true);assert.equal(head.value,0);timeline.cancel();assert.equal(timeline.paused,true);
});
