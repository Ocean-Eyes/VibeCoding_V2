import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,graspCenter} from '../src/collar-interaction.js';
import {HeldWrist,gloveAtWrist} from '../src/held-wrist.js';
import {collarHands,handAt} from './fixtures/collar-hands.mjs';
const rotate=(p,c,a)=>({x:c.x+(p.x-c.x)*Math.cos(a)-(p.y-c.y)*Math.sin(a),y:c.y+(p.x-c.x)*Math.sin(a)+(p.y-c.y)*Math.cos(a),visibility:.7});
function setup(up=false,mirror=true,period=20){
 const model=new CollarInteraction(),directions=up?['↑','↑']:['↓','↓'];let now=0;
 const closed=collarHands('close').map((h,i)=>{
  const hand=handAt(graspCenter(h),1,i===0,up);return mirror?hand:hand.map(p=>({...p,x:-p.x}));
 });
 const tick=(hands,wrists,{active=true}={})=>model.update(hands,now+=period,{active,directions,mirrored:mirror,bodyVisible:true,continuousHands:hands.map(Boolean),arms:wrists.map(wrist=>({wrist}))});
 let state;for(let k=0;k<20;k++)state=tick(closed,closed.map(h=>h[0]));assert.equal(state.count,2);
 return {model,closed,tick};
}

test('wrists alone keep gloves visible and opposing turns finish each mirrored cross grip',()=>{
 for(const up of [false,true])for(const mirror of [false,true]){
  const {closed,tick}=setup(up,mirror);let state;
  const wrists=closed.map(h=>h[0]);
  for(let k=0;k<150;k++){
   state=tick([null,null],wrists);assert.equal(state.count,2);assert.equal(state.tapped,false);
   assert.equal(state.wristHands.filter(Boolean).length,2);assert.equal(state.visible,0);
  }
  for(let k=0;k<180;k++){
   const a=.55*Math.min(1,k/60);
   state=tick([null,null],closed.map((h,i)=>rotate(h[0],graspCenter(h),(i?-a:a)*(mirror?1:-1))));
   assert.equal(state.wristHands.filter(Boolean).length,2);
   assert.ok(state.deformation.every(g=>Math.hypot(g.dx,g.dy)<1e-8));
  }
  assert.ok(state.wristCompletion>.95);assert.equal(state.tapped,true);
  const opened=closed.map((h,i)=>{
   const hand=handAt({x:Math.abs(graspCenter(h).x)*(i?-1:1),y:graspCenter(h).y},0,i===0,up);
   return mirror?hand:hand.map(p=>({...p,x:-p.x}));
  });
  for(let k=0;k<50;k++)state=tick(opened,opened.map(h=>h[0]));
  assert.equal(state.count,0);assert.equal(state.tapped,false);assert.ok(state.wristHands.every(h=>!h));
 }
});

test('stationary wrists, one turning wrist, common translation, swaps and missing wrists cannot tap',()=>{
 for(const kind of ['still','one','translation','swap','missing','uncertain','lateral','jump']){
  const {closed,tick}=setup();let state;
  for(let k=0;k<220;k++){
   const u=Math.min(1,k/60),wrists=closed.map((h,i)=>{
    const p=h[0];
    if(kind==='missing')return null;
    if(kind==='uncertain')return {...p,visibility:.2};
    if(kind==='swap')return closed[1-i][0];
    if(kind==='translation')return {...p,y:p.y-.1*u};
    if(kind==='lateral')return {...p,x:p.x+(i?-1:1)*.22*u};
    if(kind==='jump')return {...p,x:p.x+.4};
    return rotate(p,graspCenter(h),kind==='one'&&i===0?.55*u:0);
   });
   state=tick([null,null],wrists);assert.equal(state.tapped,false,kind);
  }
  if(['swap','missing','uncertain','jump'].includes(kind))assert.ok(state.wristHands.every(h=>!h),kind);
 }
});

test('fallback glove follows the wrist as a rigid shape, preserving every pairwise bone length',()=>{
 const hand=collarHands('close')[0],wrist=rotate(hand[0],graspCenter(hand),.55),glove=gloveAtWrist(hand,wrist);
 assert.equal(glove[0].x,wrist.x);assert.equal(glove[0].y,wrist.y);
 for(let i=0;i<21;i++)for(let j=0;j<21;j++)assert.ok(Math.abs(Math.hypot(hand[i].x-hand[j].x,hand[i].y-hand[j].y)-Math.hypot(glove[i].x-glove[j].x,glove[i].y-glove[j].y))<1e-10);
});

test('wrist continuity rejects sustained teleports and resumes only at the real track',()=>{
 const tracker=new HeldWrist({x:.2,y:.2});
 for(let t=0;t<3000;t+=20)assert.equal(tracker.update({x:-.2,y:.2},t),null);
 assert.ok(tracker.update({x:.2,y:.2},3020));
 assert.equal(tracker.update({x:NaN,y:.2},3040),null);
});


test('alternating finger loss and noisy pose wrists finish at 10, 15, 30 and 60 fps without cloth jumps',()=>{
 for(const fps of [10,15,30,60])for(const up of [false,true]){
  const {closed,tick}=setup(up,true,1000/fps);let state;
  for(let k=0;k<fps*5;k++){
   const angle=.55*Math.min(1,k/fps);
   const turned=closed.map((h,i)=>h.map(p=>({...p,...rotate(p,graspCenter(h),i?-angle:angle)})));
   const wrists=turned.map((h,i)=>({...h[0],x:h[0].x+Math.sin(k*1.7+i)*.003,y:h[0].y+Math.cos(k*1.3+i)*.003}));
   const hands=turned.map((h,i)=>(Math.floor(k/4)+i)%3===0?h:null);
   state=tick(hands,wrists);
   assert.equal(state.count,2);assert.ok(state.deformation.every(g=>Math.hypot(g.dx,g.dy)<1e-8));
   for(let i=0;i<2;i++)assert.ok(hands[i]||state.wristHands[i],'hidden fingers retain a wrist-followed glove');
  }
  assert.equal(state.tapped,true,`fps=${fps}, palmUp=${up}`);
 }
});


test('a body-model wrist offset is calibrated and cannot create movement at handoff',()=>{
 for(const dx of [-.06,-.03,0,.03,.06])for(const dy of [-.04,0,.04]){
  const {closed,tick}=setup();let state;
  const biased=hands=>hands.map((h,i)=>({...h[0],x:h[0].x+(i?-dx:dx),y:h[0].y+dy}));
  for(let k=0;k<20;k++)state=tick(closed,biased(closed));
  for(let k=0;k<100;k++){
   state=tick([null,null],biased(closed));
   assert.equal(state.wristCompletion,0);assert.equal(state.tapped,false);
   state.wristHands.forEach((h,i)=>assert.ok(Math.hypot(h[0].x-closed[i][0].x,h[0].y-closed[i][0].y)<1e-10));
  }
  for(let k=0;k<150;k++){
   const a=.55*Math.min(1,k/50),turned=closed.map((h,i)=>h.map(p=>({...p,...rotate(p,graspCenter(h),i?-a:a)})));
   state=tick([null,null],biased(turned));
  }
  assert.equal(state.tapped,true);
 }
});
