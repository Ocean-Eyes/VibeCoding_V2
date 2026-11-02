import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleThrow,THROW_KEYS,BONE_LENGTHS,sub,dot,cross,PHASE_SECONDS} from '../src/throw-motion.js';
import {projectThrowFoot} from '../src/throw-render.js';
import {THROW_LESSONS} from '../src/throw-lessons.js';
import {lessonPath,resolveRoute} from '../src/routes.js';
const distance=(a,b)=>Math.hypot(...sub(a,b));
test('the three requested throws provide continuous demonstrations and romanized, refreshable lesson routes',()=>{
 assert.deepEqual(THROW_LESSONS.map(t=>t.name),['밭다리 후리기','안다리 후리기','한팔 업어치기']);
 for(const t of THROW_LESSONS){assert.equal(lessonPath(t.id),'/throws/'+t.roman.toLowerCase());assert.equal(resolveRoute(lessonPath(t.id)).parent,'/throws');assert.equal(t.available,true);assert.ok(t.description&&t.source);assert.equal(t.phases,undefined);}
});
test('dense trajectories keep fixed limb lengths, reachable contacts and joints above the mat',()=>{
 for(const id of Object.keys(THROW_KEYS))for(let i=0;i<=300;i++){
  const p=sampleThrow(id,i/100);
  for(const who of ['tori','uke'])for(const type of ['arms','legs'])for(const [side,l] of Object.entries(p[who][type])){
   const name=`${id} ${i/100} ${who}.${type}.${side}`,a=type==='arms'?BONE_LENGTHS.upperArm:BONE_LENGTHS.thigh,b=type==='arms'?BONE_LENGTHS.forearm:BONE_LENGTHS.shin;
   assert(Math.abs(distance(l.root,l.joint)-a)<1e-8,name+' upper segment');assert(Math.abs(distance(l.joint,l.end)-b)<1e-8,name+' lower segment');
   assert(l.reachError<1e-8,name+' reachable target');
   for(const point of [l.root,l.joint,l.end]){assert(point.every(Number.isFinite),name+' finite');assert(point[1]>=.015,name+' above mat');}
  }
  assert(distance(p.tori.arms.left.end,p.contacts.sleeve)<1e-8,id+' retained left sleeve grip');
  for(const who of ['tori','uke']){const r=p[who],radius=Math.hypot(.137*r.up[1],.1*r.forward[1]);assert(r.head[1]-radius>=.015,id+' head clears the mat');}
 }
});
test('authored key poses and phase boundaries are continuous when seeking in either direction',()=>{
 for(const [id,keys] of Object.entries(THROW_KEYS))for(const key of keys){
  const a=sampleThrow(id,key.at-.00001),b=sampleThrow(id,key.at+.00001);
  for(const who of ['tori','uke']){assert(distance(a[who].pelvis,b[who].pelvis)<.001);for(const type of ['arms','legs'])for(const side of ['left','right'])for(const field of ['root','joint','end'])assert(distance(a[who][type][side][field],b[who][type][side][field])<.001,`${id} ${key.at} ${who}.${type}.${side}.${field}`);}
 }
});
test('outer and inner reaps use different partner legs and working-leg paths',()=>{
 const outer=sampleThrow('o-soto-gari',2),inner=sampleThrow('o-uchi-gari',2);
 assert(dot(sub(outer.tori.legs.left.end,outer.uke.legs.right.end),outer.tori.right)<-.20,'outer support is outside partner right foot');
 const alongRight=p=>dot(p,inner.tori.right),feet=Object.values(inner.uke.legs).map(leg=>alongRight(leg.end));
 assert(alongRight(inner.tori.legs.right.end)>Math.min(...feet)&&alongRight(inner.tori.legs.right.end)<Math.max(...feet),'inner entry is between partner feet');
 const a=sampleThrow('o-soto-gari',3),b=sampleThrow('o-uchi-gari',3);
 assert(a.tori.legs.right.end[2]<outer.tori.legs.right.end[2]-.8,'outer reap swings backward');
 assert(dot(sub(b.tori.legs.right.end,inner.tori.legs.right.end),inner.tori.right)>.4,'inner reap travels to performer right');
 assert.deepEqual(a.tori.legs.left.end,outer.tori.legs.left.end,'outer support foot stays planted');
});

test('front-facing anatomical right appears viewer-left, and turns preserve that anatomy',()=>{
 assert.deepEqual(PHASE_SECONDS,[3.2,4.2,4]);
 for(const id of Object.keys(THROW_KEYS)){
  const ready=sampleThrow(id,0).tori;
  assert(ready.forward[2]>.99,'face points towards the front camera');
  assert(ready.shoulders.right[0]<ready.shoulders.left[0],'right shoulder is viewer-left');
  assert(ready.arms.right.end[0]<ready.arms.left.end[0],'right lapel hand is viewer-left');
  assert(ready.legs.right.end[0]<ready.legs.left.end[0],'right foot is viewer-left');
  assert(projectThrowFoot(ready.legs.right.end)[0]>projectThrowFoot(ready.legs.left.end)[0],'top-down map puts anatomical right on the right');
  for(let i=0;i<=300;i++)for(const who of ['tori','uke']){
   const rig=sampleThrow(id,i/100)[who];
   assert(dot(cross(rig.forward,rig.up),rig.right)>.999999,'right = forward cross up');
  }
 }
 const turned=sampleThrow('ippon-seoi-nage',2).tori;
 assert(turned.forward[2]<0&&turned.shoulders.right[0]>turned.shoulders.left[0],'right projects viewer-right after turning away');
 const entering=sampleThrow('ippon-seoi-nage',1.4).tori;
 assert(entering.forward[0]>0,'right-handed shoulder throw pivots to anatomical left (+X from preparation)');
});
test('shoulder throw turns left, bends the knees, then extends without crossing planted feet',()=>{
 const ready=sampleThrow('ippon-seoi-nage',1),entry=sampleThrow('ippon-seoi-nage',2),lift=sampleThrow('ippon-seoi-nage',2.32);
 assert(Math.abs(entry.tori.yaw+Math.PI)<1e-9);assert(entry.tori.pelvis[1]<ready.tori.pelvis[1]-.15);assert(lift.tori.pelvis[1]>entry.tori.pelvis[1]+.1);
 for(let t=2;t<=3;t+=.02){const p=sampleThrow('ippon-seoi-nage',t);assert(dot(sub(p.tori.legs.right.end,p.tori.legs.left.end),p.tori.right)>.25,'feet retain anatomical sides after pivot');}
 assert(entry.turn===1);assert(entry.uke.lean>0,'partner moves onto the back');
});
