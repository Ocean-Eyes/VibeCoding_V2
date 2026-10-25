const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const server=process.env.TEST_SERVER||'http://127.0.0.1:5173';
const output='.test-output/visitors';
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1365,height:1000}});
 await context.route('**/_vercel/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
 let failure=null,total=1242;const methods=[],errors=[];
 await context.route('**/api/visitors',r=>{methods.push(r.request().method());return r.fulfill(failure?{status:503,json:{error:failure}}:{json:{total,source:'vercel',metric:'visitors',period:'all-time'}})});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.locator('#visitor-stats[data-ready=true]').waitFor({state:'attached'});
 await page.goto(server+'/dist/');await ready();assert.equal(await page.title(),'Just Judo');assert.equal(await page.locator('#visitor-total').textContent(),'1,242명');assert.equal(await page.locator('#visitor-countries').count(),0);
 await page.locator('[data-category="katame"]').click();await page.locator('#brand-home').click();assert.equal(await page.title(),'Just Judo');
 await page.screenshot({path:output+'/vercel-desktop.png',fullPage:true});
 for(const width of [1746,1915,2560]){await page.setViewportSize({width,height:920});const side=await page.locator('#visitor-stats').boundingBox(),hero=await page.locator('.ink-hero').boundingBox();assert(side.x>=width*.04-10&&side.x+side.width<hero.x);}
 await page.goto(server+'/dist/?exclude_visits=1');await ready();assert.equal(await page.locator('#visitor-total').textContent(),'1,242명');assert.equal(await page.evaluate(()=>window.vaq.find(v=>v[0]==='beforeSend')[1]({url:location.href})),null);
 await page.goto(server+'/dist/?exclude_visits=0');await ready();assert.notEqual(await page.evaluate(()=>window.vaq.find(v=>v[0]==='beforeSend')[1]({url:location.href})),null);
 await page.goto(server+'/dist/?lang=en');await ready();assert.equal(await page.title(),'Just Judo');assert.equal(await page.locator('#visitor-total').textContent(),'1,242');assert.match(await page.locator('#visitor-stats').textContent(),/Total visitors/);
 await page.setViewportSize({width:390,height:844});await page.goto(server+'/dist/?lang=ko');await ready();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:output+'/vercel-mobile.png',fullPage:true});
 failure='analytics_not_configured';await page.reload();await ready();assert.equal(await page.locator('#visitor-total').textContent(),'—');assert.match(await page.locator('#visitor-stats').getAttribute('title'),/설정/);
 failure='analytics_unavailable';await page.reload();await ready();assert.equal(await page.locator('#visitor-total').textContent(),'—');assert.match(await page.locator('#visitor-stats').getAttribute('title'),/불러오지 못/);
 failure=null;total=0;await page.reload();await ready();assert.equal(await page.locator('#visitor-total').textContent(),'0명');
 await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw Error('blocked')}});total=1242;await page.reload();await ready();assert.equal(await page.locator('#visitor-total').textContent(),'1,242명');
 assert(methods.every(m=>m==='GET'));assert.deepEqual(errors,[]);console.log('PASS: mocked Vercel Visitors, no countries/writes, title after navigation, languages, owner event opt-out, cache-independent zero/error states, blocked storage, desktop/mobile.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
