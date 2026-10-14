import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,fingerExtension,openFingers,curledFingers} from '../src/collar-interaction.js';
import {acquisitionHands} from './fixtures/acquisition-hands.mjs';
import {rollHand} from './fixtures/gyaku-hands.mjs';
import {collarArms} from './fixtures/collar-hands.mjs';
function acquire(hands,{mirror=true,palmUp=true,fps=15}={}){
 const model=new CollarInteraction();let state;
 for(let now=0;now<700;now+=1000/fps)state=model.update(hands,now,{mirrored:mirror,directions:[palmUp?'↑':'↓',palmUp?'↑':'↓'],bodyVisible:true,arms:collarArms()});
 return {model,state};
}
test('a hooked reverse grip is not forced into a full fist',()=>{
 const hands=acquisitionHands();
 assert.ok(hands.every(h=>fingerExtension(h)>.92&&openFingers(h).length<3),'reproduces the gap between open and closed thresholds');
 assert.equal(acquire(hands).state.count,2);
});
for(const mirror of [true,false])for(const palmUp of [true,false])for(const fps of [10,15,30])for(const hook of [.55,.7])for(const scale of [.8,1.2])for(const contact of ['knuckles','fingers']){
 test(`acquire hooked collar: mirror=${mirror}, reverse=${palmUp}, fps=${fps}, hook=${hook}, scale=${scale}, ${contact}`,()=>{
  const hands=acquisitionHands({mirror,palmUp,hook,scale,contact});
  const {state}=acquire(hands,{mirror,palmUp,fps});assert.equal(state.count,2);assert.equal(state.tapped,false);
 });
}
test('flat, relaxed, wrong-facing and distant hands never acquire through finger contact',()=>{
 for(const mirror of [true,false])for(const palmUp of [true,false])for(const config of [{hook:0},{hook:.18},{hook:.6,palmUp:!palmUp},{hook:.6,offset:.65}]){
  const hands=acquisitionHands({mirror,palmUp,contact:'fingers',...config});
  assert.equal(acquire(hands,{mirror,palmUp}).state.count,0,JSON.stringify({mirror,palmUp,config}));
 }
});

// An independent landmark chain, without the rendered hand model: straight
// knuckles, flexed PIP/DIP joints. Size and camera rotation must not matter.
test('independent hooked-finger geometry is recognized without a fist or thumb cue',()=>{
 for(const scale of [.5,1,2])for(const angle of [0,.7,1.5]){
  const hand=Array.from({length:21},()=>({x:0,y:0,z:0}));
  for(const [j,k]of [5,9,13,17].entries()){
   const x=(j-1.5)*.025;
   hand[k]={x,y:-.1,z:0};hand[k+1]={x,y:-.15,z:0};
   hand[k+2]={x,y:-.15-.03*Math.cos(.65),z:.03*Math.sin(.65)};
   hand[k+3]={x,y:hand[k+2].y-.022*Math.cos(1.05),z:hand[k+2].z+.022*Math.sin(1.05)};
  }
  const rotated=hand.map(p=>({x:scale*(p.x*Math.cos(angle)-p.y*Math.sin(angle)),y:scale*(p.x*Math.sin(angle)+p.y*Math.cos(angle)),z:scale*p.z}));
  assert.equal(curledFingers(rotated).length,4);assert.ok(fingerExtension(rotated)>.92);
 }
});
test('open -> hook -> release works at the collar, with modest depth noise and staggered hands',()=>{
 for(const mirror of [true,false])for(const fps of [10,15,30]){
  const model=new CollarInteraction();let state;
  for(let n=0;n<fps*4;n++){
   const now=n*1000/fps,closed=now>=600&&now<2400;
   const hands=acquisitionHands({mirror,hook:closed?.65:0,depth:.8,scale:1.1});
   if(closed&&now<850)hands[1]=acquisitionHands({mirror,hook:0,depth:.8,scale:1.1})[1];
   hands.forEach((h,i)=>h.forEach((p,k)=>{p.x+=.002*Math.sin(n*.7+i);p.z+=.001*Math.sin(n*.6+k)}));
   state=model.update(hands,now,{mirrored:mirror,directions:['↑','↑'],bodyVisible:true,arms:collarArms(),continuousHands:[true,true]});
   if(now<600)assert.equal(state.count,0);
   if(now>=1300&&now<2400)assert.equal(state.count,2,`fps=${fps}, time=${now}`);
   assert.equal(state.tapped,false);
  }
  assert.equal(state.count,0);
 }
});
test('isolated bent fingers cannot acquire while the rest of the hand remains open',()=>{
 for(const mirror of [true,false])for(const bent of [1,2]){
  const hands=acquisitionHands({mirror,hook:0}),hooked=acquisitionHands({mirror,hook:.6});
  hands.forEach((h,i)=>{for(const k of [5,9].slice(0,bent))for(let j=1;j<=3;j++)h[k+j]=hooked[i][k+j]});
  assert.equal(acquire(hands,{mirror}).state.count,0);
 }
});

// Camera depth is particularly unreliable when the fingers overlap in profile.
// Keep the thin projected palm, but simulate a curled estimate at those pixels.
function edgeEstimate({mirror,palmUp,roll,depth,hook=.65,scale=1}){
 return acquisitionHands({mirror,palmUp,hook,scale}).map((h,i)=>rollHand(h,roll*(i?-1:1)*(mirror?1:-1)).map(p=>({...p,z:p.z*depth})));
}
for(const mirror of [true,false])for(const palmUp of [true,false])for(const roll of [1,1.1,1.2])for(const depth of [0,.1,.4,1])for(const scale of [.8,1.2]){
 test(`thin edge cannot acquire: mirror=${mirror}, reverse=${palmUp}, roll=${roll}, depth=${depth}, scale=${scale}`,()=>{
  const hands=edgeEstimate({mirror,palmUp,roll,depth,scale});
  assert.equal(acquire(hands,{mirror,palmUp}).state.count,0);
 });
}
for(const mirror of [true,false])for(const palmUp of [true,false]){
 test(`edge-to-face acquires without reopening and held edge retains: mirror=${mirror}, reverse=${palmUp}`,()=>{
  const model=new CollarInteraction();let state,time=0;
  const step=hands=>state=model.update(hands,time+=65,{mirrored:mirror,directions:[palmUp?'↑':'↓',palmUp?'↑':'↓'],bodyVisible:true,arms:collarArms()});
  for(let n=0;n<20;n++)step(edgeEstimate({mirror,palmUp,roll:1.1,depth:.1}));
  assert.equal(state.count,0);
  for(let n=0;n<20;n++)step(acquisitionHands({mirror,palmUp}));
  assert.equal(state.count,2,'prepared hook must still acquire without an open-first gesture');
  for(let n=0;n<20;n++)step(edgeEstimate({mirror,palmUp,roll:1.1,depth:.1}));
  assert.equal(state.count,2,'initial visibility gate must never unlatch an existing grip');
  for(let n=0;n<25;n++)step(acquisitionHands({mirror,palmUp,hook:0}));
  assert.equal(state.count,0,'visible opening still releases');
 });
}
