const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const base=process.env.SITE_URL||'http://127.0.0.1:5186/dist/';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  for(const lesson of ['baemilgi','practice'])for(const mode of ['worker','canvas']){
   const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/api/baemilgi*',route=>route.fulfill({json:route.request().method()==='POST'?{token:'model-test'}:{entries:[]}}));
   await page.addInitScript(mode=>{
    if(mode==='canvas')Object.defineProperty(window,'OffscreenCanvas',{value:undefined});
    const acquire=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.qaStreams=[];
    navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await acquire(constraints);window.qaStreams.push(stream);return stream;};
   },mode);
   await page.goto(base+(lesson==='baemilgi'?'basics/hindu-push-up':'katame-waza/shime-waza/nami-juji-jime'));
   if(lesson==='practice')await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
   await page.locator(lesson==='baemilgi'?'#bm-start':'#play').click();
   try{
    if(lesson==='baemilgi'){
     await page.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('공용 도전 준비 완료'),null,{timeout:90000});
     await page.waitForFunction(()=>document.querySelector('#bm-cue').textContent.includes('집계 대기'),null,{timeout:20000});
     assert(await page.locator('#bm-video').isVisible());assert.equal(await page.locator('#bm-count').textContent(),'0');
    }else{
     await page.waitForFunction(()=>document.querySelector('#status').textContent==='카메라 연결됨',null,{timeout:90000});
     await page.waitForFunction(()=>document.querySelector('#overlay').dataset.detectedHands==='0',null,{timeout:20000});
     assert(await page.locator('#video').isVisible());
    }
    assert.deepEqual(errors,[]);await page.locator(lesson==='baemilgi'?'#bm-cancel':'#stop').click();assert(await page.evaluate(()=>window.qaStreams.every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
    console.log(`PASS: ${lesson}, real MediaPipe initialization and inference via ${mode}, with Chrome fake camera`);
   }catch(error){console.error(await page.locator(lesson==='baemilgi'?'#bm-notice':'#notice').textContent(),errors);throw error;}
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
