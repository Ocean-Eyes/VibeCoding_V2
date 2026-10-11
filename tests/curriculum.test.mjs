import test from 'node:test';
import assert from 'node:assert/strict';
import {TECHNIQUES,FOUNDATIONS,readProgress,progressTotals} from '../src/curriculum.js';
import {POSES,targetPose} from '../src/pose.js';
test('three requested cross-grip techniques have distinct quiz answers',()=>{assert.deepEqual(TECHNIQUES.map(t=>t.name),['십자조르기','역십자 조르기','외십자 조르기']);assert.deepEqual(TECHNIQUES.map(t=>t.answer),[0,1,2]);assert.equal(FOUNDATIONS.length,3)});
test('progress ignores unknown entries and only counts boolean completions',()=>{const p=readProgress({getItem:()=>JSON.stringify({nami:{quiz:true,practice:true},gyaku:{quiz:1,practice:'true'},other:{quiz:true,practice:true}})});assert.deepEqual(progressTotals(p),{xp:30,completed:1});assert.deepEqual(readProgress({getItem:()=>'{broken'}),{})});
test('final solo step crosses wrists while the preparation step does not',()=>{const frame={origin:{x:500,y:300},scale:180,x:{x:1,y:0},y:{x:0,y:1}};const ready=targetPose(frame,POSES[0]),crossed=targetPose(frame,POSES[2]);assert.ok(ready[15].x>ready[16].x);assert.ok(crossed[15].x<crossed[16].x)});
