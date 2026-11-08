const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.SITE_URL||'http://127.0.0.1:5186/dist/';
const colors=[[240,40,40],[40,220,60],[40,70,240],[240,210,40]];
const matches=pixels=>pixels?.length===4&&pixels.every((pixel,i)=>pixel.every((value,j)=>Math.abs(value-colors[i][j])<35));
async function sample(page,selector){return page.locator(selector).evaluate(element=>{
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=36;
 const ctx=canvas.getContext('2d');ctx.drawImage(element,0,0,64,36);
 return [[16,9],[48,9],[16,27],[48,27]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data].slice(0,3));
});}
async function until(check,label){const end=Date.now()+15000;while(Date.now()<end){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error(label);}
(async()=>{
 fs.mkdirSync('.test-output/phone-camera',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const pcContext=await browser.newContext({viewport:{width:1395,height:995}});
  // The real phone grants camera permission before sending. Preserve that ICE
  // permission state even though this test supplies camera pixels from canvas.
  const phoneContext=await browser.newContext({viewport:{width:956,height:440},isMobile:true,hasTouch:true,permissions:['camera']});
  await pcContext.addInitScript(()=>{
   window.qaPcCameraRequests=0;navigator.mediaDevices.getUserMedia=async()=>{window.qaPcCameraRequests++;throw Error('PC camera must stay off');};
   const NativeWorker=Worker;
   window.Worker=class {
    constructor(url,options){if(!String(url).includes('tracker.js'))return new NativeWorker(url,options);this.stopped=false;}
    postMessage(data){
     if(this.stopped)return;
     if(data.type==='init')setTimeout(()=>this.onmessage?.({data:{type:'ready'}}),0);
     if(data.type==='frame'){
      const canvas=new OffscreenCanvas(64,36),ctx=canvas.getContext('2d');ctx.drawImage(data.bitmap,0,0,64,36);
      window.qaInference={width:data.bitmap.width,height:data.bitmap.height,pixels:[[16,9],[48,9],[16,27],[48,27]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data].slice(0,3))};
      data.bitmap.close();setTimeout(()=>{if(!this.stopped)this.onmessage?.({data:{type:'result',points:null,hands:[],time:data.time}});},0);
     }
    }
    terminate(){this.stopped=true;}
   };
  });
  await phoneContext.addInitScript(()=>{
   window.qaAngle=-90;window.qaRawRotation=270;window.qaStreams=[];window.qaOutputs=[];
   Object.defineProperty(screen,'orientation',{value:{get angle(){return window.qaAngle;}}});
   Object.defineProperty(window,'orientation',{get(){return window.qaLegacyAngle??window.qaAngle;}});
   const capture=HTMLCanvasElement.prototype.captureStream;
   HTMLCanvasElement.prototype.captureStream=function(fps){const stream=capture.call(this,fps);if(this.id==='phone-landscape')window.qaOutputs.push(stream);return stream;};
   navigator.mediaDevices.getUserMedia=async()=>{
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    const paint=()=>{
     const rotation=window.qaRawRotation,sideways=rotation%180!==0;
     const width=sideways?720:1280,height=sideways?1280:720;
     if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
     ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.translate(width/2,height/2);ctx.rotate(rotation*Math.PI/180);
     ['rgb(240,40,40)','rgb(40,220,60)','rgb(40,70,240)','rgb(240,210,40)'].forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(-640+(i%2)*640,-360+Math.floor(i/2)*360,640,360);});
    };
    paint();setInterval(paint,33);const stream=capture.call(canvas,30);window.qaStreams.push(stream);return stream;
   };
  });
  await pcContext.route('**/api/baemilgi*',route=>route.fulfill({json:{entries:[]}}));
  const pc=await pcContext.newPage(),phone=await phoneContext.newPage(),errors=[];
  for(const page of [pc,phone])page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await pc.goto(base+'basics/hindu-push-up');await pc.locator('#bm-phone').click();await pc.locator('#phone-camera-link').waitFor({state:'visible'});
  await phone.goto(await pc.locator('#phone-camera-link').getAttribute('href'));await phone.locator('#phone-start').click();
  try{await pc.waitForFunction(()=>document.querySelector('#bm-notice').textContent.includes('스마트폰 영상 연결됨'),null,{timeout:45000});}
  catch(error){
   console.log(await phone.evaluate(()=>({status:document.querySelector('#phone-status')?.textContent,raw:window.qaStreams?.length,output:window.qaOutputs?.length,video:[document.querySelector('#phone-video')?.videoWidth,document.querySelector('#phone-video')?.videoHeight],errors:document.querySelector('#phone-resume')?.hidden})));
   console.log(await pc.locator('#bm-notice').textContent());throw error;
  }
  async function upright(label){
   await until(async()=>matches(await sample(phone,'#phone-landscape'))&&matches(await sample(pc,'#bm-video'))&&matches(await pc.evaluate(()=>window.qaInference?.pixels)),label);
   assert.deepEqual(await phone.locator('#phone-landscape').evaluate(canvas=>[canvas.width,canvas.height]),[1280,720]);
   // WebRTC may adapt the wire resolution; upright pixels and landscape aspect
   // must survive that adaptation, including in the actual inference bitmap.
   for(const [width,height] of await pc.evaluate(()=>[[document.querySelector('#bm-video').videoWidth,document.querySelector('#bm-video').videoHeight],[window.qaInference.width,window.qaInference.height]])){
    assert(width>=320);assert.equal(width/height,16/9);
   }
   console.log(`PASS: ${label}; phone preview, remote video and inference pixels agree`);
  }
  await upright('landscape right, portrait camera buffer');
  await phone.evaluate(()=>{window.qaAngle=90;window.qaRawRotation=90;});await upright('landscape left, opposite rotation');
  await phone.evaluate(()=>{window.qaRawRotation=0;});await upright('already upright landscape stays upright');
  await phone.evaluate(()=>{window.qaAngle=0;window.qaRawRotation=270;});await upright('portrait-locked browser defaults to landscape');
  await phone.evaluate(()=>{window.qaAngle=undefined;window.qaLegacyAngle=-90;});await upright('legacy screen orientation fallback');
  await phone.evaluate(()=>{window.qaAngle=undefined;window.qaLegacyAngle=undefined;});await upright('no orientation API defaults to landscape');
  await phone.locator('#phone-lens').selectOption('user');await phone.waitForFunction(()=>window.qaStreams.length===2&&!document.querySelector('#phone-lens').disabled);
  await upright('lens change retains upright canvas track');
  assert.equal(await phone.evaluate(()=>window.qaOutputs.length),1,'lens changes retain the single transmitted track');
  // Simulate a locked browser whose physical orientation cannot be inferred.
  await phone.evaluate(()=>{window.qaRawRotation=90;});
  await until(async()=>!matches(await sample(pc,'#bm-video')),'fixture must visibly rotate before manual correction');
  await phone.locator('#phone-rotate').click();await phone.locator('#phone-rotate').click();await upright('manual correction reaches PC and inference');
  await pc.evaluate(()=>scrollTo(0,0));await pc.screenshot({path:'.test-output/phone-camera/orientation-pc.png'});await phone.screenshot({path:'.test-output/phone-camera/orientation-phone.png',fullPage:true});
  assert.equal(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'landscape controls fit without horizontal overflow');
  assert.equal(await pc.evaluate(()=>window.qaPcCameraRequests),0);
  await phone.locator('#phone-stop').click();await pc.waitForFunction(()=>document.querySelector('#bm-video').hidden);
  assert(await phone.evaluate(()=>[...window.qaStreams,...window.qaOutputs].every(stream=>stream.getTracks().every(track=>track.readyState==='ended'))));
  assert(await phone.locator('#phone-landscape').isHidden());assert.deepEqual(errors,[]);
  console.log('PASS: landscape stream and camera tracks stop together. Orientation and camera images are synthetic; WebRTC transport and analysis input capture are real.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
