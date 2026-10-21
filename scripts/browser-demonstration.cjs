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
  await page.goto(base);await page.locator('[data-category="katame"]').click();await page.locator('[data-groundwork="shime-waza"]').click();await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelector('#partner').width>0&&document.querySelector('#mode-label').textContent.includes('시연'));
  assert.equal(await page.evaluate(()=>window.cameraRequests),0);
  const partner=await page.locator('#partner').evaluate(c=>c.toDataURL());
  const overlay=await page.locator('#overlay').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(700);
  assert.equal(await page.locator('#partner').evaluate(c=>c.toDataURL()),partner);
  assert.notEqual(await page.locator('#overlay').evaluate(c=>c.toDataURL()),overlay);
  assert.equal(await page.locator('#live-score-value').innerText(),'—');
  await page.locator('#viewport').screenshot({path:'.test-output/fixed-partner-demo.png'});
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='카메라 연결됨');
  await page.waitForTimeout(500);
  const livePartner=await page.locator('#partner').evaluate(c=>c.toDataURL());
  for(const observation of ['match','moved','wrong','missing']){
    await page.evaluate(p=>window.qaPose=p,observation);await page.waitForTimeout(400);
    assert.equal(await page.locator('#live-score-value').innerText(),'—','arm landmarks without fingers cannot earn a grip score');
    assert.equal(await page.locator('#overlay').getAttribute('data-grabbed'),'0');
    assert.equal(await page.locator('#partner').evaluate(c=>c.toDataURL()),livePartner,'body motion without a grip must not deform the partner');
  }
  await page.waitForTimeout(3500);
  assert.equal(await page.locator('#result-dialog').isVisible(),false);
  assert.equal(await page.locator('#xp').innerText(),'0 XP');
  await page.locator('#back-menu').click();
  for(const width of [1024,760,390,320]){
    await page.setViewportSize({width,height:900});await page.locator('[data-lesson="gyaku"]').click();
    await page.waitForFunction(()=>document.querySelector('#mode-label').textContent.includes('시연'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    if(width===390)await page.locator('#viewport').screenshot({path:'.test-output/fixed-partner-mobile.png'});
    await page.locator('#back-menu').click();
  }
  assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  assert.deepEqual(errors,[]);
  console.log('PASS: camera-free animated demonstration, fixed partner under body movement, no grip score or XP from arm pose alone, missing tracking clears score, mobile layout and camera cleanup. Synthetic landmarks test plumbing, not real-world recognition.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
