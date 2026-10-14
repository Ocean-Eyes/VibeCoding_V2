const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const enter=async p=>{await p.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');await p.locator('[data-category="basics"]').click();await p.locator('[data-lesson="belt"]').click();await p.waitForFunction(()=>document.querySelectorAll('[data-belt-step]').length===7&&document.querySelector('#belt-canvas').dataset.sourceState==='ready')};
  await enter(page);
  await page.locator('[data-belt-step="4"]').click();
  assert.match(await page.locator('#belt-source').getAttribute('href'),/F-NJFRGi6ys.*t=15s/);
  assert.match(await page.locator('#belt-source-2').getAttribute('href'),/IG5WBxopLJw.*t=20.5s/);
  const phase=()=>page.locator('#belt-canvas').getAttribute('data-phase');
  const travel=async speed=>{
   await page.locator('#belt-scrub').fill('10');await page.locator('#belt-speed').selectOption(speed);
   await page.locator('#belt-play').click();await page.waitForTimeout(600);await page.locator('#belt-play').click();
   const value=Number(await page.locator('#belt-scrub').inputValue());
   await page.waitForTimeout(50);const before=await phase();await page.waitForTimeout(220);assert.equal(await phase(),before,'pause freezes the cloth');
   return value;
  };
  const slow=await travel('0.5'),fast=await travel('1.5');assert.ok(fast>slow+6,`speed changes progress: ${slow}, ${fast}`);
  await page.locator('#belt-speed').selectOption('1');await page.locator('#belt-scrub').fill('16');
  await page.locator('#belt-play').click();await page.waitForFunction(()=>document.querySelector('#belt-film-status').textContent==='통과 지점 확인');
  const held=await phase();await page.waitForTimeout(220);assert.equal(await phase(),held,'inspection holds still');await page.locator('#belt-play').click();
  await page.locator('#belt-scrub').fill('100');await page.waitForTimeout(100);assert.equal(await page.locator('#belt-canvas').getAttribute('data-step'),'4','scrubbing does not advance lesson');
  await page.locator('#belt-scrub').fill('96');await page.locator('#belt-play').click();await page.waitForFunction(()=>document.querySelector('#belt-canvas').dataset.step==='5');
  await page.locator('#back-menu').click();await page.waitForTimeout(800);assert.ok(await page.locator('#home-screen').isVisible());
  const reduced=await browser.newPage({reducedMotion:'reduce'});await enter(reduced);await reduced.waitForTimeout(650);
  assert.equal(await reduced.locator('#belt-film-status').textContent(),'단계 완료');
  assert.equal(await reduced.locator('#belt-canvas').getAttribute('data-phase'),'0');
  assert.equal(await reduced.locator('#belt-scrub').inputValue(),'100');
  await reduced.locator('[data-belt-step="4"]').click();await reduced.waitForTimeout(150);assert.equal(await reduced.locator('#belt-canvas').getAttribute('data-phase'),'4');
  assert.deepEqual(errors,[]);
  console.log('PASS anime.js: reference time links, slow/fast playback, pause/resume, insertion hold, muted scrubbing, auto advance, cleanup and reduced motion.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
