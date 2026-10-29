const {chromium}=require(process.argv[2]||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const variant=process.env.PERF_LABEL||'current',dir='.test-output/belt-performance/'+variant;
(async()=>{fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1365,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('just-judo-visitor-excluded','1'));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:5187/basics/belt');
 await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');
 await page.locator('[data-belt-step="6"]').click();
 for(const mode of ['front','orbit','first-person']){
  if(mode==='orbit')await page.locator('[data-belt-view="oblique"]').click();
  if(mode==='first-person')await page.locator('[data-belt-perspective="first-person"]').click();
  for(const percent of [45,65,85,95,100]){
   await page.locator('#belt-scrub').fill(String(percent));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.locator(mode==='orbit'?'#belt-detail':'#belt-canvas').screenshot({path:dir+'/'+mode+'-'+percent+'.png'});
  }
 }
 await page.locator('[data-belt-perspective="front"]').click();
 await page.locator('#belt-scrub').fill('0');
 await page.evaluate(()=>{window.frameTimes=[];window.measureFrames=true;let prev=performance.now();const tick=now=>{if(!window.measureFrames)return;const pts=Number(document.querySelector('#belt-canvas').dataset.pts);window.frameTimes.push({ms:now-prev,pts});prev=now;requestAnimationFrame(tick)};requestAnimationFrame(tick)});
 await page.locator('#belt-play').click();
 await page.waitForFunction(()=>document.querySelector('#belt-film-status').textContent==='단계 완료',{},{timeout:30000});
 const samples=await page.evaluate(()=>{window.measureFrames=false;return window.frameTimes});
 const times=samples.filter(x=>x.pts>18.8&&x.pts<19.8).map(x=>x.ms).sort((a,b)=>a-b);
 const result={samples,frames:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],max:Math.max(...times),errors};
 assert(times.length>0,'Playback must produce frames during tightening');fs.writeFileSync(dir+'/timing.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,samples:undefined}));assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
