const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://127.0.0.1:5186/dist/';
const lessons=[
 {id:'belt-virtual',path:'basics/belt',button:'#belt-phone',video:'#belt-video',stop:'#belt-camera'},
 {id:'belt-real',path:'basics/belt',button:'#belt-phone',video:'#belt-video',stop:'#back-menu',real:true},
 ...['nami','gyaku','kata'].map(id=>({id,path:`katame-waza/shime-waza/${id}-juji-jime`,button:'#connect-phone',video:'#video',stop:id==='gyaku'?'#stop':'#back-menu'})),
 {id:'baemilgi',path:'basics/hindu-push-up',button:'#bm-phone',video:'#bm-video',stop:'#bm-cancel'},
 ...['o-soto-gari','o-uchi-gari','ippon-seoi-nage'].map(id=>({id,path:`throws/${id}`,button:'#throw-phone',video:'#throw-video',stop:id==='o-uchi-gari'?'#back-menu':'#throw-camera-stop',portrait:true})),
];
(async()=>{
 fs.mkdirSync('.test-output/phone-camera',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const pcContext=await browser.newContext({viewport:{width:1365,height:1000}}),phoneContext=await browser.newContext({viewport:{width:440,height:956},isMobile:true,hasTouch:true});
  await pcContext.addInitScript(real=>{
   window.qaPcCameraRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.qaPcCameraRequests++;throw Error('A phone session must not request the PC camera');};
   if(real)return;
   const NativeWorker=Worker;
   window.Worker=class {
    constructor(url,options){if(!String(url).includes('tracker.js'))return new NativeWorker(url,options);this.stopped=false;}
    postMessage(data){if(this.stopped)return;if(data.type==='init')setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),0);if(data.type==='frame'){data.bitmap.close();setTimeout(()=>{if(!this.stopped)this.onmessage?.({data:{type:'result',points:null,hands:[],time:data.time}})},0);}}
    terminate(){this.stopped=true;}
   };
  },process.env.PHONE_CAMERA_REAL==='1');
  await phoneContext.addInitScript(()=>{window.qaStreams=[];const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async constraints=>{if(window.qaDeny)throw new DOMException('Denied','NotAllowedError');const stream=await get(constraints);window.qaStreams.push(stream);return stream;};});
  await pcContext.route('**/api/baemilgi*',route=>route.fulfill({json:route.request().method()==='POST'?{token:'test'}:{entries:[]}}));
  const selected=process.env.PHONE_CAMERA_LESSONS?.split(',');
  for(const lesson of lessons.filter(lesson=>(process.env.PHONE_CAMERA_REAL!=='1'||['nami','baemilgi'].includes(lesson.id))&&(!selected||selected.includes(lesson.id)))){
   const pc=await pcContext.newPage(),phone=await phoneContext.newPage(),errors=[];
   for(const page of [pc,phone])page.on('pageerror',error=>errors.push(error.message));
   if(lesson.portrait)await pc.setViewportSize({width:1395,height:995});
   await pc.goto(base+lesson.path);
   if(lesson.id.startsWith('belt')){await pc.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');if(lesson.real)await pc.locator('#belt-mode-real').click();}
   else if(lesson.button==='#connect-phone')await pc.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
   await pc.locator(lesson.button).click();await pc.locator('#phone-camera-qr').waitFor({state:'visible'});
   const invite=await pc.locator('#phone-camera-link').getAttribute('href');
   assert.equal(new URL(invite).searchParams.get('orientation'),lesson.portrait?'portrait':'landscape');
   if(lesson.id==='belt-virtual'){
    await pc.locator('#phone-camera-qr').screenshot({path:'.test-output/phone-camera/qr.png'});
    fs.writeFileSync('.test-output/phone-camera/qr-url.txt',invite);await pc.screenshot({path:'.test-output/phone-camera/desktop-pairing.png'});
   }
   await phone.goto(invite);assert.equal(await phone.evaluate(()=>window.qaStreams.length),0);
   assert.equal(await phone.locator('#phone-orientation').inputValue(),lesson.portrait?'portrait':'landscape');
   await phone.locator('#phone-start').click();
   await phone.waitForFunction(()=>document.querySelector('#phone-status').textContent.includes('PC에 연결됐습니다'),null,{timeout:45000});
   await pc.waitForFunction(selector=>{const video=document.querySelector(selector);return video.srcObject&&video.videoWidth>0&&video.readyState>=2&&!video.hidden;},lesson.video,{timeout:45000});
   if(lesson.id==='baemilgi')await pc.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('스마트폰 영상 연결됨'));
   if(lesson.button==='#connect-phone')await pc.waitForFunction(()=>document.querySelector('#status').textContent==='카메라 연결됨');
   if(lesson.portrait){
    await pc.waitForFunction(()=>document.querySelector('#throw-camera-status').textContent.includes('스마트폰 영상 연결됨'));
    assert.deepEqual(await phone.locator('#phone-frame').evaluate(canvas=>[canvas.width,canvas.height]),[720,1280]);
    const dimensions=await pc.locator(lesson.video).evaluate(video=>[video.videoWidth,video.videoHeight]);assert.equal(dimensions[0]/dimensions[1],9/16);
    await pc.locator('#throw-canvas').screenshot({path:`.test-output/phone-camera/${lesson.id}-demo.png`});
    await pc.screenshot({path:`.test-output/phone-camera/${lesson.id}-portrait.png`,fullPage:true});
    await phone.screenshot({path:'.test-output/phone-camera/phone-portrait.png',fullPage:true});
    await pc.locator('#throw-play').click();await pc.waitForFunction(()=>Number(document.querySelector('#throw-canvas').dataset.elapsed)>.15);await pc.locator('#throw-play').click();
    const paused=await pc.locator('#throw-canvas').getAttribute('data-elapsed');await pc.waitForTimeout(150);assert.equal(await pc.locator('#throw-canvas').getAttribute('data-elapsed'),paused);
    await pc.locator('[data-throw-view="front"]').click();assert(await pc.locator(lesson.video).isVisible());
   }
   if(process.env.PHONE_CAMERA_REAL==='1'){
    if(lesson.id==='baemilgi')await pc.waitForFunction(()=>document.querySelector('#bm-cue').textContent.includes('집계 대기'));
    else await pc.waitForFunction(()=>document.querySelector('#overlay').dataset.detectedHands==='0');
   }
   const before=await pc.locator(lesson.video).evaluate(video=>video.currentTime);await pc.waitForTimeout(250);assert(await pc.locator(lesson.video).evaluate((video,before)=>video.currentTime>before,before),'remote video frames advance');
   assert.equal(await pc.evaluate(()=>window.qaPcCameraRequests),0);assert(await pc.locator('#phone-camera-dialog').isHidden());
   if(lesson.id==='baemilgi'){
    await pc.screenshot({path:'.test-output/phone-camera/pc-live.png'});await phone.screenshot({path:'.test-output/phone-camera/phone-live.png',fullPage:true});
    // Camera replacement keeps the same peer connection and PC view alive.
    await phone.locator('#phone-lens').selectOption('user');await phone.waitForFunction(()=>window.qaStreams.length>=2&&document.querySelector('#phone-status').textContent.includes('PC에 연결됐습니다'));
    await pc.waitForFunction(()=>document.querySelector('#bm-video').readyState>=2);assert(await pc.locator('#bm-video').isVisible());
   }
   await pc.locator(lesson.stop).click();
   await phone.waitForFunction(()=>window.qaStreams.length>0&&window.qaStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended')));
   assert(await phone.locator('#phone-video').isHidden());assert(await phone.locator('#phone-start').isDisabled());assert.deepEqual(errors,[]);
   await pc.close();await phone.close();console.log(`PASS: ${lesson.id}, real WebRTC video, PC lesson flow, and remote camera cleanup`);
  }
  const pc=await pcContext.newPage(),phone=await phoneContext.newPage();await pc.goto(base+'basics/hindu-push-up');await pc.locator('#bm-phone').click();await pc.locator('#phone-camera-link').waitFor({state:'visible'});
  const invite=await pc.locator('#phone-camera-link').getAttribute('href');await phone.goto(invite);await phone.evaluate(()=>window.qaDeny=true);await phone.locator('#phone-start').click();
  await phone.waitForFunction(()=>document.querySelector('#phone-status').textContent.includes('권한이 거부'));assert.equal(await phone.evaluate(()=>window.qaStreams.length),0);assert(await pc.locator('#phone-camera-dialog').isVisible());
  await phone.evaluate(()=>window.qaDeny=false);await phone.locator('#phone-start').click();await phone.waitForFunction(()=>document.querySelector('#phone-status').textContent.includes('PC에 연결됐습니다'),null,{timeout:45000});
  await phone.locator('#phone-stop').click();await pc.waitForFunction(()=>document.querySelector('#bm-video').hidden);assert(await pc.locator('#bm-start').isEnabled());await pc.close();await phone.close();
  const cancel=await pcContext.newPage();await cancel.goto(base+'basics/hindu-push-up');await cancel.locator('#bm-phone').click();await cancel.locator('#phone-camera-link').waitFor({state:'visible'});await cancel.locator('#phone-pair-cancel').click();assert(await cancel.locator('#bm-start').isEnabled());assert.equal(await cancel.evaluate(()=>window.qaPcCameraRequests),0);await cancel.close();
  const invalid=await phoneContext.newPage();await invalid.goto(base+'phone-camera');assert(await invalid.locator('#phone-start').isDisabled());assert.equal(await invalid.evaluate(()=>window.qaStreams.length),0);await invalid.close();
  const mobile=await pcContext.newPage(),sender=await phoneContext.newPage(),mobileErrors=[];mobile.on('pageerror',error=>mobileErrors.push(error.message));sender.on('pageerror',error=>mobileErrors.push(error.message));
  await mobile.setViewportSize({width:390,height:844});await mobile.goto(base+'throws?lang=en');await mobile.locator('[data-lesson="ippon-seoi-nage"]').click();await mobile.locator('#throw-phone').waitFor({state:'visible'});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(/[가-힣]/.test(await mobile.locator('#throw-screen').innerText()),false);
  await mobile.locator('#throw-phone').click();await mobile.locator('#phone-camera-link').waitFor({state:'visible'});assert.equal(new URL(await mobile.locator('#phone-camera-link').getAttribute('href')).searchParams.get('orientation'),'portrait');
  await mobile.locator('#phone-pair-cancel').click();assert(await mobile.locator('#throw-phone').isEnabled());assert(await mobile.locator('#throw-camera-stop').isHidden());
  await mobile.locator('#throw-phone').click();await mobile.locator('#phone-camera-link').waitFor({state:'visible'});await sender.goto(await mobile.locator('#phone-camera-link').getAttribute('href'));await sender.locator('#phone-start').click();
  await mobile.waitForFunction(()=>document.querySelector('#throw-camera-status').textContent.includes('Phone camera connected'),null,{timeout:45000});await mobile.screenshot({path:'.test-output/phone-camera/throw-mobile-english.png',fullPage:true});
  assert.equal(/[가-힣]/.test(await mobile.locator('#throw-screen').innerText()),false);await sender.locator('#phone-stop').click();await mobile.waitForFunction(()=>document.querySelector('#throw-phone').disabled===false&&document.querySelector('#throw-video').hidden);
  await mobile.locator('#throw-phone').click();await mobile.locator('#phone-camera-link').waitFor({state:'visible'});await mobile.goBack();await mobile.waitForURL(url=>url.pathname.endsWith('/throws'));assert(await mobile.locator('#phone-camera-dialog').isHidden());assert.equal(await mobile.evaluate(()=>window.qaPcCameraRequests),0);assert.deepEqual(mobileErrors,[]);
  await mobile.close();await sender.close();
  console.log('PASS: portrait throw camera on mobile, English UI, QR cancellation, phone-side stop and navigation during pairing.');
  console.log('PASS: phone permission denial/retry, phone-side stop, QR cancellation, invalid links. Video peers are real; camera and pose data are test fixtures.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
