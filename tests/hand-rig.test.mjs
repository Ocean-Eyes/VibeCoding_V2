import test from 'node:test';
import assert from 'node:assert/strict';
import {HAND_RIG} from '../src/hand-rig-data.js';
import {posedHand,handViewPoint} from '../src/hand-rig.js';
import {GRIP_STEPS,gripPlacement} from '../src/demonstration.js';
const length=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
test('AAH kinematics preserve 21-landmark topology, bone lengths and coordinate limits',()=>{
 const open=posedHand(0),closed=posedHand(1);
 assert.equal(closed.landmarks.length,21);
 assert.ok(closed.landmarks.every(p=>p.length===3&&p.every(Number.isFinite)));
 for(const node of HAND_RIG)for(const joint of node.joints){
  const angle=closed.joints[joint.name];assert.ok(angle>=joint.range[0]&&angle<=joint.range[1]);
 }
 for(let finger=0;finger<5;finger++)for(let j=1;j<4;j++){
  const a=1+finger*4+j-1,b=a+1;
  assert.ok(Math.abs(length(open.landmarks[a],open.landmarks[b])-length(closed.landmarks[a],closed.landmarks[b]))<1e-9);
 }
});
test('thumb side belongs to the anatomical hand, and supination rotates its depth too',()=>{
 const radial=posedHand().landmarks[1];
 assert.ok(handViewPoint(radial,true,false)[0]>0); // left dorsal thumb: right edge
 assert.ok(handViewPoint(radial,false,false)[0]<0); // right dorsal thumb: left edge
 for(const left of [true,false]){
  const back=handViewPoint(radial,left,false),palm=handViewPoint(radial,left,true);
  assert.equal(palm[0],-back[0]);assert.equal(palm[1],back[1]);assert.equal(palm[2],-back[2]);
 }
});
test('crossed limbs keep left hand on the right collar and right hand on the left',()=>{
 const left=gripPlacement(GRIP_STEPS[2][0],0),right=gripPlacement(GRIP_STEPS[2][1],1);
 assert.ok(left.x>0&&right.x<0);
 assert.ok(left.wrist.x<right.wrist.x);
 // Arm identity is fixed by limb index; mirroring only changes the projection.
 for(let i=0;i<2;i++){
  const normal=gripPlacement(GRIP_STEPS[2][i],i),mirror=gripPlacement(GRIP_STEPS[2][i],i,false);
  assert.equal(normal.x,-mirror.x);assert.equal(normal.angle,-mirror.angle);
 }
});
