const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5186/dist/';
const output='.test-output/baemilgi/animation';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:1000}}),errors=[],writes=[],media=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')writes.push(r.url());if(r.resourceType()==='media'||/hindu-push-up\.(webm|jpg)/.test(r.url()))media.push(r.url());});
  await page.addInitScript(()=>{window.cameraCalls=0;navigator.mediaDevices.getUserMedia=async()=>{window.cameraCalls++;throw new DOMException('Denied','NotAllowedError')};});
  await page.goto(base+'basics/hindu-push-up');
  const canvas=page.locator('#bm-demo-canvas');
  await canvas.waitFor();assert.equal(await page.locator('#bm-demo video,#bm-demo iframe').count(),0);
  assert(await page.locator('#bm-demo').isVisible());assert(await page.locator('#bm-practice').isHidden());
  assert.equal(await canvas.getAttribute('data-playing'),'false');
  for(const t of [0,.07,.12,.2,.3,.4,.54,.64,.7,.85,.95,1]){
   await page.locator('#bm-demo-seek').fill(String(t*1000));
   await canvas.screenshot({path:output+'/pose-'+t+'.png'});
  }
  await page.locator('[data-bm-pose="300"]').click();assert(Number(await canvas.getAttribute('data-elbow'))<80);
  assert.match(await page.locator('#bm-demo-phase').textContent(),/팔꿈치 굽혀/);
  await page.screenshot({path:output+'/desktop-bent.png',fullPage:true});
  await page.locator('[data-bm-pose="540"]').click();assert(Number(await canvas.getAttribute('data-elbow'))>155);
  await page.locator('#bm-demo-restart').click();
  for(const t of [.1,.2,.3,.4,.5,.6,.7,.8,.9]){
   await page.waitForFunction(t=>Number(document.querySelector('#bm-demo-canvas').dataset.progress)>=t,t);
   await canvas.screenshot({path:output+'/playback-'+t+'.png'});
  }
  await page.waitForFunction(()=>document.querySelector('#bm-demo-canvas').dataset.progress==='1.0000');
  assert.equal(await page.locator('#bm-demo-play').textContent(),'시연 재생');
  await page.locator('#bm-demo-speed').selectOption('0.5');assert.equal(await canvas.getAttribute('data-speed'),'0.5');
  await page.locator('#bm-demo-restart').click();await page.waitForTimeout(800);
  const slow=Number(await canvas.getAttribute('data-progress'));assert(slow>.02&&slow<.13);
  await page.locator('#bm-demo-play').click();const pausedTime=await canvas.getAttribute('data-progress');
  await page.waitForTimeout(350);assert.equal(await canvas.getAttribute('data-progress'),pausedTime);
  assert.equal(await page.evaluate(()=>window.cameraCalls),0);assert.deepEqual(writes,[]);assert.deepEqual(media,[]);
  await page.locator('#bm-demo-play').click();await page.locator('#bm-show-practice').click();assert.equal(await canvas.getAttribute('data-playing'),'false');
  await page.locator('#bm-show-demo').click();await page.locator('#bm-demo-play').click();await page.locator('#bm-start').click();
  await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('권한이 거부'));
  assert.equal(await canvas.getAttribute('data-playing'),'false');assert(await page.locator('#bm-practice').isVisible());assert(await page.locator('#bm-show-demo').isEnabled());
  await page.locator('#bm-show-demo').click();await page.locator('#bm-demo-play').click();await page.locator('#back-menu').click();assert.equal(await canvas.getAttribute('data-playing'),'false');
  await page.goto(base+'basics/hindu-push-up?lang=en');await page.setViewportSize({width:390,height:844});
  await page.locator('#bm-demo-play').waitFor();assert.equal(await page.locator('#bm-demo-play').textContent(),'Play demo');
  await page.locator('[data-bm-pose="300"]').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:output+'/mobile-en.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: canvas animation with elbow flexion/extension, full playback, pause/restart/slow speed/seek, no video download, no camera or score session from demo, camera transition, menu exit, mobile/English.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
