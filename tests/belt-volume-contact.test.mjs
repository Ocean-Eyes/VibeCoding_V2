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
  for(const state of states.filter(item=>item.frame.originalPTS>=19.9)){
    assert.equal(state.contacts.length,0);
    for(const hand of state.rig.hands)assert.ok(hand.curl.every(value=>Math.abs(value-.15)<1e-8));
  }
});
