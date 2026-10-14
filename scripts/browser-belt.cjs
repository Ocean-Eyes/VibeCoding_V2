const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR:',e.message)});
  await page.addInitScript(()=>{window.qaStreams=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async c=>{const stream=await get(c);window.qaStreams.push(stream);return stream}});
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="basics"]').click();
  assert.equal(await page.getByText('도복 입는 법',{exact:true}).count(),0);
  assert.equal(await page.locator('.lesson-card').count(),2);
  await page.locator('[data-lesson="belt"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-belt-step]').length===7&&document.querySelector('#belt-canvas').dataset.sourceState==='ready');
  assert.equal(await page.evaluate(()=>window.qaStreams.length),0,'opening lesson does not request camera');
  for(let step=0;step<7;step++){
   await page.locator(`[data-belt-step="${step}"]`).click();
   await page.waitForFunction(s=>document.querySelector('#belt-canvas').dataset.step===String(s),step).catch(async e=>{console.error('Failed stage',step,await page.locator('#belt-canvas').getAttribute('data-step'));throw e});
   assert.equal(await page.locator('[data-belt-step][aria-current="step"]').count(),1);
   await page.locator('#belt-screen').screenshot({path:`.test-output/belt-step-${step}.png`});
  }
  assert.equal(await page.locator('#belt-next').isDisabled(),true);
  await page.locator('[data-belt-step="3"]').click();
  for(const view of ['front']){
   await page.locator(`[data-belt-view="${view}"]`).click();await page.waitForFunction(v=>document.querySelector('#belt-detail').dataset.view===v,view);
   assert.equal(await page.locator('[data-belt-view][aria-pressed="true"]').count(),1);
   await page.locator('#belt-detail').screenshot({path:`.test-output/belt-depth-${view}.png`});
  }
  for(const value of ['0','25','50','75','100']){
   await page.locator('#belt-scrub').fill(value);await page.waitForTimeout(50);
   const phase=Number(await page.locator('#belt-canvas').getAttribute('data-phase'));assert.ok(phase>=2&&phase<=3);assert.ok((await page.locator('#belt-play').textContent()).includes('이 단계'));
   await page.locator('#belt-canvas').screenshot({path:`.test-output/belt-thread-${value}.png`});
  }
  await page.locator('#belt-restart').click();await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.step==='0');
  await page.locator('#belt-play').click();
  await page.locator('#belt-camera').click();
  await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.mode==='camera'&&!document.querySelector('#belt-video').hidden);
  await page.locator('[data-belt-step="3"]').click();
  const before=JSON.parse(await page.locator('#belt-canvas').getAttribute('data-anchor'));
  await page.locator('#belt-height').fill('30');await page.locator('#belt-width').fill('12');await page.waitForTimeout(100);
  const after=JSON.parse(await page.locator('#belt-canvas').getAttribute('data-anchor'));assert.ok(after.y<before.y&&after.scale<before.scale);
  await page.locator('#belt-mirror').uncheck();await page.waitForTimeout(100);assert.equal(await page.locator('#belt-video').evaluate(v=>v.style.transform),'none');
  await page.locator('#belt-align-reset').click();assert.equal(await page.locator('#belt-height').inputValue(),'36');assert.equal(await page.locator('#belt-width').inputValue(),'14');
  await page.locator('#belt-screen').screenshot({path:'.test-output/belt-camera.png'});
  await page.locator('#back-menu').click();assert.ok(await page.locator('#home-screen').isVisible());
  assert.equal(await page.evaluate(()=>window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))),true,'leaving releases camera');
  await page.locator('[data-lesson="belt"]').click();await page.locator('[data-belt-step="5"]').click();
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no mobile horizontal overflow');
  await page.locator('#belt-screen').screenshot({path:'.test-output/belt-mobile.png'});
  await page.locator('#back-menu').click();await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);assert.ok(await page.locator('#practice-screen').isVisible());assert.ok(await page.locator('#belt-screen').isHidden());
  assert.deepEqual(errors,[]);console.log('PASS Belt: seven stages, demo, camera overlay, manual alignment, mirroring, camera cleanup, mobile and return to existing judo practice.');
  // Denied permission is recoverable, and a late camera grant cannot survive leaving.
  for(const mode of ['denied','late']){
   const p=await browser.newPage();await p.addInitScript(mode=>{window.qaStopped=false;navigator.mediaDevices.getUserMedia=()=>mode==='denied'?Promise.reject(new DOMException('denied','NotAllowedError')):new Promise(resolve=>window.qaResolve=()=>resolve({getTracks:()=>[{stop:()=>window.qaStopped=true}]}))},mode);
   await p.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');await p.locator('[data-category="basics"]').click();await p.locator('[data-lesson="belt"]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-belt-step]').length===7&&document.querySelector('#belt-canvas').dataset.sourceState==='ready');await p.locator('#belt-camera').click();
   if(mode==='denied'){await p.waitForFunction(()=>document.querySelector('#belt-notice').textContent.includes('거부'));assert.equal(await p.locator('#belt-camera').isDisabled(),false)}
   else{await p.locator('#back-menu').click();await p.evaluate(()=>window.qaResolve());await p.waitForFunction(()=>window.qaStopped);assert.ok(await p.locator('#home-screen').isVisible())}
   await p.close();
  }
  console.log('PASS camera denial and cancellation during pending permission.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
