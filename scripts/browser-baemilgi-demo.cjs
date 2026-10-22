const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5186/dist/';
const output='.test-output/baemilgi/demo';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:1000}}),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());});
  await page.addInitScript(()=>{window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.cameraCalls++;throw new DOMException('Denied','NotAllowedError')};});
  await page.goto(base+'basics/hindu-push-up');
  const video=page.locator('#bm-demo-video');
  await page.waitForFunction(()=>document.querySelector('#bm-demo-video')?.readyState>=2);
  assert(await page.locator('#bm-demo').isVisible());assert(await page.locator('#bm-practice').isHidden());
  assert(await video.evaluate(v=>v.paused));
  await page.screenshot({path:output+'/desktop.png',fullPage:true});
  await page.locator('#bm-demo-play').click();
  for(const time of [0,2,4,6,8,10,12,14]){
   await page.waitForFunction(t=>document.querySelector('#bm-demo-video').currentTime>=t,time);
   await video.screenshot({path:output+'/candidate-'+time+'.png'});
  }
  await page.waitForFunction(()=>document.querySelector('#bm-demo-video').ended);
  assert.equal(await page.locator('#bm-demo-play').textContent(),'시연 재생');
  await page.locator('#bm-demo-speed').selectOption('0.5');assert.equal(await video.evaluate(v=>v.playbackRate),.5);
  await page.locator('#bm-demo-restart').click();await page.waitForFunction(()=>document.querySelector('#bm-demo-video').currentTime>.2);
  await page.locator('#bm-demo-play').click();const pausedTime=await video.evaluate(v=>v.currentTime);
  await page.waitForTimeout(350);assert.equal(await video.evaluate(v=>v.currentTime),pausedTime);
  await video.evaluate(v=>new Promise(resolve=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=2;}));await page.waitForTimeout(200);
  await video.screenshot({path:output+'/seek.png'});
  assert.equal(await page.evaluate(()=>window.cameraCalls),0);assert.deepEqual(writes,[]);
  await page.locator('#bm-demo-play').click();await page.locator('#bm-show-practice').click();assert(await video.evaluate(v=>v.paused));
  assert(await page.locator('#bm-practice').isVisible());
  await page.locator('#bm-show-demo').click();await page.locator('#bm-demo-play').click();await page.locator('#bm-start').click();
  await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('권한이 거부'));
  assert(await video.evaluate(v=>v.paused));assert(await page.locator('#bm-practice').isVisible());assert(await page.locator('#bm-show-demo').isEnabled());
  await page.locator('#bm-show-demo').click();await page.locator('#bm-demo-play').click();await page.locator('#back-menu').click();assert(await video.evaluate(v=>v.paused));
  await page.goto(base+'basics/hindu-push-up?lang=en');await page.setViewportSize({width:390,height:844});
  await page.locator('#bm-demo-play').waitFor();assert.equal(await page.locator('#bm-demo-play').textContent(),'Play demo');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:output+'/mobile-en.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: complete video playback, pause, restart, speed, seek, no camera or score session from demo, camera transition, menu exit, mobile/English.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
