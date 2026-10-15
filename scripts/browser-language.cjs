const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/_vercel/insights/script.js',r=>r.fulfill({contentType:'application/javascript',body:'window.analyticsLoaded=(window.analyticsLoaded||0)+1;'}));
 const base=process.env.SITE_URL||'http://localhost:5173/dist/index.html';
 fs.mkdirSync('.test-output/language',{recursive:true});
 async function englishVisible(){const texts=await page.evaluate(()=>{const out=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(walker.nextNode()){const n=walker.currentNode,p=n.parentElement;if(!p||p.closest('script,style,[data-no-translate]')||!/[가-힣]/.test(n.data))continue;if(p.checkVisibility())out.push(n.data.trim());}return out});assert.deepEqual(texts,[],'Untranslated visible copy');}
 async function shot(name){await page.screenshot({path:'.test-output/language/'+name+'.png',fullPage:true});}
 try{
  await page.goto(base);await page.locator('#language-button').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'ko');
  await page.locator('#language-button').click();await page.locator('[data-language="en"]').click();await page.waitForURL(/lang=en/);await page.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await page.evaluate(()=>localStorage.getItem('just-judo-language')),'en');await englishVisible();await shot('home-en');
  assert.equal(await page.evaluate(()=>window.analyticsLoaded),1);
  await page.locator('#help').click();await englishVisible();await page.locator('#close-help').click();
  for(const id of ['nami','gyaku','kata']){
   await page.locator('[data-category="katame"]').click();await page.locator(`[data-lesson="${id}"]`).click();
   await page.waitForFunction(()=>document.querySelector('#status').textContent==='Demonstration playing');await englishVisible();assert.equal(await page.locator('#practice-roman').textContent(),{nami:'Nami-juji-jime',gyaku:'Gyaku-juji-jime',kata:'Kata-juji-jime'}[id]);
   if(id==='kata')await shot('practice-en');await page.locator('#back-menu').click();
  }
  await page.locator('[data-category="basics"]').click();await page.locator('[data-lesson="belt"]').click();await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');
  for(let i=0;i<7;i++){await page.locator(`[data-belt-step="${i}"]`).click();await page.waitForTimeout(70);await englishVisible();}
  await page.locator('[data-belt-step="4"]').click();await shot('belt-en');
  await page.locator('#belt-mode-real').click();await englishVisible();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError')}});
  await page.locator('#belt-camera').click();await page.waitForFunction(()=>document.querySelector('#belt-notice').textContent.startsWith('Camera access was denied'));await englishVisible();
  await page.setViewportSize({width:390,height:844});await shot('belt-en-mobile');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow');
  await page.locator('#back-menu').click();await shot('home-en-mobile');await englishVisible();await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Demonstration playing');await shot('practice-en-mobile');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'practice mobile overflow');await englishVisible();
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const stream=c.captureStream(15);c.getContext('2d').fillRect(0,0,320,240);return stream;};window.Worker=class{postMessage(data){if(data.type==='init')setTimeout(()=>this.onmessage?.({data:{type:'error',code:'model',detail:'simulated model failure',message:'모델 오류'}}),10)}terminate(){}};});
  await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Could not load the model.'));await englishVisible();await page.locator('#back-menu').click();
  await page.goto(base);await page.waitForFunction(()=>document.documentElement.lang==='en');
  await page.locator('#language-button').click();await page.locator('[data-language="ko"]').click();await page.waitForFunction(()=>document.documentElement.lang==='ko');assert.equal((await page.locator('[data-category="basics"] .chapter-name').textContent()).replace(/\s+/g,' ').trim(),'기초 ↗');
  await page.goto(base);await page.waitForFunction(()=>document.documentElement.lang==='ko');
  const blocked=await browser.newContext();await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})});const p=await blocked.newPage();await p.route('**/_vercel/insights/script.js',r=>r.fulfill({body:''}));await p.goto(base+'?lang=en');await p.waitForFunction(()=>document.documentElement.lang==='en');await p.locator('#language-button').click();await p.locator('[data-language="ko"]').click();await p.waitForFunction(()=>document.documentElement.lang==='ko');await blocked.close();
  assert.deepEqual(errors,[]);console.log('PASS: language switch, persistence, blocked storage, home/help/three techniques/seven belt stages, real-mode error, mobile, and single analytics load');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
