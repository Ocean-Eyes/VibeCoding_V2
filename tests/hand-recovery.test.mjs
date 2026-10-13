import test from 'node:test';
import assert from 'node:assert/strict';
import {HandIdentityTracker,HandStream,poseConfirmsHand} from '../src/live-hands.js';
import {CollarInteraction,graspCenter} from '../src/collar-interaction.js';
import {collarHands,collarArms,handAt} from './fixtures/collar-hands.mjs';
const camera=h=>h?.map(p=>({...p,x:.5-p.x*.18,y:.32+p.y*.18,z:p.z*.18}))??null;
const body=h=>h?.map(p=>({...p,x:(.5-p.x)/.18,y:(p.y-.32)/.18,z:p.z/.18}))??null;
function pipeline(){
 const model=new CollarInteraction(),identity=new HandIdentityTracker(),streams=[new HandStream(),new HandStream()],consumed=[0,0];let time=0;
 return {model,streams,tick(hands,{poseHands=hands,lift=false,missing=-1,swapped=false}={}){
  time+=65;const raw=hands.map(camera),anchors=poseHands.map(camera),points=Array(33).fill(null);
  anchors.forEach((h,i)=>{points[15+i]=h?{...h[0],visibility:1}:null});
  if(swapped)[points[15],points[16]]=[points[16],points[15]];
  const held=model.hands.map(h=>!!h.grip),stalled=streams.map(s=>s.lastSeen!==null&&time-s.lastSeen>450);
  const matched=identity.update(raw.filter((h,i)=>h&&i!==missing).toReversed(),points,time,{held,stalled});
  matched.forEach((h,i)=>streams[i].update(h,time,{held:held[i],reacquire:!held[i],poseConfirmed:poseConfirmsHand(h,points,i)}));
  const observations=streams.map(s=>body(s.trackedAt(time))),recoveredHands=observations.map((h,i)=>{
   if(!h||consumed[i]===streams[i].recoveryRevision)return false;consumed[i]=streams[i].recoveryRevision;return true;
  });
  const arms=collarArms(lift?'lift':'close').map((a,i)=>({...a,wrist:poseHands[i]?{...poseHands[i][0],visibility:1}:null}));
  return model.update(observations,time,{active:true,arms,bodyVisible:true,continuousHands:observations.map(Boolean),recoveredHands});
 }};
}

test('held outliers require corroboration and fade before returning to scoring',()=>{
 const stream=new HandStream(),old=camera(collarHands('close')[0]),next=old.map(p=>({...p,x:p.x+.1}));
 stream.update(old,0,{held:true});
 for(let t=65;t<=1300;t+=65){stream.update(next,t,{held:true});assert.equal(stream.trackedAt(t),null)}
 for(let t=1365;t<=1560;t+=65){stream.update(next,t,{held:true,poseConfirmed:true});assert.equal(stream.trackedAt(t),null)}
 stream.update(next,1690,{held:true,poseConfirmed:true});assert.equal(stream.recoveryRevision,1);assert.equal(stream.opacityAt(1690),0);
 assert.equal(stream.trackedAt(1750),null);
 for(let t=1755;t<=1950;t+=65)stream.update(next,t,{held:true,poseConfirmed:true});
 assert.ok(stream.trackedAt(1950));assert.equal(stream.trackedAt(1950)[0].x,next[0].x);
});

test('one lost held hand can reopen at a new position, release, regrip and complete',()=>{
 for(const side of [0,1]){
  const p=pipeline(),closed=collarHands('close');let state;
  for(let i=0;i<12;i++)state=p.tick(closed);assert.equal(state.count,2);
  for(let i=0;i<18;i++)state=p.tick(closed,{missing:side});
  const opened=collarHands('open').map((h,i)=>i===side?h.map(q=>({...q,x:q.x+(side?-.45:.45)})):closed[i]);
  for(let i=0;i<40;i++){
   state=p.tick(opened);
   for(const g of state.deformation)assert.ok(Math.hypot(g.dx,g.dy)<1e-8,'recovery must not pull cloth');
  }
  assert.equal(state.visible,2,'both actual hands recover');assert.equal(state.grips[side],null,'open recovered hand releases');assert.equal(state.count,1);
  for(let i=0;i<40;i++)state=p.tick(collarHands('open'));assert.equal(state.count,0);
  for(let i=0;i<20;i++)state=p.tick(closed);assert.equal(state.count,2);
  for(let i=0;i<30;i++)state=p.tick(closed,{lift:true});assert.equal(state.tapped,true);
 }
});

test('a held wrist returning rotated recovers without cloth motion and can finish',()=>{
 for(const side of [0,1]){
  const p=pipeline(),closed=collarHands('close');let state;
  for(let i=0;i<12;i++)state=p.tick(closed);
  for(let i=0;i<15;i++)state=p.tick(closed,{missing:side});
  const center=graspCenter(closed[side]),a=2.4,c=Math.cos(a),s=Math.sin(a);
  const turned=closed.map((h,i)=>i!==side?h:h.map(q=>({...q,x:center.x+(q.x-center.x)*c-(q.y-center.y)*s,y:center.y+(q.x-center.x)*s+(q.y-center.y)*c})));
  for(let i=0;i<35;i++){
   state=p.tick(turned);assert.equal(state.count,2);
   assert.ok(state.deformation.every(g=>Math.hypot(g.dx,g.dy)<1e-8));
  }
  assert.equal(state.visible,2);assert.ok(p.streams[side].recoveryRevision>0);
  for(let i=0;i<30;i++)state=p.tick(turned,{lift:true});assert.equal(state.tapped,true);
 }
});

test('no second hand is invented when only one detection returns',()=>{
 const p=pipeline(),closed=collarHands('close');let state;
 for(let i=0;i<12;i++)state=p.tick(closed);
 for(let i=0;i<60;i++){state=p.tick(closed,{missing:1,poseHands:[closed[0],null]});assert.ok(state.visible<=1);assert.equal(state.tapped,false)}
 assert.equal(state.count,2);
});


test('stalled anatomical assignment can recover from stale crossed identities',()=>{
 const tracker=new HandIdentityTracker(),hands=collarHands('close').map(camera),points=Array(33).fill(null);
 hands.forEach((h,i)=>points[15+i]={...h[0],visibility:1});
 tracker.update(hands,points,0,{held:[true,true]});
 const moved=hands.map((h,i)=>h.map(p=>({...p,x:p.x+(i?-.10:.10)})));
 moved.forEach((h,i)=>points[15+i]={...h[0],visibility:1});
 let result;for(let t=650;t<=1300;t+=65)result=tracker.update(moved.toReversed(),points,t,{held:[true,true],stalled:[true,true]});
 assert.equal(result[0],moved[0]);assert.equal(result[1],moved[1]);
});
