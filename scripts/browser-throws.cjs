const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5174/dist',dir='.test-output/throw-ui';
(async()=>{
 fs.mkdirSync(dir,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   localStorage.setItem('just-judo-visitor-excluded','1');window.qaMissing=false;window.qaDenied=false;window.qaDelay=false;window.qaPhoneCancel=false;window.qaWorkers=new Set();
   const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{if(window.qaDenied)throw new DOMException('Denied','NotAllowedError');if(window.qaDelay)await new Promise(r=>window.qaResolve=r);return window.qaStream=await get(options)};
   const Original=Worker;window.Worker=class extends Original{
    constructor(...args){super(...args);window.qaWorkers.add(this)}
    postMessage(d,t){if(d.type==='frame'){d.missing=window.qaMissing;d.id=location.pathname.split('/').pop();}super.postMessage(d,t)}
    terminate(){window.qaWorkers.delete(this);super.terminate()}
   };
  });
  await page.route('**/src/baemilgi-tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   self.onmessage=async({data})=>{
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const {throwGuidePose}=await import('./throw-guide.js'),{sampleThrow}=await import('./throw-motion.js');
     const ratio=data.bitmap.height/data.bitmap.width;data.bitmap.close();
     const points=data.missing?null:throwGuidePose(sampleThrow(data.id,0).tori).map(p=>p?{x:.5+p.x*.15,y:(ratio*.5+p.y*.15)/ratio,z:p.z*.15,visibility:1}:null);
     self.postMessage({type:'result',points,time:data.time});
    }
   }`}));
  // Check phone button wiring and cancellation separately from WebRTC transport.
  await page.route('**/src/phone-camera-host.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   export async function connectPhoneCamera(options){window.qaPhoneOrientation=options.orientation;return window.qaPhoneCancel?null:navigator.mediaDevices.getUserMedia({video:true,audio:false})}
   export function cancelPhoneCamera(){}
   export function releaseCamera(stream){stream?.getTracks().forEach(t=>t.stop())}
   export function onCameraEnded(stream,fn){stream.getVideoTracks()[0].addEventListener('ended',fn)}
  `}));
  const metrics={};
  for(const id of ['o-soto-gari','o-uchi-gari','ippon-seoi-nage']){
   await page.goto(base+'/throws/'+id);await page.locator('.throw-lesson-stage').waitFor();
   const stage=await page.locator('.throw-lesson-stage').boundingBox(),coach=await page.locator('.throw-lesson-coach').boundingBox();
   metrics[id]={stageWidth:stage.width,stageHeight:stage.height,coachWidth:coach.width,gap:coach.x-stage.x-stage.width};
   assert(Math.abs(stage.width/stage.height-4/3)<.01);assert.equal(coach.width,300);
  }
  assert.deepEqual(metrics['o-uchi-gari'],metrics['o-soto-gari']);assert.deepEqual(metrics['ippon-seoi-nage'],metrics['o-soto-gari']);
  for(const id of ['o-uchi-gari','ippon-seoi-nage']){
   await page.goto(base+'/throws/'+id);await page.waitForFunction(()=>document.querySelector('#throw-canvas')?.dataset.playing==='true');
   const first=Number(await page.locator('#throw-canvas').getAttribute('data-elapsed'));await page.waitForTimeout(250);assert(Number(await page.locator('#throw-canvas').getAttribute('data-elapsed'))>first);
   assert.equal(await page.locator('#throw-solo').isChecked(),false);assert.equal(await page.locator('#throw-status,.throw-camera-panel,.throw-legend').count(),0);
   await page.locator('#throw-play').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.playing==='false');
   const paused=await page.locator('#throw-canvas').getAttribute('data-elapsed');await page.waitForTimeout(180);assert.equal(await page.locator('#throw-canvas').getAttribute('data-elapsed'),paused);
   for(const view of ['front','side','oblique']){
    await page.locator('[data-throw-view='+view+']').click();
    for(const seek of ['0','350','650','1000']){
     await page.locator('#throw-seek').fill(seek);await page.waitForFunction(v=>Math.abs(Number(document.querySelector('#throw-canvas').dataset.progress)-v/1000)<.001,Number(seek));
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const unchanged=await page.evaluate(async({id,view})=>{
      const {sampleThrow}=await import('/dist/src/throw-motion.js'),{createThrowRenderer}=await import('/dist/src/throw-render.js');
      const {throwTimeAtElapsed,THROW_DURATION}=await import('/dist/src/throw-playback.js');
      const actual=document.querySelector('#throw-canvas'),time=throwTimeAtElapsed(Number(document.querySelector('#throw-seek').value)/1000*THROW_DURATION),box=actual.getBoundingClientRect(),reference=document.createElement('canvas');
      reference.style=`position:absolute;left:-10000px;width:${box.width}px;height:${box.height}px`;document.body.append(reference);
      const renderer=createThrowRenderer(reference);renderer.draw(sampleThrow(id,time),{yaw:{front:0,side:Math.PI/2,oblique:1.05}[view],pitch:.22,solo:false,gold:true});
      const matches=actual.toDataURL()===reference.toDataURL();renderer.dispose();reference.remove();return matches;
     },{id,view});assert.equal(unchanged,true,'original paired animation geometry and handedness preserved');
    }
   }
   await page.locator('#throw-solo').check();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.solo==='true');await page.locator('#throw-solo').uncheck();
   await page.locator('#throw-speed').selectOption('0.5');await page.locator('#throw-restart').click();await page.waitForFunction(()=>Number(document.querySelector('#throw-canvas').dataset.progress)<.1);await page.screenshot({path:dir+'/'+id+'-desktop.png',fullPage:true});
   await page.locator('#throw-speed').selectOption('1');await page.locator('#throw-seek').fill('995');await page.locator('#throw-play').click();await page.waitForFunction(()=>Number(document.querySelector('#throw-canvas').dataset.progress)<.1);assert.equal(await page.locator('#throw-canvas').getAttribute('data-playing'),'true','demo loops like osoto');
   await page.locator('#throw-start').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.ready==='true');
   await page.waitForFunction(()=>document.querySelector('#throw-guide').dataset.tracked==='true'&&document.querySelector('#throw-tracking').dataset.tracked==='true');
   assert.equal(await page.locator('#throw-canvas').isVisible(),false);assert.equal(await page.locator('#throw-video').isVisible(),true);
   assert.equal(await page.locator('#throw-video').evaluate(v=>getComputedStyle(v).objectFit),'contain');
   for(const target of ['throw-video','throw-tracking'])assert.equal(await page.locator('#'+target).evaluate(v=>getComputedStyle(v).transform),'matrix(-1, 0, 0, 1, 0, 0)');
   const corner=await page.locator('#throw-target').boundingBox(),box=await page.locator('.throw-lesson-stage').boundingBox();assert(corner.x>box.x+box.width*.3&&corner.y>box.y+box.height*.5);
   const colors=await page.locator('#throw-guide').evaluate(c=>{
    const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data,n={goldLeft:0,goldRight:0,blueLeft:0,blueRight:0};
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4,s=x<c.width/2?'Left':'Right';if(rgba[i]===214&&rgba[i+1]===162&&rgba[i+2]===77)n['gold'+s]++;if(rgba[i]===110&&rgba[i+1]===188&&rgba[i+2]===229)n['blue'+s]++;}return n;
   });assert(colors.goldLeft>100&&colors.blueRight>100);assert.equal(colors.goldRight,0);assert.equal(colors.blueLeft,0);
   await page.locator('.throw-lesson-stage').screenshot({path:dir+'/'+id+'-camera.png'});
   const target=await page.locator('#throw-guide').evaluate(c=>c.toDataURL());await page.locator('#throw-seek').fill('650');await page.waitForTimeout(150);assert.notEqual(await page.locator('#throw-guide').evaluate(c=>c.toDataURL()),target,'timeline changes the correct technique reference during camera use');
   await page.evaluate(()=>window.qaMissing=true);await page.waitForFunction(()=>document.querySelector('#throw-guide').dataset.tracked==='false'&&document.querySelector('#throw-tracking').dataset.tracked==='false');
   await page.evaluate(()=>window.qaMissing=false);await page.waitForFunction(()=>document.querySelector('#throw-guide').dataset.tracked==='true');
   await page.locator('#throw-camera-stop').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.demo==='true');assert.equal(await page.evaluate(()=>window.qaStream.getTracks().every(t=>t.readyState==='ended')&&window.qaWorkers.size===0),true);
   await page.evaluate(()=>window.qaPhoneCancel=true);await page.locator('#throw-phone').click();await page.waitForFunction(()=>!document.querySelector('#throw-phone').disabled);assert.equal(await page.locator('#throw-canvas').isVisible(),true);
   await page.evaluate(()=>window.qaPhoneCancel=false);await page.locator('#throw-phone').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.ready==='true');assert.equal(await page.evaluate(()=>window.qaPhoneOrientation),'portrait');
   await page.locator('#throw-play').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.demo==='true');assert.equal(await page.evaluate(()=>window.qaStream.getTracks().every(t=>t.readyState==='ended')&&window.qaWorkers.size===0),true);
   await page.evaluate(()=>window.qaDenied=true);await page.locator('#throw-start').click();await page.waitForFunction(()=>!document.querySelector('#throw-start').disabled);assert.equal(await page.locator('#throw-canvas').isVisible(),true);assert((await page.locator('#throw-camera-status').innerText()).length>0);
   await page.evaluate(()=>{window.qaDenied=false;window.qaDelay=true});await page.locator('#throw-start').click();await page.waitForFunction(()=>!!window.qaResolve);await page.locator('#throw-camera-stop').click();await page.evaluate(()=>window.qaResolve());await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.qaStream.getTracks().every(t=>t.readyState==='ended')&&window.qaWorkers.size===0),true,'cancelled getUserMedia releases late stream');
   await page.evaluate(()=>window.qaDelay=false);await page.locator('#throw-start').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.ready==='true');assert.equal(await page.evaluate(()=>{document.dispatchEvent(new Event('judo-exit'));return window.qaStream.getTracks().every(t=>t.readyState==='ended')&&window.qaWorkers.size===0}),true,'lesson exit releases camera and worker');await page.locator('#brand-home').click();await page.locator('.main-menu').waitFor();
  }
  for(const width of [390,768,1024])for(const id of ['o-soto-gari','o-uchi-gari','ippon-seoi-nage']){
   await page.setViewportSize({width,height:844});await page.goto(base+'/throws/'+id+'?lang=en');await page.locator('.throw-lesson-stage').waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');assert.equal(/[\uac00-\ud7a3]/.test(await page.locator('#throw-screen').innerText()),false);
   if(width===390)await page.screenshot({path:dir+'/'+id+'-mobile-en.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);fs.writeFileSync(dir+'/result.json',JSON.stringify({metrics,errors,pairedDemoFrames:24},null,2));console.log('PASS: shared layout across all three throws; 24 original paired demo frames; playback, views, solo, timeline, webcam/phone wiring, gold/blue guides, tracking loss, cancellation, permission denial, cleanup; 9 responsive English pages. Synthetic camera/landmarks, not a physical phone test.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
