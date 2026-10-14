import test from 'node:test';
import assert from 'node:assert/strict';
import {BELT_STEPS,BELT_SOURCE,BELT_REFERENCE_2,BELT_LENGTH,BELT_WIDTH,beltPose,beltAnchor,pathLength,demoPlacement,cinematicPlacement,project,drawGhostBelt} from '../src/belt-geometry.js';
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('all seven stages join without teleporting the cloth at their boundaries',()=>{
 assert.equal(BELT_STEPS.length,7);
 for(let step=1;step<7;step++)assert.deepEqual({...beltPose(step,0),step:step-1},beltPose(step-1,1));
});
for(let step=0;step<7;step++)test(`stage ${step+1} preserves cloth length, width and straight free ends through 41 frames`,()=>{
 for(let i=0;i<=40;i++){
  const pose=beltPose(step,i/40),length=pose.halves.reduce((s,h)=>s+pathLength(h.path),0);assert.ok(Math.abs(length-BELT_LENGTH)<1e-8);
  assert.ok(dist(pose.halves[0].path[0],pose.halves[1].path[0])<1e-10,'one continuous midpoint');
  for(const h of pose.halves){
   assert.ok(h.freeLength>.05);
   for(const v of h.ribbon){assert.ok(v.p.every(Number.isFinite));assert.ok(Math.abs(dist(v.left,v.right)-BELT_WIDTH)<1e-9,'fixed cloth width')}
   assert.ok(Math.abs(pathLength(h.ribbon.map(v=>v.p))-h.materialLength)/h.materialLength<.015,'rendered mesh does not stretch');
   const tail=h.ribbon.filter(v=>v.s>h.materialLength-h.freeLength+.04).map(v=>v.p);
   if(tail.length>2){const chord=dist(tail[0],tail.at(-1)),arc=pathLength(tail);assert.ok(Math.abs(chord-arc)<1e-8,'free end is straight, not a snake-like spline')}
  }
 }
});
test('standing wrap uses more material while free ends shorten',()=>{
 const free=s=>beltPose(s).halves.reduce((sum,h)=>sum+h.freeLength,0);
 assert.ok(free(0)>free(1));assert.ok(free(1)>free(2));
 const end=beltPose(6);assert.ok(Math.abs(end.halves[0].freeLength-end.halves[1].freeLength)<1e-10);assert.ok(end.a.at(-1)[0]*end.b.at(-1)[0]<0);
});
test('default camera placement and demo framing retain long ends and the head',()=>{
 for(const w of [300,390,760])for(let step=0;step<7;step++)for(let i=0;i<=12;i++){
  const pose=beltPose(step,i/12),h=w*.75,anchors=[beltAnchor(w,h),demoPlacement(w,h,pose)];
  for(const anchor of anchors)for(const key of ['a','b'])for(const p of pose[key]){
   assert.ok(anchor.x+p[0]*anchor.scale>=11&&anchor.x+p[0]*anchor.scale<=w-11);
   assert.ok(anchor.y+p[1]*anchor.scale>=11&&anchor.y+p[1]*anchor.scale<=h-11);
  }
  const frame=anchors[1];assert.ok(frame.y-1.67*frame.scale>0,'head is visible');
 }
});
test('underpass is behind both front waist layers; back view reverses depth',()=>{
 const p=beltPose(3),a=p.halves[0].ribbon;
 const inserted=a.filter(v=>Math.abs(v.p[0])<.15&&Math.abs(v.p[1])<.08&&v.p[2]>.20&&v.p[2]<.25);
 assert.ok(inserted.length>0,'threaded cloth goes between body and standing belt');
 const point=[.2,.1,.3];assert.equal(project(point,'back')[0],-.2);assert.ok(project(point,'front')[1]<project(point,'back')[1]);
});

test('transient zero-size canvas during layout cannot terminate the animation loop',()=>{
 assert.doesNotThrow(()=>drawGhostBelt({canvas:{width:0,height:100}},{},beltPose(0)));
 assert.doesNotThrow(()=>drawGhostBelt({canvas:{width:100,height:0}},{},beltPose(0)));
});

test('reference sequence keeps B still while A forms the loop, then A still while B passes through',()=>{
 const before=beltPose(3),loop=beltPose(4),thread=beltPose(5);
 for(let i=0;i<=30;i++){
  const duringLoop=beltPose(4,i/30),duringThread=beltPose(5,i/30);
  for(let n=0;n<loop.b.length;n++)assert.ok(dist(duringLoop.b[n],before.b[n])<1e-9,'B must wait during A loop');
  for(let n=0;n<loop.a.length;n++)assert.ok(dist(duringThread.a[n],loop.a[n])<1e-9,'A loop must stay open during B insertion');
 }
 assert.ok(dist(before.a.at(-1),loop.a.at(-1))>.3);assert.ok(dist(loop.b.at(-1),thread.b.at(-1))>.3);
 assert.ok(before.a.at(-1)[1]>0,'A returns down after passing beneath both layers');
 assert.ok(beltPose(2).a.at(-1)[1]<0&&beltPose(2).b.at(-1)[1]<0,'ends lift together for the length check');
 assert.ok(BELT_SOURCE.includes('poG-fDcqUA0'));assert.ok(BELT_REFERENCE_2.includes('IG5WBxopLJw'));assert.ok(BELT_STEPS.every(s=>s.reference.length===2));
});
test('passing the rear center and returning to the front does not teleport a hanging end',()=>{
 let previous=beltPose(1,0);
 for(let i=1;i<=1000;i++){const current=beltPose(1,i/1000);for(const key of ['a','b'])assert.ok(dist(previous[key].at(-1),current[key].at(-1))<.04,'no side flip at the rear center');previous=current}
 const left=beltPose(1,.999999),right=beltPose(2,.000001);for(const key of ['a','b'])assert.ok(dist(left[key].at(-1),right[key].at(-1))<.00001);
});

test('waist closeups retain both tips through the full insertion sequence',()=>{
 for(const w of [300,390,940])for(let step=0;step<7;step++)for(let i=0;i<=30;i++){
  const pose=beltPose(step,i/30),h=w*.75,anchor=cinematicPlacement(w,h,pose);
  for(const key of ['a','b'])for(const p of pose[key]){
   assert.ok(anchor.x+p[0]*anchor.scale>=11&&anchor.x+p[0]*anchor.scale<=w-11);
   assert.ok(anchor.y+p[1]*anchor.scale>=11&&anchor.y+p[1]*anchor.scale<=h-11);
  }
 }
 for(const step of [4,5])assert.ok(beltPose(step).halves[0].freeLength>.3,'A needs enough cloth beyond the loop to be held');
});
