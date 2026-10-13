const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
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
   window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame'){d.phase=window.qaGripPhase;d.palmUp=window.qaPalmUp;d.edge=window.qaEdge;d.swap=window.qaSwap;d.ghostOpen=window.qaGhostOpen;d.wristVisibility=window.qaWristVisibility;d.recoverySide=window.qaRecoverySide??0;}super.postMessage(d,t)}};
  });
  await page.route('**/tests/fixtures/collar-hands.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('tests/fixtures/collar-hands.mjs','utf8')}));
  await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
   const deps=Promise.all([import('./pose.js'),import('/tests/fixtures/collar-hands.mjs')]);
   let previous=null;
   function gradual(target){
    if(!previous){previous=target.map(h=>h?.map(p=>({...p}))??null);return target}
    const result=target.map((hand,i)=>{
     if(!hand)return null;
     if(!previous[i])return hand;
     const distance=Math.max(...hand.map((p,k)=>Math.hypot(p.x-previous[i][k].x,p.y-previous[i][k].y)));
     const u=Math.min(1,.009/Math.max(.00001,distance));
     return hand.map((p,k)=>({...p,x:previous[i][k].x+(p.x-previous[i][k].x)*u,y:previous[i][k].y+(p.y-previous[i][k].y)*u,z:previous[i][k].z+(p.z-previous[i][k].z)*u}));
    });
    if(target.some(Boolean))previous=result.map(h=>h?.map(p=>({...p}))??null);
    return result;
   }
   self.onmessage=async({data})=>{
    const [{POSES,targetPose},{collarHands,handAt}]=await deps;
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
     const frame={origin:{x:w*.5,y:h*.32},scale:w*.18,x:{x:1,y:0},y:{x:0,y:1}},pose=targetPose(frame,POSES[0]);
     for(const [i,id]of [13,14].entries()){
      pose[id].y=frame.origin.y+frame.scale*(.70-(['lift','hands-only','hidden-lift'].includes(data.phase)||(data.phase==='one-lift'&&i===0)?.15:0));
      if(data.phase==='no-elbows')pose[id].visibility=.1;
     }
     let hands=collarHands(['relaxed-open','recover-open'].includes(data.phase)?'open':data.phase).map((hand,i)=>{
      if(!hand)return null;
      if(data.palmUp){
       const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
       hand=handAt(center,['open','relaxed-open','recover-open'].includes(data.phase)?0:1,i===0,true);
      }
      if(data.phase.startsWith('recover-')){
       const base=collarHands('close')[i],center=[5,9,13,17].reduce((p,k)=>({x:p.x+base[k].x/4,y:p.y+base[k].y/4}),{x:0,y:0});
       hand=handAt(center,data.phase==='recover-open'&&i===data.recoverySide?0:1,i===0,!!data.palmUp);
       if(i===data.recoverySide){
        if(data.phase==='recover-open')hand=hand.map(p=>({...p,x:p.x+(i?-.45:.45)}));
        else{const a=2.4,c=Math.cos(a),s=Math.sin(a);hand=hand.map(p=>({...p,x:center.x+(p.x-center.x)*c-(p.y-center.y)*s,y:center.y+(p.x-center.x)*s+(p.y-center.y)*c}))}
       }
      }
      if(data.phase==='relaxed-open'){
       const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
       hand=handAt(center,.15,i===0,!!data.palmUp);
       const closed=handAt(center,1,i===0,!!data.palmUp);
       for(let k=18;k<=20;k++)hand[k]=closed[k];
      }
      if(data.edge){
       const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
       hand=hand.map(p=>({x:center.x,y:p.y,z:p.x-center.x}));
      }
      const mapped=hand.map(p=>({x:frame.origin.x-p.x*frame.scale,y:frame.origin.y+p.y*frame.scale,z:p.z*frame.scale,visibility:1}));
      pose[15+i]=mapped[0];return mapped.map(p=>({...p,x:p.x/w,y:p.y/h,z:p.z/w}));
     });
     if(data.phase!=='fast'&&!data.phase.startsWith('recover-'))hands=gradual(hands);
     hands.forEach((hand,i)=>{if(hand)pose[15+i]={...hand[0],x:hand[0].x*w,y:hand[0].y*h}});
     if(data.ghostOpen)hands=collarHands('open').map(hand=>hand.map(p=>({x:(frame.origin.x-p.x*frame.scale)/w+.35,y:(frame.origin.y+p.y*frame.scale)/h,z:p.z*frame.scale/w})));
     if(data.swap){[pose[15],pose[16]]=[pose[16],pose[15]];hands.reverse()}
     if(data.phase==='hidden-left')hands[0]=null;
     if(data.phase==='hidden-right')hands[1]=null;
     if(['hidden-both','hidden-lift','body-lost'].includes(data.phase))hands=[null,null];
     if(data.wristVisibility!==undefined)for(const id of [15,16])pose[id].visibility=data.wristVisibility;
     self.postMessage({type:'result',points:['hands-only','body-lost'].includes(data.phase)?null:pose.map(p=>p?{...p,x:p.x/w,y:p.y/h,z:(p.z??0)/w}:{x:0,y:0,visibility:0}),hands:hands.filter(Boolean),time:data.time});
    }
   };`}));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
  await page.locator('#play').click();await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');
  const phase=async(name,wait=900)=>{await page.evaluate(p=>window.qaGripPhase=p,name);await page.waitForTimeout(wait)};
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
  await phase('relaxed-open',1400);assert.equal(await grabbed(),'0','three relaxed straight fingers must release');
  await phase('close',1100);assert.equal(await grabbed(),'2');
  await page.evaluate(()=>window.qaWristVisibility=.1);await phase('hidden-lift',1600);
  assert.equal(await page.locator('#overlay').getAttribute('data-completion'),'0','low-confidence pose wrists cannot substitute for hidden hands');
  assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
  await page.evaluate(()=>window.qaWristVisibility=1);await phase('close',700);
  for(const side of [0,1]){
   await page.evaluate(side=>window.qaRecoverySide=side,side);
   await phase(side?'hidden-right':'hidden-left',1200);
   await phase('recover-open',2200);
   assert.equal(await page.locator('#overlay').getAttribute('data-detected-hands'),'2');
   assert.equal(await page.locator('#overlay').getAttribute('data-live-hands'),'2','recovered open hand must reach release detection');
   assert.equal(await grabbed(),'1','only the opened hand releases its held grip');
   assert.equal(JSON.parse(await page.locator('#overlay').getAttribute('data-grips'))[side],null);
   await phase('open',1800);assert.equal(await grabbed(),'0');
   await phase('close',1200);assert.equal(await grabbed(),'2','restart without resetting the camera');
   const before=JSON.parse(await page.locator('#overlay').getAttribute('data-grips'));
   await phase(side?'hidden-right':'hidden-left',1200);await phase('recover-turn',2200);
   assert.equal(await page.locator('#overlay').getAttribute('data-live-hands'),'2','rotated held wrist must not remain rejected indefinitely');
   const after=JSON.parse(await page.locator('#overlay').getAttribute('data-grips'));
   after.forEach((g,i)=>{assert.ok(g);assert.ok(Math.hypot(g.dx-before[i].dx,g.dy-before[i].dy)<.001,'recovery cannot pull cloth')});
   await phase('close',2200);
  }
  await page.locator('#viewport').screenshot({path:'.test-output/collar-grabbed.png'});
  const heldStarts=JSON.parse(await page.locator('#overlay').getAttribute('data-grips')).map(g=>g.start);
  for(const hidden of ['hidden-left','hidden-right','hidden-both']){
   await phase(hidden,2200);
   assert.equal(await grabbed(),'2',hidden+' cannot release established grips');
   assert.ok(Number(await page.locator('#overlay').getAttribute('data-completion'))<1e-6);
   assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
   assert.deepEqual(JSON.parse(await page.locator('#overlay').getAttribute('data-grips')).map(g=>g.start),heldStarts);
   await phase('close',650);assert.equal(await grabbed(),'2');
  }
  await phase('hidden-both',1800);
  await page.evaluate(()=>{window.qaSwap=true;window.qaGhostOpen=true});
  await phase('close',800);
  assert.equal(await grabbed(),'2','returned false-open detections cannot release held collars');
  assert.deepEqual(JSON.parse(await page.locator('#overlay').getAttribute('data-grips')).map(g=>g.start),heldStarts);
  await page.evaluate(()=>window.qaGhostOpen=false);await phase('close',900);
  assert.equal(await grabbed(),'2');
  assert.equal(await page.locator('#overlay').getAttribute('data-live-hands'),'2','both hands recover despite swapped pose wrists');
  await page.evaluate(()=>window.qaSwap=false);
  await page.locator('#viewport').screenshot({path:'.test-output/collar-occlusion-recovered.png'});
  await phase('pull',1500);assert.equal(await grabbed(),'2');assert.ok(Number(await page.locator('#overlay').getAttribute('data-completion'))<1e-6);
  assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false','wide lateral pulling must not complete');
  const beforeSpike=JSON.parse(await page.locator('#overlay').getAttribute('data-grips'));
  await phase('lost',200);assert.equal(await grabbed(),'2');
  await phase('fast',400);assert.equal(await grabbed(),'2');
  const fastGrips=JSON.parse(await page.locator('#overlay').getAttribute('data-grips'));assert.ok(fastGrips.every((g,i)=>Math.abs(g.dx-beforeSpike[i].dx)<.005),'abrupt input cannot move the held cloth');
  await phase('release',1400);assert.equal(await grabbed(),'0');
  await page.waitForFunction(rest=>document.querySelector('#partner').toDataURL()===rest,rest,{timeout:3000});
  await phase('open');await phase('close');await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
  await phase('one-lift',1400);assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
  await phase('close');
  await phase('lift',300);await page.waitForFunction(()=>Number(document.querySelector('#overlay').dataset.completion)>.9);
  const liftedFabric=await fabricPixels();assert.notDeepEqual(liftedFabric,restFabric,'illustrated folds react to elbow action without stretching hand positions');
  const currentHead=await headPixels();
  assert.ok(fixedHead.every((v,i)=>Math.abs(v-currentHead[i])<=1),'opponent head remains fixed');
  const grips=JSON.parse(await page.locator('#overlay').getAttribute('data-grips'));
  assert.ok(grips.every(g=>Math.abs(g.travelX)<.01),'elbows rise while hands stay at their grips');
  assert.match(await page.locator('#live-hold').innerText(),/왼 팔꿈치 .*% · 오른 팔꿈치 .*%/);
  await page.locator('#viewport').screenshot({path:'.test-output/collar-elbows-raised.png'});
  await phase('no-elbows',300);assert.equal(await grabbed(),'2');assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
  assert.match(await page.locator('#live-feedback').innerText(),/팔꿈치/);
  await phase('lift',150);assert.equal(await grabbed(),'2');
  await page.locator('#show-skeleton').check();await phase('hands-only',250);
  assert.equal(await grabbed(),'2');assert.equal(await page.locator('#overlay').getAttribute('data-completion'),'0','no invented elbow score when pose landmarks disappear');
  await page.locator('#show-skeleton').uncheck();await phase('hidden-lift',250);
  await page.waitForFunction(()=>document.querySelector('#opponent-status').dataset.tap==='true');
  await page.locator('#viewport').screenshot({path:'.test-output/collar-tap.png'});
  await page.locator('#result-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#xp').innerText(),'20 XP');
  await page.locator('#result-again').click();await page.locator('#play').click();
  await phase('open');await phase('close');await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
  await phase('lost',300);assert.equal(await grabbed(),'2');
  await phase('lost',1000);assert.equal(await grabbed(),'2');
  await phase('body-lost',1000);assert.equal(await grabbed(),'0');assert.equal(await page.locator('#live-score-value').innerText(),'—');
  await page.setViewportSize({width:390,height:950});await phase('open');await phase('close');
  await page.locator('#viewport').screenshot({path:'.test-output/collar-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.evaluate(()=>document.querySelector('#live-score').getBoundingClientRect().top>=document.querySelector('#viewport').getBoundingClientRect().bottom),'score panel must not cover enlarged hands');
  await page.locator('#back-menu').click();assert.equal(await page.locator('#video').evaluate(v=>v.srcObject),null);
  // Check the user-facing camera convention through the real projection path,
  // on both techniques and mirror settings, rather than just fixture math.
  await page.setViewportSize({width:1440,height:1050});
  for(const [lesson,up,face]of [['nami',false,'손바닥'],['gyaku',true,'손등']]){
   await page.evaluate(up=>{window.qaGripPhase='close';window.qaPalmUp=!up;window.qaEdge=false},up);
   await page.locator(`[data-lesson="${lesson}"]`).click();await page.locator('#play').click();
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');await page.waitForTimeout(400);
   assert.equal(await grabbed(),'0','the wrong face must not acquire');
   assert.match(await page.locator('#live-feedback').innerText(),new RegExp(face));
   await page.evaluate(()=>window.qaEdge=true);await page.waitForTimeout(500);
   assert.equal(await grabbed(),'0','edge-on hands must not acquire');
   await page.evaluate(up=>{window.qaEdge=false;window.qaPalmUp=up},up);
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
   for(const hidden of ['hidden-left','hidden-right']){
    await phase(hidden,1400);assert.equal(await grabbed(),'2',lesson+' '+hidden);
    await phase('close',600);assert.equal(await grabbed(),'2');
   }
   await page.locator('#viewport').screenshot({path:`.test-output/${lesson}-camera-grip.png`});
   await page.locator('#mirror').uncheck();
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='0');
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.grabbed==='2');
   await phase('hidden-both',1400);assert.equal(await grabbed(),'2',lesson+' mirrored occlusion');
   await phase('close',600);await phase('relaxed-open',1400);assert.equal(await grabbed(),'0');
   await page.locator('#mirror').check();await page.locator('#back-menu').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS actual grip flow: prepared capture, wide lateral pull rejected, stationary hands plus bilateral elbow rise triggers completion/XP, single elbow rejected, pose loss pauses score, cloth folds, fixed head, release, mobile, palm/back and edge-on rejection with mirroring. Prolonged occlusion preserves grips; reliable pose wrists continue the elbow finish, uncertain wrists cannot score, relaxed three-finger opening releases; a lost hand returns at a new position, releases, regrips and completes without camera reset; rotated held-hand recovery does not move cloth; body loss releases. Synthetic camera landmarks.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
