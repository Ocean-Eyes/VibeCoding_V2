const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.beltTest={a:.25,b:.75,hideA:false,streams:[]};
   navigator.mediaDevices.getUserMedia=async()=>{
    const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');
    function draw(){ctx.fillStyle='#555';ctx.fillRect(0,0,640,480);if(!window.beltTest.hideA){ctx.fillStyle='rgb(20,80,240)';ctx.fillRect(window.beltTest.a*640-18,294,36,36)}ctx.fillStyle='rgb(240,30,150)';ctx.fillRect(window.beltTest.b*640-18,294,36,36);requestAnimationFrame(draw)}draw();
    const stream=c.captureStream(30);window.beltTest.streams.push(stream);return stream;
   };
  });
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');await page.locator('[data-category="basics"]').click();await page.locator('[data-lesson="belt"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-belt-step]').length===7&&document.querySelector('#belt-canvas').dataset.sourceState==='ready');
  await page.locator('#belt-mode-real').click();assert.equal(await page.locator('#belt-mode-real').getAttribute('aria-pressed'),'true');assert.ok(await page.locator('#belt-real-empty').isVisible());assert.ok(await page.locator('#belt-register-a').isDisabled());
  await page.locator('#belt-camera').click();await page.waitForFunction(()=>!document.querySelector('#belt-register-a').disabled);
  async function pick(key,x){await page.locator('#belt-register-'+key).click();await page.locator('#belt-canvas').click({position:await page.locator('#belt-canvas').evaluate((c,x)=>({x:c.clientWidth*x,y:c.clientHeight*.65}),x)})}
  // Mirrored video: blue A appears on the right and pink B on the left.
  await pick('a',.75);await page.waitForFunction(()=>document.querySelector('#belt-track-a').textContent==='추적 중');
  await pick('b',.75);assert.ok((await page.locator('#belt-notice').textContent()).includes('다른 색'));
  await page.locator('#belt-canvas').click({position:await page.locator('#belt-canvas').evaluate(c=>({x:c.clientWidth*.25,y:c.clientHeight*.65}))});
  await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.tracks==='tracked,tracked');
  await page.locator('[data-belt-step="2"]').click();await page.locator('#belt-screen').screenshot({path:'.test-output/belt-real.png'});
  await page.evaluate(()=>window.beltTest.hideA=true);await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.tracks==='occluded,tracked');
  await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.tracks==='searching,tracked');assert.equal(await page.locator('#belt-canvas').getAttribute('data-step'),'2');
  await page.evaluate(()=>window.beltTest.hideA=false);await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.tracks==='tracked,tracked');
  await page.locator('#belt-play').click();await page.waitForFunction(()=>document.querySelector('#belt-play').textContent.includes('이 단계'),{},{timeout:10000});assert.equal(await page.locator('#belt-canvas').getAttribute('data-step'),'2','real mode demo never advances user stage');
  await page.locator('#belt-mirror').uncheck();await page.locator('#belt-clear-colors').click();await pick('a',.25);await pick('b',.75);await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.tracks==='tracked,tracked');
  await page.locator('#belt-mode-virtual').click();assert.ok(await page.locator('#belt-tracking').isHidden());assert.equal(await page.evaluate(()=>window.beltTest.streams.length),1,'switch retains existing camera');
  await page.locator('#belt-mode-real').click();await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.tracks==='tracked,tracked');
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#belt-screen').screenshot({path:'.test-output/belt-real-mobile.png'});
  await page.locator('#belt-camera').click();assert.ok(await page.locator('#belt-real-empty').isVisible());assert.ok(await page.locator('#belt-register-a').isDisabled());assert.ok(await page.evaluate(()=>window.beltTest.streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  await page.locator('#back-menu').click();assert.deepEqual(errors,[]);
  console.log('PASS real belt: synthetic camera color calibration, duplicate rejection, both mirror modes, tracking, occlusion/loss/recovery, manual progression, mode switching, mobile and camera cleanup.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
