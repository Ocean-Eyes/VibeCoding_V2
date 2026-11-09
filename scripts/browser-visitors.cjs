const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),reads=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/visitors'))reads.push(r.url())});
 await page.route('**/_vercel/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
 for(const path of ['/dist/','/dist/?lang=en','/dist/katame-waza']){
  await page.goto('http://127.0.0.1:5173'+path);await page.locator('#brand-home').waitFor();
  assert.equal(await page.locator('#visitor-stats').count(),0);assert.equal(await page.locator('#visitor-total').count(),0);
 }
 assert.equal(await page.evaluate(()=>window.vaq.find(v=>v[0]==='beforeSend')[1]({type:'pageview'})),null);
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:5173/dist/');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(reads,[]);assert.deepEqual(errors,[]);console.log('PASS: visitor UI removed, no visitor API requests, analytics bot filter retained, desktop/mobile navigation.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
