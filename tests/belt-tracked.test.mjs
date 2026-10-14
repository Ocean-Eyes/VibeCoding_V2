import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {normalizeTracking,trackingPose,sampleTracking,shortenTeachingTails} from '../src/belt-player.js';
import {BELT_REVIEW} from '../src/belt-source.js';
const zipped=readFileSync(new URL('../assets/belt/tracked-v4-12dd282461bd.json.gz',import.meta.url));
const bytes=gunzipSync(zipped),data=JSON.parse(bytes),track=normalizeTracking(data,BELT_REVIEW);
test('deployed observation payload matches independently reviewed source hashes and every original PTS',()=>{
 assert.equal(createHash('sha256').update(bytes).digest('hex'),BELT_REVIEW.packed);
 assert.deepEqual(data.packing.sourceHashes,{belt:BELT_REVIEW.belt,hands:BELT_REVIEW.hands});
 assert.equal(track.frames.length,1285);assert.ok(zipped.byteLength<3300000);
 for(let i=0;i<1285;i++){assert.equal(track.frames[i].frameIndex,i);assert.ok(Math.abs(track.frames[i].originalPTS-i/60)<.000001)}
});
test('independent approval and fixed registration do not fabricate model confidence',()=>{
 const raw=normalizeTracking(data),i=900;
 assert.equal(trackingPose(raw,15).beltRegions.length,0);
 const pose=trackingPose(track,15);assert.ok(pose.beltRegions.length>0);assert.equal(pose.reviewMode,false);
 assert.equal(track.frames[i].waistConfidence,null);assert.equal(track.frames[i].beltRegions[0].confidence,null);
 assert.notEqual(track.frames[i].beltRegions[0].validationStatus,'approved');
});
test('all displayed frames keep the short-tail cap and observed hands intact',()=>{
 for(const frame of track.frames){
  const raw=trackingPose(track,frame.originalPTS),p=shortenTeachingTails(raw,{cutY:1.1,reviewedInterval:BELT_REVIEW.teaching});
  assert.equal(p.teachingTransform.applied,true);assert.deepEqual(p.handRegions,raw.handRegions);
  for(const region of p.beltRegions)for(const point of region.contour)assert.ok(point[1]<=1.1+1e-9);
 }
});
test('sampling uses an actual preceding frame and keeps occluded A/B endpoints null',()=>{
 assert.equal(sampleTracking(track,15.509).frame.frameIndex,930);
 for(const frame of track.frames){const p=trackingPose(track,frame.originalPTS);for(const key of ['a','b'])if(!frame.beltEnds[key]?.tip||!frame.beltEnds[key].visible)assert.equal(p.ends[key]?.tip??null,null)}
});
