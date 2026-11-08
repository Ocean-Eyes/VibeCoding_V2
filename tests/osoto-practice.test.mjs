import test from 'node:test';
import assert from 'node:assert/strict';
import {OSOTO_TARGETS,assessOsoto,OsotoProgress,cameraPose} from '../src/osoto-practice.js';
const observed=(stage,scale=.15,x=.5,y=.45)=>OSOTO_TARGETS[stage].map(p=>p?{x:x+p.x*scale,y:y+p.y*scale,visibility:1}:null);
for(let stage=0;stage<3;stage++)test(`stage ${stage+1}: target fits at different sizes and positions`,()=>{
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
test('all three stages must be held in order; pauses, loss and reset cannot award progress',()=>{
 const game=new OsotoProgress();let now=0;
 for(let stage=0;stage<3;stage++){
  now+=1200;for(let n=0;n<8;n++)game.update(observed(stage),now+=50);
  game.update(null,now+=50);assert.equal(game.hold,0);
  game.update(observed(stage),now+=50,false);assert.equal(game.hold,0);
  for(let n=0;n<23;n++)game.update(observed(stage),now+=50);
  assert.equal(game.done,stage===2);assert.equal(game.stage,Math.min(stage+1,2));
 }
 game.reset();assert.equal(game.stage,0);assert.equal(game.done,false);
});

test('inferred landmarks outside the camera image cannot complete a pose',()=>{
 const p=observed(0,.1,.5,.3).map(v=>v?{...v,x:1-v.x,y:v.y/.75}:null);
 assert.equal(assessOsoto(cameraPose(p,.75),0).matched,true);
 for(const i of [0,27,28]){const clipped=structuredClone(p);clipped[i].y=1.01;assert.equal(assessOsoto(cameraPose(clipped,.75),0).matched,false);}
});
