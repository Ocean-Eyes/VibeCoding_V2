import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,lapelPoint,lapelRest,graspCenter,fingerExtension} from '../src/collar-interaction.js';
import {collarHands,handAt} from './fixtures/collar-hands.mjs';
function setup(){
 const model=new CollarInteraction();let time=0,state;
 return {model,step(phase,duration=240,active=true){for(let t=0;t<duration;t+=20){time+=20;state=model.update(typeof phase==='string'?collarHands(phase):phase,time,{active})}return state}};
}
test('open and closed reference hands are distinguished using all three spatial axes',()=>{
 const open=collarHands('open')[0],closed=collarHands('close')[0];
 assert.ok(fingerExtension(open)>.90);assert.ok(fingerExtension(closed)<.76);
 const rotated=open.map(p=>({x:p.z,y:p.x,z:p.y}));assert.ok(Math.abs(fingerExtension(open)-fingerExtension(rotated))<1e-10);
});
test('only an open-to-close transition on the actual V collar acquires a grip',()=>{
 const a=setup();assert.equal(a.step('open').count,0);assert.equal(a.step('close').count,2);
 const b=setup();assert.equal(b.step('close').count,0,'entering with a fist must not grab');
 b.step('open');assert.equal(b.step('outside').count,0);assert.equal(b.step('close').count,0,'closed fist moving onto collar must not grab');
 assert.equal(b.step('open').count,0);assert.equal(b.step('close').count,2);
});
test('attached cloth stays at each hand during lateral pull, while neck and belt endpoints stay anchored',()=>{
 const a=setup();a.step('open');a.step('close');const state=a.step('pull',200);
 for(const [i,g]of state.grips.entries()){
  const pin=lapelPoint(g.side,g.t,state.deformation),hand=graspCenter(collarHands('pull')[i]);
  assert.ok(Math.hypot(pin.x-hand.x,pin.y-hand.y)<1e-10);
  assert.deepEqual(lapelPoint(g.side,0,state.deformation),lapelRest(g.side,0));
  assert.deepEqual(lapelPoint(g.side,1,state.deformation),lapelRest(g.side,1));
 }
 assert.equal(state.tension,1);assert.equal(state.tapped,false);
 assert.equal(a.step('pull',1400).tapped,true);
});
test('open hands, one-sided pulls and un-crossed grips cannot produce a tap',()=>{
 const a=setup();assert.equal(a.step('open',2000).tapped,false);a.step('close');
 assert.equal(a.step('one-pull',2000).tension,0);assert.equal(a.step('one-pull',2000).tapped,false);
 const b=setup(),wrongOpen=collarHands('open').toReversed(),wrongClose=collarHands('close').toReversed();
 b.step(wrongOpen);b.step(wrongClose);const state=b.step(collarHands('pull').toReversed(),2000);
 assert.equal(state.count,2);assert.equal(state.crossed,false);assert.equal(state.tapped,false);
});
test('opening or losing a tracked hand releases the cloth and resets the completion hold',()=>{
 const a=setup();a.step('open');a.step('close');a.step('pull',800);
 const release=a.step('release');assert.equal(release.count,0);assert.equal(release.hold,0);assert.equal(release.tension,0);
 assert.equal(a.step('release',800).deformation.length,0);
 a.step('open');a.step('close');assert.equal(a.step('lost',20).count,0);
 assert.equal(a.step('close').count,0,'reacquiring a closed hand must require reopening');
});
test('paused practice and mirror changes cannot carry a stale completion forward',()=>{
 const a=setup();a.step('open');a.step('close');assert.equal(a.step('pull',2000,false).tapped,false);
 const state=a.model.update(collarHands('pull'),3000,{active:true,mirrored:false});assert.equal(state.count,0);assert.equal(state.hold,0);
});
