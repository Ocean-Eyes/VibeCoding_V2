import test from 'node:test';
import assert from 'node:assert/strict';
import {assignHands,LandmarkStream,HandStream,HandIdentityTracker,GripProjection,projectHand,palmFacing} from '../src/live-hands.js';
const hand=(x,y=.4)=>Array.from({length:21},(_,i)=>({x:x+(i%4)*.006,y:y-Math.floor(i/4)*.015,z:0}));
const pose=(a,b)=>Array.from({length:33},(_,i)=>({x:i===15?a:i===16?b:.5,y:.4,visibility:1}));
test('detector array reorder and crossing keep the anatomical streams separate',()=>{
 const left=hand(.65),right=hand(.35);assert.deepEqual(assignHands([right,left],pose(.65,.35)),[left,right]);
 const crossedLeft=hand(.3),crossedRight=hand(.7);
 assert.deepEqual(assignHands([crossedRight,crossedLeft],pose(.3,.7),[left,right]),[crossedLeft,crossedRight]);
 assert.deepEqual(assignHands([crossedRight],pose(.3,.7),[crossedLeft,crossedRight]),[null,crossedRight]);
 assert.deepEqual(assignHands([],pose(.3,.7)),[null,null]);
});
test('quiet-hand noise is attenuated, fast intentional motion follows within 200 ms',()=>{
 const filter=new LandmarkStream();let rawEnergy=0,filteredEnergy=0;
 for(let i=0;i<100;i++){
  const x=.5+(i%2?.006:-.006),t=i*65;filter.update([{x,y:.4,z:0}],t);
  if(i>20){rawEnergy+=(x-.5)**2;filteredEnergy+=(filter.at(t+64)[0].x-.5)**2}
 }
 assert.ok(filteredEnergy<rawEnergy*.25);
 for(let i=100;i<=103;i++)filter.update([{x:.8,y:.4,z:0}],i*65);
 assert.ok(Math.abs(filter.at(103*65+65)[0].x-.8)<.01);
});
test('lost or low-confidence joints disappear immediately and reacquire without old-pose blending',()=>{
 const filter=new LandmarkStream();filter.update(hand(.2),0);filter.update(null,65);assert.equal(filter.at(65),null);
 filter.update(hand(.8),130);assert.equal(filter.at(130)[0].x,.8);
 filter.update([{x:.4,y:.4,visibility:.1}],195);assert.equal(filter.at(196)[0].visibility,.1);
 filter.update([{x:.7,y:.4,visibility:1}],260);assert.equal(filter.at(260)[0].x,.7);
 assert.equal(filter.at(600),null);
});
test('all 21 finger positions survive projection, with mirror applied once to the whole hand',()=>{
 const body={origin:{x:.5,y:.3},scale:.3,x:{x:1,y:0},y:{x:0,y:1}},scene={origin:{x:300,y:200},scale:150};
 const h=hand(.65),a=projectHand(h,body,scene,true),b=projectHand(h,body,scene,false);
 for(let i=0;i<21;i++){assert.ok(Math.abs(a[i].x-(600-b[i].x))<1e-10);assert.equal(a[i].y,b[i].y)}
 const changed=h.map(p=>({...p}));changed[8].y+=.08;
 const c=projectHand(changed,body,scene,true);assert.equal(c[7].y,a[7].y);assert.ok(Math.abs(c[8].y-a[8].y-40)<1e-10);
 assert.equal(palmFacing(a,true,true),palmFacing(b,true,false));
});

test('grasp calibration preserves pull distance when shoulders widen, while rejecting common body translation',()=>{
 const projection=new GripProjection(),scene={origin:{x:0,y:0},scale:1};
 const body={origin:{x:500,y:200},scale:200,x:{x:1,y:0},y:{x:0,y:1}};
 projection.resolve(body,false);
 const start=projectHand([{x:460,y:260}],projection.resolve(body,true),scene,true)[0];
 const widened={...body,scale:300};
 const end=projectHand([{x:440,y:260}],projection.resolve(widened,true),scene,true)[0];
 assert.ok(Math.abs(end.x-start.x-.1)<1e-10,'actual 20px pull must remain measurable');
 const translated={...widened,origin:{x:550,y:230}};
 const moved=projectHand([{x:490,y:290}],projection.resolve(translated,true),scene,true)[0];
 assert.deepEqual(moved,end);
 assert.equal(projection.resolve(null,true).scale,200,'visible hands remain usable during shoulder occlusion');
 assert.equal(projection.resolve(widened,false).scale,300,'release allows recalibration');
 projection.reset();assert.equal(projection.resolve(null,true),null);
});

