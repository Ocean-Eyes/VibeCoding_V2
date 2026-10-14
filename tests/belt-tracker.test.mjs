import test from 'node:test';
import assert from 'node:assert/strict';
import {hsv,sampleMarker,markerCandidates,newBeltTrack,updateBeltTrack,videoRect,videoToScreen,screenToVideo} from '../src/belt-tracker.js';
function frame(w=160,h=120){return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)}}
function patch(f,x,y,rgb,size=10){for(let yy=y;yy<y+size;yy++)for(let xx=x;xx<x+size;xx++){const i=(yy*f.width+xx)*4;f.data.set([...rgb,255],i)}return f}
const blue=[20,80,240],pink=[240,30,150],colors=[hsv(...blue),hsv(...pink)];
for(const gain of [.5,.7,1])for(const size of [4,8,16])test(`color end detection under brightness ${gain} / patch ${size}`,()=>{
 const f=patch(patch(frame(),25,30,blue.map(v=>v*gain),size),100,60,pink.map(v=>v*gain),size),c=markerCandidates(f,colors);
 assert.equal(c[0].length,1);assert.equal(c[1].length,1);assert.ok(c[0][0].x<c[1][0].x);
});
test('registration rejects blank, mixed colors, and two similar colors',()=>{
 const f=frame();assert.ok(sampleMarker(f,.5,.5).error);
 patch(f,75,55,blue);const a=sampleMarker(f,.5,.5);assert.ok(a.color);assert.ok(sampleMarker(f,.5,.5,a.color).error);
 patch(f,78,58,pink,3);assert.ok(sampleMarker(f,.5,.5).error);
});
test('red hue wraps through zero degrees',()=>{
 const f=patch(frame(),30,40,[245,0,10]);assert.equal(markerCandidates(f,[hsv(245,10,0)])[0].length,1);
});
test('tiny noise and large colored backgrounds are not end markers',()=>{
 const f=patch(patch(frame(),0,0,blue,45),100,60,blue,2);assert.equal(markerCandidates(f,[colors[0]])[0].length,0);
});
const point=(x,y=.5)=>({x,y,area:100});
function acquired(){let t=newBeltTrack();for(let n=0;n<3;n++)t=updateBeltTrack(t,[point(.3)],n*80);assert.equal(t.state,'tracked');return t}
test('single frame false detection does not acquire; nearby jitter is smoothed',()=>{
 let t=updateBeltTrack(newBeltTrack(),[point(.3)],0);assert.equal(t.point,null);
 t=updateBeltTrack(t,[],80);assert.equal(t.hits,0);
 t=acquired();t=updateBeltTrack(t,[point(.34)],240);assert.ok(t.point.x>.3&&t.point.x<.34);
});
for(const duration of [80,320,720,1100,1600,2400])test(`occluded end remains identified and reacquires after ${duration} ms`,()=>{
 let t=acquired();t=updateBeltTrack(t,[],160+duration);assert.equal(t.state,duration<1200?'occluded':'searching');assert.equal(t.point.x,.3);
 for(let n=1;n<=3;n++)t=updateBeltTrack(t,[point(.32)],160+duration+n*80);assert.equal(t.state,'tracked');
});
test('occluded end never jumps to a remote same-color object',()=>{
 let t=acquired();for(let now=240;now<1800;now+=80){t=updateBeltTrack(t,[point(.85)],now);assert.equal(t.point.x,.3);assert.notEqual(t.state,'tracked')}
});
test('ambiguous same-color candidates cannot reacquire after loss',()=>{
 let t=acquired();for(let now=2400;now<3000;now+=80)t=updateBeltTrack(t,[point(.2),point(.8)],now);assert.equal(t.state,'searching');assert.equal(t.point.x,.3);
});
test('crossing ends preserve color identity instead of screen left/right assignment',()=>{
 let tracks=[newBeltTrack(),newBeltTrack()];
 for(let n=0;n<30;n++){
  const ax=20+n*3,bx=130-n*3,f=patch(patch(frame(),ax,35,blue,8),bx,65,pink,8),c=markerCandidates(f,colors);
  tracks=tracks.map((t,i)=>updateBeltTrack(t,c[i],n*80));
 }
 assert.equal(tracks[0].state,'tracked');assert.equal(tracks[1].state,'tracked');assert.ok(tracks[0].point.x>tracks[1].point.x);
});
for(const [w,h,vw,vh]of [[800,600,1280,720],[390,292.5,720,1280],[1000,750,640,480]])for(const mirror of [true,false])test(`video mapping respects contain and mirror ${w}/${vw}/${mirror}`,()=>{
 const r=videoRect(w,h,vw,vh),p={x:.23,y:.71},q=screenToVideo(videoToScreen(p,r,mirror),r,mirror);assert.ok(Math.abs(q.x-p.x)<1e-10&&Math.abs(q.y-p.y)<1e-10);
 assert.equal(screenToVideo({x:r.x-1,y:r.y+1},r,mirror),null);
});
