const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await page.addInitScript(()=>{
   // Pixel assertions use a stable readback surface: Chrome may otherwise switch
   // from GPU to CPU rasterization after repeated screenshots/getImageData calls.
   const context=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,options){return context.call(this,kind,kind==='2d'&&this.id==='partner'?{...options,willReadFrequently:true}:options)};
   window.qaGripPhase='open';const Original=Worker;
   window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame')d.phase=window.qaGripPhase;super.postMessage(d,t)}};
  });
  await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
   const deps=Promise.all([import('./pose.js'),import('/tests/fixtures/collar-hands.mjs')]);
   self.onmessage=async({data})=>{
    const [{POSES,targetPose},{collarHands}]=await deps;
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
     const frame={origin:{x:w*.5,y:h*.32},scale:w*.18,x:{x:1,y:0},y:{x:0,y:1}},pose=targetPose(frame,POSES[0]);
     if(data.phase==='inward')for(const id of [11,12])pose[id].x=frame.origin.x+(pose[id].x-frame.origin.x)*1.35;
     const hands=collarHands(data.phase).map((hand,i)=>{
      if(!hand)return null;
      const mapped=hand.map(p=>({x:frame.origin.x-p.x*frame.scale,y:frame.origin.y+p.y*frame.scale,z:p.z*frame.scale,visibility:1}));
      pose[15+i]=mapped[0];return mapped.map(p=>({...p,x:p.x/w,y:p.y/h,z:p.z/w}));
     });
     self.postMessage({type:'result',points:data.phase==='hands-only'?null:pose.map(p=>p?{...p,x:p.x/w,y:p.y/h,z:(p.z??0)/w}:{x:0,y:0,visibility:0}),hands:hands.filter(Boolean),time:data.time});
    }
   };`}));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');
  const phase=async(name,wait=500)=>{await page.evaluate(p=>window.qaGripPhase=p,name);await page.waitForTimeout(wait)};
  const grabbed=()=>page.locator('#overlay').getAttribute('data-grabbed');
  await page.waitForTimeout(3100);
  const headPixels=()=>page.locator('#partner').evaluate(c=>{
    const f=JSON.parse(c.dataset.frame),d=c.width/c.getBoundingClientRect().width;
    return Array.from(c.getContext('2d').getImageData(Math.round((f.origin.x-f.scale*.26)*d),Math.round((f.origin.y-f.scale*.56)*d),Math.round(f.scale*.52*d),Math.round(f.scale*.51*d)).data);
  });
  const fabricPixels=()=>page.locator('#partner').evaluate(c=>{
    const f=JSON.parse(c.dataset.frame),d=c.width/c.getBoundingClientRect().width;
    return Array.from(c.getContext('2d').getImageData(Math.round((f.origin.x+f.scale*.30)*d),Math.round((f.origin.y+f.scale*.37)*d),Math.round(f.scale*.09*d),Math.round(f.scale*.22*d)).data);
  });
  const restFabric=await fabricPixels();
  const fixedHead=await headPixels();
  const rest=await page.locator('#partner').evaluate(c=>c.toDataURL());
  assert.equal(await grabbed(),'0');assert.equal(await page.locator('#live-score-value').innerText(),'0');
  await phase('outside');assert.equal(await grabbed(),'0');
  await phase('close');assert.equal(await grabbed(),'2','prepared closed hands acquire the opposite collars without reopening');
  await phase('open');await phase('close');await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
  assert.equal(await page.locator('#live-score-value').innerText(),'50');
  await page.locator('#viewport').screenshot({path:'.test-output/collar-grabbed.png'});
  await phase('one-pull',1500);assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
  await phase('lost',350);assert.equal(await grabbed(),'2');
  await phase('fast',400);assert.equal(await grabbed(),'2');assert.ok(Number(await page.locator('#overlay').getAttribute('data-tension'))>.9,'fast confirmed pull must respond instead of staying at zero');
  await phase('release',1400);assert.equal(await grabbed(),'0');
  assert.ok(await page.locator('#partner').evaluate(c=>c.toDataURL())===rest,'released cloth must return to its rest shape');
  await phase('open');await phase('close');await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
  await phase('inward',250);await page.waitForFunction(()=>Number(document.querySelector('#overlay').dataset.tension)>.9);
  const pulled=await page.locator('#partner').evaluate(c=>c.toDataURL());assert.notEqual(pulled,rest);
  const pulledFabric=await fabricPixels();assert.ok(restFabric.reduce((sum,v,i)=>sum+Math.abs(v-pulledFabric[i]),0)/restFabric.length>2,'fabric away from the collar must deform too');
  const currentHead=await headPixels();
  // One color level at an antialiased boundary may blend with the collar behind it.
  const changedHead=fixedHead.map((v,i)=>Math.abs(v-currentHead[i])>1?{i,v,now:currentHead[i]}:null).filter(Boolean);
  assert.ok(!changedHead.length,'the head must remain fixed even during a bilateral pull');
  const grips=JSON.parse(await page.locator('#overlay').getAttribute('data-grips'));
  assert.ok(grips.every(g=>g.side*g.travelX<-.16),'pulling crossed hands toward their own shoulders remains measurable even while the shoulders widen');
  assert.match(await page.locator('#live-hold').innerText(),/왼손 .*% · 오른손 .*%/);
  await page.locator('#viewport').screenshot({path:'.test-output/collar-pulled.png'});
  await phase('lost',350);assert.equal(await grabbed(),'2');assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
  await phase('inward',150);assert.equal(await grabbed(),'2','return at the pulled position without re-grasping');
  await page.locator('#show-skeleton').check();await phase('hands-only',250);assert.equal(await grabbed(),'2','visible hands keep responding if pose landmarks are briefly missing');
  assert.ok(Number(await page.locator('#overlay').getAttribute('data-tension'))>.9);await page.locator('#show-skeleton').uncheck();
  await page.waitForFunction(()=>document.querySelector('#opponent-status').dataset.tap==='true');
  await page.locator('#viewport').screenshot({path:'.test-output/collar-tap.png'});
  await page.locator('#result-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#xp').innerText(),'20 XP');
  await page.locator('#result-again').click();await page.locator('#play').click();
  await phase('open');await phase('close');await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
  await phase('lost',300);assert.equal(await grabbed(),'2','brief tracking loss retains grasp');
  await phase('lost',1000);assert.equal(await grabbed(),'0');assert.equal(await page.locator('#live-score-value').innerText(),'—');
  await page.setViewportSize({width:390,height:950});await phase('open');await phase('close');
  await page.locator('#viewport').screenshot({path:'.test-output/collar-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.evaluate(()=>document.querySelector('#live-score').getBoundingClientRect().top>=document.querySelector('#viewport').getBoundingClientRect().bottom),'score panel must not cover enlarged hands');
  await page.locator('#back-menu').click();assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  assert.deepEqual(errors,[]);console.log('PASS actual grip flow: open/close collision, prepared closed-entry capture, two cloth attachments, one-hand pull rejected, confirmed fast pull responds, inward pull with widening shoulders triggers tap/XP, release, tracking loss, mobile, cleanup. Synthetic camera landmarks.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
