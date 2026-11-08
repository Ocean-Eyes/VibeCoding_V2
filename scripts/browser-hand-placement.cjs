// Synthetic landmarks test the UI/scoring pipeline, not MediaPipe accuracy.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  fs.mkdirSync('.test-output',{recursive:true});
  for(const lesson of ['nami','gyaku','kata']){
   const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'ko-KR'}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{window.qaPhase='open';const Original=Worker;window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame')d.phase=window.qaPhase;super.postMessage(d,t)}}});
   await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
    const deps=Promise.all([import('./pose.js'),import('/tests/fixtures/collar-hands.mjs'),import('./hand-placement.js')]);
    self.onmessage=async({data})=>{
     const [{POSES,targetPose},{handAt},{placementTarget}]=await deps;
     if(data.type==='init')self.postMessage({type:'ready'});
     if(data.type==='frame'){
      const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
      const f={origin:{x:w*.5,y:h*.32},scale:w*.18,x:{x:1,y:0},y:{x:0,y:1}},pose=targetPose(f,POSES[0]);
      pose[13].visibility=pose[14].visibility=0;
      const hands=[0,1].map(i=>{
       const target=placementTarget(i,true);if(data.phase==='outside')target.x+=i?-.5:.5;
       const up=${JSON.stringify(lesson)}==='gyaku'||(${JSON.stringify(lesson)}==='kata'&&i===0);
       const hand=handAt(target,data.phase==='open'?0:1,i===0,data.phase==='wrong'?!up:up);
       const mapped=hand.map(p=>({x:f.origin.x-p.x*f.scale,y:f.origin.y+p.y*f.scale,z:p.z*f.scale,visibility:1}));
       pose[15+i]=mapped[0];return mapped.map(p=>({...p,x:p.x/w,y:p.y/h,z:p.z/w}));
      });
      self.postMessage({type:'result',points:pose.map(p=>p?{...p,x:p.x/w,y:p.y/h,z:(p.z??0)/w}:{x:0,y:0,visibility:0}),hands:data.phase==='missing'?[]:hands,time:data.time});
     }
    };`}));
   await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
   await page.locator('[data-category="katame"]').click();
   await page.locator('[data-groundwork="shime-waza"]').click();
   await page.locator(`[data-lesson="${lesson}"]`).click();
   await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('손 위치 가이드'));
   await page.locator('#play').click();
   await page.waitForFunction(()=>document.querySelector('#status-dot').classList.contains('active')).catch(async e=>{console.error('START',await page.locator('#notice').innerText(),errors);throw e});
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2').catch(async e=>{console.error(await page.locator('#notice').innerText(),errors);throw e});
   await page.waitForTimeout(4500);
   for(const phase of ['open','outside','wrong','missing']){
    await page.evaluate(p=>window.qaPhase=p,phase);await page.waitForTimeout(2000);
    assert.equal(await page.locator('#overlay').getAttribute('data-guide-visible'),'true');
    assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false',`${lesson}: ${phase} must not complete`);
   }
   await page.locator('#viewport').screenshot({path:`.test-output/placement-${lesson}-guide.png`});
   await page.evaluate(()=>window.qaPhase='closed');
   await page.waitForFunction(()=>document.querySelector('#opponent-status').dataset.tap==='true',{},{timeout:10000});
   await page.locator('#viewport').screenshot({path:`.test-output/placement-${lesson}-success.png`});
   await page.locator('#result-dialog').waitFor({state:'visible',timeout:5000});
   assert.deepEqual(errors,[]);console.log(`PASS ${lesson}: fixed guide, invalid hands rejected, static closed hands complete without elbows or twisting`);
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
