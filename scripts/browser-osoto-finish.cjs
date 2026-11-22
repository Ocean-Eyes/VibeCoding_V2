const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.qaOptions={};window.qaFrame=0;const Original=Worker;window.Worker=class extends Original{postMessage(d,t){if(d.type==='frame'){d.options=window.qaOptions;d.frame=window.qaFrame++;}super.postMessage(d,t);}};});
  // Expose only the test instance; production UI and source stay unchanged.
  await page.route('**/src/osoto-lesson.js*',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('dist/src/osoto-lesson.js','utf8').replace('progress=new OsotoProgress();','progress=new OsotoProgress();window.qaProgress=progress;')}));
  await page.route('**/src/baemilgi-tracker.js*',r=>r.fulfill({contentType:'text/javascript',body:`
   const deps=import('/tests/fixtures/osoto-finish-corpus.mjs');
   self.onmessage=async({data})=>{
    if(data.type==='init')self.postMessage({type:'ready'});
    if(data.type==='frame'){
     const {finishFixture}=await deps,aspect=data.bitmap.height/data.bitmap.width;data.bitmap.close();
     const o={...data.options,aspect,seed:(data.options.seed||0)+data.frame*3};
     let points=finishFixture(o);
     if(points&&o.gaps&&data.frame>=8&&data.frame<=9)points=null;
     if(points&&o.spike&&data.frame===10)for(const i of [11,12,26,28])points[i].z+=.4;
     if(points&&o.rearPartial)points[28].visibility=.22;
     self.postMessage({type:'result',points:points?.map(p=>p?{...p,y:p.y/aspect}:null),time:data.time});
    }
   }`}));
  await page.goto('http://localhost:5174/dist/throws/o-soto-gari');
  await page.locator('#osoto-start').click();await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.ready==='true');
  await page.waitForTimeout(3100);
  const cases=[
   {name:'low-leg',lean:.14,lift:.10,back:.16},
   {name:'weak-depth',lean:.28,depthGain:.08,noise:.008},
   {name:'tilted-camera',pitch:.20,yaw:.40,roll:.12},
   {name:'short-torso',torso:.43,thigh:.50,shin:.48},
   {name:'long-torso',torso:.56,thigh:.42,shin:.43},
   {name:'hands-hidden',occluded:true},
   {name:'partial-ankle',occluded:true,rearPartial:true,confidence:.4},
   {name:'tracking-gap',gaps:true,noise:.008},
   {name:'depth-spike',spike:true,noise:.008},
  ];
  for(const options of cases){
   await page.evaluate(async options=>{
    const {finishFixture}=await import('/tests/fixtures/osoto-finish-corpus.mjs');
    const video=document.querySelector('#osoto-video'),aspect=video.videoHeight/video.videoWidth;
    window.qaOptions=options;window.qaFrame=0;window.qaProgress.reset();window.qaProgress.stage=3;
    for(let i=0;i<15;i++)window.qaProgress.finishJudge.observeReference(finishFixture({...options,aspect,kind:'standing',noise:0,seed:i}),0);
    for(let i=0;i<15;i++)window.qaProgress.finishJudge.observeReference(finishFixture({...options,aspect,kind:'entry',noise:0,seed:i}),1);
   },options);
   await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.done==='false');
   try{await page.waitForFunction(()=>document.querySelector('#osoto-canvas').dataset.done==='true',{},{timeout:7000});}
   catch(e){console.error(options.name,await page.locator('#osoto-feedback').innerText());throw e;}
   assert.equal(await page.locator('#osoto-score').innerText(),'Perfect');
  }
  for(const kind of ['grounded','left','forward']){
   await page.evaluate(kind=>{window.qaOptions={kind};window.qaFrame=0;window.qaProgress.done=false;window.qaProgress.hold=0;window.qaProgress.finishJudge.frames=[];},kind);
   await page.waitForTimeout(1700);assert.equal(await page.locator('#osoto-canvas').getAttribute('data-done'),'false',kind);
  }
  await page.locator('#osoto-demo').click();assert.equal(await page.locator('#osoto-solo').isChecked(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS actual lesson pipeline: 9 finish variants, tracking gaps/depth spike, 3 incorrect poses, original paired demonstration. Synthetic landmark input.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
