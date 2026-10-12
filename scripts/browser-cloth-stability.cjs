const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:850}});
  await page.goto(process.env.SITE_URL||'http://localhost:5173/');
  const result=await page.evaluate(async()=>{
   const {drawOpponent}=await import('/src/opponent.js'),{opponentFrame}=await import('/src/demonstration.js');
   const {CollarInteraction,lapelRest}=await import('/src/collar-interaction.js'),{handAt}=await import('/tests/fixtures/collar-hands.mjs');
   const canvas=document.createElement('canvas');canvas.width=180;canvas.height=240;
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),frame=opponentFrame(180,240);
   const render=d=>{ctx.clearRect(0,0,180,240);drawOpponent(ctx,frame,{deformation:d});return ctx.getImageData(0,0,180,240).data};
   const rest=render([]);let cases=0,maxError=0;
   for(const t of [.001,.008,.025,.05,.09,.12,.20,.30])
   for(const dx of [-.09,-.06,-.03,0,.03,.06,.09])
   for(const dy of [-.025,0,.025])
   for(const directions of [['↓','↓'],['↑','↑'],['↑','↓']])
   for(const mirrored of [true,false]){
    const model=new CollarInteraction();
    const hands=[0,1].map(i=>{
     const side=(i?-1:1)*(mirrored?1:-1),p=lapelRest(side,t),center={x:p.x+side*dx,y:p.y+dy};
     const hand=handAt(center,.8,i===0,directions[i]==='↑');
     return mirrored?hand:hand.map(q=>({...q,x:2*center.x-q.x}));
    });
    let state;for(let time=0;time<=240;time+=20)state=model.update(hands,time,{directions,mirrored});
    if(state.count!==2)throw Error('capture failed');
    const pixels=render(state.deformation);
    for(let i=0;i<pixels.length;i++)maxError=Math.max(maxError,Math.abs(pixels[i]-rest[i]));
    cases++;
   }
   document.body.innerHTML='<main style="display:flex;background:#e9e5dd;padding:20px"></main>';
   const model=new CollarInteraction(),base=[1,-1].map((side,i)=>handAt(lapelRest(side,.025),1,i===0));
   let state;
   const card=label=>{
    const c=document.createElement('canvas');c.width=330;c.height=440;
    const section=document.createElement('section');section.innerText=label;section.append(c);document.querySelector('main').append(section);
    drawOpponent(c.getContext('2d'),opponentFrame(330,440),{deformation:state?.deformation??[]});
   };
   card('잡기 전');
   for(let t=0;t<=240;t+=20)state=model.update(base,t);card('목선에서 잡은 직후');
   for(let t=260;t<=600;t+=20)state=model.update(base.map(h=>h.map(p=>({...p,x:p.x+.025*(t-240)/360}))),t);
   const before=render(state.deformation);
   for(let t=620;t<=1100;t+=20)state=model.update(base.map(h=>h.map(p=>({...p,x:p.x+.9}))),t);
   const after=render(state.deformation);
   const spikeError=after.reduce((m,v,i)=>Math.max(m,Math.abs(v-before[i])),0);
   card('작게 이동 후 좌표 튐 차단');
   return {cases,maxError,spikeError};
  });
  await page.screenshot({path:'.test-output/cloth-stability.png'});
  assert.equal(result.cases,1008);assert.equal(result.maxError,0);assert.equal(result.spikeError,0);
  console.log('PASS pixel stability',JSON.stringify(result));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
