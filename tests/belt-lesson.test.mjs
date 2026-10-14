import test from 'node:test';
import assert from 'node:assert/strict';
import {BELT_STEPS,beltPose,beltAnchor} from '../src/belt-geometry.js';
test('belt transitions retain connected ends and do not jump at stage boundaries',()=>{
 assert.equal(BELT_STEPS.length,7);
 for(let step=1;step<7;step++)assert.deepEqual({...beltPose(step,0),step:step-1},beltPose(step-1,1));
 for(let step=0;step<7;step++)for(let n=0;n<=100;n++){
  const pose=beltPose(step,n/100);assert.ok(pose.wrap>=0&&pose.wrap<=1);
  for(const [i,key]of ['a','b'].entries()){const angle=pose.wrap*Math.PI*2;assert.ok(Math.hypot(pose[key][0][0]-(i?1:-1)*.51*Math.sin(angle),pose[key][0][1]-((i?.026:-.026)*pose.wrap-.09*(1-Math.cos(angle))))<1e-10);assert.ok(pose[key].flat().every(Number.isFinite))}
 }
});
test('camera default places both belt ends inside desktop and mobile views',()=>{
 for(const w of [300,390,760]){
  const h=w*.75,anchor=beltAnchor(w,h);
  for(let step=0;step<7;step++)for(let n=0;n<=20;n++)for(const key of ['a','b'])for(const [x,y]of beltPose(step,n/20)[key]){
   assert.ok(anchor.x+x*anchor.scale>=12&&anchor.x+x*anchor.scale<=w-12);
   assert.ok(anchor.y+y*anchor.scale>=12&&anchor.y+y*anchor.scale<=h-12);
  }
 }
});
test('belt knot finishes with two balanced ends on opposite sides',()=>{
 const pose=beltPose(6),a=pose.a.at(-1),b=pose.b.at(-1);assert.ok(Math.abs(a[0]+b[0])<1e-10);assert.ok(Math.abs(a[1]-b[1])<.06);assert.equal(pose.wrap,1);
 assert.ok(beltPose(3).a.at(-1)[1]<0,'inserted end emerges above both layers');
});

test('unwrapped belt has one level continuous center instead of stacked half strips',()=>{
 const pose=beltPose(0);assert.deepEqual(pose.a[0],pose.b[0]);
 assert.equal(pose.a[0][1],0);assert.equal(pose.a[1][1],0);assert.equal(pose.b[1][1],0);
});
