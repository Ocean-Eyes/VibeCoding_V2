import test from 'node:test';
import assert from 'node:assert/strict';
import {OSOTO_TARGETS,assessOsoto,OsotoProgress,cameraPose,osotoAnimation,OSOTO_DEMO_DURATION} from '../src/osoto-practice.js';
import {normalizeGuideBody,OsotoGuideScale,projectOsotoCameraPose,drawOsotoTracking,createOsotoGuideProjection,drawOsotoBody} from '../src/osoto-practice.js';
const observed=(stage,scale=.15,x=.5,y=.45)=>OSOTO_TARGETS[stage].map(p=>p?{x:x+p.x*scale,y:y+p.y*scale,z:p.z*scale,visibility:1}:null);

test('both mirrored guide panels align translated and resized bodies without changing anatomy',()=>{
 const frame=createOsotoGuideProjection();
 for(let stage=0;stage<4;stage++)for(const [size,x,y]of [[.15,.5,.45],[.1,.65,.35],[.22,.3,.55]]){
  const guide=new OsotoGuideScale();guide.update(observed(0,size,x,y),true);
  const body=guide.update(observed(stage,size,x,y)),live=frame.project(body.points),target=frame.project(OSOTO_TARGETS[stage]);
  for(const i of [0,11,12,13,14,15,16,23,24,25,26,27,28])assert(Math.hypot(live[i].x-target[i].x,live[i].y-target[i].y)<1e-8);
  assert(live[12].x>live[11].x,'anatomical right appears on the right in the mirror');
 }
 const wrong=observed(1);wrong[16].x+=.1;
 const guide=new OsotoGuideScale();guide.update(observed(0),true);
 const live=frame.project(guide.update(wrong).points),target=frame.project(OSOTO_TARGETS[1]);
 assert(live[16].x<target[16].x-20,'mirror actual hand error instead of snapping to target');
 assert(Math.abs(live[24].x-target[24].x)<1e-8);
});

