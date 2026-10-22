import test from 'node:test';import assert from 'node:assert/strict';
import {sampleDemo,distance,LENGTHS} from '../src/baemilgi-motion.js';
test('reference push-up visibly bends both elbows before pushing back to extension',()=>{
 const start=sampleDemo(0),lower=sampleDemo(.20),bottom=sampleDemo(.30),up=sampleDemo(.54);
 for(let side=0;side<2;side++){
  assert(start.limbs[side].elbowAngle>155);assert(lower.limbs[side].elbowAngle<100);
  assert(bottom.limbs[side].elbowAngle<80);assert(up.limbs[side].elbowAngle>155);
 }
 assert(bottom.shoulder[1]<start.shoulder[1]-.2);assert(bottom.shoulder[0]<start.shoulder[0]-.3);
 assert(up.shoulder[1]>bottom.shoulder[1]+.25);assert(up.hip[1]<bottom.hip[1]);
});
test('full cycle preserves anatomical lengths, floor contacts and finite continuous poses',()=>{
 const origin=sampleDemo(0);let previous=origin;
 for(let i=0;i<=1000;i++){
  const pose=sampleDemo(i/1000);
  assert(Math.abs(distance(pose.hip,pose.shoulder)-LENGTHS.torso)<1e-8);
  for(let side=0;side<2;side++){
   const limb=pose.limbs[side];
   for(const [a,b,length] of [['shoulder','elbow',LENGTHS.upperArm],['elbow','wrist',LENGTHS.forearm],['hip','knee',LENGTHS.thigh],['knee','ankle',LENGTHS.shin]])assert(Math.abs(distance(limb[a],limb[b])-length)<1e-8);
   for(const contact of ['wrist','palm','ankle','toe'])assert.deepEqual(limb[contact],origin.limbs[side][contact]);
   for(const name of ['shoulder','elbow','wrist','hip','knee','ankle','toe']){assert(limb[name].every(Number.isFinite));assert(limb[name][1]>0);assert(distance(limb[name],previous.limbs[side][name])<.02);}
  }
  assert(pose.head[1]>.11);assert(pose.hip[1]>.10);previous=pose;
 }
 for(const name of ['hip','shoulder','head'])assert(distance(previous[name],origin[name])<1e-8);
});
