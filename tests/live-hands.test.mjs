import test from 'node:test';
import assert from 'node:assert/strict';
import {assignHands,LandmarkStream,projectHand,palmFacing} from '../src/live-hands.js';
const hand=(x,y=.4)=>Array.from({length:21},(_,i)=>({x:x+(i%4)*.006,y:y-Math.floor(i/4)*.015,z:0}));
const pose=(a,b)=>Array.from({length:33},(_,i)=>({x:i===15?a:i===16?b:.5,y:.4,visibility:1}));
test('detector array reorder and crossing keep the anatomical streams separate',()=>{
 const left=hand(.65),right=hand(.35);assert.deepEqual(assignHands([right,left],pose(.65,.35)),[left,right]);
 const crossedLeft=hand(.3),crossedRight=hand(.7);
 assert.deepEqual(assignHands([crossedRight,crossedLeft],pose(.3,.7),[left,right]),[crossedLeft,crossedRight]);
 assert.deepEqual(assignHands([crossedRight],pose(.3,.7),[crossedLeft,crossedRight]),[null,crossedRight]);
 assert.deepEqual(assignHands([],pose(.3,.7)),[null,null]);
});
test('quiet-hand noise is attenuated, fast intentional motion follows within 200 ms',()=>{
 const filter=new LandmarkStream();let rawEnergy=0,filteredEnergy=0;
 for(let i=0;i<100;i++){
  const x=.5+(i%2?.006:-.006),t=i*65;filter.update([{x,y:.4,z:0}],t);
  if(i>20){rawEnergy+=(x-.5)**2;filteredEnergy+=(filter.at(t+64)[0].x-.5)**2}
 }
 assert.ok(filteredEnergy<rawEnergy*.25);
 for(let i=100;i<=103;i++)filter.update([{x:.8,y:.4,z:0}],i*65);
 assert.ok(Math.abs(filter.at(103*65+65)[0].x-.8)<.01);
});
test('lost or low-confidence joints disappear immediately and reacquire without old-pose blending',()=>{
 const filter=new LandmarkStream();filter.update(hand(.2),0);filter.update(null,65);assert.equal(filter.at(65),null);
 filter.update(hand(.8),130);assert.equal(filter.at(130)[0].x,.8);
 filter.update([{x:.4,y:.4,visibility:.1}],195);assert.equal(filter.at(196)[0].visibility,.1);
 filter.update([{x:.7,y:.4,visibility:1}],260);assert.equal(filter.at(260)[0].x,.7);
 assert.equal(filter.at(600),null);
});
test('all 21 finger positions survive projection, with mirror applied once to the whole hand',()=>{
 const body={origin:{x:.5,y:.3},scale:.3,x:{x:1,y:0},y:{x:0,y:1}},scene={origin:{x:300,y:200},scale:150};
 const h=hand(.65),a=projectHand(h,body,scene,true),b=projectHand(h,body,scene,false);
 for(let i=0;i<21;i++){assert.ok(Math.abs(a[i].x-(600-b[i].x))<1e-10);assert.equal(a[i].y,b[i].y)}
 const changed=h.map(p=>({...p}));changed[8].y+=.08;
 const c=projectHand(changed,body,scene,true);assert.equal(c[7].y,a[7].y);assert.ok(Math.abs(c[8].y-a[8].y-40)<1e-10);
 assert.equal(palmFacing(a,true,true),palmFacing(b,true,false));
});
