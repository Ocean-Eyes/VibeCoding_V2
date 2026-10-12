const {chromium}=require(process.argv[2]||'playwright');
const {mkdir,writeFile}=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();await page.goto(process.env.SITE_URL||'http://localhost:5173/index.html');
  const sprites=await page.evaluate(async()=>{
   const {drawAnatomicalArm,renderedHandSprites}=await import('./scripts/hand-surface.mjs');
   const ctx=document.createElement('canvas').getContext('2d');
   for(const left of [false,true])for(const up of [false,true])for(const ghost of [false,true])for(const gripped of (up?[false]:[false,true]))drawAnatomicalArm(ctx,{x:0,y:0},0,left,up,ghost,false,gripped);
   return renderedHandSprites();
  });
  await mkdir('assets/hands-aah-v1',{recursive:true});
  for(const {key,data}of sprites){
   const [left,up,ghost,gripped]=key.split('/').map(v=>v==='true');
   const name=`${left?'left':'right'}-${up?'palm':'back'}-${ghost?'glove':'skin'}${gripped?'-grip':''}.png`;
   await writeFile(`assets/hands-aah-v1/${name}`,Buffer.from(data.split(',')[1],'base64'));
  }
  console.log(`Rendered ${sprites.length} reference-rig hand sprites`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
