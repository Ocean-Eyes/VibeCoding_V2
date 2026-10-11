import test from 'node:test';
import assert from 'node:assert/strict';
import {POSES as JUDO_POSES,bodyFrame,targetPose,armMatch,handMatch,handOpenness,advanceHold,fitRect} from '../src/pose.js';
const POSES=[{angles:[0,0,Math.PI,Math.PI],gesture:'open'},...JUDO_POSES];
const frame={origin:{x:640,y:300},scale:180,x:{x:1,y:0},y:{x:0,y:1}};
test('all targets score 100 against themselves',()=>{for(const pose of POSES){const p=targetPose(frame,pose);assert.equal(armMatch(p,p,frame.scale).score,100)}});
test('alignment is invariant under translation, scale and rotation',()=>{
  const p=targetPose(frame,POSES[1]),theta=.4,s=1.7;
  const transform=p=>({...p,x:s*(p.x*Math.cos(theta)-p.y*Math.sin(theta))+33,y:s*(p.x*Math.sin(theta)+p.y*Math.cos(theta))-120});
  const moved=p.map(p=>p?transform(p):null),aligned=targetPose(bodyFrame(moved),POSES[1]);
  assert.equal(armMatch(moved,aligned,bodyFrame(moved).scale).score,100);
});
test('wrong wrist position reduces accuracy',()=>{const p=targetPose(frame,POSES[0]),wrong=p.map(p=>p?{...p}:null);wrong[15].y+=frame.scale;assert.ok(armMatch(wrong,p,frame.scale).score<50)});
test('missing and low confidence joints never give a score',()=>{assert.equal(bodyFrame(null),null);const p=targetPose(frame,POSES[0]);p[15].visibility=.2;assert.equal(armMatch(p,p,frame.scale),null);p[11].visibility=.2;assert.equal(bodyFrame(p),null)});
test('missing hands never imply a matching gesture',()=>{const p=targetPose(frame,POSES[0]);assert.equal(handMatch([],p,frame.scale,'open'),null)});
function handAt(wrist,fold=false){const hand=Array.from({length:21},()=>({...wrist}));for(const start of[5,9,13,17])for(let i=0;i<4;i++)hand[start+i]={x:wrist.x+(start-11)*2,y:wrist.y-(fold?[10,20,15,11][i]:10+i*10)};return hand}
test('hand matching uses wrist proximity and differentiates open/fist',()=>{const p=targetPose(frame,POSES[0]),open=[handAt(p[16]),handAt(p[15])],fist=[handAt(p[15],true),handAt(p[16],true)];assert.equal(handOpenness(open[0]),1);assert.equal(handMatch(open,p,frame.scale,'open'),100);assert.equal(handMatch(open,p,frame.scale,'fist'),0);assert.equal(handMatch(fist,p,frame.scale,'fist'),100);assert.equal(handMatch(fist,p,frame.scale,'open'),0);assert.equal(handMatch([handAt({x:0,y:0}),open[0]],p,frame.scale,'open'),null)});
test('hold needs continuous valid observations and does not jump after a stalled frame',()=>{assert.equal(advanceHold(1,.1,49,true),0);assert.equal(advanceHold(1,.1,null,true),0);assert.equal(advanceHold(1,.1,100,false),0);assert.equal(advanceHold(1,20,100,true),1.2);assert.equal(advanceHold(2.9,.2,100,true),3)});
test('contain mapping letterboxes 16:9 camera in 4:3 viewport',()=>{assert.deepEqual(fitRect(800,600,1280,720),{x:0,y:75,width:800,height:450,scale:.625})});

test('upper-body webcam crop still aligns targets when hips are not visible',()=>{
  const points=targetPose(frame,POSES[0]);points[23].visibility=.1;points[24].visibility=.1;
  const aligned=bodyFrame(points);assert.ok(aligned);
  assert.equal(armMatch(points,targetPose(aligned,POSES[0]),aligned.scale).score,100);
  points[23]=null;points[24]=null;assert.ok(bodyFrame(points));
});

test('target adapts to longer arms without accepting a wrong direction',()=>{
  const p=targetPose(frame,POSES[0]);
  for(const [s,e,w,sign]of [[11,13,15,1],[12,14,16,-1]]){
    p[e].x=p[s].x+sign*frame.scale*.95;p[w].x=p[e].x+sign*frame.scale*.9;
  }
  assert.ok(armMatch(p,targetPose(frame,POSES[0]),frame.scale).score<70);
  assert.equal(armMatch(p,targetPose(frame,POSES[0],p),frame.scale).score,100);
  assert.ok(armMatch(p,targetPose(frame,POSES[1],p),frame.scale).score<50);
});
test('50 percent starts the hold; lower and missing scores do not',()=>{
  assert.equal(advanceHold(1,.1,50,true),1.1);
  assert.equal(advanceHold(1,.1,49,true),0);
  assert.equal(advanceHold(1,.1,75,true),1.1);
  assert.equal(advanceHold(1,.1,null,true),0);
});
