const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5173/dist/index.html';
(async()=>{fs.mkdirSync('.test-output',{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const kind of ['normal','legacy-canvas','stale-assets','module-failure','leave-during-load']){
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];let staleHits=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.cameraRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.cameraRequests++;throw new DOMException('Denied','NotAllowedError')}});
  if(kind==='legacy-canvas')await page.addInitScript(()=>{CanvasRenderingContext2D.prototype.roundRect=undefined});
  if(kind==='stale-assets')await page.route('**/src/*.js*',async route=>{if(!new URL(route.request().url()).searchParams.has('v')){staleHits++;await route.fulfill({contentType:'text/javascript',body:'throw new Error("Old cached module was used")'});}else await route.continue()});
  if(kind==='module-failure')await page.route('**/src/app.js*',route=>route.abort());
  if(kind==='leave-during-load')await page.route('**/src/app.js*',async route=>{await new Promise(r=>setTimeout(r,600));await route.continue()});
  await page.goto(base);await page.locator('[data-category="katame"]').click();
  if(kind==='normal'){await page.evaluate(()=>document.fonts.ready);await page.locator('.calligraphy-piece').screenshot({path:'.test-output/enso-rounded.png'});}
  await page.locator('[data-lesson="nami"]').click();assert(await page.locator('#practice-screen').isVisible());assert.equal(await page.locator('dialog[open]').count(),0);
  if(kind==='module-failure'){await page.locator('#reload-practice').waitFor({state:'visible'});await page.locator('#back-menu').click();assert(await page.locator('#home-screen').isVisible());}
  else if(kind==='leave-during-load'){await page.locator('#back-menu').click();await page.waitForTimeout(1000);assert.equal(await page.evaluate(()=>window.cameraRequests),0);assert(await page.locator('#home-screen').isVisible());await page.locator('[data-lesson="gyaku"]').click();await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);await page.locator('#start').click();await page.waitForFunction(()=>window.cameraRequests===1);}
  else{await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);assert.equal(await page.evaluate(()=>window.cameraRequests),0);await page.locator('#start').click();await page.waitForFunction(()=>window.cameraRequests===1);assert.equal(await page.locator('.pose-card').count(),3);await page.locator('#back-menu').click();await page.locator('[data-lesson="kata"]').click();await page.locator('#start').click();await page.waitForFunction(()=>window.cameraRequests===2);assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);}
  assert.equal(staleHits,0);assert.deepEqual(errors,[]);console.log(`PASS entry: ${kind}`);await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
