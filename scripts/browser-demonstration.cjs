const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5173/dist/index.html';
(async()=>{
 fs.mkdirSync('.test-output',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});
  await page.addInitScript(()=>{
    window.cameraRequests=0;const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=(...args)=>{window.cameraRequests++;return get(...args)};
    const Original=Worker;window.Worker=class extends Original{postMessage(data,transfer){if(data.type==='frame'){data.step=Number(document.querySelector('#step-label').textContent.slice(0,2))-1;data.pose=window.qaPose||'match'}super.postMessage(data,transfer)}};
  });
  await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
    const geometry=import('./pose.js');
    self.onmessage=async({data})=>{
      const {POSES,targetPose}=await geometry;
      if(data.type==='init')self.postMessage({type:'ready'});
      if(data.type==='frame'){
        const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
        const moved=data.pose==='moved',angle=moved?.25:0,scale=w*(moved?.24:.18);
        const frame={origin:{x:w*(moved?.61:.5),y:h*(moved?.34:.4)},scale,x:{x:Math.cos(angle),y:Math.sin(angle)},y:{x:-Math.sin(angle),y:Math.cos(angle)}};
        const points=targetPose(frame,POSES[data.step]);
        if(data.pose==='wrong'){points[15].x+=scale;points[16].x-=scale}
        if(data.pose==='missing')points[15].visibility=.1;
        self.postMessage({type:'result',points:points.map(p=>p?{...p,x:p.x/w,y:p.y/h}:{x:0,y:0,visibility:0}),hands:[],time:data.time});
      }
    };`}));
  await page.goto(base);await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelector('#partner').width>0&&document.querySelector('#mode-label').textContent.includes('시연'));
  assert.equal(await page.evaluate(()=>window.cameraRequests),0);
  const partner=await page.locator('#partner').evaluate(c=>c.toDataURL());
  const overlay=await page.locator('#overlay').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#partner').evaluate(c=>c.toDataURL()),partner);
  assert.notEqual(await page.locator('#overlay').evaluate(c=>c.toDataURL()),overlay);
  assert.equal(await page.locator('#live-score-value').innerText(),'—');
  await page.locator('#viewport').screenshot({path:'.test-output/fixed-partner-demo.png'});
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#live-score-value').textContent==='100').catch(async e=>{console.error(await page.locator('#notice').innerText(),await page.locator('#status').innerText());throw e});console.log('PASS camera connects and matching pose scores 100');
  await page.locator('#play').click(); // Pause progression while evaluating the live score.
  await page.evaluate(()=>window.qaPose='moved');await page.waitForTimeout(400);
  assert.equal(await page.locator('#live-score-value').innerText(),'100');
  assert.equal(await page.locator('#partner').evaluate(c=>c.toDataURL()),partner);
  await page.evaluate(()=>window.qaPose='wrong');await page.waitForFunction(()=>Number(document.querySelector('#live-score-value').textContent)<50);
  assert.equal(await page.locator('#live-score').getAttribute('data-level'),'adjust');
  await page.evaluate(()=>window.qaPose='missing');await page.waitForFunction(()=>document.querySelector('#live-score-value').textContent==='—');
  await page.evaluate(()=>window.qaPose='match');await page.waitForFunction(()=>document.querySelector('#live-score-value').textContent==='100');
  await page.locator('#viewport').screenshot({path:'.test-output/fixed-partner-score.png'});
  await page.locator('#play').click();await page.locator('#result-dialog').waitFor({state:'visible',timeout:22000});
  assert.equal(await page.locator('#xp').innerText(),'20 XP');await page.locator('#result-home').click();
  for(const width of [1024,760,390,320]){
    await page.setViewportSize({width,height:900});await page.locator('[data-lesson="gyaku"]').click();
    await page.waitForFunction(()=>document.querySelector('#mode-label').textContent.includes('시연'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(width===390)await page.locator('#viewport').screenshot({path:'.test-output/fixed-partner-mobile.png'});
    await page.locator('#back-menu').click();
  }
  assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  assert.deepEqual(errors,[]);
  console.log('PASS: camera-free animated demonstration, fixed partner under body movement, genuine pose scores, missing tracking clears score, progression/XP, mobile layout and camera cleanup. Synthetic landmarks test plumbing, not real-world recognition.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
