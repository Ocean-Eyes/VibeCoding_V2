
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   const get=HTMLCanvasElement.prototype.getContext;
   HTMLCanvasElement.prototype.getContext=function(kind,options){return get.call(this,kind,kind==='2d'?{...options,willReadFrequently:true}:options)};
   const Original=Worker;window.qa={side:0,up:false,closed:false};
   window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame')d.qa={...window.qa};super.postMessage(d,t)}};
  });
  await page.route('**/tests/fixtures/collar-hands.mjs',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('tests/fixtures/collar-hands.mjs','utf8')}));
  await page.route('**/src/tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   const deps=Promise.all([import('./pose.js'),import('/tests/fixtures/collar-hands.mjs')]);
   self.onmessage=async({data})=>{
    const [{POSES,targetPose},{handAt}]=await deps;
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const w=data.bitmap.width,h=data.bitmap.height;data.bitmap.close();
     const f={origin:{x:w*.5,y:h*.32},scale:w*.18,x:{x:1,y:0},y:{x:0,y:1}},pose=targetPose(f,POSES[0]),i=data.qa.side;
     const hand=handAt({x:i?-.285:.285,y:.015},data.qa.closed?1:0,i===0,data.qa.up).map(p=>({x:(f.origin.x-p.x*f.scale)/w,y:(f.origin.y+p.y*f.scale)/h,z:p.z*f.scale/w}));
     pose[15+i]={...hand[0],x:hand[0].x*w,y:hand[0].y*h};
     self.postMessage({type:'result',points:pose.map(p=>p?{...p,x:p.x/w,y:p.y/h}:{x:0,y:0,visibility:0}),hands:[hand],time:data.time});
    }
   };`}));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="katame"]').click();
  let cases=0;
  for(const width of [1440,390])for(const [lesson,up]of [['nami',false],['gyaku',true]])for(const side of [0,1])for(const mirrored of [true,false]){
   await page.setViewportSize({width,height:1050});
   await page.evaluate(qa=>window.qa=qa,{side,up,closed:false});
   await page.locator('[data-lesson="'+lesson+'"]').click();
   await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
   await page.locator('#mirror').setChecked(mirrored);
   await page.locator('#play').click();
   await page.waitForFunction(()=>document.querySelector('#overlay').dataset.liveHands==='1').catch(async error=>{
    console.error('Capture setup failed',JSON.stringify({width,lesson,side,mirrored,status:await page.locator('#notice').innerText(),hands:await page.locator('#overlay').getAttribute('data-live-hands')}));
    throw error;
   });
   await page.waitForTimeout(250);
   const trace=await page.evaluate(async()=>{
    const c=document.querySelector('#partner'),overlay=document.querySelector('#overlay');
    const rest=c.toDataURL(),dims=[c.width,c.height];window.qa.closed=true;
    let acquired=false,maxDisplacement=0,changed=false,frames=0,start=performance.now();
    while(performance.now()-start<950){
     await new Promise(requestAnimationFrame);
     if(overlay.dataset.grabbed==='1')acquired=true;
     const grips=JSON.parse(overlay.dataset.grips);
     for(const g of grips)if(g)maxDisplacement=Math.max(maxDisplacement,Math.hypot(g.dx,g.dy));
     if(c.toDataURL()!==rest)changed=true;
     if(c.width!==dims[0]||c.height!==dims[1])throw Error('partner canvas resized on capture');
     frames++;
    }
    return {acquired,maxDisplacement,changed,frames};
   });
   assert.equal(trace.acquired,true,JSON.stringify({width,lesson,side,mirrored,trace}));
   assert.equal(trace.changed,false,JSON.stringify({width,lesson,side,mirrored,trace}));
   assert.ok(trace.maxDisplacement<1e-8);
   if(side===0&&mirrored)await page.locator('#viewport').screenshot({path:'.test-output/single-grip-'+lesson+'-'+width+'.png'});
   await page.locator('#back-menu').click();cases++;
  }
  assert.deepEqual(errors,[]);
  console.log('PASS single-grip capture through full camera pipeline: '+cases+' desktop/mobile, left/right, palm/back and mirror cases; no coat pixel changes while closing at the photographed neck position. Synthetic input.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
