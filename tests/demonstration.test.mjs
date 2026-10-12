import test from 'node:test';
import assert from 'node:assert/strict';
import {POSES,targetPose,bodyFrame} from '../src/pose.js';
import {GRIP_STEPS,opponentFrame,demonstrationAt,practiceGuide,sceneHands,gripPlacement,guideElbow} from '../src/demonstration.js';

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

// Geometry regression for an actual crossed grip, not two upright floating fists.
test('final hands follow the V collar and their cuffs cross without breaking under mirroring',()=>{
  const placements=GRIP_STEPS[2].map((p,i)=>gripPlacement(p,i));
  assert.ok(placements[0].x>placements[1].x);
  assert.ok(placements[0].wrist.x<placements[1].wrist.x);
  for(const [i,p]of placements.entries()){
    assert.ok(Math.abs(p.angle)>.8);
    const contact={x:p.x+Math.sin(p.angle)*.3*.27,y:p.y-Math.cos(p.angle)*.3*.27};
    assert.ok(Math.abs(contact.x)>.13&&Math.abs(contact.x)<.29);
    assert.ok(contact.y>.10&&contact.y<.17);
    const reflected=gripPlacement(GRIP_STEPS[2][i],i,false);
    assert.equal(reflected.x,-p.x);assert.equal(reflected.angle,-p.angle);
    assert.equal(reflected.wrist.x,-p.wrist.x);assert.equal(reflected.wrist.y,p.wrist.y);
  }
});

import {TECHNIQUES} from '../src/curriculum.js';
test('Kodokan cross-grip variations retain their palm orientation and distinct final action',()=>{
  const [nami,gyaku,kata]=TECHNIQUES;
  assert.deepEqual(nami.directions,['↓','↓']);assert.deepEqual(nami.actions,['press','press']);
  assert.deepEqual(gyaku.directions,['↑','↑']);assert.deepEqual(gyaku.actions,['draw','draw']);
  assert.deepEqual(kata.directions,['↑','↓']);assert.deepEqual(kata.actions,['draw','press']);
  assert.match(demonstrationAt(4,nami).label,/엄지/);
  assert.match(demonstrationAt(4,gyaku).label,/네 손가락/);
  assert.match(demonstrationAt(4,kata).label,/네 손가락/);
  assert.match(demonstrationAt(7,kata).label,/엄지/);
  assert.equal(new Set(TECHNIQUES.map(t=>demonstrationAt(9,t).label)).size,3);
  for(const t of TECHNIQUES){
    assert.deepEqual(demonstrationAt(9,t).hands,GRIP_STEPS[2]);
    assert.equal(demonstrationAt(8,t).finish,0);assert.equal(demonstrationAt(9,t).finish,1);
  }
});

test('enlarged partner retains head, sleeves and belt within desktop and narrow viewports',()=>{
 for(const [width,height]of [[954,596],[336,448],[266,355],[380,220]]){
  const frame=opponentFrame(width,height),old=Math.min(width/2.6,height/3);
  assert.ok(frame.scale>=old*1.24);
  assert.ok(frame.origin.y-.55*frame.scale>=0);
  assert.ok(frame.origin.y+1.68*frame.scale<=height);
  assert.ok(frame.origin.x-.9*frame.scale>=0&&frame.origin.x+.9*frame.scale<=width);
 }
});

test('finish raises both demonstrated elbows while keeping upper-collar hand positions fixed',()=>{
 for(const mirrored of [true,false])for(const index of [0,1]){
  const start=guideElbow(index,0,mirrored),finish=guideElbow(index,1,mirrored);
  assert.equal(start.x,finish.x);assert.ok(finish.y<start.y-.20);
 }
 assert.deepEqual(demonstrationAt(8).hands,demonstrationAt(9).hands);
});
