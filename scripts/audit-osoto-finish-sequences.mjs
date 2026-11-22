import {finishCorpus} from '../tests/fixtures/osoto-finish-corpus.mjs';
import {OsotoProgress} from '../src/osoto-practice.js';
import {evaluateFinishSequence} from '../tests/helpers/osoto-finish-evaluate.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
let Engine=OsotoProgress;
if(process.argv.includes('--baseline')){
 const before=execFileSync('git',['show','d5a8c74:src/osoto-practice.js'],{encoding:'utf8'}).replace("'./osoto-motion.js'",JSON.stringify(new URL('../src/osoto-motion.js',import.meta.url).href));
 Engine=(await import('data:text/javascript;base64,'+Buffer.from(before).toString('base64'))).OsotoProgress;
}
const groups={},failures=[];let sequences=0;
for(const sample of finishCorpus()){
 if(sample.id%7)continue;
 const {done,steps,state,hold}=evaluateFinishSequence(sample,{Engine});
 const key=sample.kind+(sample.options.depthGain===0?':no-depth':'');
 const g=groups[key]??={count:0,completed:0,totalFrames:0};g.count++;g.completed+=Number(done);g.totalFrames+=steps;sequences++;
 if(sample.options.depthGain>0&&done!==sample.expected)failures.push({kind:sample.kind,options:sample.options,last:state?.measurements,issue:state?.issue,hold});
}
await mkdir('.test-output/osoto-finish-corpus',{recursive:true});
await writeFile('.test-output/osoto-finish-corpus/sequences-'+(process.argv[2]||'audit')+'.json',JSON.stringify({groups,failures},null,2));
console.log(JSON.stringify({sequences,groups},null,2));
