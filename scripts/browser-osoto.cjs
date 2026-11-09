const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  fs.mkdirSync('.test-output/osoto',{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(process.env.OSOTO_LANDSCAPE==='1')await page.addInitScript(()=>{const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=constraints=>get({...constraints,video:{width:{exact:1280},height:{exact:720}}});});
  await page.addInitScript(()=>{window.qaStage=-1;const Original=Worker;window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame')d.stage=window.qaStage;super.postMessage(d,t)}}});
  await page.route('**/src/baemilgi-tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   const deps=import('./osoto-practice.js');self.onmessage=async({data})=>{
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const {OSOTO_TARGETS}=await deps,ratio=data.bitmap.height/data.bitmap.width;data.bitmap.close();
     const scale=Math.min(.16,ratio*.20),cy=ratio*.5;
     const points=data.stage<0?null:OSOTO_TARGETS[data.stage].map(p=>p?{x:.5+p.x*scale,y:(cy+p.y*scale)/ratio,z:p.z*scale,visibility:1}:{x:0,y:0,z:0,visibility:0});
     self.postMessage({type:'result',points,time:data.time});
    }
   }`}));
  const base='http://localhost:5173/dist';
  await page.goto(base+'/throws/o-soto-gari');await page.locator('#osoto-start').waitFor();
  assert.equal(await page.locator('#osoto-title').innerText(),'초기자세 오른발 앞');assert.equal(/Initial/i.test(await page.locator('#throw-screen').innerText()),false);
  await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.playing==='true');
  assert.equal(await page.locator('#osoto-3d').isVisible(),true);assert.equal(await page.locator('#osoto-canvas').isVisible(),false);const pixels=await page.locator('#osoto-3d').evaluate(c=>c.toDataURL());const first=Number(await page.locator('#osoto-canvas').getAttribute('data-time'));await page.waitForTimeout(2300);
  assert(Number(await page.locator('#osoto-canvas').getAttribute('data-time'))>first+1);assert.notEqual(await page.locator('#osoto-3d').evaluate(c=>c.toDataURL()),pixels,'animation must change the drawn pose');
  await page.locator('#osoto-demo').click();const paused=await page.locator('#osoto-canvas').getAttribute('data-time');await page.waitForTimeout(250);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-time'),paused);
  for(const view of ['front','side','oblique']){await page.locator('[data-osoto-view='+view+']').click();await page.waitForTimeout(120);assert.equal(await page.locator('[data-osoto-view='+view+']').getAttribute('aria-pressed'),'true');await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-'+view+'.png'});}
  await page.locator('#osoto-seek').fill('650');await page.waitForTimeout(150);await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-reap.png'});
  await page.locator('#osoto-solo').check();await page.waitForFunction(()=>document.querySelector('#osoto-3d').dataset.solo==='true');await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-solo.png'});
  await page.locator('#osoto-solo').uncheck();await page.locator('#osoto-seek').fill('1000');await page.waitForFunction(()=>Number(document.querySelector('#osoto-3d').dataset.time)>=2.99);await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-finish.png'});await page.locator('#osoto-speed').selectOption('0.5');
  await page.locator('#osoto-reset').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.stage==='0');
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/initial-front.png'});
  assert.equal(await page.locator('#osoto-video').evaluate(v=>getComputedStyle(v).transform),'none');
  await page.locator('#osoto-start').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.ready==='true');assert.equal(await page.locator('#osoto-3d').isVisible(),false);assert.equal(await page.locator('#osoto-canvas').isVisible(),true);
  const landscape=await page.locator('#osoto-video').evaluate(v=>v.videoWidth>v.videoHeight),initialAngle=landscape?90:0;
  await page.waitForFunction(a=>document.querySelector('#osoto-canvas').dataset.rotation===String(a),initialAngle);
  const originalAspect=Number(await page.locator('#osoto-canvas').getAttribute('data-camera-aspect'));assert(originalAspect>=1,'camera must start upright without clicking');
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/default-camera-'+(landscape?'landscape':'portrait')+'.png'});
  for(let turn=1;turn<=4;turn++){const angle=(initialAngle+turn*90)%360;await page.locator('#osoto-rotate').click();await page.waitForFunction(a=>document.querySelector('#osoto-canvas').dataset.rotation===String(a),angle);const aspect=Number(await page.locator('#osoto-canvas').getAttribute('data-camera-aspect'));assert(Math.abs(aspect-(turn%2?1/originalAspect:originalAspect))<.001);}
  await page.waitForTimeout(4500);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  for(let stage=0;stage<4;stage++){
   await page.evaluate(s=>window.qaStage=s,stage);
   await page.waitForFunction(s=>{const c=document.querySelector('#osoto-canvas');return s===3?c.dataset.done==='true':c.dataset.stage===String(s+1)},stage);
   if(stage<3){await page.waitForTimeout(2600);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),String(stage+1),'previous pose cannot skip the next stage');await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/front-'+(stage+1)+'.png'});}
  }
  assert.equal(await page.locator('#osoto-score').innerText(),'Perfect');await page.screenshot({path:'.test-output/osoto/complete.png',fullPage:true});
  await page.evaluate(()=>window.qaStage=-1);await page.locator('#osoto-reset').click();assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  await page.locator('#osoto-demo').click();await page.waitForFunction(()=>!document.querySelector('#osoto-video').srcObject&&document.querySelector('#osoto-canvas').dataset.demo==='true');assert.equal(await page.locator('#osoto-3d').isVisible(),true);
  for(const id of ['o-uchi-gari','ippon-seoi-nage']){await page.goto(base+'/throws/'+id);await page.locator('#throw-play').waitFor();assert.equal(await page.locator('#osoto-start').count(),0);await page.locator('#throw-play').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.playing==='true');}
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/throws/o-soto-gari?lang=en');await page.locator('#osoto-start').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(/[가-힣]/.test(await page.locator('#throw-screen').innerText()),false);
  await page.screenshot({path:'.test-output/osoto/mobile-en.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: synthetic pose tracking, unmirrored Initial + 3 holds; default 3D/view/seek/solo/speed; 2D webcam switch and 3D return, missing/wrong pose rejection, completion, reset/stop, other throw playback, mobile English');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
