const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});
  await page.goto(process.env.SITE_URL||'http://localhost:5173/');
  const result=await page.evaluate(async()=>{
   const {drawOpponent}=await import('/src/opponent.js'),{opponentFrame}=await import('/src/demonstration.js'),{frontPanel}=await import('/src/cloth-renderer.js');
   document.body.innerHTML='<main id="drawings"></main>';
   const host=document.querySelector('#drawings');host.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px;background:#e9e5dd';
   const samples=[['이완',0,0],['깃 잡기',.025,.025],['주름 모임',.072,.072],['중간 당김',.156,.156],['양손 당김',.24,.24],['왼손만 당김',.24,0],['오른손만 당김',0,.24],['놓기 · 복원',0,0]],images=[],heads=[],seams=[],gaps=[];
   for(const [label,left,right]of samples){
    const card=document.createElement('section');card.style.cssText='background:#293641;border:1px solid #9aa5ad';
    const title=document.createElement('div');title.textContent=label;title.style.cssText='color:#e5edf1;padding:12px;font:16px sans-serif;text-align:center';
    const canvas=document.createElement('canvas');canvas.width=330;canvas.height=415;canvas.style.cssText='display:block;width:100%';card.append(title,canvas);host.append(card);
    const ctx=canvas.getContext('2d'),frame=opponentFrame(330,415),deformation=[{side:1,t:.29,dx:left,dy:0},{side:-1,t:.48,dx:-right,dy:0}];
    ctx.drawImage=()=>{throw Error('Clothing states must be drawn from vector paths, never a stretched bitmap')};
    drawOpponent(ctx,frame,{deformation});images.push(canvas.toDataURL());
    heads.push(Array.from(ctx.getImageData(Math.round(frame.origin.x-frame.scale*.24),Math.round(frame.origin.y-frame.scale*.55),Math.round(frame.scale*.48),Math.round(frame.scale*.48)).data));
    // The front panel really reaches its sewn inner collar edge in every drawing.
    for(const side of [-1,1]){
     const panel=frontPanel(side,deformation);
     for(const index of [8,14,20,28]){const p=panel.edge[index];const sewn=ctx.isPointInPath(panel.path,p.x+side*.004,p.y);seams.push(sewn);if(!sewn)gaps.push({label,side,index,p,transform:Array.from(ctx.getTransform().toFloat64Array())})}
    }
   }
   return {distinct:new Set(images.slice(0,7)).size,restored:images[0]===images[7],fixedHead:heads.every(h=>h.every((v,i)=>v===heads[0][i])),sewn:seams.every(Boolean),gaps};
  });
  await page.locator('#drawings').screenshot({path:'.test-output/cloth-drawing-states.png'});
  assert.equal(result.distinct,7);assert.equal(result.restored,true);assert.equal(result.fixedHead,true);assert.equal(result.sewn,true);
  console.log('PASS authored cloth states: seven distinct vector drawings, both asymmetric pulls, sewn collar panels, fixed head, release restoration, no bitmap draw calls.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
