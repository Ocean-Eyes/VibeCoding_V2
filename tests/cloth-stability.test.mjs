import {ClothMotion,CLOTH_MAX_TRAVEL,CLOTH_SPEED} from '../src/cloth-motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction,clothPoint,lapelRest,lapelPoint} from '../src/collar-interaction.js';
import {HandStream} from '../src/live-hands.js';
import {handAt} from './fixtures/collar-hands.mjs';

test('closing near the neck never converts contact tolerance into initial fabric stretch',()=>{
 for(const t of [0,.008,.025,.05,.12,.20])for(const offset of [-.08,0,.08]){
  const model=new CollarInteraction(),hands=[1,-1].map((side,i)=>{const p=lapelRest(side,t);return handAt({x:p.x+side*offset,y:p.y-.015},1,i===0)});
  let state;for(let now=0;now<=240;now+=20)state=model.update(hands,now);
  assert.equal(state.count,2);
  for(const g of state.grips){assert.ok(Math.hypot(g.dx,g.dy)<1e-12,`initial stretch at t=${t}, offset=${offset}`)}
 }
});

test('near-neck movement has bounded influence over the whole coat',()=>{
 for(const t of [0,.001,.008,.025,.05,.12,.29])for(const dy of [-.025,.025]){
  const deformation=[{side:1,t,dx:.015,dy},{side:-1,t:t+.005,dx:-.012,dy:-dy}],limit=Math.max(...deformation.map(g=>Math.hypot(g.dx,g.dy)));
  for(let row=0;row<=50;row++)for(let col=0;col<=30;col++){
   const p={x:-.6+col*.04,y:.065+row*.025},q=clothPoint(p,deformation),d=Math.hypot(q.x-p.x,q.y-p.y);
   assert.ok(Number.isFinite(d)&&d<=limit+1e-10,`amplified by ${d/limit} near t=${t}`);
  }
 }
});

test('4032 single/bilateral contact configurations preserve the initial coat across technique and mirror settings',()=>{
 let cases=0;
 for(const t of [.001,.008,.025,.05,.09,.12,.20,.30])
 for(const dx of [-.09,-.06,-.03,0,.03,.06,.09])
 for(const dy of [-.06,-.025,0,.025])
 for(const directions of [['↓','↓'],['↑','↑'],['↑','↓']])
 for(const mirrored of [true,false])for(const mask of [0,1,2]){
  const model=new CollarInteraction();
  const hands=[0,1].map(i=>{
   const side=(i?-1:1)*(mirrored?1:-1),p=lapelRest(side,t);
   const h=handAt({x:p.x+side*dx,y:p.y+dy},.8,i===0,directions[i]==='↑');
   // Reflect the camera orientation without changing the chosen contact center.
   return mirrored?h:h.map(q=>({...q,x:2*(p.x+side*dx)-q.x}));
  });
  const visible=hands.map((h,i)=>mask===2||mask===i?h:null);
  let state;for(let time=0;time<=240;time+=20)state=model.update(visible,time,{directions,mirrored});
  assert.equal(state.count,mask===2?2:1,JSON.stringify({t,dx,dy,directions,mirrored,mask}));
  assert.ok(state.deformation.every(g=>Math.hypot(g.dx,g.dy)<1e-12));
  cases++;
 }
 assert.equal(cases,4032);
});

test('128 seeded noisy trajectories reject spikes and preserve smooth grip motion over 23040 frames',()=>{
 for(let seed=1;seed<=128;seed++){
  let random=seed;const rand=()=>((random=(1664525*random+1013904223)>>>0)/2**32);
  const model=new CollarInteraction(),streams=[new HandStream(),new HandStream()];
  let state,time=0;
  const base=[1,-1].map((side,i)=>handAt(lapelRest(side,.04+rand()*.16),.85,i===0));
  for(;time<=240;time+=20)state=model.update(base,time);
  assert.equal(state.count,2);
  for(let frame=0;frame<180;frame++,time+=65){
   const spike=frame%23>=17,shift=spike?.8+rand():Math.sin(frame/18)*.015;
   const raw=base.map(h=>h.map(p=>({...p,x:p.x+shift+(spike?0:(rand()-.5)*.001)})));
   const old=state.grips.map(g=>({...g.center}));
   state=model.update(raw,time);
   assert.equal(state.count,2);
   if(spike)assert.deepEqual(state.grips.map(g=>g.center),old);
   const limit=Math.max(...state.deformation.map(g=>Math.hypot(g.dx,g.dy)));
   for(const p of [{x:0,y:.3},{x:.22,y:.15},{x:-.3,y:.5},{x:0,y:1.1}]){
    const q=clothPoint(p,state.deformation);
    assert.ok(Math.hypot(q.x-p.x,q.y-p.y)<=limit+1e-10);
   }
   raw.forEach((h,i)=>{
    const normalized=h.map(p=>({...p,x:p.x*.18+.5,y:p.y*.18+.3}));
    streams[i].update(normalized,time);
    if(spike)assert.equal(streams[i].trackedAt(time),null);
   });
   assert.equal(state.tapped,false);
  }
 }
});

test('adding a second grip preserves an already displaced first collar',()=>{
 for(const t of [.025,.08,.20])for(const shift of [-.025,.025]){
  const model=new CollarInteraction(),left=handAt(lapelRest(1,t),1,true);
  let state;for(let time=0;time<=240;time+=20)state=model.update([left,null],time);
  const moved=left.map(p=>({...p,x:p.x+shift}));
  for(let time=260;time<=440;time+=20)state=model.update([moved,null],time);
  const before=state.deformation.map(g=>({...g})),right=handAt(lapelPoint(-1,.20,before),1,false);
  for(let time=460;time<=700;time+=20)state=model.update([moved,right],time);
  assert.equal(state.count,2);
  for(let y=.07;y<=1.2;y+=.03)for(let x=-.5;x<=.5;x+=.04){
   const a=clothPoint({x,y},before),b=clothPoint({x,y},state.deformation);
   assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.002,'second contact must not pull the existing fabric');
  }
 }
});


test('the photographed single-hand neck contact leaves the entire collar unchanged',()=>{
 for(const side of [1,-1]){
  const model=new CollarInteraction(),hands=side===1?[handAt({x:.285,y:.015},1,true),null]:[null,handAt({x:-.285,y:.015},1,false)];
  let state;for(let t=0;t<=3000;t+=20)state=model.update(hands,t);
  assert.equal(state.count,1);
  for(let t=0;t<=1;t+=.01)assert.deepEqual(lapelPoint(side,t,state.deformation),lapelRest(side,t));
 }
});

test('rendered cloth has independent speed and travel bounds for every frame',()=>{
 for(const fps of [10,15,30,60,120])for(const amplitude of [.08,.24,3,1000]){
  const motion=new ClothMotion(),step=1000/fps;
  let previous=motion.update([{side:1,t:.008,dx:0,dy:0}],0)[0];
  for(let i=1;i<=240;i++){
   const sign=i%60<30?1:-1;
   const next=motion.update([{side:1,t:.008,dx:sign*amplitude,dy:-sign*amplitude,engagement:sign>0?1:0}],i*step)[0];
   assert.ok(Math.hypot(next.dx,next.dy)<=CLOTH_MAX_TRAVEL+1e-10);
   assert.ok(Math.hypot(next.dx-previous.dx,next.dy-previous.dy)<=CLOTH_SPEED*Math.min(.05,step/1000)+1e-10);
   assert.ok(Math.abs(next.engagement-previous.engagement)<=1.5*Math.min(.05,step/1000)+1e-10);
   previous=next;
  }
 }
});
