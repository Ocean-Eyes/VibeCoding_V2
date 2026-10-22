const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const server=process.env.TEST_SERVER||'http://127.0.0.1:5187';
const output='.test-output/visitors';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1365,height:1000}});
  await context.addInitScript(()=>Object.defineProperty(navigator,'webdriver',{get:()=>false}));
  await context.route('https://justjudo.app/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.startsWith('/_vercel/'))return route.fulfill({body:'',contentType:'application/javascript'});
   const response=await context.request.get(server+'/dist'+u.pathname+u.search);
   if(response.headers()['content-type']?.includes('text/html'))return route.fulfill({response,body:(await response.text()).replace('<base href="/dist/" />','<base href="/" />')});
   await route.fulfill({response});
  });
  const visits=new Map(),writes=[];let unavailable=false;
  await context.route('**/api/visitors',async route=>{
   if(unavailable)return route.fulfill({status:503,json:{error:'unavailable'}});
   const req=route.request();if(req.method()==='POST'){
    const b=req.postDataJSON();writes.push(b);
    if(b.action==='exclude')visits.set(b.id,'excluded');
    else if(!visits.has(b.id)||b.action==='include')visits.set(b.id,'KR');
   }
   const count=Array.from(visits.values()).filter(v=>v!=='excluded').length;
   await route.fulfill({json:{total:1241+count,countries:[{country:'KR',count:1000+count},{country:'US',count:200},{country:'JP',count:40},{country:'ZZ',count:1}]}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://justjudo.app/');
  await page.waitForFunction(()=>document.querySelector('#visitor-total')?.textContent==='1,242명');
  assert.equal(writes.length,1);
  await page.waitForFunction(()=>document.querySelectorAll('.visitor-flag img').length===3);
  await page.screenshot({path:output+'/desktop.png',fullPage:true});
  await page.reload();await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.equal(writes.length,1);
  await page.locator('.visitor-settings summary').click();await page.locator('#visitor-exclude').click();await page.waitForFunction(()=>document.querySelector('#visitor-total').textContent==='1,241명');
  assert.equal(writes.at(-1).action,'exclude');
  await page.reload();await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.equal(writes.length,2);
  assert.equal(await page.locator('#visitor-exclude').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>window.vaq.find(v=>v[0]==='beforeSend')[1]({url:location.href})),null);
  await page.locator('.visitor-settings summary').click();await page.locator('#visitor-exclude').click();await page.waitForFunction(()=>document.querySelector('#visitor-total').textContent==='1,242명');assert.equal(writes.at(-1).action,'include');
  await page.goto('https://justjudo.app/?exclude_visits=1');await page.waitForFunction(()=>document.querySelector('#visitor-total').textContent==='1,241명');
  assert(!new URL(page.url()).searchParams.has('exclude_visits'));
  await page.locator('.visitor-settings summary').click();await page.locator('#visitor-exclude').click();
  await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});
  await page.reload();await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.equal(await page.locator('#visitor-exclude').getAttribute('aria-pressed'),'false');
  await page.goto('https://justjudo.app/?exclude_visits=1');await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});
  const oldWrites=writes.length;
  await page.goto('https://justjudo.app/basics/hindu-push-up');await page.locator('#bm-demo-canvas').waitFor();assert(await page.locator('#visitor-stats').isHidden());assert.equal(writes.length,oldWrites);
  await page.goto('https://justjudo.app/?lang=en');await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.match(await page.locator('#visitor-stats').textContent(),/Total visitors/);
  assert.match(await page.locator('#visitor-stats').textContent(),/South Korea/);
  for(const width of [768,1024]){
   await page.setViewportSize({width,height:900});
   const side=await page.locator('#visitor-stats').boundingBox(),note=await page.locator('.margin-note').boundingBox();
   await page.screenshot({path:output+'/tablet-'+width+'.png',fullPage:true});
   assert(side.y+side.height<=note.y||side.x+side.width<=note.x,JSON.stringify({width,side,note}));
  }
  await page.setViewportSize({width:390,height:844});await page.goto('https://justjudo.app/?lang=ko');await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:output+'/mobile.png',fullPage:true});
  unavailable=true;await page.reload();await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.equal(await page.locator('#visitor-total').textContent(),'—');assert.match(await page.locator('#visitor-status').textContent(),/불러오지 못/);
  assert.deepEqual(errors,[]);
  // A first visit through the owner link must never send a visit/include write.
  unavailable=false;await context.clearCookies();await page.evaluate(()=>localStorage.clear());const n=writes.length;
  await page.goto('https://justjudo.app/?exclude_visits=1');await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.deepEqual(writes.slice(n).map(x=>x.action),['exclude']);
  // Storage denial cannot inflate the total on repeated reloads.
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('blocked')}});
  const before=writes.length;await page.goto('https://justjudo.app/');await page.locator('#visitor-exclude:not([disabled])').waitFor({state:'attached'});assert.equal(writes.length,before);assert.match(await page.locator('#visitor-status').textContent(),/저장 공간/);
  console.log('PASS: flags, desktop/mobile, languages, deduplication, exclusion/removal/reload/undo, owner link, storage/API failure, lesson regression; screenshots: '+output);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
