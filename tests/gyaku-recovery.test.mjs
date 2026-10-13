import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,cameraPalmNormal} from '../src/collar-interaction.js';
import {gyakuHands} from './fixtures/gyaku-hands.mjs';
import {collarArms} from './fixtures/collar-hands.mjs';
function setup(mirror=true){
 const model=new CollarInteraction();let time=0;
 const step=(hands,arms=collarArms())=>model.update(hands,time+=65,{active:true,mirrored:mirror,directions:['↑','↑'],bodyVisible:true,arms,continuousHands:hands.map(Boolean)});
 let state;for(let i=0;i<12;i++)state=step(gyakuHands({mirror}));assert.equal(state.count,2);
 return {step};
}
for(const mirror of [true,false]){
 test(`gyaku self-occluded open estimates retain grips and visible wrists, mirror=${mirror}`,()=>{
  const {step}=setup(mirror);let state;
  for(let i=0;i<24;i++)state=step(gyakuHands({mirror,curl:0,roll:1.48}));
  assert.equal(state.count,2);assert.equal(state.tapped,false);
  assert.equal(state.wristHands.filter(Boolean).length,2,'visible hand wrists continue even if body-model wrists are absent');
  for(let i=0;i<20;i++)state=step(gyakuHands({mirror,curl:0}));assert.equal(state.count,0);
 });
 test(`gyaku collapsed hidden finger estimates cannot unlatch, mirror=${mirror}`,()=>{
  const {step}=setup(mirror);let state;
  for(let i=0;i<24;i++)state=step(gyakuHands({mirror,curl:0,collapsed:true}));
  assert.equal(state.count,2);assert.equal(state.tapped,false);
  for(let i=0;i<20;i++)state=step(gyakuHands({mirror,curl:0,roll:.65}));assert.equal(state.count,0);
 });
 test(`gyaku can finish with trustworthy wrists while finger opening is ambiguous, mirror=${mirror}`,()=>{
  const {step}=setup(mirror);let state;
  for(let i=0;i<12;i++)state=step(gyakuHands({mirror,curl:0,roll:1.48}));
  for(let i=0;i<28;i++)state=step(gyakuHands({mirror,curl:0,roll:1.48}),collarArms('lift'));
  assert.equal(state.count,2);assert.equal(state.tapped,true);
 });
}

test('clearly extended fingers still release with a tilted palm plane',()=>{
 for(const mirror of [true,false])for(const roll of [.65,.8,1]){
  const {step}=setup(mirror);let state;
  for(let i=0;i<20;i++)state=step(gyakuHands({mirror,curl:.1,roll}));
  assert.equal(state.count,0,`mirror=${mirror}, roll=${roll}`);
 }
});

test('a tilted acquisition can still release with a clearly camera-facing open hand',()=>{
 let checked=0;
 for(const roll of [-1.4,-1.3,-1.2,-1.1,-.9,.9,1.1,1.2,1.3,1.4]){
  const hands=gyakuHands({roll});if(!hands.every((h,i)=>cameraPalmNormal(h,i)<-.20))continue;
  checked++;const model=new CollarInteraction();let state,time=0;
  for(let i=0;i<15;i++)state=model.update(hands,time+=65,{directions:['↑','↑'],bodyVisible:true});
  assert.equal(state.count,2);
  for(let i=0;i<20;i++)state=model.update(gyakuHands({curl:0}),time+=65,{directions:['↑','↑'],bodyVisible:true,continuousHands:[true,true]});
  assert.equal(state.count,0,`initial roll=${roll}`);
 }
 assert.ok(checked>=2);
});
