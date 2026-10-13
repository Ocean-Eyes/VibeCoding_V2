import {writeFile,mkdir} from 'node:fs/promises';
import {GRIP_TUNING} from '../src/grip-tuning.js';
import {gyakuCorpus,evaluateGyaku} from '../tests/fixtures/gyaku-corpus.mjs';
const train=gyakuCorpus('train',24),validation=gyakuCorpus('holdout-v3',32),trials=[];
const grid={releaseFace:[.1,.15,.25],releaseReach:[.4,.55,.7],releaseAlignment:[.25,.4,.55]};
const key=r=>[r.metrics.falseAcquire+r.metrics.falseTap,r.metrics.gripLost+r.metrics.ghostLost,r.metrics.missedRelease+r.metrics.missedTap,r.tuning.releaseFace,r.tuning.releaseReach,r.tuning.releaseAlignment];
const better=(a,b)=>{const x=key(a),y=key(b);for(let k=0;k<x.length;k++)if(x[k]!==y[k])return x[k]<y[k];return false};
let best;
for(const releaseFace of grid.releaseFace)for(const releaseReach of grid.releaseReach)for(const releaseAlignment of grid.releaseAlignment){
 const tuning={...GRIP_TUNING,releaseFace,releaseReach,releaseAlignment},metrics=evaluateGyaku(train,tuning),trial={tuning,metrics};trials.push(trial);
 if(!best||better(trial,best))best=trial;
 console.log(JSON.stringify({releaseFace,releaseReach,releaseAlignment,passed:metrics.passed,cases:metrics.cases,gripLost:metrics.gripLost,missedRelease:metrics.missedRelease}));
}
const heldOut=evaluateGyaku(validation,best.tuning),report={scope:'Synthetic Gyaku 3D self-occlusion and release sequences, not real-camera accuracy',grid,selected:best,heldOut,candidates:trials.length,trainingSequenceRuns:trials.length*train.length,trials};
await mkdir('.test-output',{recursive:true});await writeFile('.test-output/gyaku-fit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({selected:best.tuning,training:best.metrics,validation:heldOut}));
