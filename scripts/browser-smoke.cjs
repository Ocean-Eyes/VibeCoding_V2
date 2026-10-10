// Optional browser QA: node scripts/browser-smoke.cjs <path-to-playwright-package>
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
  fs.mkdirSync('.test-output',{recursive:true});
  const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{channel:'chrome'}),headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER:',m.text())});
    await page.goto('http://localhost:5173');await page.screenshot({path:'.test-output/initial.png',fullPage:true});
    assert.equal(await page.locator('.pose-card').count(),4);await page.locator('#help').click();assert.equal(await page.locator('#guide').evaluate(e=>e.open),true);await page.locator('#close-help').click();
    await page.locator('#demo').click();assert.match(await page.locator('#status').innerText(),/데모/);await page.waitForFunction(()=>document.querySelector('#score').textContent!=='—');
    await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#step-label').textContent.startsWith('02'),{},{timeout:15000});
    await page.locator('#play').click();assert.match(await page.locator('#notice').innerText(),/일시 정지/);
    await page.locator('#next').click();assert.match(await page.locator('#step-label').innerText(),/03/);
    await page.locator('#mirror').uncheck();await page.screenshot({path:'.test-output/demo.png',fullPage:true});
    await page.locator('#stop').click();assert.equal(await page.locator('#welcome').isVisible(),true);
    await page.locator('#start').click();await page.waitForFunction(()=>['카메라 연결됨','카메라 대기 중'].includes(document.querySelector('#status').textContent),{},{timeout:100000});
    console.log('CAMERA STATUS:',await page.locator('#status').innerText());console.log('NOTICE:',await page.locator('#notice').innerText());
    assert.equal(await page.locator('#status').innerText(),'카메라 연결됨');
    await page.waitForFunction(()=>parseInt(document.querySelector('#fps').textContent)>0,{},{timeout:20000});
    assert.equal(await page.locator('#score').innerText(),'—'); // fake camera has no human
    await page.locator('#stop').click();assert.equal(await page.locator('#video').evaluate(e=>e.srcObject),null);
    await page.setViewportSize({width:768,height:1024});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.test-output/tablet.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const denied=await browser.newPage();await denied.addInitScript(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied by test','NotAllowedError')}});
    await denied.goto('http://localhost:5173');await denied.locator('#start').click();await denied.waitForFunction(()=>document.querySelector('#notice').textContent.includes('거부'));
    assert.equal(await denied.locator('#welcome').isVisible(),true);assert.equal(await denied.locator('#play').isDisabled(),true);
    assert.deepEqual(errors,[]);console.log('Browser smoke passed: demo, sequence, controls, worker/model inference, missing-person scores, cleanup, layouts, denied permission.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
