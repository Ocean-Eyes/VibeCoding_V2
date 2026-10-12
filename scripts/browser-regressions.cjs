// npm install is not needed for the app; this QA script requires a Playwright package.
const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.SITE_URL||'http://localhost:5173/';
async function enterPractice(page){
  await page.locator('[data-category="katame"]').click();
  await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelector('#pose-list').children.length===3);
  await page.locator('#start').click();

}
(async()=>{
  fs.mkdirSync('.test-output',{recursive:true});
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try{
    // Real MediaPipe inference on a public photographic fixture, NOT a real webcam user.
    const person=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    person.on('pageerror',e=>errors.push(e.message));
    await person.addInitScript(()=>{
      navigator.mediaDevices.getUserMedia=async()=>{
        const response=await fetch('https://storage.googleapis.com/mediapipe-assets/pose.jpg');
        if(!response.ok)throw Error('Photo fixture download failed');
        const image=await createImageBitmap(await response.blob());
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        const interval=setInterval(()=>ctx.drawImage(image,0,0),100);
        const stream=canvas.captureStream(10);const track=stream.getVideoTracks()[0],stop=track.stop.bind(track);
        track.stop=()=>{clearInterval(interval);image.close();stop()};return stream;
      };
    });
    await person.goto(base);await enterPractice(person);
    await person.waitForFunction(()=>document.querySelector('#overlay').dataset.aligned==='true',{},{timeout:90000});
    await person.waitForFunction(()=>document.querySelector('#arm-score').textContent!=='—');

    await person.waitForFunction(()=>Number(document.querySelector('#timer').textContent.replace(':',''))>=2,{},{timeout:20000});
    assert.equal(await person.locator('#video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState),'live');
    assert.equal(await person.locator('#welcome').isVisible(),false);
    await person.screenshot({path:'.test-output/person-inference.png',fullPage:true});
    await person.locator('#stop').click();assert.equal(await person.locator('#video').evaluate(v=>v.srcObject),null);
    console.log('PASS: photographic person fixture, aligned overlay, arm score, practice start keeps camera active.');

    const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const Original=window.Worker;
      window.Worker=class extends Original {constructor(...args){super(...args);window.testWorker=this;}};
    });
    await page.route('**/src/tracker.js*',route=>route.fulfill({contentType:'text/javascript',body:`
      self.onmessage=({data})=>{
        if(data.type==='init')self.postMessage({type:'ready'});
        if(data.type==='break')self.postMessage({type:'error',message:'Injected inference failure'});
        if(data.type==='frame'){
          data.bitmap.close();
          const points=Array.from({length:33},()=>({x:.5,y:.5,visibility:.05}));
          for(const [i,x,y]of [[11,.6,.4],[12,.4,.4],[13,.736,.4],[14,.264,.4],[15,.864,.4],[16,.136,.4]])points[i]={x,y,visibility:.99};
          self.postMessage({type:'result',points,hands:[],time:data.time});
        }
      };` }));
    await page.goto(base);await enterPractice(page);
    await page.waitForFunction(()=>document.querySelector('#overlay').dataset.aligned==='true');
    assert.notEqual(await page.locator('#arm-score').innerText(),'—');
    await page.evaluate(()=>window.testWorker.postMessage({type:'break'}));
    await page.locator('#retry-tracking').waitFor({state:'visible'});
    assert.equal(await page.locator('#video').evaluate(v=>v.srcObject.getVideoTracks()[0].readyState),'live');
    assert.equal(await page.locator('#welcome').isVisible(),false);
    assert.equal(await page.locator('#play').isDisabled(),true);
    assert.equal(await page.locator('#score').innerText(),'—');
    assert.equal(await page.locator('#overlay').evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return a.some((v,i)=>i%4===3&&v>0)}),true);
    await page.locator('#retry-tracking').click();await page.waitForFunction(()=>document.querySelector('#overlay').dataset.aligned==='true');
    assert.equal(await page.locator('#play').isEnabled(),true);await page.locator('#stop').click();
    assert.deepEqual(errors,[]);
    console.log('PASS: cropped hips still align; injected inference failure preserves camera and reference guide; retry restores tracking.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
