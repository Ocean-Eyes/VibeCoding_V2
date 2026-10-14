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
