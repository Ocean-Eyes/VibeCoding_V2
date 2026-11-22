import test from 'node:test';
import assert from 'node:assert/strict';
import {OSOTO_TARGETS,assessOsoto,OsotoProgress,cameraPose,osotoAnimation,OSOTO_DEMO_DURATION} from '../src/osoto-practice.js';
import {normalizeGuideBody,createOsotoGuideProjection,drawOsotoBody} from '../src/osoto-practice.js';
const observed=(stage,scale=.15,x=.5,y=.45)=>OSOTO_TARGETS[stage].map(p=>p?{x:x+p.x*scale,y:y+p.y*scale,z:p.z*scale,visibility:1}:null);

test('live guide aligns translated and resized bodies to the same target without mirroring',()=>{
 const frame=createOsotoGuideProjection();
 for(let stage=0;stage<4;stage++)for(const [size,x,y]of [[.15,.5,.45],[.1,.65,.35],[.22,.3,.55]]){
  const body=normalizeGuideBody(observed(stage,size,x,y)),live=frame.project(body.points),target=frame.project(OSOTO_TARGETS[stage]);
  for(const i of [0,11,12,13,14,15,16,23,24,25,26,27,28])assert(Math.hypot(live[i].x-target[i].x,live[i].y-target[i].y)<1e-8);
  assert(live[12].x<live[11].x,'anatomical right stays viewer-left');
 }
 const wrong=observed(1);wrong[16].x+=.1;
 const live=frame.project(normalizeGuideBody(wrong).points),target=frame.project(OSOTO_TARGETS[1]);
 assert(live[16].x>target[16].x+20,'show actual hand error instead of snapping to target');
 assert(Math.abs(live[24].x-target[24].x)<1e-8);
});

test('matching characters share a scale and baseline in separate left and right panels',()=>{
 const left=createOsotoGuideProjection(300,420),right=createOsotoGuideProjection(300,420,300);
 for(let stage=0;stage<4;stage++){
  const target=left.project(OSOTO_TARGETS[stage]),live=right.project(normalizeGuideBody(observed(stage)).points);
  for(const i of [0,11,12,15,16,23,24,27,28]){
   assert(Math.abs(live[i].x-target[i].x-300)<1e-8);
   assert(Math.abs(live[i].y-target[i].y)<1e-8);
  }
 }
});

test('guide shows visible limbs during partial tracking and never draws a lost joint',()=>{
 const points=observed(0);points[28].visibility=.1;
 const body=normalizeGuideBody(points);assert(body,'visible torso can still anchor the guide');
 assert.equal(assessOsoto(points,0).matched,false,'partial tracking cannot advance the exercise');
 const frame=createOsotoGuideProjection(),projected=frame.project(body.points),arcs=[];
 const ctx={save(){},restore(){},beginPath(){},closePath(){},stroke(){},fill(){},fillText(){},moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y))},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y))},arc(x,y){arcs.push([x,y])}};
 drawOsotoBody(ctx,projected,'#6ebce5',frame.scale);
 assert(arcs.some(([x,y])=>x===projected[27].x&&y===projected[27].y));
 assert(!arcs.some(([x,y])=>x===projected[28].x&&y===projected[28].y));
 points[23].visibility=.1;assert.equal(normalizeGuideBody(points),null);
 assert.equal(normalizeGuideBody(null),null);
});
for(let stage=0;stage<4;stage++)test(`stage ${stage+1}: target fits at different sizes and positions`,()=>{
 for(const [s,x,y]of [[.15,.5,.45],[.22,.35,.5],[.1,.6,.35]])assert.equal(assessOsoto(observed(stage,s,x,y),stage).matched,true);
});
test('later stages require their own leg/torso position',()=>{
 assert.equal(assessOsoto(observed(0),1).matched,false);
 assert.equal(assessOsoto(observed(1),2).matched,false);
 assert.equal(assessOsoto(observed(2),1).matched,false);
});
test('missing or hidden feet cannot pass',()=>{
 assert.equal(assessOsoto(null,0).matched,false);
 for(const i of [0,15,16,27,28]){const p=observed(0);p[i].visibility=.1;assert.equal(assessOsoto(p,0).matched,false);}
});
test('Initial and three stages must be held in order; pauses, loss and reset cannot award progress',()=>{
 const game=new OsotoProgress();let now=0;
 for(let stage=0;stage<4;stage++){
  now+=1200;for(let n=0;n<8;n++)game.update(observed(stage),now+=50);
  game.update(null,now+=50);assert.equal(game.hold,0);
  game.update(observed(stage),now+=50,false);assert.equal(game.hold,0);
  for(let n=0;n<23;n++)game.update(observed(stage),now+=50);
  assert.equal(game.done,stage===3);assert.equal(game.stage,Math.min(stage+1,3));
 }
 game.reset();assert.equal(game.stage,0);assert.equal(game.done,false);
});

test('inferred landmarks outside the camera image cannot complete a pose',()=>{
 const p=observed(0,.1,.5,.3).map(v=>v?{...v,x:v.x,y:v.y/.75}:null);
 assert.equal(assessOsoto(cameraPose(p,.75),0).matched,true);
 for(const i of [0,27,28]){const clipped=structuredClone(p);clipped[i].y=1.01;assert.equal(assessOsoto(cameraPose(clipped,.75),0).matched,false);}
});

