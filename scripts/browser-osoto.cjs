const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  fs.mkdirSync('.test-output/osoto',{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.qaStage=-1;window.qaDepth=0;window.qaFlat=false;window.qaSmall=false;const Original=Worker;window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame'){d.stage=window.qaStage;d.depth=window.qaDepth;d.flat=window.qaFlat;d.small=window.qaSmall;}super.postMessage(d,t)}}});
  await page.route('**/src/baemilgi-tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   const deps=import('./osoto-practice.js');self.onmessage=async({data})=>{
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const {OSOTO_TARGETS}=await deps,ratio=data.bitmap.height/data.bitmap.width;data.bitmap.close();
     const scale=Math.min(.16,ratio*.20),cy=ratio*.5;
     let points=data.stage<0?null:OSOTO_TARGETS[data.stage].map(p=>p?{x:.5+p.x*scale,y:(cy+p.y*scale)/ratio,z:p.z*scale,visibility:1}:{x:0,y:0,z:0,visibility:0});
     if(data.stage===3){
      const {body,limb}=await import('./throw-motion.js'),rig=body({p:[.15,.94,.24],yaw:0,lean:.12,l:[.23,.065,.38],r:[-.12,.12,-.10]});
      points=Array(33).fill(null);const put=(i,v)=>points[i]={x:.5+(v[0]-rig.pelvis[0])*scale/.49,y:(cy-(v[1]-rig.pelvis[1])*scale/.49)/ratio,z:-(v[2]-rig.pelvis[2])*scale/.49,visibility:1};
      put(0,rig.head);for(const [side,a,e,w,h,k,f,hand]of [['left',11,13,15,23,25,27,[-.2,.08,.21]],['right',12,14,16,24,26,28,[.1,.54,.32]]]){
       const arm=limb(rig.shoulders[side],rig.at(...hand),.33,.31,[0,-1,.2]);put(a,rig.shoulders[side]);put(e,arm.joint);put(w,arm.end);put(h,rig.legs[side].root);put(k,rig.legs[side].joint);put(f,rig.legs[side].end);
      }
      for(const i of [0,13,14,15,16])points[i]=null;points[28].visibility=.3;
     }
     if(points&&data.depth)for(const i of [11,12])points[i].z+=data.depth;
     if(points&&data.flat){points[27].y=points[28].y=(points[27].y+points[28].y)/2;points[27].z=scale*.2;points[28].z=-scale*.2;}
     if(points&&data.small){const floor=(points[27].y+points[28].y)/2;points[27].y=floor-scale*.04/ratio/2;points[28].y=floor+scale*.04/ratio/2;points[27].z=points[28].z=0;points[27].visibility=points[28].visibility=.5;}
     self.postMessage({type:'result',points,time:data.time});
    }
   }`}));
  const base=process.env.SITE_URL||'http://localhost:5174/dist';
  await page.goto(base+'/throws/o-soto-gari');await page.locator('#osoto-start').waitFor();
  assert.equal(await page.locator('#osoto-title').innerText(),'초기자세 오른발 앞');assert.equal(/Initial/i.test(await page.locator('#throw-screen').innerText()),false);
  await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.playing==='true');
  assert.equal(await page.locator('#osoto-3d').isVisible(),true);assert.equal(await page.locator('#osoto-canvas').isVisible(),false);const pixels=await page.locator('#osoto-3d').evaluate(c=>c.toDataURL());const first=Number(await page.locator('#osoto-canvas').getAttribute('data-time'));await page.waitForTimeout(2300);
  assert(Number(await page.locator('#osoto-canvas').getAttribute('data-time'))>first+1);assert.notEqual(await page.locator('#osoto-3d').evaluate(c=>c.toDataURL()),pixels,'animation must change the drawn pose');
  await page.locator('#osoto-demo').click();const paused=await page.locator('#osoto-canvas').getAttribute('data-time');await page.waitForTimeout(250);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-time'),paused);
  for(const view of ['front','side','oblique']){await page.locator('[data-osoto-view='+view+']').click();await page.waitForTimeout(120);assert.equal(await page.locator('[data-osoto-view='+view+']').getAttribute('aria-pressed'),'true');await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-'+view+'.png'});}
  assert.equal(await page.locator('#osoto-solo').isChecked(),false);assert.equal(await page.locator('#osoto-3d').getAttribute('data-solo'),'false');
  await page.locator('#osoto-solo').check();await page.waitForFunction(()=>document.querySelector('#osoto-3d').dataset.solo==='true');
  await page.locator('#osoto-solo').uncheck();await page.waitForFunction(()=>document.querySelector('#osoto-3d').dataset.solo==='false');
  const {throwTimeAtElapsed,THROW_DURATION}=await import('../src/throw-playback.js');
  for(const [seek,stage]of [['0',0],['350',1],['600',2],['900',3]]){
   await page.locator('#osoto-seek').fill(seek);
   const time=throwTimeAtElapsed(Number(seek)/1000*THROW_DURATION);
   await page.waitForFunction(time=>document.querySelector('#osoto-3d').dataset.time===time.toFixed(4),time);
   assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),String(stage));
   const originalMatches=await page.evaluate(async time=>{
    const {sampleThrow}=await import('/dist/src/throw-motion.js'),{createThrowRenderer}=await import('/dist/src/throw-render.js');
    const actual=document.querySelector('#osoto-3d'),box=actual.getBoundingClientRect(),reference=document.createElement('canvas');
    reference.style=`position:absolute;left:-10000px;width:${box.width}px;height:${box.height}px`;document.body.append(reference);
    const renderer=createThrowRenderer(reference);renderer.draw(sampleThrow('o-soto-gari',time),{yaw:1.05,pitch:.18,solo:false,gold:true});
    const matches=actual.toDataURL()===reference.toDataURL();renderer.dispose();reference.remove();return matches;
   },time);
   assert.equal(originalMatches,true,'2-person demo matches the original right-handed motion, independent of practice guide changes');
   await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-step-'+stage+'.png'});
  }
  await page.locator('#osoto-seek').fill('1000');await page.waitForFunction(()=>Number(document.querySelector('#osoto-3d').dataset.time)>=2.99);await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/3d-finish.png'});await page.locator('#osoto-speed').selectOption('0.5');
  await page.locator('#osoto-reset').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.stage==='0');
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/initial-front.png'});
  assert.equal(await page.locator('#osoto-3d').evaluate(v=>getComputedStyle(v).transform),'none','original 3D demonstration is not mirrored');
  const handedness=await page.evaluate(async()=>{const {OSOTO_TARGETS,createOsotoGuideProjection}=await import('/dist/src/osoto-practice.js');return [0,300].map(offset=>{const p=createOsotoGuideProjection(300,420,offset).project(OSOTO_TARGETS[0]);return p[28].x>p[27].x&&p[16].x>p[15].x;});});
  assert.deepEqual(handedness,[true,true],'gold and blue guides show right hand and foot on screen-right');
  await page.locator('#osoto-start').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.ready==='true');assert.equal(await page.locator('#osoto-3d').isVisible(),false);assert.equal(await page.locator('#osoto-canvas').isVisible(),true);
  for(const id of ['osoto-video','osoto-tracking'])assert.equal(await page.locator('#'+id).evaluate(v=>getComputedStyle(v).transform),'matrix(-1, 0, 0, 1, 0, 0)','camera practice remains mirrored separately from demonstration');
  const guide=await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL());
  const targetBox=await page.locator('#osoto-target').boundingBox(),stageBox=await page.locator('.osoto-stage').boundingBox();
  assert(targetBox.width<stageBox.width*.61&&targetBox.x>stageBox.x+stageBox.width*.3&&targetBox.y>stageBox.y+stageBox.height*.5);
  await page.evaluate(()=>window.qaStage=1);await page.waitForTimeout(350);
  assert.notEqual(await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL()),guide,'blue character must respond to tracked posture');
  await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.tracked==='true');
  assert.equal(await page.locator('#osoto-tracking').isVisible(),true);
  await page.waitForFunction(()=>document.querySelector('#osoto-tracking').dataset.tracked==='true');
  assert.equal(await page.locator('#osoto-target-legend').isVisible(),true);
  const colors=await page.locator('#osoto-canvas').evaluate(c=>{
   const rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data,count={goldLeft:0,goldRight:0,blueLeft:0,blueRight:0};
   for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const i=(y*c.width+x)*4,side=x<c.width/2?'Left':'Right';
    if(rgba[i]===214&&rgba[i+1]===162&&rgba[i+2]===77)count['gold'+side]++;
    if(rgba[i]===110&&rgba[i+1]===188&&rgba[i+2]===229)count['blue'+side]++;
   }
   return count;
  });
  assert(colors.goldLeft>100&&colors.blueRight>100);assert.equal(colors.goldRight,0);assert.equal(colors.blueLeft,0);
  const stableAvatar=await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL());
  const stableSticks=await page.locator('#osoto-tracking').evaluate(c=>c.toDataURL());
  await page.evaluate(()=>window.qaDepth=4);await page.waitForTimeout(350);
  assert.equal(await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL()),stableAvatar,'inferred depth cannot shrink the blue avatar');
  assert.equal(await page.locator('#osoto-tracking').evaluate(c=>c.toDataURL()),stableSticks,'camera sticks stay on the same image coordinates');
  await page.evaluate(()=>window.qaDepth=0);
  await page.locator('#osoto-target').screenshot({path:'.test-output/osoto/live-comparison.png'});
  await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/camera-tracking.png'});
  await page.evaluate(()=>window.qaStage=-1);
  await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.tracked==='false');
  await page.waitForFunction(()=>document.querySelector('#osoto-tracking').dataset.tracked==='false');
  assert.equal(await page.locator('#osoto-tracking').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),false);
  assert.equal(await page.locator('#osoto-canvas').evaluate(c=>c.toDataURL()),guide,'stale user character clears while target stays fixed');
  await page.screenshot({path:'.test-output/osoto/corner-guide.png',fullPage:true});
  await page.waitForTimeout(4500);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0');
  await page.evaluate(()=>{window.qaStage=0;window.qaFlat=true;});await page.waitForTimeout(1800);
  assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),'0','level feet with noisy estimated depth cannot clear the starting stance');
  assert(Number((await page.locator('#osoto-score').innerText()).replace('%',''))<55);
  await page.evaluate(()=>window.qaFlat=false);
  for(let stage=0;stage<4;stage++){
   await page.evaluate(s=>{window.qaStage=s;window.qaSmall=s===0;},stage);
   await page.waitForFunction(s=>{const c=document.querySelector('#osoto-canvas');return s===3?c.dataset.done==='true':c.dataset.stage===String(s+1)},stage);
   if(stage<3){await page.waitForTimeout(2600);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-stage'),String(stage+1),'previous pose cannot skip the next stage');await page.locator('.osoto-stage').screenshot({path:'.test-output/osoto/front-'+(stage+1)+'.png'});}
  }
  assert.equal(await page.locator('#osoto-score').innerText(),'Perfect');await page.screenshot({path:'.test-output/osoto/complete.png',fullPage:true});
  await page.evaluate(()=>window.qaStage=-1);await page.locator('#osoto-reset').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.stage==='0');
  await page.locator('#osoto-demo').click();await page.waitForFunction(()=>!document.querySelector('#osoto-video').srcObject&&document.querySelector('#osoto-canvas').dataset.demo==='true');assert.equal(await page.locator('#osoto-3d').isVisible(),true);
  assert.equal(await page.locator('#osoto-tracking').isVisible(),false);
  for(const id of ['o-uchi-gari','ippon-seoi-nage']){await page.goto(base+'/throws/'+id);await page.locator('#throw-play').waitFor();assert.equal(await page.locator('#osoto-start').count(),0);await page.locator('#throw-play').click();await page.waitForFunction(()=>document.querySelector('#throw-canvas').dataset.playing==='true');}
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/throws/o-soto-gari?lang=en');await page.locator('#osoto-start').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(/[가-힣]/.test(await page.locator('#throw-screen').innerText()),false);
  await page.screenshot({path:'.test-output/osoto/mobile-en.png',fullPage:true});assert.deepEqual(errors,[]);
  console.log('PASS: original paired demo unchanged at four moments, earlier practice stages preserved, low-leg/slight-lean finish completes with hidden face/arms and partial rear-ankle confidence, reset/stop, mobile English. Synthetic landmarks; real camera accuracy not measured.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
