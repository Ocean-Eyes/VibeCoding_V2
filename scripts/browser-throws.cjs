// Run with an installed Playwright module path as argv[2], or use `playwright`.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://127.0.0.1:5188',dir='.test-output/throws/browser';
const ids=['o-soto-gari','o-uchi-gari','ippon-seoi-nage'];
(async()=>{
 fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],timings={};
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('just-judo-visitor-excluded','1'));
  await page.goto(base+'/throws');assert.equal(await page.locator('#course-grid [data-lesson]').count(),3);
  await page.screenshot({path:dir+'/category.png',fullPage:true});
  for(const id of ids){
   await page.locator(`[data-lesson="${id}"]`).click();await page.waitForFunction(()=>document.querySelector('#throw-canvas')?.dataset.time==='0.0000');
   assert.equal(new URL(page.url()).pathname.endsWith('/throws/'+id),true);
   await page.reload();await page.waitForFunction(()=>document.querySelector('#throw-canvas')?.dataset.time==='0.0000');
   for(const view of ['oblique','front','side']){
    await page.locator(`[data-throw-view="${view}"]`).click();
    for(let phase=0;phase<3;phase++){
     await page.locator(`[data-throw-phase="${phase}"]`).click();
     for(const p of [0,250,500,750,1000]){
      await page.locator('#throw-seek').fill(String(p));
      assert.equal(await page.locator('#throw-canvas').getAttribute('data-playing'),'false');
      await page.locator('#throw-canvas').screenshot({path:`${dir}/${id}-${view}-${phase}-${p}.png`});
     }
    }
   }
   await page.locator('[data-throw-view="oblique"]').click();
   await page.locator('#throw-solo').check();assert.equal(await page.locator('#throw-canvas').getAttribute('data-solo'),'true');
   await page.locator('#throw-canvas').screenshot({path:`${dir}/${id}-solo.png`});await page.locator('#throw-solo').uncheck();
   for(let phase=0;phase<3;phase++){await page.locator(`[data-throw-phase="${phase}"]`).click();await page.locator('#throw-check').check();}
   assert.match(await page.locator('#throw-practice-status').textContent(),/완료/);
   await page.locator('[data-throw-phase="0"]').click();await page.locator('#throw-speed').selectOption('0.5');await page.locator('#throw-play').click();
   await page.waitForFunction(()=>Number(document.querySelector('#throw-canvas').dataset.progress)>.08);
   await page.locator('#throw-play').click();const paused=await page.locator('#throw-canvas').getAttribute('data-time');await page.waitForTimeout(150);assert.equal(await page.locator('#throw-canvas').getAttribute('data-time'),paused);
   await page.locator('#throw-speed').selectOption('1');await page.locator('#throw-seek').fill('950');await page.locator('#throw-play').click();
   await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.playing==='false');assert.equal(await page.locator('#throw-canvas').getAttribute('data-time'),'1.0000');
   await page.locator('#throw-repeat').check();await page.locator('#throw-seek').fill('950');await page.locator('#throw-play').click();
   await page.waitForFunction(()=>Number(document.querySelector('#throw-canvas').dataset.progress)<.3);assert.equal(await page.locator('#throw-canvas').getAttribute('data-playing'),'true');await page.locator('#throw-play').click();await page.locator('#throw-repeat').uncheck();
   await page.evaluate(()=>{window.throwFrames=[];window.throwMeasure=true;let previous;const tick=now=>{if(!window.throwMeasure)return;if(previous)window.throwFrames.push(now-previous);previous=now;requestAnimationFrame(tick)};requestAnimationFrame(tick)});
   await page.locator('#throw-all').click();
   await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.time==='3.0000'&&document.querySelector('#throw-canvas').dataset.playing==='false',null,{timeout:30000});
   const frames=await page.evaluate(()=>{window.throwMeasure=false;return window.throwFrames.sort((a,b)=>a-b)});timings[id]={frames:frames.length,median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)]};
   await page.locator('#throw-all').click();await page.locator('#brand-home').click();assert.equal(await page.locator('#throw-screen').isHidden(),true);assert.equal(await page.locator('#home-screen').isVisible(),true);
   await page.locator('[data-category="throws"]').click();
  }
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/throws/ippon-seoi-nage');await page.waitForFunction(()=>document.querySelector('#throw-canvas')?.dataset.time);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile page must not scroll horizontally');
  await page.locator('[data-throw-phase="1"]').click();await page.locator('#throw-seek').fill('1000');await page.screenshot({path:dir+'/mobile.png',fullPage:true});
  await page.goto(base+'/throws/o-uchi-gari?lang=en');await page.waitForFunction(()=>document.querySelector('#throw-canvas')?.dataset.time);assert.equal(await page.locator('html').getAttribute('lang'),'en');
  assert.equal(/[가-힣]/.test(await page.locator('#throw-screen').innerText()),false,'English lesson must be translated');await page.screenshot({path:dir+'/english-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/result.json',JSON.stringify({timings,errors},null,2));console.log(JSON.stringify({timings,errors}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