test('crossing identities survive detector reorder and swapped pose wrists during overlap',()=>{
 const tracker=new HandIdentityTracker();
 const positions=[[.35,.65],[.41,.59],[.46,.54],[.49,.51],[.54,.46],[.59,.41]];
 positions.forEach(([left,right],i)=>{
  const hands=[hand(left),hand(right)],p=i>=2&&i<=4?pose(right,left):pose(left,right);
  const matched=tracker.update(i%2?hands.toReversed():hands,p,i*65);
  if(i===3){assert.deepEqual(matched,[null,null]);return}
  assert.ok(matched[0]&&matched[1]);assert.equal(matched[0][0].x,left);assert.equal(matched[1][0].x,right);
 });
});

test('ambiguous overlapping detections do not create two certain observations',()=>{
 const tracker=new HandIdentityTracker();tracker.update([hand(.45),hand(.55)],pose(.45,.55),0);
 assert.deepEqual(tracker.update([hand(.5)],pose(.5,.5),65),[null,null]);
 assert.deepEqual(tracker.update([hand(.5),hand(.501)],pose(.5,.5),130),[null,null]);
 assert.deepEqual(tracker.update([],null,195),[null,null]);
 const recovered=tracker.update([hand(.55),hand(.45)],pose(.45,.55),260);
 assert.equal(recovered[0][0].x,.45);assert.equal(recovered[1][0].x,.55);
});

test('one-frame hand teleport is held visually and excluded from scoring',()=>{
 const stream=new HandStream();stream.update(hand(.4),0);
 stream.update(hand(.85),65);assert.equal(stream.at(100)[0].x,.4);assert.equal(stream.trackedAt(100),null);
 stream.update(hand(.4),130);assert.equal(stream.at(130)[0].x,.4);
 assert.equal(stream.trackedAt(200),null,'resume bridge does not score synthesized coordinates');
 stream.update(hand(.4),260);assert.equal(stream.trackedAt(300)[0].x,.4);
});

test('brief hand occlusion retains a fading glove and blends confirmed recovery',()=>{
 const stream=new HandStream();stream.update(hand(.4),0);stream.update(null,65);
 assert.equal(stream.at(200)[0].x,.4);assert.equal(stream.trackedAt(200),null);assert.ok(stream.opacityAt(200)<1);
 stream.update(hand(.44),220);assert.equal(stream.at(220)[0].x,.4);
 assert.ok(stream.at(295)[0].x>.4&&stream.at(295)[0].x<.44);
 stream.update(hand(.44),350);assert.ok(Math.abs(stream.trackedAt(380)[0].x-.44)<1e-8);
 stream.update(null,400);assert.equal(stream.at(701),null,'old pose never stays on screen indefinitely');
});

test('sustained fast hand movement is confirmed then smoothly accepted rather than frozen',()=>{
 const stream=new HandStream();stream.update(hand(.3),0);
 stream.update(hand(.6),65);stream.update(hand(.61),130);assert.equal(stream.at(130)[0].x,.3);
 stream.update(hand(.62),195);assert.equal(stream.at(195)[0].x,.3);
 assert.ok(stream.at(270)[0].x>.3&&stream.at(270)[0].x<.62);
 stream.update(hand(.62),325);assert.ok(Math.abs(stream.trackedAt(350)[0].x-.62)<.01);
});

test('a stretched finger outlier does not deform the visible glove',()=>{
 const stream=new HandStream(),h=hand(.4);stream.update(h,0);
 const bad=h.map(p=>({...p}));bad[8].x+=.5;stream.update(bad,65);
 assert.deepEqual(stream.at(100),h);assert.equal(stream.trackedAt(100),null);
});

test('an approach followed by a stop does not predict through the other wrist',()=>{
 const tracker=new HandIdentityTracker();
 for(let time=0;time<300;time+=65)tracker.update([hand(.45),hand(.55)],pose(.45,.55),time);
 for(let time=325;time<800;time+=65){
  const result=tracker.update([hand(.49),hand(.51)],pose(.49,.51),time);
  // Fully overlapping palms may be held, but cannot be assigned backwards.
  if(result[0])assert.equal(result[0][0].x,.49);if(result[1])assert.equal(result[1][0].x,.51);
 }
});

test('reacquisition after a long absence accepts a new hand scale and position',()=>{
 const stream=new HandStream();stream.update(hand(.3),0);stream.update(null,65);
 const next=hand(.7).map(p=>({...p,y:.4+(p.y-.4)*3}));stream.update(next,900);
 assert.deepEqual(stream.trackedAt(900),next);
});

test('a pose-only wrist swap cannot override two stationary visible hand tracks',()=>{
 const tracker=new HandIdentityTracker();tracker.update([hand(.3),hand(.7)],pose(.3,.7),0);
 for(let time=65;time<=650;time+=65){
  const h=tracker.update([hand(.7),hand(.3)],pose(.7,.3),time);
  assert.equal(h[0][0].x,.3);assert.equal(h[1][0].x,.7);
 }
});
