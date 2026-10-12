import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,lapelPoint,lapelRest,graspCenter,fingerExtension,clothPoint,cameraPalmNormal,gripPosture} from '../src/collar-interaction.js';
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
test('prepared curled hands can enter the opposite lapel without first spreading fingers',()=>{
 const a=setup();assert.equal(a.step('open').count,0);assert.equal(a.step('close').count,2);
 const b=setup();assert.equal(b.step('close').count,2);
 const c=setup();assert.equal(c.step('outside').count,0);assert.equal(c.step('close',80).count,0);
 assert.equal(c.step('close',100).count,2,'stable contact in the prepared posture acquires the collar');
});

test('each technique requires its camera-facing orientation on the opposite collar',()=>{
 for(const directions of [['↓','↓'],['↑','↑'],['↑','↓']]){
  const model=new CollarInteraction();
  const hands=[0,1].map(i=>handAt(lapelRest(i?-1:1,i?.48:.29),1,i===0,directions[i]==='↑'));
  let state;for(let now=0;now<=240;now+=20)state=model.update(hands,now,{directions});
  assert.equal(state.count,2,directions.join('/'));
 }
 const wrong=collarHands('close').map((h,i)=>handAt(graspCenter(h),1,i===0,true));
 assert.equal(setup().step(wrong).count,0,'wrong palm direction must not attach');
 const vertical=collarHands('close').map((h,i)=>{
  const center=graspCenter(h),a=i?.95:-.95,c=Math.cos(a),s=Math.sin(a);
  return h.map(p=>({...p,x:center.x+(p.x-center.x)*c-(p.y-center.y)*s,y:center.y+(p.x-center.x)*s+(p.y-center.y)*c}));
 });
 assert.equal(setup().step(vertical).count,2,'correct opposite-lapel grips do not require an artificial diagonal wrist angle');
});

test('collar attachment coordinates remain continuous with anchored neck and waist',()=>{
 const deformation=[{side:1,t:.29,dx:.20,dy:-.025},{side:-1,t:.48,dx:-.18,dy:.02}];
 for(const g of deformation){
  const rest=lapelRest(g.side,g.t),seam=clothPoint(rest,deformation),edge=lapelPoint(g.side,g.t,deformation);
  assert.deepEqual(seam,edge);
  const nearby=clothPoint({x:rest.x+g.side*.035,y:rest.y+.025},deformation);
  assert.ok(g.side*(nearby.x-(rest.x+g.side*.035))>.10,'nearby sewn-edge coordinates must follow the grasp');
  const adjacent=clothPoint({x:rest.x+.00001,y:rest.y},deformation);
  assert.ok(Math.hypot(adjacent.x-seam.x,adjacent.y-seam.y)<.0001,'no separation at the sewn edge');
 }
 for(const x of [-.4,0,.4])for(const y of [.065,1.1,1.5])assert.deepEqual(clothPoint({x,y},deformation),{x,y});
});

test('attached cloth stays at each hand during lateral pull, while the neckline and waist stay anchored',()=>{
 const a=setup();a.step('open');a.step('close');const state=a.step('pull',200);
 for(const [i,g]of state.grips.entries()){
  const pin=lapelPoint(g.side,g.t,state.deformation),hand=graspCenter(collarHands('pull')[i]);
  assert.ok(Math.hypot(pin.x-hand.x,pin.y-hand.y)<1e-10);
  assert.deepEqual(lapelPoint(g.side,0,state.deformation),lapelRest(g.side,0));
  assert.deepEqual(lapelPoint(g.side,1,state.deformation),clothPoint(lapelRest(g.side,1),state.deformation));
 }
 assert.equal(state.tension,1);assert.equal(state.tapped,false);
 assert.equal(a.step('pull',1400).tapped,true);
});
test('open hands, one-sided pulls and un-crossed grips cannot produce a tap',()=>{
 const a=setup();assert.equal(a.step('open',2000).tapped,false);a.step('close');
 assert.equal(a.step('one-pull',2000).tension,0);assert.equal(a.step('one-pull',2000).tapped,false);
 const b=setup(),wrongOpen=collarHands('open').toReversed(),wrongClose=collarHands('close').toReversed();
 b.step(wrongOpen);b.step(wrongClose);const state=b.step(collarHands('pull').toReversed(),2000);
 assert.equal(state.count,0);assert.equal(state.crossed,false);assert.equal(state.tapped,false);
});
test('opening or losing a tracked hand releases the cloth and resets the completion hold',()=>{
 const a=setup();a.step('open');a.step('close');a.step('pull',800);
 const release=a.step('release');assert.equal(release.count,0);assert.equal(release.hold,0);assert.equal(release.tension,0);
 assert.equal(a.step('release',800).deformation.length,0);
 a.step('open');a.step('close');assert.equal(a.step('lost',20).count,2);assert.equal(a.step('lost',900).count,0);
 assert.equal(a.step('close').count,2,'a newly tracked prepared grip reacquires after stable contact');
});
test('paused practice and mirror changes cannot carry a stale completion forward',()=>{
 const a=setup();a.step('open');a.step('close');assert.equal(a.step('pull',2000,false).tapped,false);
 const state=a.model.update(collarHands('pull'),3000,{active:true,mirrored:false});assert.equal(state.count,0);assert.equal(state.hold,0);
});

