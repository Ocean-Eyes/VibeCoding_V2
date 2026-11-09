const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://127.0.0.1:5173/dist/design/atmosphere.html';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('.scene').dataset.shader==='ready');
  const sample=()=>page.evaluate(()=>{
   const c=document.querySelector('#ink-fluid');
   window.inkShader.draw(Number(c.dataset.time),{x:-9999,y:-9999},.62,false);
   const gl=c.getContext('webgl'),pixels=new Uint8Array(c.width*c.height*4);
   gl.readPixels(0,0,c.width,c.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
   const result=[];for(let i=0;i<pixels.length;i+=64)result.push(pixels[i]+pixels[i+1]+pixels[i+2]);
   return {result,error:gl.getError()};
  });
  await page.waitForTimeout(250);const first=await sample();
  await page.waitForTimeout(1200);const second=await sample();
  assert.equal(first.error,0);assert.equal(second.error,0);
  const changed=first.result.filter((v,i)=>Math.abs(v-second.result[i])>8).length/first.result.length;
  assert(changed>.05,'visible shader pixels must change, not just an animation timer');
  await page.mouse.move(1050,380);await page.waitForTimeout(250);
  await page.locator('[data-course=throws]').click();await page.locator('[data-lesson="1"]').click();
  assert.equal(await page.locator('#lesson-roman').textContent(),'O-UCHI-GARI');
  await page.locator('#motion').click();const paused=await sample();await page.waitForTimeout(200);
  assert.deepEqual(await sample(),paused);
  assert.equal(await page.locator('.footer a').count(),0);
  assert.equal(await page.locator('.space-mark').textContent(),'柔道');
  const extension=await page.evaluate(()=>!!document.querySelector('#ink-fluid').getContext('webgl').getExtension('WEBGL_lose_context'));
  if(extension){
   await page.evaluate(()=>document.querySelector('#ink-fluid').getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
   await page.waitForFunction(()=>document.querySelector('.scene').dataset.shader==='fallback');
   await page.locator('#start').click();assert(await page.locator('dialog').isVisible());await page.keyboard.press('Escape');
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();
  await page.waitForFunction(()=>document.querySelector('.scene').dataset.shader==='ready');
  assert.equal(await page.locator('#motion').getAttribute('aria-pressed'),'false');
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log(`PASS: OGL rendering (${Math.round(changed*100)}% sampled pixels visibly changed), GL errors=0, pause, menus, context-loss fallback, reduced motion, mobile.`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