test('matching characters share a scale and baseline in separate left and right panels',()=>{
 const left=createOsotoGuideProjection(300,420),right=createOsotoGuideProjection(300,420,300);
 const guide=new OsotoGuideScale();guide.update(observed(0),true);
 for(let stage=0;stage<4;stage++){
  const target=left.project(OSOTO_TARGETS[stage]),live=right.project(guide.update(observed(stage)).points);
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

test('avatar scale ignores depth spikes and stays fixed when the torso bends',()=>{
 const guide=new OsotoGuideScale();for(let i=0;i<15;i++)guide.update(observed(0),true);
 const baseline=guide.update(observed(0));
 for(const depth of [1,4,-3,NaN]){
  const points=observed(0);points[11].z=depth;points[12].z=depth;
  const body=guide.update(points);
  assert.equal(body.scale,baseline.scale);
  for(const i of [0,11,12,15,16,27,28]){
   assert.equal(body.points[i].x,baseline.points[i].x);assert.equal(body.points[i].y,baseline.points[i].y);
  }
 }
 const bent=observed(0);for(const i of [11,12])bent[i].y=(bent[i].y+.45)/2;
 const body=guide.update(bent);
 assert.equal(body.scale,baseline.scale);assert.equal(body.points[27].y,baseline.points[27].y,'bending cannot resize the legs');
 guide.update(observed(0,.4),true);assert(Math.abs(guide.scale-.15)<1e-8,'one bad preparation frame cannot replace the scale');
 guide.reset();guide.update(observed(0,.08),true);assert(Math.abs(guide.scale-.08)<1e-8);
});

test('camera sticks follow contain-fit video coordinates in portrait and landscape',()=>{
 for(const [w,h,vw,vh,x,y]of [[540,960,1280,720,135,404.0625],[960,540,1280,720,240,135],[540,960,720,1280,135,240],[960,540,720,1280,404.0625,135]]){
  const points=cameraPose([{x:.25,y:.25,visibility:1}],vh/vw),projected=projectOsotoCameraPose(points,w,h,vw,vh);
  assert(Math.abs(projected[0].x-x)<1e-8);assert(Math.abs(projected[0].y-y)<1e-8);
 }
 assert.equal(projectOsotoCameraPose(null,540,960,720,1280),null);
 assert.equal(projectOsotoCameraPose([],540,960,0,0),null);
});

test('camera sticks show recognized arms even with missing hips and clear lost landmarks',()=>{
 const points=observed(0);points[23]=points[24]=null;points[15].visibility=.1;
 const arcs=[];const ctx={save(){},restore(){},beginPath(){},stroke(){},fill(){},moveTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y))},lineTo(x,y){assert(Number.isFinite(x)&&Number.isFinite(y))},arc(x,y){arcs.push([x,y])}};
 assert(drawOsotoTracking(ctx,points)>0);
 assert(arcs.some(([x,y])=>x===points[16].x&&y===points[16].y));
 assert(!arcs.some(([x,y])=>x===points[15].x&&y===points[15].y));
 assert.equal(drawOsotoTracking(ctx,null),0);
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

test('level feet cannot pass Initial from depth noise or a rolled camera',()=>{
 for(const depth of [.02,.08,.3,.8])for(const roll of [0,.22,-.22]){
  const p=observed(0),floor=(p[27].y+p[28].y)/2;
  p[27].y=p[28].y=floor;p[27].z=.15*depth/2;p[28].z=-.15*depth/2;
  for(const v of p)if(v){const x=v.x-.5,y=v.y-.45;v.x=.5+Math.cos(roll)*x-Math.sin(roll)*y;v.y=.45+Math.sin(roll)*x+Math.cos(roll)*y;}
  const result=assessOsoto(p,0);assert.equal(result.matched,false);assert.equal(result.critical,false);assert(result.score<55);
 }
});

test('an invalid stance clears the hold instead of accumulating sporadic depth matches',()=>{
 const game=new OsotoProgress();let now=0;
 const flat=observed(0);flat[27].y=flat[28].y;flat[27].z=flat[28].z;
 for(let cycle=0;cycle<12;cycle++){
  for(let i=0;i<10;i++)game.update(observed(0),now+=50);
  game.update(flat,now+=50);assert.equal(game.hold,0);
 }
 assert.equal(game.stage,0);
 for(let i=0;i<23;i++)game.update(observed(0),now+=50);
 assert.equal(game.stage,1);
});

test('knee lift and backward extension require distinct whole-leg shapes',()=>{
 const noKneeLift=observed(2);noKneeLift[26].y=.45+.15*.85;noKneeLift[26].z=0;
 assert.equal(assessOsoto(noKneeLift,2).matched,false);
 const curledHeel=observed(3);curledHeel[26]={...curledHeel[26],y:.45+.15*.85,z:0};
 assert.equal(assessOsoto(curledHeel,3).matched,false);
 const flat=observed(1);assert.equal(assessOsoto(flat,2).matched,false);assert.equal(assessOsoto(flat,3).matched,false);
 for(let stage=0;stage<3;stage++){const lowConfidence=observed(stage);lowConfidence[28].visibility=.4;assert.equal(assessOsoto(lowConfidence,stage).matched,false);}
});
test('lift and reap still require leg depth and torso lean when XY matches',()=>{
 for(const stage of [2,3]){
  const p=observed(stage).map(p=>p?{...p,z:0}:null);assert.equal(assessOsoto(p,stage).matched,false);
  const unknown=observed(stage).map(p=>p?{...p,z:undefined}:null);assert.equal(assessOsoto(unknown,stage).matched,false);
 }
});

test('a small grounded step passes with weak depth, but level feet and a reversed step do not',()=>{
 for(const stage of [0,1])for(const advance of [.035,.055])for(const depth of [0,.03,-.03]){
  const p=observed(stage),direction=stage===0?1:-1,floor=(p[27].y+p[28].y)/2;
  p[27].y=floor-direction*advance*.15/2;p[28].y=floor+direction*advance*.15/2;
  p[27].z=direction*depth*.15/2;p[28].z=-direction*depth*.15/2;
  p[27].visibility=p[28].visibility=.5;
  assert.equal(assessOsoto(p,stage).matched,true,`stage ${stage}, step ${advance}, depth ${depth}`);
  [p[27].y,p[28].y]=[p[28].y,p[27].y];
  assert.equal(assessOsoto(p,stage).matched,false,'the opposite foot cannot advance the stage');
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
import {body,limb} from '../src/throw-motion.js';

function moderateFinish({lean=.25,height=.22,rear=-.24}={}){
 const rig=body({p:[.15,.94,.24],yaw:0,lean,l:[.23,.065,.38],r:[-.12,height,rear]});
 assert(rig.legs.right.reachError<1e-8,'fixture must not silently lift an unreachable foot');
 const points=Array(33).fill(null);
 const put=(i,v)=>points[i]={x:.5+(v[0]-rig.pelvis[0])*.15,y:.45-(v[1]-rig.pelvis[1])*.15,z:-(v[2]-rig.pelvis[2])*.15,visibility:1};
 put(0,rig.head);
 for(const [side,a,e,w,h,k,f,hand]of [['left',11,13,15,23,25,27,[-.2,.08,.21]],['right',12,14,16,24,26,28,[.1,.54,.32]]]){
  const arm=limb(rig.shoulders[side],rig.at(...hand),.33,.31,[0,-1,.2]);
  put(a,rig.shoulders[side]);put(e,arm.joint);put(w,arm.end);put(h,rig.legs[side].root);put(k,rig.legs[side].joint);put(f,rig.legs[side].end);
 }
 return points;
}

test('finish accepts a moderate forward lean and lower backward leg, without accepting standing or knee lift',()=>{
 for(const lean of [.25,.35])for(const height of [.20,.27]){
  assert.equal(assessOsoto(moderateFinish({lean,height}),3).matched,true,`lean ${lean}, height ${height}`);
 }
 assert.equal(assessOsoto(moderateFinish({lean:0}),3).matched,false,'backward foot alone is not a torso lean');
 assert.equal(assessOsoto(moderateFinish({height:.065,rear:.04}),3).matched,false,'grounded rear foot is not a reap');
 assert.equal(assessOsoto(observed(2),3).matched,false,'forward knee lift cannot complete the finish');
});

test('a borderline finish estimate reduces hold progress instead of restarting the full second',()=>{
 const game=new OsotoProgress();game.stage=3;let now=0;
 for(let i=0;i<8;i++)game.update(moderateFinish(),now+=50);
 const before=game.hold,jitter=moderateFinish();
 for(const i of [11,12])jitter[i].z=.15*.49*-.01;
 const state=game.update(jitter,now+=50);
 assert.equal(state.matched,false);assert(game.hold>0&&game.hold<before);
 for(let i=0;i<16;i++)game.update(moderateFinish(),now+=50);
 assert.equal(game.done,true);
});

test('finish accepts a low rear leg, slight lean and weak but consistent RGB depth',()=>{
 const low=moderateFinish({lean:.12,height:.12,rear:-.10});
 assert.equal(assessOsoto(low,3).matched,true);
 const weak=observed(3).map(p=>p?{...p,z:p.z*.12}:null);
 assert.equal(assessOsoto(weak,3).matched,true);
 for(const i of [11,12])weak[i].x=.5+(weak[i].x-.5)*.4;
 assert.equal(assessOsoto(weak,3).matched,true,'a small torso turn is allowed in the finish');
});

test('finish ignores occluded face and arms, accepts a partly hidden rear ankle, but still requires the supporting leg',()=>{
 const p=moderateFinish();
 for(const i of [0,13,14,15,16])p[i]=null;
 p[28].visibility=.3;
 assert.equal(assessOsoto(p,3).matched,true);
 const game=new OsotoProgress();game.stage=3;
 for(let now=0;now<=1200;now+=50)game.update(p,now);
 assert.equal(game.done,true,'hand occlusion cannot reset a valid finishing hold');
 for(const i of [23,25,27,28]){
  const hidden=structuredClone(p);hidden[i].visibility=.1;
  assert.equal(assessOsoto(hidden,3).matched,false,`lost leg landmark ${i}`);
 }
});

test('the sleeve arm is extended in ready and entry practice poses without stretching bones',()=>{
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(let time=0;time<=1;time+=.025){
  const arm=sampleOsotoMotion(time).arms.left;
  assert(distance(arm.root,arm.end)/(.33+.31)>.98,'sleeve arm should be nearly straight');
  assert(arm.reachError<1e-8);
 }
});
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
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i])),back=reap.legs.right;
 assert(distance(back.root,back.end)/(distance(back.root,back.joint)+distance(back.joint,back.end))>.96,'finish extends the reaping leg instead of curling its heel');
 assert(back.end[2]<reap.pelvis[2]-.65);assert(back.end[1]>.2&&back.end[1]<.55);
 for(let time=1;time<=3;time+=.02)assert(Math.hypot(...sampleOsotoMotion(time).legs.left.end.map((x,i)=>x-entry.legs.left.end[i]))<.0001);
});

