import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {gunzipSync} from 'node:zlib';
import {cameraPoint,cameraRotation,FIRST_PERSON_CAMERA} from '../src/belt-view-camera.js';
import {rasterVolume} from '../src/belt-volume-render.js';
import {firstPersonScene} from '../src/belt-first-person.js';
import {normalizeControls} from '../src/belt-controls.js';import {lessonMotion} from '../src/belt-volume-motion.js';

test('orbit changes the camera without scaling or shearing the material',()=>{
 for(const yaw of [0,.72,Math.PI,5])for(const pitch of [-Math.PI/2,-.38,0,Math.PI/2]){
  const m=cameraRotation(yaw,pitch),columns=[m.slice(0,3),m.slice(3,6),m.slice(6,9)];
  for(const p of columns)assert.ok(Math.abs(Math.hypot(...p)-1)<1e-12);
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.abs(columns[i].reduce((s,v,k)=>s+v*columns[j][k],0))<1e-12);
  const p=[.3,.2,-.4],q=cameraPoint(p,{yaw,pitch}).position;assert.ok(Math.abs(Math.hypot(...p)-Math.hypot(...q))<1e-12);
 }
});
test('first person sees the same waist from above with wearer-right on screen-right',()=>{
 const right=cameraPoint([-.3,.03,.07],FIRST_PERSON_CAMERA),left=cameraPoint([.3,.03,.07],FIRST_PERSON_CAMERA);
 assert.ok(right.visible&&left.visible);assert.ok(right.position[0]>0&&left.position[0]<0);
 const m=cameraRotation(FIRST_PERSON_CAMERA.yaw,FIRST_PERSON_CAMERA.pitch),eye=FIRST_PERSON_CAMERA.target.map((v,i)=>v+m[i*3+2]*FIRST_PERSON_CAMERA.distance);
 assert.ok(eye[1]<-1,'eye must be above the waist');assert.ok(eye[2]>.05,'eye must stay outside the torso front');
});
test('software inspection rotates in both axes and retains depth order',()=>{
 const tri=(z,n)=>[-.2,-.1,z,...n,0,0,.2,-.1,z,...n,0,0,0,.3,z,...n,0,0],a=tri(.2,[0,0,1]),b=tri(-.1,[1,0,0]),data=new Float32Array([...a,...b]);
 const options={pitch:-.4,distance:1.5},viewport=[-.6,-.6,.6,.6];
 const front=rasterVolume(data,96,96,.5,false,viewport,options),reversed=rasterVolume(new Float32Array([...b,...a]),96,96,.5,false,viewport,options);
 assert.deepEqual(front,reversed);assert.notDeepEqual(front,rasterVolume(data,96,96,.5,false,viewport));assert.ok(front.some((v,i)=>i%4===3&&v));
 // A triangle crossing the near plane is clipped rather than mirrored behind
 // the camera or discarded in its entirety by the software fallback.
 const crossing=new Float32Array([-.01,0,1.48,0,0,1,0,0,.1,0,1,0,0,1,0,0,0,.1,1,0,0,1,0,0]);
 assert.ok(rasterVolume(crossing,96,96,0,false,viewport,{distance:1.5}).some((v,i)=>i%4===3&&v));
});
test('first-person scene preserves every belt vertex and the original grip anchors',()=>{
 const frames=normalizeControls(JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url))))).frames;
 for(const t of [0,2,5,8.5,11,14,16.5,19.8]){
  const frame=frames.reduce((a,b)=>Math.abs(b.originalPTS-t)<Math.abs(a.originalPTS-t)?b:a),state=lessonMotion(frame),before=state.volume.vertexData.slice(),scene=firstPersonScene(state);
  assert.ok(scene.vertexData.every(Number.isFinite));assert.deepEqual(state.volume.vertexData,before);assert.deepEqual(scene.vertexData.slice(-before.length),before);
  assert.equal(scene.grips.length,2);assert.equal(firstPersonScene(state),scene);
  for(const grip of scene.grips){const hand=state.rig.hands.find(h=>h.identity===grip.identity);assert.deepEqual(grip.point,[...hand.grip,hand.materialContactDepth??.12]);if(grip.contact){const c=state.contacts.find(c=>c.identity===grip.identity);assert.deepEqual(grip.contact,c.point3D);}}
 }
});
