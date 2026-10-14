const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const enter=async page=>{await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');await page.locator('[data-category="basics"]').click();await page.locator('[data-lesson="belt"]').click()};
 const pattern='**/tracked-v4-*.json.gz';
 try{
  for(const kind of ['download','integrity']){
   const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.route(pattern,r=>kind==='download'?r.fulfill({status:503,body:'offline'}):r.fulfill({status:200,body:'{}'}));
   await enter(p);await p.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='error');
   assert.ok(await p.locator('#belt-retry').isVisible());assert.ok(await p.locator('#belt-play').isDisabled());
   await p.unroute(pattern);await p.locator('#belt-retry').click();await p.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');
   await p.locator('[data-belt-step="4"]').click();await p.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.pts==='15.5');
   assert.equal(await p.locator('#belt-detail').getAttribute('data-pts'),'15.5');
   assert.ok(Number(await p.locator('#belt-canvas').getAttribute('data-belt-regions'))>0);
   assert.equal(await p.locator('[data-belt-view="back"]').count(),0);assert.equal(await p.locator('[data-belt-view="side"]').count(),0);
   assert.deepEqual(errors,[]);await p.close();
  }
  const p=await browser.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));let release,requested=false;
  await p.route(pattern,async r=>{requested=true;await new Promise(resolve=>release=resolve);await r.abort().catch(()=>{})});
  await enter(p);await p.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='loading');
  while(!requested)await p.waitForTimeout(20);
  await p.locator('#back-menu').click();release();await p.waitForTimeout(150);assert.ok(await p.locator('#home-screen').isVisible());
  await p.unroute(pattern);await p.locator('[data-lesson="belt"]').click();await p.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');
  const resources=await p.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.includes('tracked-v4-')).map(r=>({name:r.name,encodedBodySize:r.encodedBodySize,decodedBodySize:r.decodedBodySize,transferSize:r.transferSize})));
  assert.ok(resources.some(r=>r.encodedBodySize>3000000&&r.encodedBodySize<3300000),'explicit gzip transport stays approximately 3.2 MB');
  const pixels=await p.locator('#belt-canvas').evaluate(c=>({regions:c.dataset.beltRegions,frame:c.dataset.frame,pts:c.dataset.pts,renderSource:c.dataset.renderSource}));
  fs.writeFileSync('.test-output/belt-source-browser.json',JSON.stringify({resources,pixels,errors},null,2));assert.deepEqual(errors,[]);
  console.log('PASS source: failed download, bad hash, retry, close during fetch, reopen, actual gzip transfer, same PTS detail and front-only UI.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
