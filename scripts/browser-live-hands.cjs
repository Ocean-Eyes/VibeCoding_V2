const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.addInitScript(()=>{
   const Original=Worker;window.qaGesture='open';
   window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame'){d.gesture=window.qaGesture;d.reversed=window.qaReversed;d.one=window.qaOne;d.missing=window.qaMissing}super.postMessage(d,t)}};
  });
  await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
   const deps=Promise.all([import('./pose.js'),import('./hand-rig.js')]);
   self.onmessage=async({data})=>{
    const [{POSES,targetPose},{posedHand,handViewPoint}]=await deps;
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
     const frame={origin:{x:w*.5,y:h*.32},scale:w*.18,x:{x:1,y:0},y:{x:0,y:1}};
     const pose=targetPose(frame,POSES[data.gesture==='cross'?2:0]);
     const curl=data.gesture==='open'?0:data.gesture==='half'?.5:1;
     const hands=[0,1].map(i=>posedHand(curl).landmarks.map(p=>{
      const q=handViewPoint(p,i===0,false),wrist=pose[15+i];
      return {x:(wrist.x+q[0]*frame.scale*2.55)/w,y:(wrist.y+q[1]*frame.scale*2.55)/h,z:q[2]*frame.scale*2.55/w};
     }));
     if(data.one)hands.splice(1,1);if(data.reversed)hands.reverse();
     self.postMessage({type:'result',points:pose.map(p=>p?{...p,x:p.x/w,y:p.y/h}:{x:0,y:0,visibility:0}),hands:data.missing?[]:hands,time:data.time});
    }
   };`}));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();await page.waitForFunction(()=>document.querySelector('#mode-label').textContent.includes('시연'));await page.locator('#play').click();
  await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');
  await page.locator('#play').click(); // Keep the lesson on one step while changing real input.
  const partner=await page.locator('#partner').evaluate(c=>c.toDataURL()),renders=[];
  for(const gesture of ['open','half','fist','cross']){
   await page.evaluate(g=>window.qaGesture=g,gesture);await page.waitForTimeout(900);
   await page.locator('#viewport').screenshot({path:`.test-output/live-glove-${gesture}.png`});
   renders.push(await page.locator('#overlay').evaluate(c=>c.toDataURL()));
   assert.equal(await page.locator('#partner').evaluate(c=>c.toDataURL()),partner);
  }
  assert.equal(new Set(renders).size,4,'individual finger flexion and crossing change the live surface');
  const beforeOrder=await page.locator('#overlay').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
  await page.evaluate(()=>window.qaReversed=true);await page.waitForTimeout(900);
  const afterOrder=await page.locator('#overlay').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data));
  const drift=beforeOrder.reduce((v,x,i)=>v+Math.abs(x-afterOrder[i]),0)/beforeOrder.length;
  assert.ok(drift<.3,`detector reorder should not swap limbs: mean pixel drift ${drift}`);
  await page.locator('#mirror').uncheck();await page.waitForTimeout(150);
  assert.notEqual(await page.locator('#overlay').evaluate(c=>c.toDataURL()),renders.at(-1));
  await page.evaluate(()=>window.qaOne=true);await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='1');
  await page.evaluate(()=>window.qaMissing=true);await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='0');
  await page.evaluate(()=>{window.qaMissing=false;window.qaOne=false;window.qaGesture='open'});
  await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');
  await page.setViewportSize({width:390,height:950});await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#viewport').screenshot({path:'.test-output/live-glove-mobile.png'});
  await page.locator('#back-menu').click();assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  assert.deepEqual(errors,[]);
  console.log('PASS live gloves: open/partial/fist/crossed landmarks, detector reorder, mirroring, missing/reacquired hands, fixed partner, mobile and cleanup. Synthetic input; not a real-camera accuracy claim.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
