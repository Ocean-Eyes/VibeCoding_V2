const {chromium}=require(process.argv[2]||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{fs.mkdirSync('.test-output/ground',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.qaGroundPhase=-1;window.qaGroundId='ude-garami';const Native=Worker;window.Worker=class extends Native{postMessage(d,t){if(d.type==='frame'){d.phase=window.qaGroundPhase;d.id=window.qaGroundId;}super.postMessage(d,t)}}});
const fixture=fs.readFileSync('tests/ground-fixture.mjs','utf8').replace('export function','function');
await page.route('**/src/tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:fixture+`;
self.onmessage=({data})=>{if(data.type==='init')self.postMessage({type:'ready'});if(data.type==='frame'){const aspect=data.bitmap.height/data.bitmap.width;data.bitmap.close();const f=data.phase<0?{points:null,hands:[]}:groundFixture(data.id,data.phase,aspect);self.postMessage({type:'result',...f,time:data.time});}};`}));
const base='http://localhost:5173/dist';
for(const [id,group,name]of [['ude-garami','kansetsu-waza','팔얽어비틀기'],['kesa-gatame','osaekomi-waza','곁누르기']]){
 await page.goto(base+'/katame-waza/'+group);assert.equal(await page.locator('[data-lesson="'+id+'"]').count(),1);assert.equal(await page.locator('[data-lesson="nami"]').count(),0);
 await page.locator('[data-lesson="'+id+'"]').click();await page.locator('#ground-scene').waitFor();
 assert((await page.locator('#throw-screen h1').innerText()).includes(name));
 const pixels=await page.locator('#ground-scene').evaluate(c=>c.toDataURL());await page.waitForTimeout(6000);assert.notEqual(await page.locator('#ground-scene').evaluate(c=>c.toDataURL()),pixels);
 await page.locator('#ground-play').click();await page.screenshot({path:'.test-output/ground/'+id+'-demo.png',fullPage:true});
 for(const view of ['top','side','angle']){await page.locator('[data-ground-view="'+view+'"]').click();await page.waitForTimeout(100);await page.locator('#ground-scene').screenshot({path:'.test-output/ground/'+id+'-'+view+'.png'});}
 await page.evaluate(id=>{window.qaGroundId=id;window.qaGroundPhase=-1},id);
 await page.locator('#ground-start').click();await page.waitForFunction(()=>document.querySelector('#throw-screen').dataset.groundReady==='true');
 await page.waitForTimeout(2300);assert.equal(await page.locator('#throw-screen').getAttribute('data-ground-stage'),'0');
 if(id==='kesa-gatame'){assert.equal(await page.locator('#ground-scene').isVisible(),false);assert.equal(await page.locator('#ground-guide').isVisible(),true);const a=await page.locator('#ground-guide').boundingBox(),b=await page.locator('.ground-stage').boundingBox();assert(a.x>b.x+b.width/2&&a.y>b.y+b.height/2);}
 await page.screenshot({path:'.test-output/ground/'+id+'-practice.png',fullPage:true});
 await page.evaluate(()=>window.qaGroundPhase=0);await page.waitForFunction(()=>document.querySelector('#throw-screen').dataset.groundStage==='1');
 if(id==='ude-garami'){await page.evaluate(()=>window.qaGroundPhase=2);await page.waitForTimeout(2300);assert.equal(await page.locator('#throw-screen').getAttribute('data-ground-done'),'false');
 await page.evaluate(()=>window.qaGroundPhase=1);await page.waitForFunction(()=>document.querySelector('#throw-screen').dataset.groundUnder==='true');await page.evaluate(()=>window.qaGroundPhase=2);}
 if(id==='ude-garami'){await page.waitForFunction(()=>document.querySelector('#throw-screen').dataset.groundStage==='2');await page.waitForTimeout(1800);assert.equal(await page.locator('#throw-screen').getAttribute('data-ground-done'),'false');await page.evaluate(()=>window.qaGroundPhase=3);}
 await page.waitForFunction(()=>document.querySelector('#throw-screen').dataset.groundDone==='true');assert.equal(await page.locator('#ground-score').innerText(),'Perfect');
 await page.locator('#ground-reset').click();await page.evaluate(()=>window.qaGroundPhase=-1);await page.waitForFunction(()=>document.querySelector('#throw-screen').dataset.groundStage==='0');
 await page.locator('#ground-play').click();await page.waitForFunction(()=>!document.querySelector('#ground-video').srcObject&&document.querySelector('#throw-screen').dataset.groundDemo==='true');
}
await page.setViewportSize({width:390,height:844});await page.goto(base+'/katame-waza/osaekomi-waza/kesa-gatame?lang=en');await page.locator('#ground-start').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(/[가-힣]/.test(await page.locator('#throw-screen').innerText()),false);await page.screenshot({path:'.test-output/ground/mobile-en.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS: categories, routes, animated 3D/views, camera entry, fixed kesa 2D guide, ordered grips/poses, completion/reset, stream cleanup and mobile English (synthetic landmarks).');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
