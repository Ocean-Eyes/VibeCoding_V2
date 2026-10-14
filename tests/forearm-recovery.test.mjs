import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction} from '../src/collar-interaction.js';
import {kataHands,kataArms} from './fixtures/kata-hands.mjs';
for(const mirror of [true,false])test(`right-hand reacquisition does not erase continuously observed forearm motion, mirror=${mirror}`,()=>{
 const model=new CollarInteraction(),closed=kataHands({mirror});let state;
 for(let now=0;now<4500;now+=65){
  const u=Math.min(1,Math.max(0,(now-700)/800)),a=.36*u*(mirror?1:-1);
  const recovered=now>=1560&&now<1625;
  state=model.update(closed,now,{active:true,mirrored:mirror,directions:['↑','↓'],bodyVisible:true,arms:kataArms(closed,{mirror,angles:[a,a]}),recoveredHands:[false,recovered],continuousHands:[true,true]});
  if(now>=1625)assert.ok(state.finishLevels[1]>.8,`right=${state.finishLevels[1]}, time=${now}`);
 }
 assert.equal(state.count,2);assert.equal(state.tapped,true);
});

import {HandStream,poseConfirmsHand} from '../src/live-hands.js';
test('real HandStream reacquisition preserves an independently tracked right arm',()=>{
 const model=new CollarInteraction(),closed=kataHands(),stream=new HandStream();let state,revision=0;
 const camera=h=>h.map(p=>({...p,x:.5+p.x*.5,y:.25+p.y*.5,z:p.z*.5}));
 const project=h=>h?.map(p=>({...p,x:(p.x-.5)/.5,y:(p.y-.25)/.5,z:p.z/.5}))??null;
 const w=closed[1][0],angle=.86,c=Math.cos(angle),s=Math.sin(angle);
 const turned=closed[1].map(p=>({...p,x:w.x+(p.x-w.x)*c-(p.y-w.y)*s,y:w.y+(p.x-w.x)*s+(p.y-w.y)*c}));
 for(let now=0;now<4500;now+=65){
  const raw=camera(now>=1200?turned:closed[1]),pose=Array(33).fill(null);
  pose[15]={...camera(closed[0])[0],visibility:1};pose[16]={...camera(closed[1])[0],visibility:1};
  stream.update(raw,now,{held:!!model.hands[1].grip,poseConfirmed:poseConfirmsHand(raw,pose,1)});
  const hand=project(stream.trackedAt(now+64)),recovered=!!hand&&revision!==stream.recoveryRevision;
  if(recovered)revision=stream.recoveryRevision;
  const a=.36*Math.min(1,Math.max(0,(now-650)/500));
  state=model.update([closed[0],hand],now+64,{active:now>=2100,directions:['↑','↓'],bodyVisible:true,arms:kataArms(closed,{angles:[a,a]}),continuousHands:[true,!!hand],recoveredHands:[false,recovered]});
  if(now>=2100)assert.ok(state.finishLevels[1]>.8,`right score lost after stream recovery at ${now}`);
 }
 assert.ok(revision>0,'must actually trigger hand-filter recovery');assert.equal(state.count,2);assert.equal(state.tapped,true);
});
for(const fps of [10,15,30,60])test(`right-arm angle spikes are rejected but genuine unwinding still clears progress at ${fps}fps`,()=>{
 const model=new CollarInteraction(),hands=kataHands();let state,time=0;
 const step=(a,b,sample)=>model.update(hands,time+=1000/fps,{active:true,directions:['↑','↓'],bodyVisible:true,arms:kataArms(hands,{angles:[a,b]}),poseSampleTime:sample??time});
 for(let k=0;k<fps;k++)state=step(0,0);
 // A low right-angle estimate every third frame must not erase a held turn.
 for(let k=0;k<fps*3;k++){
  state=step(.31,k%3===0?.08:.31);
  if(k>=3)assert.ok(state.finishLevels[1]>.8,`unstable right level ${state.finishLevels[1]}`);
 }
 assert.equal(state.tapped,true);
 // New attempt: returning the right arm after a short motion must never finish.
 model.reset();time=0;
 for(let k=0;k<fps;k++)state=step(0,0);
 for(let k=0;k<Math.ceil(fps*.35);k++)state=step(.31,.31);
 for(let k=0;k<fps*2;k++)state=step(.31,0);
 assert.equal(state.tapped,false);assert.equal(state.hold,0);assert.equal(state.finishLevels[1],0);
});
test('repainting one pose sample does not add median votes',()=>{
 const model=new CollarInteraction(),hands=kataHands();let time=0,state;
 const step=(angle,sample)=>model.update(hands,time+=20,{directions:['↑','↓'],bodyVisible:true,arms:kataArms(hands,{angles:[.3,angle]}),poseSampleTime:sample});
 // Establish a neutral reference separately from the sampled arm movement.
 for(let k=0;k<10;k++)model.update(hands,time+=20,{directions:['↑','↓'],bodyVisible:true,arms:kataArms(hands)});
 step(.3,1);step(.3,2);step(.05,3);
 for(let k=0;k<5;k++)state=step(.05,3);
 assert.ok(state.forearmLevels[1]>.8);
 step(.05,4);state=step(.05,5);assert.ok(state.forearmLevels[1]<.3);
});

