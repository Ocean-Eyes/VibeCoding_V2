const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const base=process.env.SITE_URL||'http://127.0.0.1:5174/dist/';
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const cases=[['katame','shime',0,'katame-waza/shime-waza/nami-juji-jime','#practice-screen'],['katame','shime',1,'katame-waza/shime-waza/kata-juji-jime','#practice-screen'],['katame','shime',2,'katame-waza/shime-waza/gyaku-juji-jime','#practice-screen'],['katame','kansetsu',0,'katame-waza/kansetsu-waza/ude-garami','#throw-screen'],['katame','osaekomi',0,'katame-waza/osaekomi-waza/kesa-gatame','#throw-screen'],['throws',null,0,'throws/o-soto-gari','#throw-screen'],['throws',null,1,'throws/o-uchi-gari','#throw-screen'],['throws',null,2,'throws/ippon-seoi-nage','#throw-screen'],['basics',null,0,'basics/belt','#belt-screen'],['basics',null,1,'basics/hindu-push-up','#baemilgi-screen']];
 for(const [course,group,lesson,path,screen]of cases){
  console.log('Checking '+path);await page.goto(base);await page.waitForFunction(()=>document.querySelector('.scene')?.dataset.shader==='ready');
  assert.equal(await page.locator('#camera,#motion,dialog').count(),0);
  await page.locator(`[data-course=${course}]`).click();if(group)await page.locator(`[data-group=${group}]`).click();
  await page.locator(`[data-lesson="${lesson}"]`).click();await page.locator('#start').click();
  await page.waitForURL(base+path);await page.locator(screen).waitFor({state:'visible'});
  await page.locator(screen+' canvas:visible').first().waitFor({state:'visible'});
  if(screen==='#belt-screen')await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.sourceState==='ready');
  await page.waitForFunction(()=>document.querySelector('.lesson-atmosphere')?.dataset.shader==='ready');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(226, 225, 217)');
  await page.screenshot({path:'.test-output/design/lesson-'+path.split('/').pop()+'.png'});
  await page.locator('#back-menu').click();await page.locator('.scene').waitFor({state:'visible'});
  assert.equal(await page.locator(`[data-course=${course}]`).getAttribute('aria-current'),'true');
  if(group)assert.equal(await page.locator(`[data-group=${group}]`).getAttribute('aria-current'),'true');
 }
 await page.goto(base+'throws/o-soto-gari');await page.locator('#throw-screen canvas:visible').first().waitFor({state:'visible'});
 await page.locator('#brand-home').click();await page.waitForURL(base);await page.locator('.scene').waitFor();
 const t=await page.locator('#ink-fluid').getAttribute('data-time');await page.waitForTimeout(900);assert(Number(await page.locator('#ink-fluid').getAttribute('data-time'))>Number(t));
 await page.screenshot({path:'.test-output/design/main-live.png'});
 await page.locator('[data-course=basics]').click();
 assert.deepEqual(await page.locator('[data-lesson]').evaluateAll(items=>items.map(item=>item.firstChild.textContent)),['띠 매는 법','배밀기','낙법']);
 await page.locator('[data-lesson="2"]').click();assert(await page.locator('#start').isDisabled());
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('PASS: all 10 lessons open from new homepage, real lesson canvases, category return, direct route, home return, VFX, unavailable lesson disabled, mobile, no JS errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