test('Initial requires right foot in front, and front-facing body',()=>{
 const p=observed(0);[p[27].z,p[28].z]=[p[28].z,p[27].z];assert.equal(assessOsoto(p,0).matched,false);
 const side=observed(0).map(p=>p?{...p,x:.5+(p.x-.5)*.1}:null);assert.equal(assessOsoto(side,0).matched,false);
});
test('front/back leg depth and torso lean are mandatory even when XY matches',()=>{
 for(const stage of [0,1,2,3]){
  const p=observed(stage).map(p=>p?{...p,z:0}:null);assert.equal(assessOsoto(p,stage).matched,false);
  const unknown=observed(stage).map(p=>p?{...p,z:undefined}:null);assert.equal(assessOsoto(unknown,stage).matched,false);
 }
});
test('front animation holds Initial then moves through all three poses continuously',()=>{
 assert.deepEqual(osotoAnimation(0).points,OSOTO_TARGETS[0]);
 assert.deepEqual(osotoAnimation(1).points,OSOTO_TARGETS[0]);
 assert.notDeepEqual(osotoAnimation(3).points,OSOTO_TARGETS[0]);
 assert.equal(osotoAnimation(5).stage,1);assert.equal(osotoAnimation(8.5).stage,2);assert.equal(osotoAnimation(13).stage,3);
 assert.deepEqual(osotoAnimation(OSOTO_DEMO_DURATION).points,OSOTO_TARGETS[3]);
 for(let time=.05;time<=14;time+=.05){const a=osotoAnimation(time-.05).points,b=osotoAnimation(time).points;assert(Math.max(...[11,12,15,16,27,28].map(i=>Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y,a[i].z-b[i].z)))<.4);}
});

test('Initial checks stance without demanding pulling arms yet',()=>{
 const p=observed(0);for(const i of [13,14,15,16])p[i].y+=.15;
 assert.equal(assessOsoto(p,0).matched,true);
});

// Reference events, independent of the scoring targets.
import {sampleOsotoMotion} from '../src/osoto-motion.js';
test('reference motion steps left, raises a bent right knee, then reaps back on the planted left foot',()=>{
 const initial=sampleOsotoMotion(0),entry=sampleOsotoMotion(1),lift=sampleOsotoMotion(2),reap=sampleOsotoMotion(3);
 assert(initial.legs.right.end[2]>initial.legs.left.end[2]);
 assert(sampleOsotoMotion(.5).legs.left.end[1]>.07);
 assert(entry.legs.left.end[2]>initial.legs.left.end[2]+.3);
 assert(lift.legs.right.joint[1]>entry.legs.right.joint[1]+.12);
 assert(lift.legs.right.end[1]>.35);
 const leg=lift.legs.right,u=leg.root.map((v,i)=>v-leg.joint[i]),v=leg.end.map((v,i)=>v-leg.joint[i]);
 const angle=Math.acos(u.reduce((n,x,i)=>n+x*v[i],0)/(Math.hypot(...u)*Math.hypot(...v)));assert(angle<Math.PI*.8,'right knee visibly bends');
 assert(reap.legs.right.end[2]<reap.pelvis[2]-.35);assert(reap.head[2]>reap.pelvis[2]+.3);
 for(let time=1;time<=3;time+=.02)assert(Math.hypot(...sampleOsotoMotion(time).legs.left.end.map((x,i)=>x-entry.legs.left.end[i]))<.0001);
});
test('reference animation preserves bone lengths and never puts feet below the floor',()=>{
 for(let time=0;time<=3;time+=.02){const b=sampleOsotoMotion(time);
  for(const [parts,a,c]of [[b.legs,.46,.45],[b.arms,.33,.31]])for(const limb of Object.values(parts)){
   const d=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));assert(Math.abs(d(limb.root,limb.joint)-a)<.0001);assert(Math.abs(d(limb.joint,limb.end)-c)<.0001);
  }
  assert(b.legs.left.end[1]>=.04&&b.legs.right.end[1]>=.04);
 }
});

test('front view keeps anatomical right screen-left, with camera coordinates unmirrored',()=>{
 for(let stage=0;stage<4;stage++){
  const target=OSOTO_TARGETS[stage];assert(target[12].x<target[11].x);assert(target[28].x<target[27].x);
  const raw=observed(stage,.1,.5,.3).map(p=>p?{...p,y:p.y/.75}:null);
  const mapped=cameraPose(raw,.75);assert.equal(mapped[28].x,raw[28].x);assert.equal(assessOsoto(mapped,stage).matched,true);
  const reversed=mapped.map(p=>p?{...p,x:1-p.x}:null);assert.equal(assessOsoto(reversed,stage).matched,false);
 }
});

test('relaxed judging accepts foot and hand offsets while preserving stage direction',()=>{
 for(let stage=0;stage<4;stage++){
  const p=observed(stage);
  p[27].x+=.15*.72;p[28].x-=.15*.72;
  if(stage){p[15].x+=.15*.95;p[16].x-=.15*.95;}
  assert.equal(assessOsoto(p,stage).matched,true);
 }
});
test('brief visible pose jitter preserves hold progress, but missing tracking clears it',()=>{
 const game=new OsotoProgress();let now=0;
 for(let i=0;i<8;i++)game.update(observed(0),now+=50);
 const before=game.hold;
 game.update(observed(1),now+=50);
 assert(game.hold>0&&game.hold<before);
 for(let i=0;i<16;i++)game.update(observed(0),now+=50);
 assert.equal(game.stage,1);
 game.reset();game.update(observed(0),0);game.update(observed(0),100);
 game.update(null,150);assert.equal(game.hold,0);
});

test('sleeve hand stays at the waist while lapel hand stays at the chest',()=>{
 for(let time=0;time<=3;time+=.1){
  const rig=sampleOsotoMotion(time);
  const height=hand=>hand.map((v,i)=>v-rig.pelvis[i]).reduce((sum,v,i)=>sum+v*rig.up[i],0);
  assert(height(rig.arms.left.end)<.12);
  assert(height(rig.arms.left.end)>.02);
  assert(height(rig.arms.right.end)>.35);
 }
});
