import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleThrow} from '../src/throw-motion.js';
import {createThrowGuide,throwGuidePose} from '../src/throw-guide.js';

for(const id of ['o-uchi-gari','ippon-seoi-nage']){
 test(`${id}: reference guide preserves the original body and anatomical sides`,()=>{
  for(let i=0;i<=120;i++){
   const body=sampleThrow(id,i/40).tori,before=JSON.stringify(body),p=throwGuidePose(body);
   for(const [side,shoulder,elbow,wrist,hip,knee,ankle]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
    for(const [index,v]of [[shoulder,body.shoulders[side]],[elbow,body.arms[side].joint],[wrist,body.arms[side].end],[hip,body.legs[side].root],[knee,body.legs[side].joint],[ankle,body.legs[side].end]]){
     assert.equal(p[index].x,(v[0]-body.pelvis[0])/.49);assert.equal(p[index].y,-(v[1]-body.pelvis[1])/.49);
    }
   }
   assert.equal(JSON.stringify(body),before);
  }
 });
 test(`${id}: one fixed mirrored viewport contains the full animation in separate panels`,()=>{
  const guide=createThrowGuide(id),scale=guide.scale;
  for(let i=0;i<=600;i++){
   const p=guide.pose(sampleThrow(id,i/200).tori),left=guide.project(p),right=guide.project(p,300);
   for(let j=0;j<p.length;j++)if(p[j]){
    assert(left[j].x>=12&&left[j].x<=288);assert(left[j].y>=12&&left[j].y<=408);
    assert(Math.abs(right[j].x-left[j].x-300)<1e-9);assert.equal(right[j].y,left[j].y);
   }
   assert.equal(guide.scale,scale);
  }
  const p=guide.project(guide.pose(sampleThrow(id,0).tori));
  assert(p[16].x>p[15].x,'mirror places the right hand on screen-right');
 });
}
