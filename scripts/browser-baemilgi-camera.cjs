const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://127.0.0.1:5186/dist/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 fs.mkdirSync('.test-output/baemilgi-camera',{recursive:true});
 try{
  for(const mode of ['auto','fallback','manual','front','zoom-unavailable','cancel','playback-blocked','playback-cancel','worker-fallback','worker-unavailable','tracking-retry','fallback-cancel']){
   const page=await browser.newPage({viewport:{width:1365,height:1000}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/baemilgi*',route=>route.fulfill({json:route.request().method()==='POST'?{token:'camera-test'}:{entries:[]}}));
   await page.route('**/baemilgi-model.js*',route=>route.fulfill({contentType:'text/javascript',body:`export async function createPoseModel(){window.qaModels=(window.qaModels||0)+1;if(window.qaMode==='fallback-cancel')await new Promise(resolve=>window.qaReleaseModel=resolve);return {detectForVideo:()=>({landmarks:[]}),close(){window.qaClosedModels=(window.qaClosedModels||0)+1;}};}`}));
   await page.addInitScript(mode=>{
    window.qaMode=mode;window.qaRequests=[];window.qaStreams=[];window.qaZooms=[];window.qaWorkers=0;
    const play=HTMLMediaElement.prototype.play;let blocked=false;
    HTMLMediaElement.prototype.play=function(){
     if(this.id==='bm-video'){
      if(this.hidden||!this.muted||!this.playsInline)throw Error('Camera video must be visible, muted and inline before playback');
      if((mode==='playback-blocked'||mode==='playback-cancel')&&!blocked){blocked=true;return Promise.reject(new DOMException('Tap required','NotAllowedError'));}
     }
     return play.call(this);
    };
    if(mode==='worker-unavailable')Object.defineProperty(window,'OffscreenCanvas',{value:undefined});
    const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.enumerateDevices=async()=>[
     {kind:'videoinput',deviceId:'front-lens',label:'Front Ultra Wide Camera'},
     {kind:'videoinput',deviceId:'wide',label:'Back Wide Camera'},
     {kind:'videoinput',deviceId:'ultra',label:'Back Ultra Wide Camera'},
    ];
    navigator.mediaDevices.getUserMedia=async constraints=>{
     window.qaRequests.push(constraints);
     const device=constraints.video.deviceId?.exact||(constraints.video.facingMode?.ideal==='user'?'front-lens':'wide');
     if(mode==='cancel'&&device==='ultra')await new Promise(resolve=>window.qaReleaseWide=resolve);
     if(mode==='fallback'&&device==='ultra')throw new DOMException('Lens unavailable','OverconstrainedError');
     if(window.qaStreams.some(s=>s.getTracks().some(t=>t.readyState==='live')))throw Error('Previous camera was not released');
     // Real Chrome fake-device stream; only lens metadata and zoom are simulated.
     const stream=await original({audio:false,video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}});
     const track=stream.getVideoTracks()[0],settings=track.getSettings.bind(track);
     track.getSettings=()=>({...settings(),deviceId:device});
     track.getCapabilities=()=>mode==='zoom-unavailable'?{}:{zoom:{min:.5,max:4}};
     track.getConstraints=()=>constraints.video;
     track.applyConstraints=async value=>{window.qaZooms.push(value);};
     window.qaStreams.push(stream);return stream;
    };
    const OriginalWorker=Worker;
    window.Worker=class {
     constructor(url,options){if(!String(url).includes('baemilgi-tracker'))return new OriginalWorker(url,options);window.qaWorkers++;this.stopped=false;}
     postMessage(data){
      if(this.stopped)return;
      if(data.type==='init')setTimeout(()=>this.onmessage?.({data:{type:mode==='worker-fallback'||mode==='fallback-cancel'?'error':'ready'}}),0);
      if(data.type==='frame'){data.bitmap.close();setTimeout(()=>{if(!this.stopped)this.onmessage?.({data:window.qaTrackingError?{type:'error'}:{type:'result',points:null,time:data.time}})},0);}
     }
     terminate(){this.stopped=true;}
    };
   },mode);
   await page.goto(base+'basics/hindu-push-up');
   await page.locator('#bm-camera-select option[value="ultra"]').waitFor({state:'attached'});
   assert.equal(await page.evaluate(()=>window.qaStreams.length),0,'selecting a camera does not start capture');
   if(mode==='manual')await page.locator('#bm-camera-select').selectOption('front-lens');
   if(mode==='front')await page.locator('#bm-camera-select').selectOption('user');
   await page.locator('#bm-start').click();
   if(mode==='playback-blocked'||mode==='playback-cancel'){
    await page.locator('#bm-resume-video').waitFor({state:'visible'});
    assert(await page.locator('#bm-video').isVisible());assert.equal(await page.evaluate(()=>window.qaWorkers),0);
    assert(await page.evaluate(()=>window.qaStreams.at(-1).getTracks().every(t=>t.readyState==='live')));
    assert.doesNotMatch(await page.locator('#bm-notice').textContent(),/권한이 거부/);
    if(mode==='playback-cancel'){
     await page.locator('#bm-cancel').click();assert(await page.locator('#bm-resume-video').isHidden());
     assert(await page.evaluate(()=>window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
     assert(await page.locator('#bm-camera-select').isEnabled());await page.close();console.log(`PASS: ${mode}`);continue;
    }
    await page.locator('#bm-resume-video').click();
   }
   if(mode==='fallback-cancel'){
    await page.waitForFunction(()=>typeof window.qaReleaseModel==='function');await page.locator('#bm-cancel').click();await page.evaluate(()=>window.qaReleaseModel());
    await page.waitForFunction(()=>window.qaClosedModels===1);assert(await page.locator('#bm-video').isHidden());
    assert(await page.evaluate(()=>window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
    assert.deepEqual(errors,[]);await page.close();console.log(`PASS: ${mode}`);continue;
   }
   if(mode==='cancel'){
    await page.waitForFunction(()=>typeof window.qaReleaseWide==='function');
    assert(await page.locator('#bm-camera-select').isDisabled());
    await page.locator('#bm-cancel').click();await page.evaluate(()=>window.qaReleaseWide());
    await page.waitForFunction(()=>window.qaStreams.length===2&&window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')));
    assert.equal(await page.evaluate(()=>window.qaWorkers),0);
    assert(await page.locator('#bm-start').isEnabled());assert(await page.locator('#bm-camera-select').isEnabled());
    assert(await page.locator('#bm-video').isHidden());
   }else{
    await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('공용 도전 준비 완료'));
    assert(await page.locator('#bm-camera-select').isDisabled());assert(await page.locator('#bm-video').isVisible());
    const state=await page.evaluate(()=>({requests:window.qaRequests,zooms:window.qaZooms,device:document.querySelector('#bm-video').srcObject.getVideoTracks()[0].getSettings().deviceId}));
    const manual=mode==='manual'||mode==='front';
    assert.equal(state.requests.length,mode==='fallback'?3:manual?1:2);
    assert.equal(state.device,manual?'front-lens':mode==='fallback'?'wide':'ultra');
    assert(state.requests.every(request=>request.audio===false));
    if(!manual)assert.deepEqual(state.requests[0].video.facingMode,{ideal:'environment'});
    assert.equal(state.zooms.length,mode==='zoom-unavailable'?0:1);
    if(state.zooms.length){assert.equal(state.zooms[0].advanced.at(-1).zoom,.5);assert.deepEqual(state.zooms[0].frameRate,{ideal:30,max:30});}
    if(mode==='worker-fallback'||mode==='worker-unavailable')assert.equal(await page.evaluate(()=>window.qaModels),1);
    if(mode==='tracking-retry'){
     await page.evaluate(()=>window.qaTrackingError=true);await page.locator('#bm-retry-tracking').waitFor({state:'visible'});
     assert(await page.locator('#bm-video').isVisible());assert(await page.evaluate(()=>window.qaStreams.at(-1).getTracks().every(t=>t.readyState==='live')));
     assert.match(await page.locator('#bm-notice').textContent(),/카메라 영상은 유지/);
     await page.evaluate(()=>window.qaTrackingError=false);await page.locator('#bm-retry-tracking').click();
     await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('공용 도전 준비 완료'));
     assert.equal(await page.evaluate(()=>window.qaRequests.length),2,'tracking retry reuses the same camera stream');
    }
    assert.equal(await page.locator('#bm-video').evaluate(video=>getComputedStyle(video).objectFit),'contain');
    if(mode==='auto'){
     await page.screenshot({path:'.test-output/baemilgi-camera/desktop.png',fullPage:true});
     await page.setViewportSize({width:390,height:844});
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
     await page.screenshot({path:'.test-output/baemilgi-camera/mobile.png',fullPage:true});
    }
    await page.locator('#bm-cancel').click();assert(await page.locator('#bm-camera-select').isEnabled());
    assert(await page.evaluate(()=>window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
   }
   assert.deepEqual(errors,[]);await page.close();console.log(`PASS: ${mode}`);
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
