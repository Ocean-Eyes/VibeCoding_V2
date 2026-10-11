const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5173/';
(async()=>{
 fs.mkdirSync('.test-output',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'.test-output/dojo-home.png',fullPage:true});
  assert.deepEqual(await page.locator('.chapter-name').allTextContents(),['기초 ↗','굳히기본 ↗','매치기본 ↗']);
  assert.equal(await page.locator('#practice-screen').isVisible(),false);
  await page.locator('[data-category="basics"]').click();assert.equal(await page.locator('.lesson-enter:disabled').count(),3);
  await page.locator('[data-category="throws"]').click();assert.equal(await page.locator('.coming-panel').isVisible(),true);
  await page.locator('[data-category="katame"]').click();assert.equal(await page.locator('[data-lesson]').count(),3);
  for(const [i,id]of ['nami','gyaku','kata'].entries()){
   await page.locator(`[data-lesson="${id}"]`).click();assert.equal(await page.locator('#enter-practice').isDisabled(),true);
   await page.locator('.quiz-choice').nth((i+1)%3).click();assert.equal(await page.locator('#enter-practice').isDisabled(),true);
   await page.locator('.quiz-choice').nth(i).click();assert.equal(await page.locator('#enter-practice').isEnabled(),true);
   await page.locator('.quiz-choice').nth(i).click();await page.locator('#close-lesson').click();
  }
  assert.equal(await page.locator('#xp').innerText(),'30 XP');await page.reload();assert.equal(await page.locator('#xp').innerText(),'30 XP');
  await page.locator('[data-category="katame"]').click();await page.screenshot({path:'.test-output/dojo-courses.png',fullPage:true});
  await page.locator('[data-lesson="gyaku"]').click();await page.screenshot({path:'.test-output/dojo-lesson.png'});
  await page.locator('#enter-practice').click();assert.equal(await page.locator('#practice-title').innerText(),'역십자 조르기');
  assert.equal(await page.locator('.pose-card').count(),3);await page.locator('#demo').click();await page.locator('#play').click();
  await page.locator('#result-dialog').waitFor({state:'visible',timeout:25000});assert.equal(await page.locator('#xp').innerText(),'30 XP');
  await page.locator('#result-home').click();assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  // Exercise real camera/model initialization, then menu navigation releases the stream.
  await page.locator('[data-lesson="nami"]').click();await page.locator('#enter-practice').click();await page.locator('#start').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='카메라 연결됨',{},{timeout:90000});
  await page.waitForFunction(()=>parseInt(document.querySelector('#fps').textContent)>0);
  await page.locator('#back-menu').click();assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  // Inject known poses only to test progression/reward plumbing. This is not recognition validation.
  await page.addInitScript(()=>{const Original=Worker;window.Worker=class extends Original{postMessage(data,transfer){if(data.type==='frame')data.step=Number(document.querySelector('#step-label').textContent.slice(0,2))-1;super.postMessage(data,transfer)}}});
  await page.route('**/src/tracker.js',route=>route.fulfill({contentType:'text/javascript',body:`
    self.onmessage=({data})=>{
      if(data.type==='init')self.postMessage({type:'ready'});
      if(data.type==='frame'){
        const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
        const a=[[1.8,-1.15,Math.PI-1.8,-Math.PI+1.15],[1.8,-2.5,Math.PI-1.8,-Math.PI+1.15],[1.8,-2.5,Math.PI-1.8,-Math.PI+2.5]][data.step];
        const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.05}));const scale=w*.18;
        for(const [side,s,e,t,j]of [[1,11,13,15,0],[-1,12,14,16,2]]){let x=w*.5+side*scale*.5,y=h*.4;points[s]={x:x/w,y:y/h,visibility:1};x+=Math.cos(a[j])*scale*.68;y+=Math.sin(a[j])*scale*.68;points[e]={x:x/w,y:y/h,visibility:1};x+=Math.cos(a[j+1])*scale*.64;y+=Math.sin(a[j+1])*scale*.64;points[t]={x:x/w,y:y/h,visibility:1};}
        self.postMessage({type:'result',points,hands:[],time:data.time});
      }
    };`}));
  await page.reload();await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();await page.locator('#enter-practice').click();await page.locator('#start').click();
  await page.waitForFunction(()=>!document.querySelector('#play').disabled);await page.locator('#play').click();
  await page.locator('#result-dialog').waitFor({state:'visible',timeout:22000});assert.equal(await page.locator('#xp').innerText(),'50 XP');
  await page.locator('#result-home').click();assert.equal(await page.locator('#completion-count').innerText(),'1 / 3');
  await page.reload();assert.equal(await page.locator('#xp').innerText(),'50 XP');
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'.test-output/dojo-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: chapters, planned lessons, three grips, quiz, persistent XP, demo exclusion, real model initialization, camera cleanup, injected mission completion and mobile layout.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