test('ready and support legs stay tall rather than crouching, and joints move continuously',()=>{
 const d=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(const time of [0,1,2,3]){
  const rig=sampleOsotoMotion(time),leg=rig.legs.left;
  assert(d(leg.root,leg.end)/(.46+.45)>.96,'supporting leg has a soft knee bend');
 }
 const ready=sampleOsotoMotion(0).legs.right;assert(d(ready.root,ready.end)/(.46+.45)>.98);
 let previous=sampleOsotoMotion(0);
 for(let i=1;i<=600;i++){
  const current=sampleOsotoMotion(i/200);
  for(const kind of ['legs','arms'])for(const side of ['left','right'])for(const point of ['joint','end'])assert(d(current[kind][side][point],previous[kind][side][point])<.03,'no abrupt joint flips');
  previous=current;
 }
});
test('reference animation preserves bone lengths and never puts feet below the floor',()=>{
 for(let time=0;time<=3;time+=.02){const b=sampleOsotoMotion(time);
  for(const [parts,a,c]of [[b.legs,.46,.45],[b.arms,.33,.31]])for(const limb of Object.values(parts)){
   const d=(p,q)=>Math.hypot(...p.map((v,i)=>v-q[i]));assert(Math.abs(d(limb.root,limb.joint)-a)<.0001);assert(Math.abs(d(limb.joint,limb.end)-c)<.0001);
   assert(limb.reachError<1e-8,'never conceal an unreachable pose by clamping the requested limb');
  }
  assert(b.legs.left.end[1]>=.065&&b.legs.right.end[1]>=.065,'ankle height includes the displayed sole thickness');
 }
});

