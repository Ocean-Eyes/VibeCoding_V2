const {chromium}=require(process.argv[2]||'playwright');
const gyakuOnly=process.argv.includes('--gyaku'),kataShoulder=process.argv.includes('--kata-shoulder'),kataLeft=process.argv.includes('--kata-left')||kataShoulder,kataOnly=process.argv.includes('--kata')||kataLeft,edgeOnly=process.argv.includes('--edge'),startupOnly=process.argv.includes('--startup');
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
   window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame'){d.phase=window.qaGripPhase;d.palmUp=window.qaPalmUp;d.kata=window.qaKata;d.kataLeft=window.qaKataLeft;d.edge=window.qaEdge;d.swap=window.qaSwap;d.ghostOpen=window.qaGhostOpen;d.wristVisibility=window.qaWristVisibility;d.recoverySide=window.qaRecoverySide??0;}super.postMessage(d,t)}};
  });
  for(const name of ['collar-hands','gyaku-hands','acquisition-hands'])await page.route(`**/tests/fixtures/${name}.mjs`,r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync(`tests/fixtures/${name}.mjs`,'utf8')}));
  await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
   const deps=Promise.all([import('./pose.js'),import('/tests/fixtures/collar-hands.mjs'),import('/tests/fixtures/gyaku-hands.mjs'),import('/tests/fixtures/acquisition-hands.mjs')]);
   let previous=null,kataAngle=0,kataFrames=0;
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
    const [{POSES,targetPose},{collarHands,handAt},{gyakuHands,rollHand},{acquisitionHands}]=await deps;
    if(data.type==='init')setTimeout(()=>self.postMessage({type:'ready'}),${startupOnly?1800:0});
    if(data.type==='frame'){
     const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
     const frame={origin:{x:w*.5,y:h*.32},scale:w*.18,x:{x:1,y:0},y:{x:0,y:1}},pose=targetPose(frame,POSES[0]);
     for(const [i,id]of [13,14].entries()){
      pose[id].y=frame.origin.y+frame.scale*(.70-(['lift','hands-only','hidden-lift','gyaku-lift'].includes(data.phase)||(data.phase==='one-lift'&&i===0)?.15:0));
      if(data.phase==='no-elbows'||data.phase.startsWith('wrist-'))pose[id].visibility=.1;
     }
     let hands=collarHands(['relaxed-open','recover-open'].includes(data.phase)?'open':data.phase).map((hand,i)=>{
      if(!hand)return null;
      if(data.palmUp||data.kata){
       const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
       hand=handAt(center,['open','relaxed-open','recover-open'].includes(data.phase)?0:1,i===0,data.kata?i===0:true);
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
      if(data.phase==='wrist-turn'||data.phase==='wrist-return'){
       const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
       const angle=data.phase==='wrist-return'?.7:.55,a=i?-angle:angle,c=Math.cos(a),s=Math.sin(a);
       hand=hand.map(p=>({...p,x:center.x+(p.x-center.x)*c-(p.y-center.y)*s,y:center.y+(p.x-center.x)*s+(p.y-center.y)*c}));
      }
      if(data.edge==='thin'){
       hand=rollHand(hand,1.1*(i?-1:1)).map(p=>({...p,z:p.z*.1}));
      }else if(data.edge){
       const center=[5,9,13,17].reduce((p,k)=>({x:p.x+hand[k].x/4,y:p.y+hand[k].y/4}),{x:0,y:0});
       hand=hand.map(p=>({x:center.x,y:p.y,z:p.x-center.x}));
      }
      if(data.phase.startsWith('gyaku-'))hand=gyakuHands({curl:['gyaku-edge','gyaku-lift','gyaku-collapsed','gyaku-open'].includes(data.phase)?0:1,roll:data.phase==='gyaku-open'?.85:data.phase==='gyaku-collapsed'?.2:1.4,collapsed:data.phase==='gyaku-collapsed'?.3:false})[i];
      if(data.phase==='hook-open'||data.phase==='hook-close')hand=acquisitionHands({hook:data.phase==='hook-open'?0:.55})[i];
      if(data.phase==='uncrossed'){const dx=(i?.65:-.65)-hand[0].x,dy=.75-hand[0].y;hand=hand.map(p=>({...p,x:p.x+dx,y:p.y+dy}))}
      const mapped=hand.map(p=>({x:frame.origin.x-p.x*frame.scale,y:frame.origin.y+p.y*frame.scale,z:p.z*frame.scale,visibility:1}));
      pose[15+i]=mapped[0];return mapped.map(p=>({...p,x:p.x/w,y:p.y/h,z:p.z/w}));
     });
     if(data.phase!=='fast'&&data.phase!=='wrist-return'&&!data.phase.startsWith('recover-'))hands=gradual(hands);
     hands.forEach((hand,i)=>{if(hand)pose[15+i]={...hand[0],x:hand[0].x*w,y:hand[0].y*h}});
     if(data.kata){
      kataFrames++;
      const target=['kata-turn','kata-one','kata-hidden'].includes(data.phase)?.36*(data.kataLeft?-1:1):0;
      kataAngle+=Math.max(-.018,Math.min(.018,target-kataAngle));
      for(let i=0;i<2;i++){
       const wrist=pose[15+i],wx=(frame.origin.x-wrist.x)/frame.scale,wy=(wrist.y-frame.origin.y)/frame.scale;
       const noisy=i===(data.kataLeft?0:1)&&kataFrames%5===0;
       const a=data.phase==='kata-one'&&i===1?0:data.phase==='kata-hidden'&&noisy?Math.sign(kataAngle)*Math.max(0,Math.abs(kataAngle)-.24):kataAngle,c=Math.cos(a),s=Math.sin(a),dx=(i?.67:-.67)-wx,dy=.70-wy;
       // The left forearm foreshortens gradually, then fluctuates across the old .65 radius gate.
       const scale=data.kataLeft&&i===0?1-(.36+(kataFrames%2?.02:-.02))*Math.min(1,Math.abs(kataAngle)/.36):1;
       pose[13+i]={x:frame.origin.x-(wx+(dx*c-dy*s)*scale)*frame.scale,y:frame.origin.y+(wy+(dx*s+dy*c)*scale)*frame.scale,visibility:1};
      }
      if(data.phase==='kata-hidden'){hands=[null,null];if(${kataShoulder})pose[11].visibility=.1}
     }
     if(data.ghostOpen)hands=collarHands('open').map(hand=>hand.map(p=>({x:(frame.origin.x-p.x*frame.scale)/w+.35,y:(frame.origin.y+p.y*frame.scale)/h,z:p.z*frame.scale/w})));
     if(data.swap){[pose[15],pose[16]]=[pose[16],pose[15]];hands.reverse()}
     if(data.phase==='hidden-left')hands[0]=null;
     if(data.phase==='hidden-right')hands[1]=null;
     if(data.phase.startsWith('wrist-')||['hidden-both','hidden-lift','body-lost'].includes(data.phase))hands=[null,null];
     if(data.wristVisibility!==undefined)for(const id of [15,16])pose[id].visibility=data.wristVisibility;
     self.postMessage({type:'result',points:['hands-only','body-lost'].includes(data.phase)?null:pose.map(p=>p?{...p,x:p.x/w,y:p.y/h,z:(p.z??0)/w}:{x:0,y:0,visibility:0}),hands:hands.filter(Boolean),time:data.time});
    }
   };`}));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.evaluate(({up,kata,startup,left})=>{window.qaPalmUp=up;window.qaKata=kata;window.qaKataLeft=left;if(startup){window.qaGripPhase='uncrossed';window.qaWristVisibility=.1}},{up:gyakuOnly,kata:kataOnly,startup:startupOnly,left:kataLeft});
  await page.locator('[data-category="katame"]').click();await page.locator('[data-groundwork="shime-waza"]').click();await page.locator(`[data-lesson="${kataOnly?'kata':gyakuOnly?'gyaku':'nami'}"]`).click();
  await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
  if(startupOnly)await page.locator('#pose-list .pose-card').nth(2).click();
  await page.locator('#play').click();
  if(startupOnly){
   await page.waitForFunction(()=>document.querySelector('#mode-label').textContent==='CONNECTING'&&document.querySelector('#overlay').dataset.guideVisible==='false');
   const empty=await page.locator('#overlay').evaluate(c=>{const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=3;i<pixels.length;i+=4)if(pixels[i])return false;return true});
   assert.ok(empty,'loading a camera from the crossed demonstration must clear its arms');
  }
  if(!startupOnly)await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');
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
  if(startupOnly){
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.detectedHands==='2');
   assert.equal(await page.locator('#overlay').getAttribute('data-guide-visible'),'false','camera startup cannot show old crossed demonstration arms');
   assert.equal(await page.locator('#overlay').getAttribute('data-assigned-hands'),'0','uncertain initial pose must not guess detector order');
   await page.evaluate(()=>window.qaWristVisibility=1);
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='2');
   for(const mirror of [true,false]){
    await page.locator('#mirror').setChecked(mirror);await page.waitForTimeout(1000);
    let wrists=JSON.parse(await page.locator('#overlay').getAttribute('data-display-wrists'));
    let elbows=JSON.parse(await page.locator('#overlay').getAttribute('data-display-elbows'));
    assert.ok(wrists.every(Boolean)&&elbows.every(Boolean));
    assert.ok((wrists[0].x-wrists[1].x)*(elbows[0].x-elbows[1].x)>0,'separated hands connect to separated forearms');
    assert.ok(mirror?wrists[0].x<wrists[1].x:wrists[0].x>wrists[1].x);
    await page.evaluate(()=>window.qaSwap=true);await page.waitForTimeout(1000);
    elbows=JSON.parse(await page.locator('#overlay').getAttribute('data-display-elbows'));
    assert.deepEqual(elbows,[null,null],'swapped body wrists cannot draw opposite forearms');
    await page.evaluate(()=>window.qaSwap=false);await page.waitForTimeout(1000);
    elbows=JSON.parse(await page.locator('#overlay').getAttribute('data-display-elbows'));assert.ok(elbows.every(Boolean));
    assert.equal(await grabbed(),'0');
    await page.locator('#viewport').screenshot({path:`.test-output/startup-arms-${mirror}.png`});
   }
   await phase('close',2300);assert.equal(await grabbed(),'2','real crossing is still reflected and can acquire');
   assert.deepEqual(errors,[]);
   console.log('PASS camera startup: uncertain wrists do not seed identity, uncrossed hands/forearms stay uncrossed in both mirror modes, pose wrist swaps do not connect opposite elbows, real crossing still acquires. Synthetic camera landmarks.');
   return;
  }
  const restFabric=await fabricPixels();
  const fixedHead=await headPixels();
  const rest=await page.locator('#partner').evaluate(c=>c.toDataURL());
  assert.equal(await grabbed(),'0');assert.equal(await page.locator('#live-score-value').innerText(),'0');
  if(edgeOnly){
   await page.locator('#back-menu').click();
   for(const lesson of ['nami','gyaku','kata'])for(const mirror of [true,false]){
    await page.locator(`[data-lesson="${lesson}"]`).click();
    await page.evaluate(lesson=>{window.qaPalmUp=lesson==='gyaku';window.qaKata=lesson==='kata';window.qaEdge=false;window.qaGripPhase='open'},lesson);
    await page.locator('#mirror').setChecked(mirror);
    await page.locator('#play').click();
    await phase('open',1500);
    assert.equal(await grabbed(),'0');
    await page.evaluate(()=>window.qaEdge='thin');
    await phase('open',1500);
    assert.equal(await grabbed(),'0',`${lesson}: open profile cannot acquire`);
    await phase('close',1800);
    assert.equal(await grabbed(),'0',`${lesson}, mirror=${mirror}: thin palm with false curled depth must not acquire`);
    await page.evaluate(()=>window.qaEdge=false);
    await phase('close',1400);
    assert.equal(await grabbed(),'2',`${lesson}: turning a prepared grip to the camera can acquire without reopening`);
    await page.evaluate(()=>window.qaEdge='thin');
    await phase('close',1400);
    assert.equal(await grabbed(),'2',`${lesson}: an acquired grip survives wrist rotation to profile`);
    await page.evaluate(()=>window.qaEdge=false);
    await phase('open',1700);
    assert.equal(await grabbed(),'0',`${lesson}: visible opening releases`);
    await page.locator('#back-menu').click();
   }
   assert.deepEqual(errors,[]);
   console.log('PASS thin-palm acquisition rejection with flattened depth, prepared grip acquisition, held profile retention and opening release: Nami/Gyaku/Kata, both mirror modes. Synthetic camera landmarks through actual app tracking and rendering.');
   return;
  }
  if(kataOnly){
   for(const mirror of [true,false]){
    await page.locator('#mirror').setChecked(mirror);
    await phase('open',1000);await phase('close',1400);assert.equal(await grabbed(),'2','mixed grip acquisition');
    await phase('kata-one',2600);assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false','one forearm cannot tap');
    if(kataShoulder){
     await page.locator('.motion-diagnostics summary').click();
     const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save-trace').click()]);
     const path='.test-output/kata-shoulder-trace.json';await download.saveAs(path);
     const trace=JSON.parse(fs.readFileSync(path,'utf8'));assert.equal(trace.technique,'kata');assert.ok(trace.frames.length>0&&trace.frames.length<=300);
     assert.ok(trace.frames.every(f=>f.options.arms.length===2&&f.result.forearmStatus.length===2));
     await page.locator('.motion-diagnostics summary').click();
    }
    await phase('close',1500);
    await phase('kata-hidden',2600);
    await page.waitForFunction(()=>document.querySelector('#opponent-status').dataset.tap==='true');
    const elbows=JSON.parse(await page.locator('#overlay').getAttribute('data-elbows'));
    const forearms=JSON.parse(await page.locator('#overlay').getAttribute('data-forearms'));
    if(kataShoulder){assert.equal(elbows[0],null);assert.match(await page.locator('#diagnostic-left').textContent(),/전완 추적 중/)}
    assert.ok(kataLeft?elbows.some(v=>v<.8):elbows.some(v=>v===0),'elbow-rise alone cannot complete this turn');
    assert.ok(forearms.every(v=>v>.8),'both forearms contribute despite asymmetric elbow rise');
    assert.equal(await page.locator('#overlay').getAttribute('data-wrist-hands'),'2','hidden fingers still show both gloves');
    await page.locator('#viewport').screenshot({path:`.test-output/kata-${kataLeft?'left':'right'}-finish-${mirror}.png`});
    await phase('open',1200);assert.equal(await grabbed(),'0','mixed grip releases');
    await page.locator('#result-dialog').waitFor({state:'visible'});
    if(mirror){await page.locator('#result-again').click();await page.locator('#play').click();await page.waitForTimeout(3100)}
   }
   assert.deepEqual(errors,[]);console.log(kataLeft?'Left forearm perspective variation: enabled.':'Right forearm noise regression.');console.log('PASS Kata mixed-grip acquisition, one-arm rejection, asymmetric forearm finish with hidden fingers and noisy elbow, visible gloves, tap and release in both mirror modes. Synthetic camera landmarks.');return;
  }
  if(gyakuOnly){
   for(const mirror of [true,false]){
    // Each retry starts a new camera session: establish identity before hiding body wrists.
    await page.evaluate(()=>window.qaWristVisibility=1);
    await page.locator('#mirror').setChecked(mirror);
    await phase('hook-open',1200);assert.equal(await grabbed(),'0');
    await phase('hook-close',1400);assert.equal(await grabbed(),'2','a collar hook must acquire without making a full fist');
    await phase('hook-open',1000);assert.equal(await grabbed(),'0','opening a hooked grip releases');
    await phase('close',1400);assert.equal(await grabbed(),'2');
    await page.evaluate(()=>window.qaWristVisibility=.1);
    await phase('gyaku-roll',1200);assert.equal(await grabbed(),'2');
    await phase('gyaku-edge',1800);assert.equal(await grabbed(),'2','self-occluded fingers cannot unlatch');
    assert.deepEqual(JSON.parse(await page.locator('#overlay').getAttribute('data-glove-sources')),['live','live'],'fresh finger shapes must not be overwritten by the grip latch');
    assert.equal(await page.locator('#overlay').getAttribute('data-wrist-hands'),'2','hand-detector wrists keep both gloves visible without body wrists');
    assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false');
    await page.locator('#viewport').screenshot({path:`.test-output/gyaku-occlusion-${mirror}.png`});
    await phase('gyaku-collapsed',1600);assert.equal(await grabbed(),'2','collapsed finger estimates cannot unlatch');
    assert.deepEqual(JSON.parse(await page.locator('#overlay').getAttribute('data-glove-sources')),['wrist','wrist'],'collapsed fingers remain a fallback, not a deformed live glove');
    await phase('gyaku-roll',1200);await phase('gyaku-edge',1000);await phase('gyaku-lift',600);
    await page.waitForFunction(()=>document.querySelector('#opponent-status').dataset.tap==='true');
    await phase('gyaku-open',1000);assert.equal(await grabbed(),'0','intentional opening still releases after a reverse-grip finish');
    await page.locator('#result-dialog').waitFor({state:'visible'});
    if(mirror){await page.locator('#result-again').click();await page.locator('#play').click();await page.waitForTimeout(3100)}
   }
   assert.deepEqual(errors,[]);console.log('PASS Gyaku actual app path, mirrored and unmirrored: open -> collar hook -> release, 3D roll, self-occluded false-open estimates, collapsed fingertips, no body-model wrists, two visible gloves, finish -> tap -> deliberate tilted opening -> release. Synthetic landmarks.');return;
  }
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
   assert.ok(Number(await page.locator('#overlay').getAttribute('data-wrist-hands'))>=1,'a visible wrist keeps the occluded glove on screen');
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
  assert.match(await page.locator('#live-hold').innerText(),/왼 동작 .*% · 오른 동작 .*%/);
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
  await phase('open',1600);await phase('close',1800);assert.equal(await grabbed(),'2');
  await page.evaluate(()=>window.qaWristVisibility=.1);await phase('wrist-still',1200);
  assert.equal(await page.locator('#live-score-value').innerText(),'50');
  assert.equal(await page.locator('#overlay').getAttribute('data-wrist-hands'),'0');
  assert.match(await page.locator('#live-feedback').innerText(),/손목.*인식 대기/);
  await page.evaluate(()=>window.qaWristVisibility=.55);await phase('wrist-return',1200);
  assert.equal(await page.locator('#overlay').getAttribute('data-wrist-hands'),'2','moderate-confidence relocated wrists must recover from 50-point waiting state');
  assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false','recovery itself is not a finish');
  await phase('relaxed-open',1300);assert.equal(await grabbed(),'0');
  await phase('close',1100);assert.equal(await grabbed(),'2');
  await phase('wrist-still',2200);
  assert.equal(await page.locator('#overlay').getAttribute('data-live-hands'),'0');
  assert.equal(await page.locator('#overlay').getAttribute('data-wrist-hands'),'2');
  assert.equal(await page.locator('#opponent-status').getAttribute('data-tap'),'false','stationary wrists do not tap');
  const beforeWrists=JSON.parse(await page.locator('#overlay').getAttribute('data-display-wrists'));
  await phase('wrist-turn',1000);
  assert.equal(await page.locator('#overlay').getAttribute('data-wrist-hands'),'2');
  assert.notDeepEqual(JSON.parse(await page.locator('#overlay').getAttribute('data-display-wrists')),beforeWrists,'gloves follow the pose wrists after full hand loss');
  await page.locator('#viewport').screenshot({path:'.test-output/wrist-only-finish.png'});
  await page.waitForFunction(()=>document.querySelector('#opponent-status').dataset.tap==='true');
  await phase('relaxed-open',800);assert.equal(await grabbed(),'0','real finger opening releases the wrist-followed grip');
  await page.locator('#result-dialog').waitFor({state:'visible'});
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
   assert.deepEqual(JSON.parse(await page.locator('#overlay').getAttribute('data-glove-sources')),['wrist','wrist']);
   await phase('close',600);await phase('relaxed-open',1400);assert.equal(await grabbed(),'0');
   await page.locator('#mirror').check();await page.locator('#back-menu').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS actual grip flow: prepared capture, wide lateral pull rejected, stationary hands plus bilateral elbow rise triggers completion/XP, single elbow rejected, pose loss pauses score, cloth folds, fixed head, release, mobile, palm/back and edge-on rejection with mirroring. Prolonged occlusion preserves grips; reliable pose wrists continue the elbow finish, uncertain wrists cannot score, relaxed three-finger opening releases; a lost hand returns at a new position, releases, regrips and completes without camera reset; rotated held-hand recovery does not move cloth; body loss releases. Wrist-only gloves remain visible with hidden fingers and elbows; opposing wrist turns reach tap, and reopening releases. Synthetic camera landmarks.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
