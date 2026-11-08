import test from 'node:test';
import assert from 'node:assert/strict';
import {HandPlacement,placementTarget,evaluatePlacement} from '../src/hand-placement.js';
import {handAt} from './fixtures/collar-hands.mjs';
function hands(directions=['↓','↓'],mirrored=true,curl=1){return directions.map((d,i)=>{
 const p=placementTarget(i,true),h=handAt(p,curl,i===0,d==='↑');
 return mirrored?h:h.map(p=>({...p,x:-p.x}));
})}
function hold(model,h,options={},start=0){let s;for(let t=start;t<=start+1600;t+=50)s=model.update(h,t,{active:true,...options});return s}
for(const directions of [['↓','↓'],['↑','↑'],['↑','↓']])for(const mirrored of [true,false])test(`static closed hands complete without twist or elbows: ${directions} mirror=${mirrored}`,()=>{
 const model=new HandPlacement(),h=hands(directions,mirrored);
 assert(h.every((v,i)=>evaluatePlacement(v,i,{directions,mirrored}).matched));
 const result=hold(model,h,{directions,mirrored});assert.equal(result.tapped,true);assert.equal(result.score,100);assert.equal(result.hold,1.2);
});
test('open, wrong-facing, misplaced and missing hands never complete',()=>{
 const correct=hands();for(const bad of [hands(['↑','↑']),hands(['↓','↓'],true,0),correct.map(h=>h.map(p=>({...p,x:p.x+.4}))),[correct[0],null],[null,null]]){
 const s=hold(new HandPlacement(),bad);assert.equal(s.tapped,false);assert.equal(s.hold,0);assert(s.score<100);
 }
});
test('either hand may arrive first; no opening or grab transition required',()=>{
 const model=new HandPlacement(),h=hands();assert.equal(model.update([null,h[1]],0,{active:true}).count,1);
 assert.equal(hold(model,h,{},50).tapped,true);
});
test('loss, wrong shape and pause reset continuous hold; stale arms cannot fill missing hands',()=>{
 for(const broken of [[null,null],hands(['↓','↓'],true,0)]){
 const m=new HandPlacement(),h=hands();for(let t=0;t<=600;t+=50)m.update(h,t,{active:true});
 const s=m.update(broken,650,{active:true,arms:[{wrist:h[0][0]},{wrist:h[1][0]}]});assert.equal(s.hold,0);assert.equal(s.tapped,false);
 }
 const m=new HandPlacement(),h=hands();for(let t=0;t<=600;t+=50)m.update(h,t,{active:true});assert.equal(m.update(h,650,{active:false}).hold,0);
 assert.equal(m.update(h,99999,{active:true}).tapped,false);
});
