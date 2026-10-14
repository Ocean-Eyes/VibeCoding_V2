import test from 'node:test';
import assert from 'node:assert/strict';
import {PracticeTrace,motionDiagnostic} from '../src/practice-trace.js';
import {CollarInteraction} from '../src/collar-interaction.js';
test('trace is bounded, throttled and detached from mutable live state',()=>{
 const trace=new PracticeTrace(),state=new CollarInteraction().update([null,null],0),options={arms:[null,null],active:true};
 for(let time=0;time<40000;time+=20)trace.record(time,[null,null],options,state,{forearm:[null,null]});
 assert.equal(trace.frames.length,300);assert.ok(trace.frames[0].time>=9900);
 state.forearmStatus[0]='elbow';options.active=false;
 const snapshot=trace.snapshot('kata','build123');
 assert.equal(snapshot.frames.at(-1).result.forearmStatus[0],'ungripped');assert.equal(snapshot.frames.at(-1).options.active,true);
 snapshot.frames[0].options.active=false;assert.equal(trace.frames[0].options.active,true);
 trace.clear();assert.equal(trace.frames.length,0);trace.record(10,[null,null],options,state,{});assert.equal(trace.frames.length,1);
});
test('diagnostic differentiates missing elbow, invalid geometry and observed zero movement',()=>{
 const state=new CollarInteraction().update([null,null],0);state.grips[0]={side:1};
 state.forearmStatus[0]='elbow';assert.match(motionDiagnostic(state,0),/팔꿈치 인식 대기/);
 state.forearmStatus[0]='geometry';assert.match(motionDiagnostic(state,0),/방향 확인 불가/);
 state.forearmStatus[0]='tracked';state.forearmAngles[0]=0;assert.match(motionDiagnostic(state,0),/전완 추적 중 · 회전 0°/);
 assert.match(motionDiagnostic(null,1),/오른쪽: 깃 잡기 전/);
});
