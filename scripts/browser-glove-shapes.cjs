const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1200,height:820}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/index.html');
  const results=await page.evaluate(async()=>{
   const {drawLiveGlove}=await import('./src/live-glove.js');
   const {posedHand,handViewPoint}=await import('./src/hand-rig.js');
   document.body.replaceChildren();document.body.style.margin='0';
   const sheet=Object.assign(document.createElement('canvas'),{width:1200,height:820});document.body.append(sheet);
   const ctx=sheet.getContext('2d');ctx.fillStyle='#e5e0d4';ctx.fillRect(0,0,1200,820);
   const results=[];
   for(const [row,palm]of [true,false].entries())for(const [col,curl]of [0,.5,1].entries()){
    ctx.fillStyle='#28343b';ctx.font='18px sans-serif';ctx.fillText(`${palm?'PALM':'BACK'} / ${['open','half','fist'][col]}`,col*400+20,row*410+30);
    for(const left of [true,false]){
     const canvas=Object.assign(document.createElement('canvas'),{width:190,height:350}),paint=canvas.getContext('2d');
     const hand=posedHand(curl).landmarks.map(p=>{const q=handViewPoint(p,left,palm);return {x:95+q[0]*1000,y:235+q[1]*1000,z:q[2]*1000}});
     drawLiveGlove(paint,hand,palm,{x:95,y:340});
     const pixels=paint.getImageData(0,0,190,350).data;
     // Flood the transparent exterior. A curled glove should have no enclosed
     // transparent islands (the old folded outlines produced triangular holes).
     let holes=0;
     if(curl===1){
      const seen=new Uint8Array(190*350),queue=[0];seen[0]=1;
      for(let i=0;i<queue.length;i++){
       const n=queue[i],x=n%190,y=Math.floor(n/190);
       for(const m of [x?n-1:-1,x<189?n+1:-1,y?n-190:-1,y<349?n+190:-1]){
        if(m>=0&&!seen[m]&&pixels[m*4+3]<80){seen[m]=1;queue.push(m)}
       }
      }
      for(let n=0;n<seen.length;n++)if(!seen[n]&&pixels[n*4+3]<80)holes++;
     }
     results.push({palm,curl,left,holes,filled:pixels.filter((v,i)=>i%4===3&&v>100).length});
     ctx.drawImage(canvas,col*400+(left?10:200),row*410+45);
    }
   }
   return results;
  });
  assert.equal(results.length,12);assert.ok(results.every(r=>r.filled>3000));assert.ok(results.every(r=>r.holes===0),JSON.stringify(results));
  await page.locator('canvas').screenshot({path:'.test-output/glove-shapes.png'});
  assert.deepEqual(errors,[]);console.log('PASS glove rendering: 12 left/right palm/back open/half/fist combinations; contact sheet saved for visual review.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
