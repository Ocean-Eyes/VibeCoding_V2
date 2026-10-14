import test from 'node:test';
import assert from 'node:assert/strict';
import {selectGlove,hideCollarThumb,gloveElbow} from '../src/glove-display.js';
import {CollarInteraction} from '../src/collar-interaction.js';
import {gyakuHands} from './fixtures/gyaku-hands.mjs';
import {collarArms,collarHands} from './fixtures/collar-hands.mjs';
for(const mirror of [true,false])for(const curl of [0,.2,.5,.8,1])test(`live finger shape wins over a retained grip: mirror=${mirror}, curl=${curl}`,()=>{
 const model=new CollarInteraction();let state,time=0;
 for(let k=0;k<12;k++)state=model.update(gyakuHands({mirror}),time+=65,{mirrored:mirror,directions:['↑','↑'],bodyVisible:true,arms:collarArms()});
 assert.equal(state.count,2);
 const observed=gyakuHands({mirror,curl,roll:1.48});
 for(let k=0;k<12;k++)state=model.update(observed,time+=65,{mirrored:mirror,directions:['↑','↑'],bodyVisible:true,arms:collarArms()});
 assert.equal(state.count,2,'display must not change grip preservation');
 for(let i=0;i<2;i++){
  const shown=selectGlove(observed[i],observed[i],state.wristHands[i]);
  assert.equal(shown.source,'live');assert.strictEqual(shown.hand,observed[i]);
  if(curl===0)assert.notDeepEqual(shown.hand,state.wristHands[i],'opening cannot be replaced by the old closed shape');
 }
});
test('a wrist-only hand is a fallback, and fresh fingers take over immediately on return',()=>{
 const closed=collarHands('close')[0],opened=collarHands('open')[0];
 assert.deepEqual(selectGlove(null,closed,opened),{hand:opened,source:'wrist'});
 assert.deepEqual(selectGlove(opened,closed,closed),{hand:opened,source:'live'});
 assert.deepEqual(selectGlove(null,closed,null),{hand:closed,source:'retained'});
 assert.deepEqual(selectGlove(null,null,null),{hand:null,source:'missing'});
});
test('an open hand keeps its thumb visible during the grip release delay',()=>{
 for(const hand of collarHands('open'))assert.equal(hideCollarThumb(hand,true),false);
});
test('an extended thumb is not hidden merely because the other fingers grip',()=>{
 for(const hand of collarHands('close')){
  hand[3]={...hand[3],x:hand[5].x+.4};hand[4]={...hand[4],x:hand[5].x+.5};
  assert.equal(hideCollarThumb(hand,true),false);
 }
});
test('thumb masking still applies to a folded thumb at the collar contact',()=>{
 for(const hand of collarHands('close')){
  hand[3]={...hand[5]};hand[4]={...hand[5]};
  assert.equal(hideCollarThumb(hand,true),true);assert.equal(hideCollarThumb(hand,false),false);
 }
});

test('collapsed hidden-joint estimates stay a fallback, while real curls and size changes stay live',()=>{
 const reference=gyakuHands()[0];
 for(const scale of [.7,1,1.4])for(const curl of [0,.25,.5,1]){
  const hand=gyakuHands({curl,scale,roll:1.4})[0];
  assert.equal(selectGlove(hand,hand,reference).source,'live');
 }
 const collapsed=gyakuHands({curl:0,collapsed:.3})[0];
 assert.equal(selectGlove(collapsed,collapsed,reference).source,'wrist');
});

test('forearm joins only a matching visible pose wrist, including real crossed wrists',()=>{
 for(const mirror of [true,false])for(const crossed of [true,false]){
  const hands=collarHands('open');
  for(const [i,h]of hands.entries()){
   const dx=(crossed?1:-1)*(i?-.3:.3)-h[0].x;
   h.forEach(p=>{p.x=(p.x+dx)*(mirror?1:-1)});
   const elbow={x:(i?.65:-.65)*(mirror?1:-1),y:.7,visibility:1};
   const arm={wrist:{...h[0],visibility:1},elbow};
   assert.deepEqual(gloveElbow(h,arm),elbow);
   assert.equal(gloveElbow(h,{...arm,wrist:{...h[0],x:-h[0].x}}),null,'opposite wrist must not manufacture a crossed forearm');
   assert.equal(gloveElbow(h,{...arm,wrist:{...h[0],visibility:.1}}),null);
   assert.equal(gloveElbow(h,{...arm,elbow:{...elbow,visibility:.1}}),null);
  }
 }
 assert.equal(gloveElbow(null,null),null);
});
