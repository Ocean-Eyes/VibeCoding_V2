import test from 'node:test';
import assert from 'node:assert/strict';
import {ThrowProgress,THROW_TARGETS,assessThrow,measureThrowPose} from '../src/throw-practice.js';
import {cameraPose} from '../src/osoto-practice.js';
import {practiceFixture} from './fixtures/throw-practice-corpus.mjs';

const ids=['o-uchi-gari','ippon-seoi-nage'];
const input=(id,stage,options={})=>cameraPose(practiceFixture(id,stage,options),options.aspect??16/9);
function reachStage(progress,wanted,options={}){
 let now=progress.last??0;
 for(let stage=progress.stage;stage<wanted;stage++){
  let result;for(let frame=0;frame<65;frame++){
   result=progress.update(input(progress.id,stage,{...options,seed:1+frame*7}),now+=65);
   if(progress.stage>stage||progress.done)break;
  }
  assert(progress.stage>stage||progress.done,`${progress.id} stalled at ${stage}: ${result.issue}, score ${result.score}`);
 }
 return now;
}
for(const id of ids)for(const size of [.75,1,1.25])for(const yawOffset of [-.18,0,.18])for(const pitch of [-.10,0,.10])for(const depthGain of [0,.1,1])for(const noise of [0,.003]){
 test(`${id}: full independent motion size=${size}, yaw=${yawOffset}, pitch=${pitch}, depth=${depthGain}, noise=${noise}`,()=>{
  const progress=new ThrowProgress(id),options={size,yawOffset,pitch,depthGain,noise,roll:yawOffset*.5,aspect:size<1?9/16:size>1?1:16/9};
  reachStage(progress,4,options);assert.equal(progress.done,true);
 });
}
for(const id of ids){
 test(`${id}: every rendered practice target clears its own stage without touching the 3D demo`,()=>{
  const progress=new ThrowProgress(id);let now=0;
  for(let stage=0;stage<4;stage++){
   for(let frame=0;frame<65;frame++){
    const points=THROW_TARGETS[id][stage].map(p=>p?{...p,x:.5+p.x*.15,y:1+p.y*.15,z:p.z*.15}:null);
    progress.update(points,now+=65);if(progress.stage>stage||progress.done)break;
   }
   assert(progress.stage>stage||progress.done,`${id} target ${stage} must be reachable`);
  }
 });
 for(const stage of [1,2,3])for(const invalid of ['stationary','previous',...(id==='o-uchi-gari'&&stage===3?['wrong-leg','upright']:[]),...(id==='ippon-seoi-nage'&&stage===1?['wrong-turn']:[]),...(id==='ippon-seoi-nage'&&stage===3?['upright','no-extension']:[])]){
  test(`${id}: ${invalid} cannot clear stage ${stage}`,()=>{
   const progress=new ThrowProgress(id);let now=reachStage(progress,stage);
   for(let i=0;i<100;i++)progress.update(input(id,stage,{invalid,noise:.001,seed:i+1}),now+=65);
   assert.equal(progress.stage,stage);assert.equal(progress.done,false);assert(progress.hold<1);
  });
 }
 test(`${id}: standing still never completes the full lesson`,()=>{
  const progress=new ThrowProgress(id);for(let i=0;i<500;i++)progress.update(input(id,0,{seed:i+1,noise:.001}),i*65);
  assert.equal(progress.stage,1);assert.equal(progress.done,false);
 });
 test(`${id}: hidden face and hands do not block the full leg/body sequence`,()=>{
  const progress=new ThrowProgress(id);reachStage(progress,4,{hidden:[0,13,14,15,16]});assert.equal(progress.done,true);
 });
 test(`${id}: countdown, pause and reset cannot award or retain old hold time`,()=>{
  const progress=new ThrowProgress(id);for(let i=0;i<40;i++)progress.update(input(id,0),i*65,false);
  assert.equal(progress.stage,0);assert.equal(progress.hold,0);assert.deepEqual(progress.references,[]);
  let now=reachStage(progress,1);now+=1200;
  for(let i=0;i<8;i++)progress.update(input(id,1),now+=65);assert(progress.hold>0&&progress.hold<1);
  progress.pause();assert.equal(progress.hold,0);assert.equal(progress.stage,1);
  progress.reset();assert.equal(progress.stage,0);assert.deepEqual(progress.references,[]);assert.equal(progress.done,false);
 });
 test(`${id}: a short lost frame freezes hold; sustained lost tracking clears it`,()=>{
  const progress=new ThrowProgress(id);let now=0;
  for(let i=0;i<8;i++)progress.update(input(id,0),now+=65);
  const before=progress.hold;assert(before>0);const result=progress.update(null,now+=65);assert.equal(result.grace,true);assert.equal(progress.hold,before);
  progress.update(null,now+=500);assert.equal(progress.hold,0);assert.equal(progress.stage,0);
  reachStage(progress,4);assert.equal(progress.done,true);
 });
 test(`${id}: one frozen camera observation cannot earn a one-second hold`,()=>{
  const progress=new ThrowProgress(id),points=input(id,0);for(let i=0;i<100;i++)progress.update(points,i*65);
  assert.equal(progress.stage,0);assert.equal(progress.done,false);
 });
 test(`${id}: finish remains Perfect until restart and a new run requires fresh references`,()=>{
  const progress=new ThrowProgress(id);reachStage(progress,4);assert.equal(progress.update(null,1e6).score,100);assert.equal(progress.update(null,1e6).done,true);
  progress.reset();assert.equal(progress.update(null,1e6).done,false);assert.equal(progress.stage,0);
 });
 test(`${id}: low-confidence feet and malformed input never produce a score or advance`,()=>{
  const progress=new ThrowProgress(id);let now=0;
  for(const bad of [null,[],Array(33).fill(null),input(id,0,{hidden:[28]})])for(let i=0;i<40;i++){
   const result=progress.update(bad,now+=65);assert.equal(result.score,0);assert.equal(result.stage,0);
  }
  assert.equal(measureThrowPose(null),null);
 });
 test(`${id}: the judge leaves raw landmarks unchanged and score stays finite`,()=>{
  const points=input(id,0),before=JSON.stringify(points),result=assessThrow(points,id,0);
  assert.equal(JSON.stringify(points),before);assert(Number.isFinite(result.score)&&result.score>=0&&result.score<=100);
 });
}
test('unsupported techniques cannot silently receive another technique’s judgment',()=>{
 assert.throws(()=>new ThrowProgress('unknown'));assert.throws(()=>assessThrow([], 'unknown',0));
});