test('partly curled preparation, staggered lapel heights and mirrored grips remain usable',()=>{
 for(const mirrored of [true,false]){
  const model=new CollarInteraction();
  const hands=[0,1].map(i=>{
   const side=i?-1:1,center=lapelRest(side,i?.60:.22),hand=handAt(center,.8,i===0);
   return mirrored?hand:hand.map(p=>({...p,x:-p.x}));
  });
  // Mirrored off swaps the visible branches, which are not identical below the neck.
  if(!mirrored)hands.forEach((h,i)=>{const center=graspCenter(h),target=lapelRest(i?1:-1,i?.22:.60);h.forEach(p=>{p.x+=target.x-center.x;p.y+=target.y-center.y})});
  let state;for(let now=0;now<=240;now+=20)state=model.update(hands,now,{mirrored});
  assert.equal(state.count,2);assert.equal(state.crossed,true);
 }
});

test('a stationary hand still pins its fabric while the other hand pulls',()=>{
 const stationary=lapelRest(-1,.48),moving=lapelRest(1,.29);
 const deformation=[{side:-1,t:.48,dx:0,dy:0},{side:1,t:.29,dx:.20,dy:.03}];
 const pin=clothPoint(stationary,deformation),other=clothPoint(moving,deformation);
 assert.ok(Math.hypot(pin.x-stationary.x,pin.y-stationary.y)<1e-10);
 assert.ok(Math.hypot(other.x-moving.x-.20,other.y-moving.y-.03)<1e-10);
});

test('camera-facing classification is independent of gravity, wrist angle and mirroring',()=>{
 // Independent anatomical fixture: selfie left palm has index toward screen right,
 // pinky toward screen left; the right palm is opposite. No AAH hand generator.
 for(const index of [0,1])for(const mirrored of [true,false])for(const palm of [true,false]){
  for(const angle of [0,.7,1.5,2.8])for(const tilt of [-1.1,0,1.1]){
   const sign=(index?-1:1)*(mirrored?1:-1)*(palm?1:-1);
   const hand=Array.from({length:21},()=>({x:0,y:0,z:0}));
   hand[5]={x:.05*sign,y:-.12,z:0};hand[17]={x:-.05*sign,y:-.12,z:0};
   for(const p of hand){
    p.z=p.x*Math.sin(tilt);p.x*=Math.cos(tilt);
    const x=p.x,y=p.y;p.x=x*Math.cos(angle)-y*Math.sin(angle);p.y=x*Math.sin(angle)+y*Math.cos(angle);
   }
   const side=(index?-1:1)*(mirrored?1:-1),direction=palm?'↓':'↑';
   assert.equal(cameraPalmNormal(hand,index,mirrored)>0,palm);
   assert.equal(gripPosture(hand,index,side,mirrored,direction),null);
   assert.equal(gripPosture(hand,index,side,mirrored,palm?'↑':'↓'),'palm');
  }
 }
});

test('an edge-on hand cannot substitute for either palm or back',()=>{
 for(const index of [0,1])for(const direction of ['↓','↑']){
  const hand=Array.from({length:21},()=>({x:0,y:0,z:0}));
  hand[5]={x:0,y:-.12,z:.05};hand[17]={x:0,y:-.12,z:-.05};
  assert.equal(gripPosture(hand,index,index?-1:1,true,direction),'turn');
 }
});

