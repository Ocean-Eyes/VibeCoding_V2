import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleThrow,THROW_KEYS,sub,add,mul,dot,unit} from '../src/throw-motion.js';
import {CONTACT_RATE,CONTACT_TRACKS} from '../src/throw-contact-data.js';
import {bodyIntersections} from '../src/throw-body.js';
const distance=(a,b)=>Math.hypot(...sub(a,b));

test('every authored throw ships a complete contact track, not an empty placeholder',()=>{
 for(const id of Object.keys(THROW_KEYS)){
  const track=CONTACT_TRACKS[id];assert.equal(track?.length,CONTACT_RATE*3+1,id);
  for(const frame of track){assert.equal(frame.length,54);assert(frame.every(Number.isFinite));}
 }
});

test('retained grips contact the partner garment independently of the displayed hand label',()=>{
 for(const id of Object.keys(THROW_KEYS))for(let i=0;i<=600;i++){
  const p=sampleThrow(id,i/200),arm=p.uke.arms.right,axis=unit(sub(arm.end,arm.joint));
  const centre=add(arm.joint,mul(sub(arm.end,arm.joint),.35)),offset=sub(p.tori.arms.left.end,centre);
  assert(Math.abs(dot(offset,axis))<1e-5,`${id} ${p.time}: same material site along sleeve`);
  assert(Math.abs(Math.hypot(...offset)-.112)<1e-5,`${id} ${p.time}: palm around sleeve fold`);
  if(p.time<=1||id!=='ippon-seoi-nage'&&p.time<=2.35){
   const surface=p.uke.at(-.1,.40,.153),palm=add(surface,mul(p.uke.forward,.047));
   assert(distance(p.tori.arms.right.end,palm)<1e-5,`${id} ${p.time}: right hand on left lapel`);
  }
 }
});

test('outer reap finishes with a planted left foot and extended raised right leg',()=>{
 const entry=sampleThrow('o-soto-gari',1.45),finish=sampleThrow('o-soto-gari',3);
 for(let i=145;i<=300;i++)assert(distance(sampleThrow('o-soto-gari',i/100).tori.legs.left.end,entry.tori.legs.left.end)<1e-8);
 const leg=finish.tori.legs.right;
 assert(leg.end[1]>leg.root[1]+.15,'reaping foot rises behind the hip');
 assert(leg.end[2]<leg.root[2]-.75,'working leg extends back');
 assert(distance(leg.root,leg.end)>.87,'working knee is almost extended');
 assert(finish.tori.pelvis[1]>.85,'performer stays supported rather than collapsing');
});

test('displayed body envelopes do not intersect at baked frames or halfway between them',()=>{
 for(const id of Object.keys(THROW_KEYS))for(let i=0;i<=CONTACT_RATE*6;i++){
  const time=i/(CONTACT_RATE*2),hits=bodyIntersections(sampleThrow(id,time));
  assert.equal(hits.length,0,`${id} ${time}: ${JSON.stringify(hits[0])}`);
 }
});
