const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.handDraws=[];
   const context=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(type,...args){if(type.includes('webgl'))throw Error('Runtime GPU rendering must not be needed');return context.call(this,type,...args)};
   const draw=CanvasRenderingContext2D.prototype.drawImage;
   CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
    if(image.src?.includes('/hands-aah-v1/')){const m=this.getTransform();window.handDraws.push({canvas:this.canvas.id,asset:new URL(image.src).pathname.split('/').pop(),det:m.a*m.d-m.b*m.c});if(window.handDraws.length>200)window.handDraws.shift()}
    return draw.call(this,image,...args);
   };
  });
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="katame"]').click();
  const renders=[];
  for(const [id,faces]of [['nami',['back','back']],['gyaku',['palm','palm']],['kata',['palm','back']]]){
   await page.evaluate(()=>window.handDraws=[]);await page.locator(`[data-lesson="${id}"]`).click();
   await page.waitForFunction(()=>window.handDraws.some(d=>d.canvas==='grip-preview'));
   const calls=await page.evaluate(()=>window.handDraws.filter(d=>d.canvas==='grip-preview'));
   assert.deepEqual(calls.map(c=>c.asset),[`left-${faces[0]}-skin.png`,`right-${faces[1]}-skin.png`]);
   renders.push(await page.locator('#grip-preview').evaluate(c=>c.toDataURL()));
   await page.locator('#mirror').uncheck();await page.evaluate(()=>window.handDraws=[]);await page.waitForTimeout(150);
   const reflected=await page.evaluate(()=>window.handDraws.filter(d=>d.canvas==='overlay'));
   assert.ok(reflected.some(d=>d.asset===`left-${faces[0]}-glove.png`&&d.det<0));
   assert.ok(reflected.some(d=>d.asset===`right-${faces[1]}-glove.png`&&d.det<0));
   await page.locator('#mirror').check();await page.locator('#back-menu').click();
  }
  assert.equal(new Set(renders).size,3);
  for(const width of [390,320]){
   await page.setViewportSize({width,height:950});await page.locator('[data-lesson="nami"]').click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('.lesson-reference').screenshot({path:`.test-output/reference-rig-${width}.png`});
   await page.locator('#back-menu').click();
  }
  assert.deepEqual(errors,[]);console.log('PASS reference rig: correct anatomical asset per limb and technique, whole-arm mirroring, no runtime WebGL dependency, mobile layout');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
