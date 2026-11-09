
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
  await page.route('**/api/phone-camera',route=>{if(route.request().postDataJSON()?.action==='join')joins++;return route.fulfill({status:410,json:{error:'expired'}})});
  await page.goto('http://localhost:5186/dist/phone-camera?orientation=portrait&lang=en#room='+ 'a'.repeat(24)+'&key='+'b'.repeat(32));
  await page.locator('#phone-start').click();
  await page.waitForFunction(()=>document.querySelector('#phone-status').textContent.includes('QR connection ended'));
  for(const key of ['width','height','aspectRatio'])assert.equal(await page.evaluate(key=>window.captureRequest.video[key],key),undefined);
  assert.equal(joins,1,'native landscape frames must not block a portrait connection');
  assert.equal(await page.locator('#phone-preview-video').isHidden(),true);
  assert.equal(await page.locator('#phone-status').evaluate(e=>e.textContent.includes('portrait')),false);
  console.log('PASS: portrait UI accepts native camera dimensions without imposing sensor aspect constraints');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});


