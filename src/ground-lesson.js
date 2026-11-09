import {throwText as t} from './throw-lessons.js';
import {createThrowRenderer} from './throw-render.js';
import {sampleGround} from './ground-motion.js';
import {GroundProgress} from './ground-practice.js';
import {createPracticeTracker} from './practice-tracking.js';
import {createCameraPlayback} from './camera-playback.js';
import {connectPhoneCamera,cancelPhoneCamera,releaseCamera,onCameraEnded} from './phone-camera-host.js';
function drawGuide(canvas,pose){
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,360,260);
 const project=p=>[180+p[0]*125,120+p[2]*70-p[1]*85];
 for(const [rig,color]of [[pose.uke,'#5687a0'],[pose.tori,'#d6a24d']]){
  ctx.lineCap=ctx.lineJoin='round';ctx.strokeStyle=ctx.fillStyle=color;
  for(const limbs of [rig.legs,rig.arms])for(const arm of Object.values(limbs)){
   const pts=[arm.root,arm.joint,arm.end].map(project);ctx.lineWidth=limbs===rig.legs?20:13;
   ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
  }
  const torso=[rig.shoulders.left,rig.shoulders.right,rig.legs.right.root,rig.legs.left.root].map(project);
  ctx.beginPath();torso.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();
  const [x,y]=project(rig.head);ctx.beginPath();ctx.arc(x,y,15,0,Math.PI*2);ctx.fill();
 }
}
export function openGroundLesson(lesson){
 const root=document.getElementById('throw-screen'),kesa=lesson.id==='kesa-gatame';
 root.innerHTML=`<header class="throw-heading"><div><div class="eyebrow">${lesson.roman}</div><h1>${lesson.name}</h1></div><span class="throw-kanji">${lesson.kanji}</span></header>
 <div class="ground-layout"><section><div class="ground-stage">
 <video id="ground-video" autoplay muted playsinline hidden></video><canvas id="ground-scene" aria-label="${t('3D 동작 시연','3D demonstration')}"></canvas>
 <div id="ground-guide" hidden><span id="ground-guide-step"></span><canvas id="ground-guide-canvas" width="360" height="260" aria-label="${t('따라 할 자세','Target pose')}"></canvas></div></div>
 <div class="ground-result"><strong id="ground-score"></strong><span id="ground-feedback" role="status"></span><progress id="ground-hold" max="1" value="0"></progress></div>
 <div class="throw-controls"><button id="ground-play" class="outline"></button><button id="ground-start" class="primary">${t('웹캠으로 시작','Start with webcam')}</button><button id="ground-phone" class="outline">${t('스마트폰 카메라 연결','Connect phone camera')}</button><button id="ground-reset" class="outline">${t('처음부터','Restart')}</button><button id="ground-stop" class="outline" hidden>${t('카메라 끄기','Stop camera')}</button><button id="ground-resume" class="outline" hidden>${t('카메라 영상 시작','Start camera video')}</button></div>
 <div id="ground-views" class="throw-toolbar"><button data-ground-view="angle" aria-pressed="true">${t('사선','Oblique')}</button><button data-ground-view="top" aria-pressed="false">${t('위에서','Top')}</button><button data-ground-view="side" aria-pressed="false">${t('측면','Side')}</button></div>
 <p id="ground-status" role="status"></p></section>
 <aside class="ground-coach"><h2 id="ground-title"></h2><ol>${lesson.steps.map((step,i)=>`<li data-ground-step="${i}">${step}</li>`).join('')}</ol><div id="ground-inset"></div><p class="ground-limit">${kesa?t('혼자 하는 자세 연습','Solo position practice'):t('손 연결 연습 · 관절을 비트는 힘은 평가하지 않습니다.','Hand connection practice · joint pressure is not evaluated.')}</p></aside></div>`;
 const $=id=>root.querySelector('#'+id),video=$('ground-video'),scene=$('ground-scene'),stageNode=root.querySelector('.ground-stage'),game=new GroundProgress(lesson.id);
 const abort=new AbortController(),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 let renderer;try{renderer=createThrowRenderer(scene)}catch{ $('ground-status').textContent=t('3D를 표시할 수 없습니다. 다른 브라우저로 열어 주세요.','3D is unavailable. Please use another browser.');return ()=>abort.abort();}
 let demo=true,playing=true,elapsed=0,lastTick=0,raf=0,disposed=false,stream=null,tracker=null,ready=false,busy=false,data=null,lastResult=0,lastFrame=-1,sent=0,generation=0,startAt=Infinity,initTimer,frameTimer;
 let yaw=.55,pitch=.95;
 const playback=createCameraPlayback(video,$('ground-resume'),{onBlocked:()=>{$('ground-status').textContent=t('카메라 영상 시작을 눌러 주세요.','Tap Start camera video.');}});
 function stop(){
  generation++;clearTimeout(initTimer);clearTimeout(frameTimer);cancelPhoneCamera();playback.cancel();tracker?.terminate();tracker=null;releaseCamera(stream);stream=null;video.srcObject=null;video.hidden=true;
  ready=busy=false;data=null;lastFrame=-1;game.hold=0;game.under=false;game.last=null;startAt=Infinity;
  $('ground-start').disabled=$('ground-phone').disabled=false;$('ground-stop').hidden=true;
 }
 function fail(){stop();$('ground-status').textContent=t('카메라 또는 자세 인식을 연결하지 못했습니다. 다시 시작해 주세요.','Camera or tracking failed. Please start again.');}
 async function start(phone=false){
  stop();demo=false;playing=false;game.reset();const current=generation;
  $('ground-start').disabled=$('ground-phone').disabled=true;$('ground-stop').hidden=false;$('ground-status').textContent=t('카메라 준비 중…','Preparing camera…');
  try{
   const acquired=phone?await connectPhoneCamera({orientation:'landscape',autoRotate:kesa,isCurrent:()=>current===generation&&!disposed}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720}},audio:false});
   if(current!==generation||disposed){releaseCamera(acquired);return;}if(!acquired){stop();return;}
   stream=acquired;video.srcObject=stream;onCameraEnded(stream,()=>{if(current===generation){stop();$('ground-status').textContent=t('카메라 연결이 끝났습니다.','Camera disconnected.');}});
   if(!await playback.start(()=>current===generation&&!disposed))return;
   tracker=createPracticeTracker();tracker.onmessage=({data:message})=>{
    if(current!==generation||disposed)return;
    if(message.type==='ready'){clearTimeout(initTimer);ready=true;startAt=performance.now()+2000;$('ground-status').textContent='';}
    if(message.type==='result'){clearTimeout(frameTimer);busy=false;data=message;lastResult=performance.now();}
    if(message.type==='error')fail();
   };tracker.onerror=fail;initTimer=setTimeout(()=>{if(current===generation)fail()},30000);tracker.postMessage({type:'init'});
  }catch{if(current===generation)fail();}
 }
 async function infer(now){
  if(!ready||busy||document.hidden||video.readyState<2||video.currentTime===lastFrame||now-sent<75)return;
  busy=true;lastFrame=video.currentTime;sent=now;const current=generation;
  try{const bitmap=await createImageBitmap(video);if(current!==generation||disposed){bitmap.close();return;}frameTimer=setTimeout(()=>{if(current===generation)fail()},5000);tracker.postMessage({type:'frame',bitmap,time:now},[bitmap]);}
  catch{if(current===generation)fail();}
 }
 function tick(now){
  if(disposed)return;void infer(now);
  const dt=lastTick?Math.min(.1,(now-lastTick)/1000):0;lastTick=now;
  if(demo&&playing&&!document.hidden)elapsed=(elapsed+dt)%(kesa?12:10);
  const time=demo?(kesa?Math.min(3,elapsed/3):Math.min(2,elapsed/3)):kesa?game.stage+1:game.stage===0?1:game.under?2:1.5;
  const demoStage=kesa?Math.min(2,Math.floor(time)):time<1?0:1;
  const fresh=ready&&now-lastResult<350&&!document.hidden?data:null;
  const state=demo?{stage:demoStage}:game.update(fresh?.points,fresh?.hands,video.videoHeight/(video.videoWidth||1),now,ready&&now>=startAt&&!document.hidden);
  const pose=sampleGround(lesson.id,time);
  root.classList.toggle('ground-practice',!demo);root.classList.toggle('ground-kesa',kesa);
  if(!demo&&!kesa){if(scene.parentElement!==$('ground-inset'))$('ground-inset').append(scene);}
  else if(scene.parentElement!==stageNode)stageNode.prepend(scene);
  scene.hidden=!demo&&kesa;$('ground-guide').hidden=demo||!kesa;$('ground-views').hidden=!demo&&kesa;
  if(!scene.hidden)renderer.draw(pose,{yaw,pitch,gold:true,center:kesa?[0,.30,-.02]:[-.15,.32,-.25],extent:kesa?2.6:3.1});
  if(!demo&&kesa){drawGuide($('ground-guide-canvas'),pose);$('ground-guide-step').textContent=`${state.stage+1} / 3`;}
  $('ground-title').textContent=lesson.steps[state.stage];
  root.querySelectorAll('[data-ground-step]').forEach((el,i)=>{el.classList.toggle('current',i===state.stage);el.classList.toggle('complete',!demo&&(i<state.stage||state.done));});
  $('ground-play').textContent=demo?(playing?t('시연 일시정지','Pause demo'):t('시연 재생','Play demo')):t('3D 시연 보기','Watch 3D demo');
  $('ground-score').textContent=demo?'':state.done||state.transition?'Perfect':fresh?`${state.score}%`:'—';$('ground-hold').hidden=demo;$('ground-hold').value=state.hold||0;
  const hints={tracking:kesa?t('전신을 보여 주세요.','Show your whole body.'):t('상체와 양손을 보여 주세요.','Show your upper body and both hands.'),right:t('오른손을 가슴 아래에 두고 쥐세요.','Close your right hand below your chest.'),under:t('왼손을 오른손 아래로 넣으세요.','Move your left hand below your right hand.'),connect:t('왼손으로 오른팔 손목 위를 잡으세요.','Grip your right forearm just above the wrist.'),sit:t('옆으로 앉아 무릎을 굽히고 다리를 벌리세요.','Sit alongside, bend the knee and spread your legs.'),wrap:t('오른팔은 머리 쪽, 왼손은 소매 쪽에 두세요.','Place your right arm near the head and left hand near the sleeve.'),hold:t('그대로 유지','Hold'),position:t('가이드 자세를 따라 하세요.','Follow the guide pose.')};
  $('ground-feedback').textContent=demo?'':state.done?'Perfect':ready&&now<startAt?String(Math.ceil((startAt-now)/1000)):state.transition?'Perfect':hints[state.issue]||'';
  root.dataset.groundStage=String(state.stage);root.dataset.groundDone=String(!!state.done);root.dataset.groundReady=String(ready);root.dataset.groundDemo=String(demo);root.dataset.groundUnder=String(game.under);
  raf=requestAnimationFrame(tick);
 }
 on($('ground-start'),'click',()=>void start());on($('ground-phone'),'click',()=>void start(true));on($('ground-stop'),'click',stop);
 on($('ground-play'),'click',()=>{if(demo)playing=!playing;else{stop();demo=true;playing=true;elapsed=0;}});
 on($('ground-reset'),'click',()=>{game.reset();elapsed=0;startAt=ready?performance.now()+2000:Infinity;});
 root.querySelectorAll('[data-ground-view]').forEach(button=>on(button,'click',()=>{const view=button.dataset.groundView;[yaw,pitch]=view==='top'?[0,1.50]:view==='side'?[1.4,.35]:[.55,.95];root.querySelectorAll('[data-ground-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 on(document,'visibilitychange',()=>{data=null;game.hold=0;game.under=false;game.last=null;lastTick=0;});
 function cleanup(){if(disposed)return;disposed=true;stop();cancelAnimationFrame(raf);renderer.dispose();abort.abort();root.classList.remove('ground-practice','ground-kesa');}
 on(document,'judo-exit',cleanup);on(window,'pagehide',cleanup);raf=requestAnimationFrame(tick);return cleanup;
}