// Perspective changes elbow-to-wrist length even though the anatomical arm
// stays rigid. The old wrist-circle length gate discarded the forearm angle.
for(const side of [0,1])for(const mirror of [true,false])for(const reverse of [true,false])for(const fps of [10,15,30])for(const ratio of [.6,.64,1.4,1.6]){
 test(`Kata perspective turn: side=${side}, mirror=${mirror}, reverse=${reverse}, fps=${fps}, ratio=${ratio}`,()=>{
  const model=new CollarInteraction(),hands=kataHands({mirror,reverse}),directions=reverse?['↓','↑']:['↑','↓'];let state;
  for(let n=0;n<fps*5;n++){
   const now=n*1000/fps,u=Math.min(1,Math.max(0,(now-700)/900)),angle=.36*u*(side?1:-1)*(mirror?1:-1);
   const arms=kataArms(hands,{mirror,angles:[angle,angle]}),a=arms[side];
   const scale=1+(ratio-1)*u+(u===1?(n%2?.008:-.008):0);
   a.elbow.x=a.wrist.x+(a.elbow.x-a.wrist.x)*scale;a.elbow.y=a.wrist.y+(a.elbow.y-a.wrist.y)*scale;
   const observed=hands.map((h,i)=>now>1200&&i===side&&n%4<2?null:h);
   state=model.update(observed,now,{active:true,mirrored:mirror,directions,bodyVisible:true,arms,continuousHands:observed.map(Boolean)});
   if(now>1900)assert.ok(state.forearmLevels[side]>.8,`side=${side}, score=${state.forearmLevels[side]}`);
  }
  assert.equal(state.count,2);assert.equal(state.tapped,true);
 });
}
for(const side of [0,1])for(const kind of ['one-arm','still','collapsed','stretched','uncertain','unwind']){
 test(`Kata perspective negative: ${kind}, side=${side}`,()=>{
  const model=new CollarInteraction(),hands=kataHands();let state,tapped=false;
  for(let n=0;n<80;n++){
   const now=n*65,u=Math.min(1,Math.max(0,(now-700)/900));
   let angle=kind==='still'?0:.36*u*(side?1:-1);
   if(kind==='unwind'&&now>1900)angle=0;
   const angles=[angle,angle];if(kind==='one-arm')angles[1-side]=0;
   const arms=kataArms(hands,{angles}),a=arms[side],scale=1+((kind==='collapsed'?.1:kind==='stretched'?3:.64)-1)*u;
   // A depth-only change must not earn elevation credit in this angle test.
   if(['still','collapsed'].includes(kind))a.shoulder.y+=(a.elbow.y-a.wrist.y)*(scale-1);
   a.elbow.x=a.wrist.x+(a.elbow.x-a.wrist.x)*scale;a.elbow.y=a.wrist.y+(a.elbow.y-a.wrist.y)*scale;
   if(kind==='uncertain'&&now>700)a.elbow.visibility=.1;
   state=model.update(hands,now,{active:true,directions:['↑','↓'],bodyVisible:true,arms});tapped||=state.tapped;
  }
  assert.equal(tapped,false);assert.equal(state.hold,0);
  if(kind==='unwind')assert.ok(state.forearmLevels[side]<1e-10);
 });
}
