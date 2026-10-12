import {readFile,writeFile,readdir,mkdir,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const files=['index.html','dojo.css',...(await readdir(new URL('src/',root))).filter(n=>n.endsWith('.js')).sort().map(n=>`src/${n}`)];
const sources=await Promise.all(files.map(n=>readFile(new URL(n,root),'utf8')));
const hash=createHash('sha256').update(sources.join('\n'));
async function hashAssets(directory){
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    const path=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
    if(entry.isDirectory())await hashAssets(path);else hash.update(entry.name).update(await readFile(path));
  }
}
await hashAssets(new URL('assets/',root));
const version=hash.digest('hex').slice(0,16);
await mkdir(new URL('dist/src/',root),{recursive:true});
for(let i=0;i<files.length;i++){
  // Version every local module edge, including dynamic imports and worker URLs.
  const output=sources[i].replace(/(['"])(\.\/?[^'"\s]+\.(?:js|css))\1/g,(_,quote,path)=>`${quote}${path}?v=${version}${quote}`);
  await writeFile(new URL(`dist/${files[i]}`,root),output);
}
await cp(new URL('assets/',root),new URL('dist/assets/',root),{recursive:true});
await writeFile(new URL('dist/.nojekyll',root),'');
console.log(`Built dist (${version})`);
