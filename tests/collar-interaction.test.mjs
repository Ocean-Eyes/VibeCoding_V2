import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,lapelPoint,lapelRest,graspCenter,fingerExtension,clothPoint} from '../src/collar-interaction.js';
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

test('each technique requires its palm orientation and a diagonal wrist on the opposite collar',()=>{
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
 assert.equal(setup().step(vertical).count,0,'upright hands must not replace the crossing posture');
});

test('coat fabric and collar share a continuous displacement, with anchored neck and waist',()=>{
 const deformation=[{side:1,t:.29,dx:.20,dy:-.025},{side:-1,t:.48,dx:-.18,dy:.02}];
 for(const g of deformation){
  const rest=lapelRest(g.side,g.t),seam=clothPoint(rest,deformation),edge=lapelPoint(g.side,g.t,deformation);
  assert.deepEqual(seam,edge);
  const nearby=clothPoint({x:rest.x+g.side*.035,y:rest.y+.025},deformation);
  assert.ok(g.side*(nearby.x-(rest.x+g.side*.035))>.10,'adjacent chest fabric must follow the grasp');
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
 a.step('open');a.step('close');assert.equal(a.step('lost',20).count,0);
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

test('edge-on palms with depth still acquire without being flattened toward the camera',()=>{
 const hands=collarHands('close').map((hand,i)=>{
  const center=graspCenter(hand),sign=i?-1:1;
  // Rotate the palm around the wrist-to-MCP axis while preserving diagonal approach.
  const w=hand[0],axis={x:center.x-w.x,y:center.y-w.y,z:0},len=Math.hypot(axis.x,axis.y);axis.x/=len;axis.y/=len;
  const angle=sign*1.30,c=Math.cos(angle),s=Math.sin(angle);
  return hand.map(p=>{
   const v={x:p.x-w.x,y:p.y-w.y,z:(p.z??0)-(w.z??0)},dot=v.x*axis.x+v.y*axis.y;
   return {x:w.x+v.x*c+axis.y*v.z*s+axis.x*dot*(1-c),y:w.y+v.y*c-axis.x*v.z*s+axis.y*dot*(1-c),z:(w.z??0)+v.z*c+(axis.x*v.y-axis.y*v.x)*s};
  });
 });
 assert.equal(setup().step(hands).count,2);
});
