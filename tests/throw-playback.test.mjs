import test from 'node:test';
import assert from 'node:assert/strict';
import {THROW_DURATION,throwTimeAtElapsed} from '../src/throw-playback.js';

test('one continuous timeline preserves authored timing and reaches the finish',()=>{
 assert.equal(THROW_DURATION,11.4);
 for(const [elapsed,time] of [[-1,0],[0,0],[1.6,.5],[3.2,1],[5.3,1.5],[7.4,2],[9.4,2.5],[11.4,3],[12,3]]){
  assert(Math.abs(throwTimeAtElapsed(elapsed)-time)<1e-12,`elapsed ${elapsed}`);
 }
 for(let elapsed=.01;elapsed<=THROW_DURATION;elapsed+=.01){
  const previous=throwTimeAtElapsed(elapsed-.01),current=throwTimeAtElapsed(elapsed);
  assert(current>previous&&current-previous<.004,'no hold, jump or reversal at old boundaries');
 }
});