for(const id of ids)for(const yawOffset of [-.18,0,.18])for(const depthGain of [0,.1,1]){
 const cases=id==='o-uchi-gari'?[[1,'stationary'],[2,'previous'],[2,'stationary'],[3,'wrong-leg'],[3,'upright']]:[[1,'wrong-turn'],[2,'stationary'],[2,'previous'],[3,'no-extension'],[3,'upright']];
 for(const [stage,invalid]of cases)test(`${id}: noisy ${invalid} at stage ${stage}, yaw=${yawOffset}, depth=${depthGain} cannot earn Perfect`,()=>{
  const progress=new ThrowProgress(id),options={yawOffset,depthGain,noise:.003};let now=reachStage(progress,stage,options);
  for(let i=0;i<110;i++)progress.update(input(id,stage,{...options,invalid,seed:10000+i*17}),now+=65);
  assert.equal(progress.stage,stage);assert.equal(progress.done,false);
 });
}
for(const id of ids)for(const interval of [33,65,100])test(`${id}: ${interval}ms observations tolerate a brief gap and one depth spike at every stage`,()=>{
 const progress=new ThrowProgress(id);let now=0;
 for(let stage=0;stage<4;stage++){
  const warmup=Math.max(0,Math.ceil((progress.until-now)/interval));let gaps=0,spikes=0;
  for(let frame=0;frame<150;frame++){
   const lost=frame===warmup+6;let points=lost?null:input(id,stage,{noise:.001,seed:frame*31+1});if(lost)gaps++;
   if(points&&frame===warmup+8){for(const i of [11,12,25,26,27,28])points[i].z+=.4;spikes++;}
   progress.update(points,now+=interval);if(progress.stage>stage||progress.done)break;
  }
  assert(progress.stage>stage||progress.done,`stage ${stage} stalled at ${interval}ms`);
  assert.equal(gaps,1);assert.equal(spikes,1);
 }
});
for(const id of ids)for(const torso of [.43,.49,.55])for(const legScale of [.88,1,1.12])for(const yawOffset of [-.12,0,.12])for(const depthGain of [0,1]){
 test(`${id}: independent proportions torso=${torso}, legs=${legScale}, yaw=${yawOffset}, depth=${depthGain}`,()=>{
  const progress=new ThrowProgress(id);reachStage(progress,4,{torso,legScale,yawOffset,depthGain,noise:.002});assert.equal(progress.done,true);
 });
}
for(const size of [.75,1.3,1.8])test(`moving an unchanged stance to camera scale ${size} cannot replace an inner-reap entry`,()=>{
 const progress=new ThrowProgress('o-uchi-gari');let now=reachStage(progress,1);
 for(let frame=0;frame<100;frame++)progress.update(input(progress.id,0,{size}),now+=65);
 assert.equal(progress.stage,1);assert.equal(progress.done,false);
});
for(const id of ids)for(const depthGain of [0,.1,1])for(const yawOffset of [-.18,0,.18]){
 for(const invalid of ['finish-at-start',...(id==='ippon-seoi-nage'?['bent-at-start']:[])])test(`${id}: ${invalid} is not a ready stance, yaw=${yawOffset}, depth=${depthGain}`,()=>{
  const progress=new ThrowProgress(id);for(let i=0;i<100;i++)progress.update(input(id,0,{invalid,depthGain,yawOffset,noise:.003,seed:i*13+1}),i*65);
  assert.equal(progress.stage,0);assert.equal(progress.done,false);
 });
}
