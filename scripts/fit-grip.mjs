import {writeFile,mkdir} from 'node:fs/promises';
const INITIAL_TUNING={wristVisibility:.5,wristRecoveryMs:300,finishEnter:.7,finishExit:.55,finishGraceMs:300,wristAngle:.40,elbowRise:.15};
import {finishCorpus,evaluateFinish} from '../tests/fixtures/finish-corpus.mjs';
const train=finishCorpus('train',18),heldOut=finishCorpus('validation-v2',24);
const grid={wristVisibility:[.45,.50,.60],wristRecoveryMs:[200,300,450],finishEnter:[.60,.70,.80],finishExit:[.45,.55,.65],finishGraceMs:[150,300,450],wristAngle:[.30,.40,.50],elbowRise:[.10,.125,.15]};
const trials=[],cache=new Map();
function evaluate(tuning){
 const key=JSON.stringify(tuning);if(cache.has(key))return cache.get(key);
 const metrics=evaluateFinish(train,tuning),result={tuning:{...tuning},metrics};cache.set(key,result);trials.push(result);return result;
}
// False taps dominate selection. Ties prefer stricter entry and smaller tolerance,
// not the fastest possible completion. Held-out trajectories are never consulted.
const rank=r=>r.metrics.falseTap*10000+r.metrics.missed*100+(1-r.tuning.finishEnter)+r.tuning.finishGraceMs/100000+r.tuning.wristRecoveryMs/1000000;
let best=evaluate({...INITIAL_TUNING});const baseline=best;
for(let round=0;round<2;round++)for(const [parameter,values]of Object.entries(grid)){
 let winner=best;
 for(const value of values){const tuning={...best.tuning,[parameter]:value};if(tuning.finishExit>=tuning.finishEnter)continue;const result=evaluate(tuning);if(rank(result)<rank(winner))winner=result}
 best=winner;console.log(JSON.stringify({round,parameter,candidates:trials.length,missed:best.metrics.missed,falseTap:best.metrics.falseTap}));
}
// Also sweep the three coupled motion thresholds jointly. This avoids treating
// the entry fraction independently of the physical movement it normalizes.
for(const finishEnter of grid.finishEnter)for(const wristAngle of grid.wristAngle)for(const elbowRise of grid.elbowRise){
 const result=evaluate({...best.tuning,finishEnter,wristAngle,elbowRise});if(rank(result)<rank(best))best=result;
}
const validation=evaluateFinish(heldOut,best.tuning);
const report={scope:'Synthetic post-tracker landmark trajectories; not measured webcam accuracy',split:'Independent deterministic seeds; held-out cases excluded from parameter selection',grid,baseline,selected:best,heldOut:validation,candidates:trials.length,trainingSequenceRuns:trials.length*train.length,trials};
await mkdir('.test-output',{recursive:true});await writeFile('.test-output/grip-fit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selected:best.tuning,train:best.metrics,heldOut:validation,candidates:trials.length}));
