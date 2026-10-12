import test from 'node:test';
import assert from 'node:assert/strict';
import {POSES,targetPose,bodyFrame} from '../src/pose.js';
import {GRIP_STEPS,opponentFrame,demonstrationAt,practiceGuide,sceneHands} from '../src/demonstration.js';

test('grips finish on the upper lapels, preparation stays below the shoulders',()=>{
  assert.ok(GRIP_STEPS[0].every(p=>p.y>.5));
  assert.ok(GRIP_STEPS[2].every(p=>Math.abs(p.x)<.3&&p.y>.15&&p.y<.45));
  assert.ok(GRIP_STEPS[2][0].x<GRIP_STEPS[2][1].x);
});
test('demonstration moves one crossing hand at a time and releases continuously',()=>{
  assert.deepEqual(demonstrationAt(4).hands,GRIP_STEPS[1]);
  assert.deepEqual(demonstrationAt(7).hands,GRIP_STEPS[2]);
  assert.deepEqual(demonstrationAt(3).hands[1],GRIP_STEPS[0][1]);
  assert.deepEqual(demonstrationAt(6).hands[0],GRIP_STEPS[1][0]);
  for(const boundary of [2,5,8,10,12]){
    const before=demonstrationAt(boundary-.001).hands,after=demonstrationAt(boundary+.001).hands;
    before.forEach((p,i)=>assert.ok(Math.hypot(p.x-after[i].x,p.y-after[i].y)<.01));
  }
});
test('scene anchors remain fixed when the user translates, rotates or changes size',()=>{
  const scene=opponentFrame(900,600);
  for(const scale of [90,180,300])for(const angle of [0,.3,-.4]){
    const frame={origin:{x:320+scale,y:200},scale,x:{x:Math.cos(angle),y:Math.sin(angle)},y:{x:-Math.sin(angle),y:Math.cos(angle)}};
    const points=targetPose(frame,POSES[2]),tracked=bodyFrame(points),target=targetPose(tracked,POSES[2],points);
    const hands=sceneHands(points,tracked,target,2);
    hands.forEach((p,i)=>assert.ok(Math.hypot(p.x-GRIP_STEPS[2][i].x,p.y-GRIP_STEPS[2][i].y)<1e-10));
    assert.deepEqual(opponentFrame(900,600),scene);
  }
});
test('wrong wrists move the user marker away from the guide; invisible wrists disappear',()=>{
  const frame={origin:{x:400,y:200},scale:160,x:{x:1,y:0},y:{x:0,y:1}};
  const target=targetPose(frame,POSES[2]);const points=target.map(p=>p?{...p}:null);
  points[15].x+=80;points[16].visibility=.1;
  const hands=sceneHands(points,frame,target,2);
  assert.equal(hands[0].x,GRIP_STEPS[2][0].x+.5);assert.equal(hands[1],null);
});

test('practice guides stay at the scoring target after arriving, without looping away',()=>{
  for(let step=0;step<3;step++)for(const seconds of [1.5,4,8,20]){
    practiceGuide(step,seconds).forEach((p,i)=>assert.ok(Math.hypot(p.x-GRIP_STEPS[step][i].x,p.y-GRIP_STEPS[step][i].y)<1e-10));
  }
});
