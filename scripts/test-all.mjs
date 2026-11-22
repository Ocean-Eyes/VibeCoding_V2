import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const collect=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
 const path=join(directory,entry.name);
 return entry.isDirectory()?collect(path):entry.name.endsWith('.test.mjs')?[path]:[];
});
const files=collect(fileURLToPath(new URL('../tests/',import.meta.url))).sort();
if(!files.length)throw new Error('No test files found');
console.log(`Running all ${files.length} test files`);
const result=spawnSync(process.execPath,['--test',...files],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
