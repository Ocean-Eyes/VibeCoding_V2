const {chromium}=require(process.argv[2]||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1365,height:768}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SITE_URL||'http://127.0.0.1:5173/dist/index.html');await page.locator('[data-category="basics"]').click();await page.locator('[data-lesson="belt"]').click();await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');await page.locator('[data-belt-step="6"]').click();await page.locator('[data-belt-view="oblique"]').click();await page.locator('#belt-detail').scrollIntoViewIfNeeded();
 const state=()=>page.evaluate(()=>({scroll:scrollY,camera:JSON.parse(document.querySelector('#belt-detail').dataset.camera)}));
 // A real wheel over the panel padding must not scroll the document.
 for(const [selector,position] of [['.belt-closeup','padding'],['#belt-detail-hint','center'],['#belt-detail','center']]){
  const box=await page.locator(selector).boundingBox();await page.mouse.move(position==='padding'?box.x+5:box.x+box.width/2,position==='padding'?Math.max(10,box.y+30):box.y+box.height/2);const before=await state();await page.mouse.wheel(0,120);await page.waitForTimeout(350);const after=await state();assert.ok(after.camera.zoom>before.camera.zoom,`${selector}: wheel must zoom`);assert.equal(after.scroll,before.scroll,`${selector}: page must stay still`);
 }
 fs.mkdirSync('.test-output/belt-wheel',{recursive:true});await page.screenshot({path:'.test-output/belt-wheel/zoom.png'});
 const box=await page.locator('#belt-detail').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);const before=await state();await page.mouse.wheel(0,-120);await page.waitForTimeout(350);assert.ok((await state()).camera.zoom<before.camera.zoom);assert.equal((await state()).scroll,before.scroll);
 // Outside the panel and in front mode the page keeps its normal scroll.
 await page.mouse.move(50,350);const outside=await state();await page.mouse.wheel(0,120);await page.waitForTimeout(350);assert.ok((await state()).scroll>outside.scroll);assert.deepEqual((await state()).camera,outside.camera);
 await page.locator('[data-belt-view="front"]').click();await page.locator('#belt-detail').scrollIntoViewIfNeeded();const front=await state(),r=await page.locator('#belt-detail').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,120);await page.waitForTimeout(350);assert.ok((await state()).scroll>front.scroll);assert.deepEqual((await state()).camera,front.camera);assert.deepEqual(errors,[]);
 console.log('PASS real wheel over 3D canvas, panel padding and hint: zoom without page scroll; outside/front scroll normally.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
