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
     const scale=Math.min(.16,ratio*.20),cy=ratio*.5;
     const points=data.stage<0?null:OSOTO_TARGETS[data.stage].map(p=>p?{x:1-(.5+p.x*scale),y:(cy+p.y*scale)/ratio,z:p.z*scale,visibility:1}:{x:0,y:0,z:0,visibility:0});
     self.postMessage({type:'result',points,time:data.time});
    }
   }`}));
  const base='http://localhost:5173/dist';
  await page.goto(base+'/throws/o-soto-gari');await page.locator('#osoto-start').waitFor();
  await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.playing==='true');
  const pixels=await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL());const first=Number(await page.locator('#osoto-canvas').getAttribute('data-time'));await page.waitForTimeout(2300);
  assert(Number(await page.locator('#osoto-canvas').getAttribute('data-time'))>first+1);assert.notEqual(await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL()),pixels,'animation must change the drawn pose');
  await page.locator('#osoto-demo').click();const paused=await page.locator('#osoto-canvas').getAttribute('data-time');await page.waitForTimeout(250);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-time'),paused);
  await page.locator('#osoto-reset').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.stage==='0');
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/initial-front.png'});
  await page.locator('#osoto-start').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.ready==='true');
  await page.waitForTimeout(4500);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  for(let stage=0;stage<4;stage++){
   await page.evaluate(s=>window.qaStage=s,stage);
   await page.waitForFunction(s=>{const c=document.querySelector('#osoto-canvas');return s===3?c.dataset.done==='true':c.dataset.stage===String(s+1)},stage);
   if(stage<3){await page.waitForTimeout(2600);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),String(stage+1),'previous pose cannot skip the next stage');await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/front-'+(stage+1)+'.png'});}
  }
  assert.equal(await page.locator('#osoto-score').innerText(),'Perfect');await page.screenshot({path:'.test-output/osoto/complete.png',fullPage:true});
  await page.evaluate(()=>window.qaStage=-1);await page.locator('#osoto-reset').click();assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  await page.locator('#osoto-stop').click();await page.waitForFunction(()=>!document.querySelector('#osoto-video').srcObject);
  for(const id of ['o-uchi-gari','ippon-seoi-nage']){await page.goto(base+'/throws/'+id);await page.locator('#throw-play').waitFor();assert.equal(await page.locator('#osoto-start').count(),0);await page.locator('#throw-play').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.playing==='true');}
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/throws/o-soto-gari?lang=en');await page.locator('#osoto-start').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(/[가-힣]/.test(await page.locator('#throw-screen').innerText()),false);
  await page.screenshot({path:'.test-output/osoto/mobile-en.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: synthetic pose tracking, Initial + 3 ordered holds; front animation play/pause/restart, missing/wrong pose rejection, completion, reset/stop, other throw playback, mobile English');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
