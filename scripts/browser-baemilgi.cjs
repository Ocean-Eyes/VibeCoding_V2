const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const base=process.env.SITE_URL||'http://127.0.0.1:5186/dist/';
const output='.test-output/baemilgi';
(async()=>{
 const {pose}=await import(pathToFileURL(path.resolve('tests/fixtures/baemilgi-poses.mjs')).href);
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 fs.mkdirSync(output,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(poses=>{
   window.qaPose='low';window.qaStreams=[];
   const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
   navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await original(constraints);window.qaStreams.push(stream);return stream;};
   const OriginalWorker=Worker;
   window.Worker=class {
    constructor(url,options){if(!String(url).includes('baemilgi-tracker'))return new OriginalWorker(url,options);this.stopped=false;}
    postMessage(data){
     if(this.stopped)return;
     if(data.type==='init')setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),25);
     else if(data.type==='frame'){
      const points=window.qaPose===null?null:poses[window.qaPose].map(p=>({...p,x:(p.x-.5)*(1000/700)/(data.bitmap.width/data.bitmap.height)+.5}));
      data.bitmap.close();setTimeout(()=>{if(!this.stopped)this.onmessage?.({data:{type:'result',time:data.time,points}})},10);
     }
    }
    terminate(){this.stopped=true;}
   };
  },Object.fromEntries(['low','up','standing','kneeling','plank'].map(name=>[name,pose(name)])));
  // The unconfigured API is intentionally real, not a fake successful leaderboard.
  await page.goto(base+'basics');await page.locator('[data-lesson="baemilgi"]').click();
  await page.locator('#bm-start').waitFor();assert.equal(await page.evaluate(()=>window.qaStreams.length),0);
  await page.waitForFunction(()=>document.querySelector('#bm-board-note').textContent.includes('연결할 수 없습니다'));
  await page.screenshot({path:output+'/desktop.png',fullPage:true});
  const set=async name=>page.evaluate(name=>window.qaPose=name,name);
  const until=async count=>page.waitForFunction(count=>document.querySelector('#bm-count').textContent===String(count),count);
  await page.locator('#bm-start').click();await page.waitForFunction(()=>document.querySelector('#bm-mode').textContent==='LIVE');
  assert(await page.locator('#bm-demo').isHidden());assert(await page.locator('#bm-demo-canvas').evaluate(c=>c.dataset.playing==='false'));assert(await page.locator('#bm-show-demo').isDisabled());
  await set('up');await until(1);await page.waitForTimeout(900);assert.equal(await page.locator('#bm-count').textContent(),'1');
  await set(null);await page.waitForTimeout(200);await set('up');await page.waitForTimeout(600);assert.equal(await page.locator('#bm-count').textContent(),'1');
  await set('low');await page.waitForTimeout(650);await set('up');await until(2);
  await set('standing');await page.locator('#bm-result').waitFor({state:'visible'});
  assert.equal(await page.locator('#bm-final-count').textContent(),'2');
  assert(await page.locator('#bm-show-demo').isEnabled());
  assert(await page.evaluate(()=>window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  await page.locator('#bm-nickname').fill('도전왕');await page.locator('#bm-save').click();
  await page.waitForFunction(()=>document.querySelector('#bm-save').textContent==='저장 완료');
  assert.match(await page.locator('#bm-save-note').textContent(),/공용 순위에는 등록되지 않았습니다/);
  await page.screenshot({path:output+'/result.png'});await page.locator('#bm-dismiss').click();
  assert.match(await page.locator('#bm-entries').textContent(),/도전왕/);
  await page.reload();await page.locator('#bm-local').click();assert.match(await page.locator('#bm-entries').textContent(),/도전왕/);
  // Cancel and leaving the lesson both release camera tracks and never submit a score.
  await set('low');await page.locator('#bm-start').click();await page.waitForFunction(()=>document.querySelector('#bm-mode').textContent==='LIVE');await page.locator('#bm-cancel').click();assert(await page.locator('#bm-result').isHidden());
  await page.locator('#bm-start').click();await page.waitForFunction(()=>document.querySelector('#bm-mode').textContent==='LIVE');await page.locator('#back-menu').click();
  assert(await page.evaluate(()=>window.qaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))));
  await page.locator('[data-lesson="belt"]').click();await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');assert(await page.locator('#baemilgi-screen').isHidden());
  await page.goto(base+'basics/hindu-push-up?lang=en');await page.locator('#bm-start').waitFor();assert.match(await page.locator('#baemilgi-screen h1').textContent(),/Hindu push-up/);
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:output+'/mobile-en.png',fullPage:true});
  // Exercise the shared-save UI, retry, duplicate-click protection and safe nickname rendering.
  await page.setViewportSize({width:1365,height:1000});let saves=0,entries=[];
  await page.route('**/api/baemilgi*',async route=>{
   const body=route.request().postDataJSON();
   if(!body)return route.fulfill({json:{entries}});
   if(body.action==='start')return route.fulfill({json:{token:'ui-test-session'}});
   saves++;if(saves===1)return route.fulfill({status:503,json:{error:'storage_unavailable'}});
   entries=[{nickname:body.nickname,count:body.count,rank:1}];return route.fulfill({json:{saved:true,improved:true,best:body.count,rank:1}});
  });
  await set('low');await page.locator('#bm-start').click();await page.waitForFunction(()=>document.querySelector('#bm-mode').textContent==='LIVE');await set('up');await until(1);await set('standing');await page.locator('#bm-result').waitFor({state:'visible'});
  await page.locator('#bm-nickname').fill('<img>');await page.locator('#bm-save').click();assert.equal(saves,0);
  await page.locator('#bm-nickname').fill('Judoka');await page.locator('#bm-save').click();await page.waitForFunction(()=>document.querySelector('#bm-save-note').textContent.includes('submission failed'));await page.locator('#bm-save').click();await page.waitForFunction(()=>document.querySelector('#bm-save').textContent==='Saved');assert.equal(saves,2);
  await page.locator('#bm-dismiss').click();assert.match(await page.locator('#bm-entries').textContent(),/Judoka/);
  assert.deepEqual(errors,[]);await page.close();
  // Permission denial is a real UI path; no inference replacement is needed here.
  const denied=await browser.newPage();await denied.addInitScript(()=>navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')});
  await denied.goto(base+'basics/hindu-push-up');await denied.locator('#bm-start').click();await denied.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('권한이 거부'));assert(await denied.locator('#bm-start').isEnabled());await denied.close();
  console.log('PASS: synthetic pose stream through real camera UI, two reps, auto-standing stop, device persistence, no false shared-save claims, cancellation, navigation cleanup, belt entry, mobile/English, server retry and permission denial.');
  if(process.env.CHECK_REAL_MODEL==='1'){
   const real=await browser.newPage(),realErrors=[];real.on('pageerror',e=>realErrors.push(e.message));
   await real.goto(base+'basics/hindu-push-up');await real.locator('#bm-start').click();
   await real.waitForFunction(()=>document.querySelector('#bm-notice').textContent.startsWith('이 기기 기록 모드'),{},{timeout:90000});
   await real.waitForFunction(()=>document.querySelector('#bm-cue').textContent.includes('집계 대기'));
   assert.equal(await real.locator('#bm-count').textContent(),'0');await real.locator('#bm-cancel').click();assert.deepEqual(realErrors,[]);await real.close();
   console.log('PASS: actual MediaPipe model download, Worker initialization and inference on Chrome fake camera (no real-person accuracy claim).');
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
