
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>{
   navigator.mediaDevices.getUserMedia=async constraints=>{
    window.captureRequest=constraints;
    const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
    const ctx=canvas.getContext('2d');setInterval(()=>{ctx.fillStyle='blue';ctx.fillRect(0,0,1280,720)},33);
    return canvas.captureStream(30);
   };
  });
  let joins=0;
  await page.route('**/api/phone-camera',route=>{if(route.request().postDataJSON()?.action==='join')joins++;return route.fulfill({json:{}})});
  await page.goto('http://localhost:5186/dist/phone-camera?orientation=portrait&lang=en#room='+ 'a'.repeat(24)+'&key='+'b'.repeat(32));
  await page.locator('#phone-start').click();
  await page.waitForFunction(()=>document.querySelector('#phone-start').disabled===false);
  assert.equal(await page.evaluate(()=>window.captureRequest.video.aspectRatio.exact),9/16);
  assert.equal(joins,0,'a landscape result must not be accepted as portrait or transmitted');
  assert.equal(await page.locator('#phone-preview-video').isHidden(),true);
  assert.equal(await page.locator('#phone-status').evaluate(e=>e.textContent.includes('portrait')),true);
  console.log('PASS: portrait requires 9:16; ignored constraints do not silently connect a landscape camera');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});

