const {chromium}=require(process.argv[2]||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SITE_URL||'http://localhost:5173/dist/index.html');
  await page.locator('[data-category="katame"]').click();await page.locator('[data-lesson="nami"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('.pose-card').length===3);
  assert.deepEqual(await page.locator('.pose-card strong').allTextContents(),['첫 깃 잡기','반대 깃 잡기','교차한 팔 비틀기']);
  assert.ok(!(await page.locator('#pose-description').innerText()).includes('가슴 앞'));
  const result=await page.evaluate(async()=>{
   const entry=new URL(document.querySelector('script[type="module"]').src);
   const module=name=>import(new URL(name+entry.search,entry).href);
   const [{prepareHands},{drawOpponent,drawGripGuides},{demonstrationAt,opponentFrame},{TECHNIQUES}]=await Promise.all([
    module('./hand-renderer.js'),module('./opponent.js'),module('./demonstration.js'),module('./curriculum.js')]);
   await prepareHands();const sheets=[];
   for(const mirrored of [true,false]){
    const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1080;const ink=sheet.getContext('2d');
    for(const [row,technique]of TECHNIQUES.entries())for(const [column,time]of [0,1,2.5,4,5.5,6,8,10.8].entries()){
     const tile=document.createElement('canvas');tile.width=400;tile.height=720;const ctx=tile.getContext('2d');
     ctx.fillStyle='#25313a';ctx.fillRect(0,0,400,720);
     const frame=opponentFrame(400,660),state=demonstrationAt(time,technique);
     drawOpponent(ctx,frame);drawGripGuides(ctx,frame,state.hands,technique.directions,mirrored,null,state);
     ctx.fillStyle='white';ctx.font='20px sans-serif';ctx.fillText(`${technique.id} / ${time}s`,15,690);
     ink.drawImage(tile,column*200,row*360,200,360);
    }
    sheets.push(sheet.toDataURL());
   }
   return sheets;
  });
  result.forEach((data,i)=>fs.writeFileSync(`.test-output/demo-arms-${i}.png`,Buffer.from(data.split(',')[1],'base64')));
  assert.deepEqual(errors,[]);assert.notEqual(result[0],result[1]);
  console.log('PASS demonstration render: 48 phases across three techniques and both mirror settings');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
