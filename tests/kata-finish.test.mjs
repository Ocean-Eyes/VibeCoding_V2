import test from 'node:test';
import assert from 'node:assert/strict';
import {CollarInteraction} from '../src/collar-interaction.js';
import {kataHands,kataArms} from './fixtures/kata-hands.mjs';
test('Kata mixed grip finishes when both forearms turn but only one elbow rises',()=>{
 for(const mirror of [true,false])for(const reverse of [true,false]){
  const hands=kataHands({mirror,reverse}),model=new CollarInteraction(),directions=reverse?['↓','↑']:['↑','↓'];let state;
  for(let now=0;now<5000;now+=65){
   const angle=.36*Math.min(1,Math.max(0,(now-700)/900))*(mirror?1:-1);
   state=model.update(hands,now,{active:true,mirrored:mirror,directions,bodyVisible:true,arms:kataArms(hands,{mirror,angles:[angle,angle]}),continuousHands:[true,true]});
  }
  assert.equal(state.count,2);assert.equal(state.elbowLevels.filter(v=>v===0).length,1,'reproduces the one-sided elbow score');
  assert.equal(state.tapped,true,JSON.stringify({mirror,reverse,levels:state.finishLevels}));
 }
});

import {kataCorpus,evaluateKata} from './fixtures/kata-corpus.mjs';
for(const c of kataCorpus())test(`${c.id}, ${c.fps}fps, mirror=${c.mirror}, reverse=${c.reverse}`,()=>{
 const result=evaluateKata(c);
 assert.equal(result.tapped,c.expected,JSON.stringify(result));
 assert.equal(result.gripLost,false);assert.equal(result.ghostLost,false);assert.equal(result.released,true);
 if(c.expected)assert.ok(result.maxCloth<.01,'forearm rotation cannot move stationary collar pins');
});
