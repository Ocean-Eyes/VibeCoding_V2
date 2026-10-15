import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLanguage,translate} from '../src/i18n.js';
import {EN} from '../src/i18n-messages.js';
test('explicit supported language overrides saved preference; invalid values fall back safely',()=>{
 assert.equal(resolveLanguage('?lang=en','ko'),'en');assert.equal(resolveLanguage('?lang=ko','en'),'ko');
 assert.equal(resolveLanguage('?lang=fr','en'),'en');assert.equal(resolveLanguage('',null),'ko');assert.equal(resolveLanguage('','invalid'),'ko');
});
test('runtime values are inserted once without interpreting placeholders inside them',()=>{
 assert.equal(translate('추적 모듈 오류: {0}',['network {1}'],'en'),'Tracking module error: network {1}');
 assert.equal(translate('{0}개 손 인식 · {1}개 깃 잡힘',[2,1],'en'),'2 hands detected · 1 lapels gripped');
 assert.equal(translate('{0} / {1}초',[.5,1.2],'ko'),'0.5 / 1.2초');
});
test('English catalog retains every interpolation slot and contains no untranslated Korean',()=>{
 const slots=s=>(s.match(/\{\d+\}/g)||[]).sort();
 for(const [key,value] of Object.entries(EN)){assert.deepEqual(slots(value),slots(key),key);assert.equal(/[가-힣]/.test(value),false,key);assert.ok(value.trim(),key)}
});
test('unknown text and unsupported locales retain source copy',()=>{
 assert.equal(translate('Unlisted text',[],'en'),'Unlisted text');assert.equal(translate('띠 매는 법',[],'fr'),'띠 매는 법');
});
