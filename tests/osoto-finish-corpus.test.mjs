import test from 'node:test';
import assert from 'node:assert/strict';
import {finishCorpus,finishFixture} from './fixtures/osoto-finish-corpus.mjs';
import {evaluateFinishSequence} from './helpers/osoto-finish-evaluate.mjs';
import {assessOsoto,OsotoProgress} from '../src/osoto-practice.js';

test('46,170 independent physical/camera cases produce finite, bounded finish feedback',()=>{
 let cases=0;
 for(const sample of finishCorpus()){
  const r=assessOsoto(sample.points,3,{reference:sample.reference});
  assert(Number.isFinite(r.score)&&r.score>=0&&r.score<=100);
  assert.equal(typeof r.matched,'boolean');cases++;
 }
 assert.equal(cases,46170);
});

test('over 6,500 noisy sequences accept at least 97% of observable valid finishes and reject all invalid finishes',()=>{
 let valid=0,completed=0,invalid=0,falseAwards=0,noDepth=0,noDepthAwards=0;
 const failures=[];
 for(const sample of finishCorpus()){
  if(sample.id%7)continue;
  const r=evaluateFinishSequence(sample);
  if(sample.options.depthGain===0){noDepth++;noDepthAwards+=Number(r.done);continue;}
  if(sample.expected){valid++;completed+=Number(r.done);}
  else {invalid++;if(r.done){falseAwards++;failures.push({kind:sample.kind,options:sample.options});}}
 }
 assert(valid>=3600&&invalid>=1400&&noDepth>=1200);
 assert(completed/valid>=.97,`${completed}/${valid} valid sequences completed`);
 assert.equal(falseAwards,0,JSON.stringify(failures.slice(0,5)));
 assert.equal(noDepthAwards,0,'a completely lost depth signal must not turn noise into completion');
 console.log(`Finish corpus: ${completed}/${valid} observable valid sequences, ${falseAwards}/${invalid} false awards, ${noDepthAwards}/${noDepth} lost-depth awards`);
});

test('short tracking gaps and one large depth spike do not block an otherwise valid finish at different frame rates',()=>{
 for(const interval of [33,65,100])for(const pitch of [-.15,0,.15]){
  const sample={options:{lean:.30,lift:.18,back:.28,pitch,depthGain:.4,noise:.008,seed:8,occluded:true}};
  const r=evaluateFinishSequence(sample,{frames:100,interval,dropouts:true,spike:true});
  assert.equal(r.done,true,`interval ${interval}, pitch ${pitch}`);
 }
});

test('a 250ms tracking grace never awards time, and prolonged loss, pause and reset still stop progress',()=>{
 const game=new OsotoProgress();game.stage=3;
 for(let n=0;n<15;n++)game.finishJudge.observeReference(finishFixture({kind:'entry',seed:n}));
 const p=finishFixture();for(let now=0;now<=500;now+=50)game.update(p,now);
 const hold=game.hold;assert(hold>0&&hold<1);
 for(let now=550;now<=700;now+=50){game.update(null,now);assert.equal(game.hold,hold);assert.equal(game.done,false);}
 game.update(null,800);assert.equal(game.hold,0);
 for(let now=850;now<=1100;now+=50)game.update(p,now);
 assert(game.hold>0,'the same valid frame can resume after a gap');
 game.update(p,1150,false);assert.equal(game.hold,0);assert.equal(game.done,false);
 game.reset();assert.equal(game.stage,0);assert.equal(game.hold,0);assert.equal(game.finishJudge.reference,null);
});

test('neutral torso calibration survives the already leaning entry stance',()=>{
 const game=new OsotoProgress();game.stage=3;
 for(let n=0;n<15;n++)game.finishJudge.observeReference(finishFixture({kind:'standing',seed:n}),0);
 for(let n=0;n<15;n++)game.finishJudge.observeReference(finishFixture({kind:'grounded',lean:.12,seed:n}),1);
 const first=game.finishJudge.reference.torsoDepth;
 assert(Math.abs(first)<1e-10,'entry must not replace the neutral torso reference');
 const p=finishFixture({lean:.18,lift:.12,back:.20});
 for(let now=0;now<2000&&!game.done;now+=65)game.update(p,now);
 assert.equal(game.done,true);
});

test('stable per-joint depth offsets cancel against the same user calibration',()=>{
 let completed=0,total=0;
 for(const foot of [-.10,0,.10])for(const shoulder of [-.05,0,.05])for(const pitch of [-.10,0,.10]){
  const options={lean:.30,lift:.18,back:.30,pitch,depthGain:.4,noise:.006,seed:71,depthOffsets:{11:shoulder,12:shoulder,26:foot*.5,28:foot}};
  completed+=Number(evaluateFinishSequence({options}).done);total++;
 }
 assert.equal(completed,total);
});

test('1,000 withheld body/camera cases generalize beyond the fixed sweep',()=>{
 let seed=38912;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 let valid=0,completed=0,bad=0,awards=0;
 for(let n=0;n<500;n++){
  const options={torso:.44+random()*.10,lean:.18+random()*.25,lift:.12+random()*.16,back:.17+random()*.22,pitch:(random()-.5)*.3,yaw:(random()-.5)*.6,roll:(random()-.5)*.18,depthGain:.16+random()*.8,noise:.004+random()*.006,seed:n+10000,distance:3+random()*2,aspect:n%2?16/9:9/16,occluded:n%3===0};
  if(!finishFixture(options))continue;valid++;completed+=Number(evaluateFinishSequence({options}).done);
  const kind=['standing','entry','grounded','upright','backward','forward','left','lost','curl'][n%9];
  bad++;awards+=Number(evaluateFinishSequence({options:{...options,kind}}).done);
 }
 assert.equal(valid,500);assert.equal(bad,500);assert(completed/valid>=.97);assert.equal(awards,0);
});
