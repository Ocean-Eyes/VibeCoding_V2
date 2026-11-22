import {writeFile,mkdir} from 'node:fs/promises';
import {finishCorpus} from '../tests/fixtures/osoto-finish-corpus.mjs';
import {assessOsoto} from '../src/osoto-practice.js';
const groups={},failures=[];
for(const sample of finishCorpus()){
 const result=assessOsoto(sample.points,3,{reference:sample.reference});
 const g=groups[sample.kind]??={count:0,accepted:0,issues:{}};
 g.count++;if(result.matched)g.accepted++;else g.issues[result.issue]=(g.issues[result.issue]||0)+1;
 if(result.matched!==sample.expected&&failures.length<80)failures.push({kind:sample.kind,options:sample.options,issue:result.issue,score:result.score});
}
const report={groups,failures};
await mkdir('.test-output/osoto-finish-corpus',{recursive:true});
await writeFile('.test-output/osoto-finish-corpus/'+(process.argv[2]||'audit')+'.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(groups,null,2));
