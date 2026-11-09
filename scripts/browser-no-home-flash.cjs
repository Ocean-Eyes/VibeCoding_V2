const {chromium}=require(process.argv[2]||'playwright');const assert=require('node:assert/strict');
const base=process.env.SITE_URL||'http://127.0.0.1:5174/dist/';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const [path,screen]of [['katame-waza/shime-waza/nami-juji-jime','#practice-screen'],['throws/o-soto-gari','#throw-screen'],['basics/belt','#belt-screen']]){
  let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/src/academy.js*',async route=>{await gate;await route.continue();});
  await page.goto(base+path,{waitUntil:'commit'});
  await page.locator('#home-screen').waitFor({state:'attached'});
  await page.waitForTimeout(500);
  assert(await page.locator('#home-screen').evaluate(el=>el.hidden),'old homepage must be hidden before application JavaScript runs');
  assert.equal(await page.locator('.ink-hero').isVisible(),false);
  release();await page.locator(screen).waitFor({state:'visible'});
  assert.equal(await page.locator('#home-screen').isVisible(),false);
  await page.unroute('**/src/academy.js*');
  await page.locator('#back-menu').click();await page.locator('[data-course]').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.ink-hero').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('PASS: no old UI before delayed application startup, three lesson types open, return to new category menu');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
