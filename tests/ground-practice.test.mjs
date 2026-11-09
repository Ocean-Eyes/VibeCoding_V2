import test from 'node:test';import assert from 'node:assert/strict';
import {GroundProgress} from '../src/ground-practice.js';
import {sampleGround} from '../src/ground-motion.js';
import {groundFixture} from './ground-fixture.mjs';
test('opponent bent arm stays at 90 degrees throughout the connection',()=>{
 for(let t=0;t<=2;t+=.05){const {uke}=sampleGround('ude-garami',t),arm=uke.arms.right;
 assert(arm.joint[0]<arm.root[0],'anatomical right arm extends outwards');
 assert(arm.end[2]<arm.joint[2],'forearm points toward the head');
 const a=arm.root.map((v,i)=>v-arm.joint[i]),b=arm.end.map((v,i)=>v-arm.joint[i]);
 assert(Math.abs(a.reduce((sum,v,i)=>sum+v*b[i],0))<1e-8);
 assert(uke.head[1]<.3);assert(uke.legs.left.end[1]<.2);
 }
 const pose=sampleGround('ude-garami',2);
 assert(Math.hypot(...pose.tori.arms.left.end.map((v,i)=>v-pose.gripTargets.ownGrip[i]))<1e-8);
});
test('ude requires right grip, under-arm passage and then a distinct left grip',()=>{
 const game=new GroundProgress('ude-garami');let now=0;
 const feed=(phase,n=24)=>{let result;for(let i=0;i<n;i++){const f=groundFixture('ude-garami',phase);result=game.update(f.points,f.hands,9/16,now+=50);}return result};
 let f=groundFixture('ude-garami');for(let i=0;i<30;i++)game.update(f.points,[],9/16,now+=50);assert.equal(game.stage,0);
 feed(0);assert.equal(game.stage,1);
 feed(2,50);assert.equal(game.done,false,'skipping the underneath movement must not pass');
 feed(1,2);assert.equal(game.under,true);
 f=groundFixture('ude-garami',2);for(let i=0;i<30;i++)game.update(f.points,f.hands.slice(1),9/16,now+=50);assert.equal(game.done,false);
 feed(2,30);assert.equal(game.stage,2);assert.equal(game.done,false);
 feed(2,40);assert.equal(game.done,false,'holding the connection alone cannot finish the lever');
 feed(3,30);assert.equal(game.done,true);
 game.reset();assert.equal(game.under,false);assert.equal(game.stage,0);
});
test('kesa requires a seated base, ordered arm placement and final hold',()=>{
 const game=new GroundProgress('kesa-gatame');let now=0;
 const f=groundFixture('kesa-gatame'),standing=structuredClone(f.points);
 for(const i of [25,26,27,28])standing[i].visibility=0;
 for(let i=0;i<30;i++)game.update(standing,[],9/16,now+=50);assert.equal(game.stage,0);
 for(let stage=0;stage<3;stage++){now+=800;for(let i=0;i<36;i++)game.update(f.points,[],9/16,now+=50);assert.equal(game.stage,Math.min(stage+1,2));}
 assert.equal(game.done,true);
});
test('tracking loss and inactive practice cannot complete or preserve a grip',()=>{
 const g=new GroundProgress('ude-garami'),f=groundFixture('ude-garami');
 for(let i=0;i<10;i++)g.update(f.points,f.hands,9/16,i*50);assert(g.hold>0);
 g.update(null,null,9/16,500);assert.equal(g.hold,0);
 for(let i=0;i<30;i++)g.update(f.points,f.hands,9/16,600+i*50,false);
 assert.equal(g.stage,0);
});

