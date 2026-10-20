import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {normalizeControls} from '../src/belt-controls.js';
import {paperMotion} from '../src/paper-motion.js';
import {buildBlenderBelt} from '../src/belt-blender-motion.js';
import {applyVolumeContacts} from '../src/belt-volume-contact.js';
import {contactpointBySemantic} from '../src/belt-volume.js';

const frames=normalizeControls(JSON.parse(gunzipSync(readFileSync(new URL('../assets/belt/controls-ebcf8e7605ad.json.gz',import.meta.url))))).frames;
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const states=frames.slice(888).map(frame=>{
  const original=paperMotion(frame),volume=buildBlenderBelt(frame.originalPTS);
  return {frame,original,volume,...applyVolumeContacts(frame,volume,original.rig)};
});

test('held hands use the same named material coordinates as the Blender belt',()=>{
  let held=0;
  for(const state of states)for(const contact of state.contacts){
    const strip=state.volume.strips.find(item=>item.material===contact.material);
    const point=contactpointBySemantic(strip,contact.semantic,contact.materialFraction,{visible:false});
    assert.ok(dist(point.center,contact.point3D)<1e-9);
    assert.ok(point.materialS<=strip.visibleMaterialS+1e-9);
    if(contact.acquisitionWeight===1){assert.ok(dist(contact.actualContactPoint,contact.assignedPoint)<1e-8);held++;}
    if(contact.contactSpan==='A-tightening-holder')assert.equal(contact.identity,'Right');
    if(contact.contactSpan==='B-receiver')assert.equal(contact.identity,'Left');
  }
  assert.ok(held>180);
});

test('contact handover and release do not teleport either anatomical hand',()=>{
  for(let i=1;i<states.length;i++)for(const hand of states[i].rig.hands){
    const prior=states[i-1].rig.hands.find(item=>item.identity===hand.identity);
    assert.ok(dist(hand.grip,prior.grip)<.05,`frame ${states[i].frame.frameIndex}, ${hand.identity}`);
    const angle=Math.abs(Math.atan2(Math.sin(hand.angle-prior.angle),Math.cos(hand.angle-prior.angle)));
    assert.ok(angle<.20,`wrist flip at ${states[i].frame.frameIndex}: ${angle}`);
  }
  for(const state of states.filter(item=>item.frame.originalPTS>=20.42)){
    assert.equal(state.contacts.length,0);
    for(const hand of state.rig.hands)assert.ok(hand.curl.every(value=>Math.abs(value-.15)<1e-8));
  }
});

test('both hands pull outward with closed grips and retain the balanced finish',()=>{
  const pull=states.filter(item=>item.frame.originalPTS>=18&&item.frame.originalPTS<=19.8);
  for(const state of pull){
    assert.equal(state.contacts.length,2);
    for(const contact of state.contacts){
      assert.equal(contact.role,'held');assert.equal(contact.acquisitionWeight,1);
      const strip=state.volume.strips.find(s=>s.material===contact.material);
      assert.ok(Math.abs(strip.totalMaterialS-contact.materialS-.045)<1e-9,'grip slides toward or away from the tip');
    }
    for(const hand of state.rig.hands)assert.ok(hand.curl.every(value=>value>=.86-1e-12),'hand opens during the pull');
  }
  const first=pull[0],last=pull.at(-1);
  for(const identity of ['Right','Left']){
    const start=first.rig.hands.find(h=>h.identity===identity),end=last.rig.hands.find(h=>h.identity===identity);
    assert.ok(Math.abs(end.grip[0])-Math.abs(start.grip[0])>.08,`${identity} does not pull outward`);
  }
  const [a,b]=last.rig.hands;
  assert.ok(Math.abs(a.grip[0]+b.grip[0])<.015,'unequal lateral reach');
  assert.ok(Math.abs(a.grip[1]-b.grip[1])<.035,'unequal pulling height');
});
