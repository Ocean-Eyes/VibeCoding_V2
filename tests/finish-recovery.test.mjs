import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,graspCenter} from '../src/collar-interaction.js';
import {collarHands,collarArms} from './fixtures/collar-hands.mjs';
const turn=(h,a)=>{const c=graspCenter(h);return h.map(p=>({...p,x:c.x+(p.x-c.x)*Math.cos(a)-(p.y-c.y)*Math.sin(a),y:c.y+(p.x-c.x)*Math.sin(a)+(p.y-c.y)*Math.cos(a)}))};
function setup(){
 const model=new CollarInteraction(),closed=collarHands('close');let time=0;
 const step=(hands,arms=collarArms(),active=true)=>model.update(hands,time+=20,{active,arms,bodyVisible:true,continuousHands:hands.map(Boolean)});
 for(let k=0;k<20;k++)step(closed);
 return {model,closed,step};
}
test('moderately visible wrists resume the screenshot waiting state and complete without reopening',()=>{
 const {closed,step}=setup();let state;
 for(let k=0;k<55;k++)state=step([null,null],[null,null]);
 assert.equal(state.score,50);assert.equal(state.trackingPaused,true);
 const arms=phase=>collarArms(phase).map((a,i)=>({...a,wrist:{...closed[i][0],visibility:.55}}));
 for(let k=0;k<25;k++)state=step([null,null],arms('close'));
 assert.equal(state.wristHands.filter(Boolean).length,2);
 for(let k=0;k<90;k++)state=step([null,null],arms('lift'));
 assert.equal(state.tapped,true);
});
test('a held pose wrist returning after motion is reacquired instead of rejected forever',()=>{
 const {closed,step}=setup();let state;
 const returned=closed.map((h,i)=>turn(h,i?-.7:.7));
 for(let k=0;k<60;k++)state=step([null,null],collarArms().map((a,i)=>({...a,wrist:returned[i][0]})));
 assert.equal(state.wristHands.filter(Boolean).length,2);
 assert.equal(state.tapped,false,'reacquisition itself cannot finish');
 assert.ok(state.deformation.every(g=>Math.hypot(g.dx,g.dy)<1e-8));
 for(let k=0;k<90;k++)state=step([null,null],collarArms('lift').map((a,i)=>({...a,wrist:returned[i][0]})));
 assert.equal(state.tapped,true);
});
test('left elbow evidence and right wrist evidence combine for the same finish',()=>{
 for(const wristSide of [0,1]){
  const {closed,step}=setup();let state;
  for(let k=0;k<130;k++){
   const angle=.55*Math.min(1,k/35),hands=closed.map((h,i)=>i===wristSide?turn(h,i?-angle:angle):h);
   const arms=collarArms('lift');arms[wristSide]=null;
   state=step(hands,arms);
  }
  assert.equal(state.tapped,true,`wrist side ${wristSide}`);
 }
});
test('brief threshold dips do not erase an otherwise sustained finishing action',()=>{
 const {closed,step}=setup();let state;
 for(let k=0;k<160;k++){
  const arms=collarArms().map(a=>({...a,elbow:{...a.elbow,y:a.elbow.y-(k%10===0?.097:.115)}}));
  state=step(closed,arms);
 }
 assert.equal(state.tapped,true);
});

import {HeldWrist} from '../src/held-wrist.js';
test('rendering one cached pose frame repeatedly cannot confirm wrist recovery',()=>{
 const track=new HeldWrist({x:0,y:0}),wrist={x:.13,y:.03,visibility:.7};
 for(let time=0;time<=240;time+=16)assert.equal(track.update(wrist,time,{recover:true,sampleTime:0}),null);
 assert.equal(track.revision,0);
 assert.equal(track.update(wrist,260,{recover:true,sampleTime:260}),null);
 assert.ok(track.update(wrist,330,{recover:true,sampleTime:330}));assert.equal(track.revision,1);
});
