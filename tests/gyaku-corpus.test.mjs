import test from 'node:test';
import assert from 'node:assert/strict';
import {GRIP_TUNING} from '../src/grip-tuning.js';
import {gyakuCorpus,evaluateGyaku} from './fixtures/gyaku-corpus.mjs';
for(const c of gyakuCorpus('holdout-v3',32))test(`gyaku: ${c.id} @ ${c.fps}fps`,()=>{
 const result=evaluateGyaku([c],GRIP_TUNING);assert.equal(result.passed,1,JSON.stringify(result.failures));
});