test('kesa keeps rigid limbs, split seated legs and a sideways trunk lean toward uke',()=>{
 for(let time=0;time<=3;time+=.03){
  const {tori,uke}=sampleGround('kesa-gatame',time);
  for(const rig of [tori,uke])for(const [limbs,a,b]of [[rig.arms,.33,.31],[rig.legs,.46,.45]])for(const limb of Object.values(limbs)){
   const d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
   assert(Math.abs(d(limb.root,limb.joint)-a)<1e-6);
   assert(Math.abs(d(limb.joint,limb.end)-b)<1e-6);
   assert(limb.joint[1]>=0);assert(limb.end[1]>=0);
  }
 }
 const {tori}=sampleGround('kesa-gatame',3);
 assert(tori.pelvis[1]<.3);
 assert(tori.head[0]>tori.pelvis[0]+.3);
 assert(tori.forward[2]<0,'face uke head, not feet');
 assert(tori.legs.right.end[2]<tori.pelvis[2]-.5);
 assert(tori.legs.left.end[2]>tori.pelvis[2]+.5);
});

test('ude reference arms keep bone lengths and reach both grip targets',()=>{
 const d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 let previous;
 for(let time=0;time<=3.001;time+=.02){
  const pose=sampleGround('ude-garami',time);
  for(const arm of Object.values(pose.tori.arms)){
   assert(Math.abs(d(arm.root,arm.joint)-.33)<1e-6);
   assert(Math.abs(d(arm.joint,arm.end)-.31)<1e-6);
   assert(arm.joint[1]>.05);assert(arm.end[1]>.05);
  }
  if(previous)for(const side of ['left','right'])assert(d(pose.tori.arms[side].end,previous.tori.arms[side].end)<.04);
  previous=pose;
 }
 const pose=sampleGround('ude-garami',2);
 assert(d(pose.tori.arms.left.end,pose.gripTargets.ownGrip)<.001);
 assert(Math.abs(d(pose.tori.arms.left.end,pose.gripTargets.ownForearm)-.075)<1e-6,'palm sits outside the held forearm');
 assert(d(pose.tori.arms.right.end,pose.gripTargets.opponentWrist)<.06);
});

test('mounted ude hands descend from above with a head-facing shoulder frame',()=>{
 const start=sampleGround('ude-garami',0),grip=sampleGround('ude-garami',1),under=sampleGround('ude-garami',1.7);
 for(let time=0;time<=3;time+=.02){
  const {tori}=sampleGround('ude-garami',time),r=tori.arms.right,l=tori.arms.left;
  assert(r.root[1]>=.45&&l.root[1]>=.45,'shoulders above the supine chest while leaning into the connection');
  assert(Math.abs(r.root[0]-l.root[0]-.41)<1e-6,'mounted performer faces the head');
  assert(Math.abs(r.root[1]-l.root[1])<1e-6);
  assert(r.reachError<1e-6&&l.reachError<1e-6,'no hidden reach clamping');
 }
 for(const side of ['right','left'])assert(start.tori.arms[side].end[1]>.5);
 assert(grip.tori.arms.right.end[1]<start.tori.arms.right.end[1]-.3);
 assert(grip.tori.arms.right.end[1]>grip.uke.arms.right.end[1]);
 assert(under.tori.arms.left.end[1]<under.uke.arms.right.joint[1]-.1);
});

test('final lever raises the left elbow and uke elbow while preserving the pinned wrist and connected grip',()=>{
 const start=sampleGround('ude-garami',2),end=sampleGround('ude-garami',3),d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 assert(end.tori.arms.left.joint[1]>start.tori.arms.left.joint[1]+.05);
 assert(end.uke.arms.right.joint[1]>start.uke.arms.right.joint[1]+.05);
 for(let t=2;t<=3.001;t+=.01){
  const p=sampleGround('ude-garami',t),a=p.uke.arms.right;
  assert(d(a.end,start.uke.arms.right.end)<1e-8);
  assert(d(p.tori.arms.right.end,start.tori.arms.right.end)<1e-8);
  assert(Math.abs(d(a.root,a.joint)-.33)<1e-8);
  assert(Math.abs(d(a.joint,a.end)-.31)<1e-8);
  assert(d(p.tori.arms.left.end,p.gripTargets.ownGrip)<1e-8);
  assert.equal(p.grips.left.held,1);assert.equal(p.grips.right.held,1);
 }
});
