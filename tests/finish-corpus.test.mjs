import test from 'node:test';
import assert from 'node:assert/strict';
import {GRIP_TUNING} from '../src/grip-tuning.js';
import {finishCorpus,evaluateFinish} from './fixtures/finish-corpus.mjs';
// Preserve the independent validation split in the normal test command.
for(const c of finishCorpus('validation-v2',24))test(`finish validation: ${c.id} @ ${c.fps}fps`,()=>{
 const result=evaluateFinish([c],GRIP_TUNING);
 assert.equal(result.falseTap,0,c.id);assert.equal(result.missed,0,c.id);
});
