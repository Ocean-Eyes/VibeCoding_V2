const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://127.0.0.1:5186/dist/';
const screens=[
 {id:'belt-virtual',path:'basics/belt',video:'#belt-video',start:'#belt-camera',resume:'#belt-resume-video',notice:'#belt-notice',belt:true},
 {id:'belt-real',path:'basics/belt',video:'#belt-video',start:'#belt-camera',resume:'#belt-resume-video',notice:'#belt-notice',belt:true,real:true},
 ...['nami','gyaku','kata'].map(id=>({id,path:`katame-waza/shime-waza/${id}-juji-jime`,video:'#video',start:'#play',resume:'#resume-video',notice:'#notice',retry:'#retry-tracking'})),
 {id:'baemilgi',path:'basics/hindu-push-up',video:'#bm-video',start:'#bm-start',resume:'#bm-resume-video',notice:'#bm-notice',retry:'#bm-retry-tracking'},
];
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 fs.mkdirSync('.test-output/mobile-cameras',{recursive:true});let count=0;
 try{
  for(const profile of [{id:'iphone',width:440,height:956},{id:'android',width:412,height:915}]){
   const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   for(const mode of ['normal','blocked','denied','late','fallback'])for(const screen of screens){
    if(mode==='fallback'&&screen.belt)continue;
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/baemilgi*',route=>route.fulfill({json:route.request().method()==='POST'?{token:'mobile-camera-test'}:{entries:[]}}));
    await page.route('**/practice-model.js*',route=>route.fulfill({contentType:'text/javascript',body:`export async function createPracticeModels(){window.qaFallback=true;return {pose:{detectForVideo:()=>({landmarks:[]})},hand:{detectForVideo:()=>({landmarks:[]})},close(){}};}`}));
    await page.route('**/baemilgi-model.js*',route=>route.fulfill({contentType:'text/javascript',body:`export async function createPoseModel(){window.qaFallback=true;return {detectForVideo:()=>({landmarks:[]}),close(){}};}`}));
    await page.addInitScript(mode=>{
     window.qaStreams=[];window.qaRequests=[];window.qaTrackingError=false;
     const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
     navigator.mediaDevices.getUserMedia=async constraints=>{
      window.qaRequests.push(constraints);if(mode==='denied')throw new DOMException('Denied','NotAllowedError');
      if(mode==='late')await new Promise(resolve=>window.qaGrant=resolve);
      const stream=await acquire(constraints);window.qaStreams.push(stream);return stream;
     };
     const play=HTMLMediaElement.prototype.play;let blocked=false;
     HTMLMediaElement.prototype.play=function(){
      if(['video','belt-video','bm-video'].includes(this.id)){
       if(this.hidden||!this.muted||!this.playsInline)throw Error('Invalid mobile video setup');
       if(mode==='blocked'&&!blocked){blocked=true;return Promise.reject(new DOMException('Tap required','NotAllowedError'));}
      }
      return play.call(this);
     };
     const NativeWorker=Worker;
     window.Worker=class {
      constructor(url,options){if(!String(url).includes('tracker.js'))return new NativeWorker(url,options);this.stopped=false;}
      postMessage(data){
       if(this.stopped)return;
       if(data.type==='init')setTimeout(()=>{if(!this.stopped)this.onmessage?.({data:{type:mode==='fallback'?'error':'ready'}})},0);
       if(data.type==='frame'){data.bitmap.close();setTimeout(()=>{if(!this.stopped)this.onmessage?.({data:window.qaTrackingError?{type:'error',code:'tracking',detail:'test failure'}:{type:'result',points:null,hands:[],time:data.time}})},0);}
      }
      terminate(){this.stopped=true;}
     };
    },mode);
    await page.goto(base+screen.path);
    if(screen.belt){await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');if(screen.real)await page.locator('#belt-mode-real').click();}
    else if(screen.id!=='baemilgi')await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
    assert.equal(await page.evaluate(()=>window.qaRequests.length),0,'opening a screen does not activate a camera');
    await page.locator(screen.start).click();
    if(mode==='denied'){
     await page.waitForFunction(selector=>document.querySelector(selector).textContent.includes('거부'),screen.notice);
     assert(await page.locator(screen.video).isHidden());assert(await page.locator(screen.start).isEnabled());
    }else if(mode==='late'){
     await page.waitForFunction(()=>typeof window.qaGrant==='function');await page.locator('#back-menu').click();await page.evaluate(()=>window.qaGrant());
     await page.waitForFunction(()=>window.qaStreams.length>0&&window.qaStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
     assert(await page.locator(screen.video).isHidden());
    }else{
     if(mode==='blocked'){
      await page.locator(screen.resume).waitFor({state:'visible'});assert(await page.locator(screen.video).isVisible());
      assert(await page.evaluate(()=>window.qaStreams.at(-1).getTracks().every(track=>track.readyState==='live')));
      assert.doesNotMatch(await page.locator(screen.notice).textContent(),/권한이 거부/);await page.locator(screen.resume).click();
     }
     if(screen.belt)await page.waitForFunction(()=>document.querySelector('#belt-video').readyState>=2&&!document.querySelector('#belt-video').hidden);
     else if(screen.id==='baemilgi')await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('공용 도전 준비 완료'));
     else await page.waitForFunction(()=>document.querySelector('#status').textContent==='카메라 연결됨');
     assert(await page.locator(screen.video).isVisible());assert(await page.evaluate(()=>window.qaRequests.every(request=>request.audio===false)));
     if(mode==='fallback')assert(await page.evaluate(()=>window.qaFallback));
     if(mode==='normal'&&screen.retry){
      const requests=await page.evaluate(()=>window.qaRequests.length);await page.evaluate(()=>window.qaTrackingError=true);await page.locator(screen.retry).waitFor({state:'visible'});
      assert(await page.locator(screen.video).isVisible());assert(await page.evaluate(()=>window.qaStreams.at(-1).getTracks().every(track=>track.readyState==='live')));
      await page.evaluate(()=>window.qaTrackingError=false);await page.locator(screen.retry).click();
      if(screen.id==='baemilgi')await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('공용 도전 준비 완료'));
      else await page.waitForFunction(()=>document.querySelector('#status').textContent==='카메라 연결됨');
      assert.equal(await page.evaluate(()=>window.qaRequests.length),requests,'tracking retry reuses capture');
     }
     if(mode==='normal'){
      await page.locator(screen.video).scrollIntoViewIfNeeded();await page.screenshot({path:`.test-output/mobile-cameras/${profile.id}-${screen.id}.png`});
      await page.setViewportSize({width:profile.height,height:profile.width});assert(await page.locator(screen.video).isVisible());
     }
     await page.locator('#back-menu').click();
     assert(await page.evaluate(()=>window.qaStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
    }
    assert.deepEqual(errors,[]);await page.close();console.log(`PASS: ${profile.id} / ${screen.id} / ${mode}`);count++;
   }
   await context.close();
  }
  console.log(`PASS: ${count} mobile camera scenarios (simulated devices; not a physical iPhone/Android test).`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