test('a half-curled grip near either lapel acquires without a precise wrist angle',()=>{
 for(const directions of [['↓','↓'],['↑','↑']]){
  const hands=[0,1].map(i=>{
   const center=lapelRest(i?-1:1,i?.48:.29);center.x+=(i?-1:1)*.105;
   return handAt(center,.5,i===0,directions[i]==='↑');
  });
  const model=new CollarInteraction();let state;
  for(let now=0;now<=240;now+=20)state=model.update(hands,now,{directions});
  assert.equal(state.count,2);
 }
});

test('brief occlusion preserves both grips and pauses hold until observations return',()=>{
 const a=setup();a.step('close');const pulled=a.step('pull',500),earned=pulled.hold;
 const hidden=a.step('lost',400);assert.equal(hidden.count,2);assert.equal(hidden.trackingPaused,true);
 assert.equal(hidden.hold,earned);assert.equal(hidden.tapped,false);
 const returned=a.step('pull',20);assert.equal(returned.count,2);assert.equal(returned.trackingPaused,false);
 assert.equal(a.step('pull',900).tapped,true,'resume the same grips without going back to the collars');
});
test('brief false-open observations do not unlatch; sustained open hands do',()=>{
 const a=setup();a.step('close');a.step('pull',300);
 assert.equal(a.step('release',100).count,2);
 assert.equal(a.step('pull',100).count,2);
 const partial=collarHands('pull').map((h,i)=>handAt(graspCenter(h),.4,i===0));
 assert.equal(a.step(partial,400).count,2,'uncertain curl must not be treated as deliberate release');
 assert.equal(a.step('release',260).count,0);
});
test('a continuous wide lateral pull never releases merely for leaving the acquisition zone',()=>{
 const a=setup();a.step('close');let state;
 for(let step=1;step<=6;step++){
  const hands=collarHands('close').map((h,i)=>h.map(p=>({...p,x:p.x+(i?-1:1)*step*.12})));
  state=a.step(hands,80);assert.equal(state.count,2);
 }
 assert.equal(state.tension,1);
});
test('a tracking jump keeps the last cloth pin without earning a tap',()=>{
 const a=setup();const acquired=a.step('close'),pins=acquired.grips.map(g=>({...g.center}));
 const jumped=collarHands('close').map(h=>h.map(p=>({...p,x:p.x+1.5})));
 const state=a.step(jumped,80);assert.equal(state.count,2);assert.equal(state.trackingPaused,true);assert.equal(state.tapped,false);
 assert.deepEqual(state.grips.map(g=>g.center),pins);assert.equal(a.step('close',20).count,2);
 assert.equal(a.step('lost',1000).count,0);
});

test('a confirmed fast bilateral pull recovers from the jump filter instead of freezing at zero',()=>{
 const a=setup();a.step('close');
 const fast=collarHands('close').map((h,i)=>h.map(p=>({...p,x:p.x+(i?-1:1)*.56})));
 const initial=a.step(fast,60);assert.equal(initial.count,2);assert.equal(initial.trackingPaused,true);assert.equal(initial.tension,0);
 const confirmed=a.step(fast,200);assert.equal(confirmed.trackingPaused,false);assert.equal(confirmed.tension,1);
 assert.equal(a.step(fast,1300).tapped,true);
});
test('crossed hands pulling toward their own shoulders count, but moving both hands together does not',()=>{
 const a=setup();a.step('close');
 const inward=collarHands('close').map((h,i)=>h.map(p=>({...p,x:p.x+(i?1:-1)*.19})));
 const state=a.step(inward,1600);assert.equal(state.count,2);assert.equal(state.pullDirection,'opposed');assert.ok(state.tension>.9);assert.equal(state.tapped,true);
 const b=setup();b.step('close');
 const together=collarHands('close').map(h=>h.map(p=>({...p,x:p.x+.25})));
 const moved=b.step(together,1600);assert.deepEqual(moved.pulls,[1,1]);assert.equal(moved.pullDirection,'together');assert.equal(moved.tension,0);assert.equal(moved.tapped,false);
});
