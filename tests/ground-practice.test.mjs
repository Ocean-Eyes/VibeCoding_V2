import test from 'node:test';import assert from 'node:assert/strict';
import {GroundProgress} from '../src/ground-practice.js';
import {sampleGround,groundDemoTime} from '../src/ground-motion.js';
import {groundFixture} from './ground-fixture.mjs';
import {bodyShapes,bodyOverlap} from '../src/throw-body.js';
import {groundContactShapes} from '../src/throw-render.js';
import {GROUND_CONTACT_RATE} from '../src/ground-contact-data.js';

test('ude releases through the same path and returns to the start without a loop jump',()=>{
 assert.equal(groundDemoTime('ude-garami',9),3);
 assert.equal(groundDemoTime('ude-garami',12),3);
 assert(groundDemoTime('ude-garami',15)<3);
 assert.equal(groundDemoTime('ude-garami',21),0);
 let previous=0;
 for(let i=0;i<=480;i++){
  const time=groundDemoTime('ude-garami',i/10);
  assert(time>=0&&time<=3);assert(Math.abs(time-previous)<=.034);
  previous=time;
 }
});

test('all displayed arm, palm and finger meshes clear other arms and the opponent body between contact keys',()=>{
 for(let frame=0;frame<=GROUND_CONTACT_RATE*12;frame++){
  const time=frame/(GROUND_CONTACT_RATE*4),pose=sampleGround('ude-garami',time),shapes=groundContactShapes(pose);
  for(const shape of shapes)assert(shape.points.flat().every(Number.isFinite),shape.id);
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){
   const a=shapes[i],b=shapes[j];
   // Adjacent pieces of the same arm join at their elbow/wrist. No cross-arm
   // grip exclusion: actual curved fingers must remain outside the held mesh.
   if(a.id.split('.').slice(0,2).join('.')===b.id.split('.').slice(0,2).join('.'))continue;
   const hit=bodyOverlap(a,b,.000001);
   assert.equal(hit,null,time+': '+JSON.stringify(hit));
  }
  const body=bodyShapes(pose.uke).filter(s=>!/^arm\.|^hand\./.test(s.id));
  for(const arm of shapes.filter(s=>s.id.startsWith('tori.')))for(const part of body){
   const hit=bodyOverlap(arm,part,.000001);assert.equal(hit,null,time+': '+JSON.stringify(hit));
  }
 }
});

test('opponent bent arm stays at 90 degrees throughout the connection',()=>{
 for(let t=0;t<=2;t+=.05){const {uke}=sampleGround('ude-garami',t),arm=uke.arms.right;
 assert(arm.joint[0]<arm.root[0],'anatomical right arm extends outwards');
 assert(arm.end[1]>arm.joint[1]+.3,'right forearm is raised upright');
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
  if(previous)for(const side of ['left','right']){
   assert(d(pose.tori.arms[side].end,previous.tori.arms[side].end)<.04);
   assert(d(pose.tori.arms[side].joint,previous.tori.arms[side].joint)<.04,'elbow cannot jump to the opposite bend');
  }
  previous=pose;
 }
 const pose=sampleGround('ude-garami',2);
 assert(d(pose.tori.arms.left.end,pose.gripTargets.ownGrip)<.001);
 assert(Math.abs(d(pose.tori.arms.left.end,pose.gripTargets.ownForearm)-.080)<1e-6,'palm sits outside the held forearm');
 assert(Math.abs(d(pose.tori.arms.right.end,pose.gripTargets.wristSite)-.080)<1e-6);
});

test('mounted ude hands descend from above with a head-facing shoulder frame',()=>{
 const start=sampleGround('ude-garami',0),grip=sampleGround('ude-garami',1),under=sampleGround('ude-garami',1.4);
 for(let time=0;time<=3;time+=.02){
  const {tori}=sampleGround('ude-garami',time),r=tori.arms.right,l=tori.arms.left;
  assert(r.root[1]>=.45&&l.root[1]>=.45,'shoulders above the supine chest while leaning into the connection');
  assert(Math.abs(Math.hypot(...r.root.map((v,i)=>v-l.root[i]))-.41)<1e-6,'rigid shoulder width while leaning toward the right arm');
  assert(Math.abs(r.root[1]-l.root[1])<1e-6);
  assert(r.reachError<1e-6&&l.reachError<1e-6,'no hidden reach clamping');
 }
 assert(start.tori.arms.right.end[1]>.6);
 assert(start.tori.arms.left.end[0]<start.uke.arms.right.joint[0]-.1,'left hand waits outside the elbow before threading');
 assert(grip.tori.arms.right.end[1]<start.tori.arms.right.end[1]-.13);
 assert.equal(grip.grips.right.held,1);assert.equal(grip.grips.left.held,0);
 assert(under.tori.arms.left.end[1]<under.uke.arms.right.joint[1]-.1);
});

test('final lever raises the left elbow and uke elbow while preserving the pinned wrist and connected grip',()=>{
 const start=sampleGround('ude-garami',2),end=sampleGround('ude-garami',3),d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 assert(end.tori.arms.left.joint[1]>start.tori.arms.left.joint[1]+.05);
 // With an upright forearm and pinned wrist, uke's elbow follows an arc
 // around the shoulder-wrist axis rather than a vertical translation.
 assert(end.uke.arms.right.joint[1]>start.uke.arms.right.joint[1]);
 assert(d(end.uke.arms.right.joint,start.uke.arms.right.joint)>.05);
 for(let t=2;t<=3.001;t+=.01){
  const p=sampleGround('ude-garami',t),a=p.uke.arms.right;
  assert(d(a.end,start.uke.arms.right.end)<1e-8);
  assert(Math.abs(d(p.tori.arms.right.end,p.gripTargets.wristSite)-.080)<1e-8);
  assert(Math.abs(d(a.root,a.joint)-.33)<1e-8);
  assert(Math.abs(d(a.joint,a.end)-.31)<1e-8);
  assert(d(p.tori.arms.left.end,p.gripTargets.ownGrip)<1e-8);
  assert.equal(p.grips.left.held,1);assert.equal(p.grips.right.held,1);
 }
});
