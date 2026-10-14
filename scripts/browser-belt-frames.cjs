const {chromium}=require(process.argv[2]||'playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1160}});
 await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
 await page.evaluate(async()=>{
  const script=[...document.scripts].find(s=>s.type==='module').src;
  const url=new URL('src/belt-geometry.js',location.href);url.search=new URL(script).search;
  const {beltPose,drawGhostBelt}=await import(url.href);
  document.body.innerHTML='';document.body.style.cssText='margin:0;background:#deded5;display:grid;grid-template-columns:repeat(6,1fr);gap:4px';
  for(const stage of [3,4,5])for(const progress of [0,.2,.4,.6,.8,1]){
   const box=document.createElement('div'),label=document.createElement('div'),c=document.createElement('canvas');
   c.width=236;c.height=340;c.style.background='#e4e2d9';label.textContent=`단계 ${stage+1} / ${Math.round(progress*100)}%`;box.append(label,c);document.body.append(box);
   drawGhostBelt(c.getContext('2d'),{x:118,y:110,scale:128},beltPose(stage,progress),{opacity:1});
  }
 });
 await page.screenshot({path:'.test-output/belt-thread-sequence.png',fullPage:true});
 console.log('Captured 18 intermediate insertion frames.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
