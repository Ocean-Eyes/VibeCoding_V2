const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  fs.mkdirSync('.test-output/osoto',{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.qaStage=-1;const Original=Worker;window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame')d.stage=window.qaStage;super.postMessage(d,t)}}});
  await page.route('**/src/baemilgi-tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   const deps=import('./osoto-practice.js');self.onmessage=async({data})=>{
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const {OSOTO_TARGETS}=await deps,ratio=data.bitmap.height/data.bitmap.width;data.bitmap.close();
     const points=data.stage<0?null:OSOTO_TARGETS[data.stage].map(p=>p?{x:1-(.5+p.x*.10),y:(.30+p.y*.10)/ratio,z:0,visibility:1}:{x:0,y:0,z:0,visibility:0});
     self.postMessage({type:'result',points,time:data.time});
    }
   }`}));
  const base='http://localhost:5173/dist';
  await page.goto(base+'/throws/o-soto-gari');await page.locator('#osoto-start').waitFor();
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/guide-1.png'});
  await page.locator('#osoto-start').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.ready==='true');
  await page.waitForTimeout(4500);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  await page.evaluate(()=>window.qaStage=0);await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.stage==='1');
  await page.waitForTimeout(2600);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'1','stage 1 pose must not clear stage 2');
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/guide-2.png'});
  await page.evaluate(()=>window.qaStage=1);await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.stage==='2');
  await page.waitForTimeout(2600);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-done'),'false');
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/guide-3.png'});
  await page.evaluate(()=>window.qaStage=2);await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.done==='true');
  assert.equal(await page.locator('#osoto-score').innerText(),'Perfect');await page.screenshot({path:'.test-output/osoto/complete.png',fullPage:true});
  await page.evaluate(()=>window.qaStage=-1);await page.locator('#osoto-reset').click();assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  await page.locator('#osoto-stop').click();await page.waitForFunction(()=>!document.querySelector('#osoto-video').srcObject);
  for(const id of ['o-uchi-gari','ippon-seoi-nage']){await page.goto(base+'/throws/'+id);await page.locator('#throw-play').waitFor();assert.equal(await page.locator('#osoto-start').count(),0);await page.locator('#throw-play').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.playing==='true');}
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/throws/o-soto-gari?lang=en');await page.locator('#osoto-start').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(/[가-힣]/.test(await page.locator('#throw-screen').innerText()),false);
  await page.screenshot({path:'.test-output/osoto/mobile-en.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: synthetic pose tracking, 3 ordered holds, missing/wrong pose rejection, completion, reset/stop, other throw playback, mobile English');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