test('judging keeps anatomical camera coordinates unmirrored before display projection',()=>{
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
 const jitter=observed(0);jitter[27].x+=.15*1.3;
 game.update(jitter,now+=50);
 assert(game.hold>0&&game.hold<before);
 for(let i=0;i<16;i++)game.update(observed(0),now+=50);
 assert.equal(game.stage,1);
 game.reset();game.update(observed(0),0);game.update(observed(0),100);
 game.update(null,150);assert.equal(game.hold,0);
});

test('a brief small-step estimation dip decays the hold instead of discarding progress',()=>{
 const game=new OsotoProgress();let now=0;
 for(let i=0;i<8;i++)game.update(observed(0),now+=50);
 const before=game.hold,p=observed(0),floor=(p[27].y+p[28].y)/2;
 p[27].y=floor-.15*.02/2;p[28].y=floor+.15*.02/2;
 game.update(p,now+=50);assert(game.hold>0&&game.hold<before);
 for(let i=0;i<16;i++)game.update(observed(0),now+=50);
 assert.equal(game.stage,1);
});

test('sleeve hand stays at the waist while lapel hand stays at the chest',()=>{
 for(let time=0;time<=3;time+=.1){
  const rig=sampleOsotoMotion(time);
  const height=hand=>hand.map((v,i)=>v-rig.pelvis[i]).reduce((sum,v,i)=>sum+v*rig.up[i],0);
  assert(height(rig.arms.left.end)<.12);
  assert(height(rig.arms.left.end)>.02);
  assert(height(rig.arms.right.end)>.51&&height(rig.arms.right.end)<.57,'lapel grip stays near collar/shoulder height');
  assert(height(rig.arms.right.end)-height(rig.arms.left.end)>.40,'do not raise the sleeve grip with the lapel grip');
 }
});
