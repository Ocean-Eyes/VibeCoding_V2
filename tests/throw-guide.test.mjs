import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleThrow} from '../src/throw-motion.js';
import {createThrowGuide,throwGuidePose,throwPracticeYaw,PROFILE_TORSO_DEPTH} from '../src/throw-guide.js';
import {drawOsotoBody,projectOsotoCameraPose,cameraPose} from '../src/osoto-practice.js';

for(const id of ['o-uchi-gari','ippon-seoi-nage']){
 test(`${id}: reference guide preserves the original body and anatomical sides`,()=>{
  for(let i=0;i<=120;i++){
   const body=sampleThrow(id,i/40).tori,before=JSON.stringify(body),p=throwGuidePose(body);
   for(const [side,shoulder,elbow,wrist,hip,knee,ankle]of [['left',11,13,15,23,25,27],['right',12,14,16,24,26,28]]){
    for(const [index,v]of [[shoulder,body.shoulders[side]],[elbow,body.arms[side].joint],[wrist,body.arms[side].end],[hip,body.legs[side].root],[knee,body.legs[side].joint],[ankle,body.legs[side].end]]){
     assert.equal(p[index].x,(v[0]-body.pelvis[0])/.49);assert.equal(p[index].y,-(v[1]-body.pelvis[1])/.49);
    }
   }
   assert.equal(JSON.stringify(body),before);
  }
 });
 test(`${id}: one fixed mirrored viewport contains the full animation in separate panels`,()=>{
  const guide=createThrowGuide(id),scale=guide.scale;
  for(let i=0;i<=600;i++){
   const p=guide.pose(sampleThrow(id,i/200).tori),left=guide.project(p),right=guide.project(p,300);
   for(let j=0;j<p.length;j++)if(p[j]){
    assert(left[j].x>=12&&left[j].x<=288);assert(left[j].y>=12&&left[j].y<=408);
    assert(Math.abs(right[j].x-left[j].x-300)<1e-9);assert.equal(right[j].y,left[j].y);
   }
   assert.equal(guide.scale,scale);
  }
  assert.equal(guide.yaw,id==='ippon-seoi-nage'?Math.PI/2:0);
 });
}

for(const id of ['o-uchi-gari','ippon-seoi-nage'])for(const time of [0,.5,1,1.5,2,2.5,3])for(const yaw of [-Math.PI,-Math.PI/2,0,Math.PI/2,Math.PI]){
 test(`${id} at ${time}, camera yaw ${yaw.toFixed(2)}: orthogonal projection retains depth, bone length and side labels`,()=>{
  const body=sampleThrow(id,time).tori,p=throwGuidePose(body,yaw),front=throwGuidePose(body),before=JSON.stringify(body);
  for(let i=0;i<p.length;i++)if(p[i]){
   const a=front[i],b=p[i];assert(Math.abs(Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z))<1e-9);assert.equal(a.y,b.y);
   assert(Math.abs(b.x-(a.x*Math.cos(yaw)+a.z*Math.sin(yaw)))<1e-9);
  }
  for(const [a,b,length]of [[11,13,.33],[13,15,.31],[12,14,.33],[14,16,.31],[23,25,.46],[25,27,.45],[24,26,.46],[26,28,.45]])assert(Math.abs(Math.hypot(...['x','y','z'].map(k=>p[a][k]-p[b][k]))-length/.49)<1e-8);
  assert.equal(JSON.stringify(body),before);
 });
}

test('shoulder throw practice camera faces the left shoulder and the left turn moves toward the monitor',()=>{
 const yaw=throwPracticeYaw('ippon-seoi-nage');assert.equal(yaw,Math.PI/2);
 const initial=sampleThrow('ippon-seoi-nage',0).tori;
 assert(initial.shoulders.left[0]>initial.shoulders.right[0],'camera at +X sees the left shoulder');
 const turning=sampleThrow('ippon-seoi-nage',1.6).tori;
 assert(turning.forward[0]>.7,'left turn points toward the +X camera');
 assert.equal(throwPracticeYaw('o-uchi-gari'),0);assert.equal(throwPracticeYaw('o-soto-gari'),0);
});

function recordingContext(){
 const ctx={fills:[],strokes:[],path:[],save(){},restore(){},beginPath(){this.path=[]},closePath(){},moveTo(x,y){this.path.push([x,y])},lineTo(x,y){this.path.push([x,y])},arc(x,y,r){this.path.push([x,y,r])},fill(){this.fills.push({path:this.path.slice(),color:this.fillStyle})},stroke(){this.strokes.push(this.path.slice())},fillText(){}};
 return ctx;
}
for(const time of [0,.5,1,1.5,2,2.5,3])for(const missing of [[],[0],[13,15],[14,16],[25,27],[26,28],[11]]){
 test(`side-on avatar at ${time}, occluded ${missing.join(',')||'none'}: silhouette has depth without moving observed joints`,()=>{
  const guide=createThrowGuide('ippon-seoi-nage'),points=guide.project(guide.pose(sampleThrow('ippon-seoi-nage',time).tori));
  for(const i of missing)points[i]=null;const before=JSON.stringify(points),ctx=recordingContext();
  drawOsotoBody(ctx,points,'#d6a24d',guide.scale,{torsoDepth:PROFILE_TORSO_DEPTH});
  assert.equal(JSON.stringify(points),before);
  if(missing.includes(11)){assert.equal(ctx.fills.length,0);return;}
  const polygon=ctx.fills.find(f=>f.path.length===4&&f.path.every(p=>p.length===2));assert(polygon);
  const area=Math.abs(polygon.path.reduce((a,p,i)=>{const q=polygon.path[(i+1)%4];return a+p[0]*q[1]-p[1]*q[0]},0))/2;
  assert(area>guide.scale*guide.scale*.06,'side-on jacket must not collapse into a line');
  for(const shape of [...ctx.fills.map(f=>f.path),...ctx.strokes])for(const point of shape)assert(point.every(Number.isFinite));
 });
}
for(const [videoWidth,videoHeight]of [[720,1280],[1280,720],[640,480],[480,640],[960,960]])for(const [width,height]of [[540,960],[351,624],[960,720]]){
 test(`live camera ${videoWidth}x${videoHeight} in ${width}x${height}: skeleton follows contain-fit image without rotating or cropping`,()=>{
  const raw=[{x:0,y:0,visibility:1},{x:1,y:1,visibility:1},{x:.5,y:.5,visibility:.4}],points=cameraPose(raw,videoHeight/videoWidth),p=projectOsotoCameraPose(points,width,height,videoWidth,videoHeight);
  const factor=Math.min(width/videoWidth,height/videoHeight),w=videoWidth*factor,h=videoHeight*factor;
  assert(Math.abs(p[0].x-(width-w)/2)<1e-9);assert(Math.abs(p[0].y-(height-h)/2)<1e-9);
  assert(Math.abs(p[1].x-(width+w)/2)<1e-9);assert(Math.abs(p[1].y-(height+h)/2)<1e-9);
  assert.equal(p[2].x,width/2);assert.equal(p[2].y,height/2);assert.equal(p[2].visibility,.4);
 });
}
