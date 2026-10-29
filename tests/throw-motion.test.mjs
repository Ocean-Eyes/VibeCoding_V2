import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleThrow,THROW_KEYS,BONE_LENGTHS,sub,dot} from '../src/throw-motion.js';
import {THROW_LESSONS,THROW_PHASES} from '../src/throw-lessons.js';
import {lessonPath,resolveRoute} from '../src/routes.js';
const distance=(a,b)=>Math.hypot(...sub(a,b));
test('the three requested throws expose ordered phases and romanized, refreshable lesson routes',()=>{
 assert.deepEqual(THROW_LESSONS.map(t=>t.name),['밭다리 후리기','안다리 후리기','한팔 업어치기']);
 assert.deepEqual(THROW_PHASES.map(p=>p.id),['kuzushi','tsukuri','kake']);
 for(const t of THROW_LESSONS){assert.equal(lessonPath(t.id),'/throws/'+t.roman.toLowerCase());assert.equal(resolveRoute(lessonPath(t.id)).parent,'/throws');assert.equal(t.phases.length,3);assert.equal(t.available,true);for(const p of t.phases)assert.ok(p.title&&p.cue&&p.focus&&p.check);}
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
 assert(outer.tori.legs.left.end[0]<outer.uke.legs.right.end[0]-.20,'outer support is outside partner right foot');
 assert(inner.tori.legs.right.end[0]>inner.uke.legs.right.end[0]&&inner.tori.legs.right.end[0]<inner.uke.legs.left.end[0],'inner entry is between partner feet');
 const a=sampleThrow('o-soto-gari',3),b=sampleThrow('o-uchi-gari',3);
 assert(a.tori.legs.right.end[2]<outer.tori.legs.right.end[2]-.8,'outer reap swings backward');
 assert(b.tori.legs.right.end[0]>inner.tori.legs.right.end[0]+.4,'inner reap travels to performer right');
 assert.deepEqual(a.tori.legs.left.end,outer.tori.legs.left.end,'outer support foot stays planted');
});
test('shoulder throw turns left, bends the knees, then extends without crossing planted feet',()=>{
 const ready=sampleThrow('ippon-seoi-nage',1),entry=sampleThrow('ippon-seoi-nage',2),lift=sampleThrow('ippon-seoi-nage',2.32);
 assert(Math.abs(entry.tori.yaw+Math.PI)<1e-9);assert(entry.tori.pelvis[1]<ready.tori.pelvis[1]-.15);assert(lift.tori.pelvis[1]>entry.tori.pelvis[1]+.1);
 for(let t=2;t<=3;t+=.02){const p=sampleThrow('ippon-seoi-nage',t);assert(dot(sub(p.tori.legs.right.end,p.tori.legs.left.end),p.tori.right)>.25,'feet retain anatomical sides after pivot');}
 assert(entry.turn===1);assert(entry.uke.lean>0,'partner moves onto the back');
});
