import test from 'node:test';import assert from 'node:assert/strict';
import {BaemilgiCounter,measureBaemilgi} from '../src/baemilgi-counter.js';
import {pose,mix,dimensions} from './fixtures/baemilgi-poses.mjs';
function runner(options={}){
 const counter=new BaemilgiCounter();let time=0,current=pose('low',options);
 function hold(name,ms=500){current=name===null?null:pose(name,options);for(let i=0;i<ms;i+=50){counter.update(current,time,dimensions);time+=50;}return counter.snapshot();}
 function move(name,ms=600){const end=pose(name,options);for(let i=50;i<=ms;i+=50){counter.update(mix(current,end,i/ms),time,dimensions);time+=50;}current=end;}
 return {counter,hold,move,get time(){return time;}};
}
test('side pose measurements use actual image aspect ratio and distinguish low / raised / standing',()=>{
 for(const options of [{},{mirror:true},{scale:.65},{scale:.8,offsetX:.04,offsetY:-.04}]){
  assert.equal(measureBaemilgi(pose('low',options),dimensions).low,true);
  assert.equal(measureBaemilgi(pose('up',options),dimensions).up,true);
  assert.equal(measureBaemilgi(pose('standing',options),dimensions).standing,true);
 }
 assert.equal(measureBaemilgi(pose('kneeling'),dimensions).up,false);
 assert.equal(measureBaemilgi(pose('plank'),dimensions).up,false);
});
test('three full cycles count once each, then standing stops without a fourth count',()=>{
 for(const options of [{},{mirror:true},{scale:.7}]){
  const r=runner(options);r.hold('low',1000);assert.equal(r.counter.state,'running');
  for(let i=1;i<=3;i++){r.move('up');r.hold('up',1000);assert.equal(r.counter.count,i);r.hold('up',1000);assert.equal(r.counter.count,i);r.move('low');r.hold('low');}
  r.move('standing');r.hold('standing',1500);assert.equal(r.counter.state,'finished');assert.equal(r.counter.count,3);
  const frozen=r.counter.snapshot();r.hold('low',1000);r.move('up');r.hold('up');assert.deepEqual(r.counter.snapshot(),frozen);
 }
});
test('starting upright or raised does not start or add reps; standing after zero reps can end',()=>{
 const r=runner();r.hold('standing',2000);r.hold('up',2000);assert.equal(r.counter.state,'ready');assert.equal(r.counter.count,0);
 r.hold('low',1000);r.hold('standing',1500);assert.equal(r.counter.state,'finished');assert.equal(r.counter.count,0);
});
test('partial rise, straight plank and brief upward noise do not count',()=>{
 const r=runner();r.hold('low',1000);r.hold('up',100);r.hold('low',300);assert.equal(r.counter.count,0);
 r.move('plank');r.hold('plank',2000);assert.equal(r.counter.count,0);
});
test('lost landmarks, a hidden tab and long gaps invalidate only the unfinished rep',()=>{
 for(const kind of ['lost','hidden','gap']){
  const r=runner();r.hold('low',1000);r.move('up');r.hold('up');r.move('low');r.hold('low');assert.equal(r.counter.count,1);
  if(kind==='lost')r.hold(null,1000);else if(kind==='hidden')r.counter.interrupt();else r.counter.update(pose('up'),r.time+1000,dimensions);
  r.hold('up',2000);assert.equal(r.counter.count,1,kind);
 }
});
test('low confidence, cropped body and front-facing body do not arm a rep',()=>{
 for(const points of [pose('low',{visibility:.4}),pose('low',{offsetY:.5}),null,[]])assert.equal(measureBaemilgi(points,dimensions).valid,false);
 const front=pose('low');front[12].x=front[11].x+.3;front[24].x=front[23].x+.3;
 const c=new BaemilgiCounter();for(let time=0;time<2000;time+=50)c.update(front,time,dimensions);
 assert.equal(c.state,'ready');assert.equal(c.reason,'side');
});
test('brief standing or a kneeling rest does not end a run; reset clears old rep history',()=>{
 const r=runner();r.hold('low',1000);r.hold('standing',900);r.hold('kneeling',3000);assert.equal(r.counter.state,'running');
 r.hold('standing',900);assert.equal(r.counter.state,'running');r.counter.reset();assert.equal(r.counter.count,0);assert.deepEqual(r.counter.reps,[]);assert.equal(r.counter.state,'ready');
});
