import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const files=['index.html','dojo.css',...(await readdir(new URL('src/',root))).filter(n=>n.endsWith('.js')).sort().map(n=>`src/${n}`)];
const sources=await Promise.all(files.map(n=>readFile(new URL(n,root),'utf8')));
const version=createHash('sha256').update(sources.join('\n')).digest('hex').slice(0,16);
await mkdir(new URL('dist/src/',root),{recursive:true});
for(let i=0;i<files.length;i++){
  // Version every local module edge, including dynamic imports and worker URLs.
  const output=sources[i].replace(/(['"])(\.\/?[^'"\s]+\.(?:js|css))\1/g,(_,quote,path)=>`${quote}${path}?v=${version}${quote}`);
  await writeFile(new URL(`dist/${files[i]}`,root),output);
}
await writeFile(new URL('dist/.nojekyll',root),'');
console.log(`Built dist (${version})`);
