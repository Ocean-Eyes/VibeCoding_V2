import {openOsotoLesson} from './osoto-lesson.js';
import {throwText as t} from './throw-lessons.js';
import {sampleThrow} from './throw-motion.js';
import {THROW_DURATION,throwTimeAtElapsed} from './throw-playback.js';
import {createThrowRenderer,drawFootMap} from './throw-render.js';
import {createThrowGuide} from './throw-guide.js';
import {drawOsotoBody,OsotoGuideScale,cameraPose,projectOsotoCameraPose,drawOsotoTracking} from './osoto-practice.js';
import {createPoseTracker} from './baemilgi-tracking.js';
import {createCameraPlayback} from './camera-playback.js';
import {connectPhoneCamera,cancelPhoneCamera,releaseCamera,onCameraEnded} from './phone-camera-host.js';

let cleanup=()=>{};
export function openThrowLesson(lesson){
 cleanup();if(lesson.id==='o-soto-gari'){cleanup=openOsotoLesson(lesson);return;}
 const root=document.getElementById('throw-screen');
 root.innerHTML=`
  <header class="throw-heading"><div><div class="eyebrow">NAGE-WAZA / ${lesson.roman.toUpperCase()}</div><h1>${lesson.name}</h1></div><span class="throw-kanji" lang="ja" aria-hidden="true">${lesson.kanji}</span></header>
  <div class="throw-lesson-layout">
   <section aria-label="${t('기술 시연','Technique demonstration')}">
    <div id="throw-3d-controls" class="throw-toolbar"><span>${t('3D 시연','3D demonstration')}</span><div role="group" aria-label="${t('시점','View')}"><button data-throw-view="oblique" aria-pressed="true">${t('사선','Oblique')}</button><button data-throw-view="front" aria-pressed="false">${t('정면','Front')}</button><button data-throw-view="side" aria-pressed="false">${t('측면','Side')}</button></div><label><input id="throw-solo" type="checkbox"> ${t('혼자 보기','Solo view')}</label></div>
    <div class="throw-lesson-stage is-3d"><video id="throw-video" class="throw-lesson-video" autoplay muted playsinline hidden></video><canvas id="throw-tracking" class="throw-lesson-tracking" aria-hidden="true" hidden></canvas><canvas id="throw-canvas" width="960" height="720" role="img" aria-label="${lesson.name} · ${t('3D 시연','3D demonstration')}"></canvas><div id="throw-target" class="throw-target" hidden><div class="throw-target-legend"><span><i class="target-key"></i>${t('목표','Target')}</span><span><i class="user-key"></i>${t('내 자세','You')}</span></div><canvas id="throw-guide" width="600" height="420" aria-label="${t('목표와 현재 사용자 자세','Target and current user pose')}"></canvas></div></div>
    <div class="throw-scrub throw-timeline"><label for="throw-seek">${t('동작 살펴보기','Explore movement')}</label><input id="throw-seek" type="range" min="0" max="1000" step="1" value="0"><select id="throw-speed" aria-label="${t('재생 속도','Playback speed')}"><option value="1">1×</option><option value="0.5">0.5×</option></select></div>
    <div class="throw-controls"><button id="throw-play" class="outline"></button><button id="throw-start" class="primary">${t('웹캠으로 시작','Start with webcam')}</button><button id="throw-phone" class="outline">${t('스마트폰 카메라 연결','Connect phone camera')}</button><button id="throw-restart" class="outline">${t('처음부터','Restart')}</button><button id="throw-camera-stop" class="outline" hidden>${t('카메라 끄기','Stop camera')}</button><button id="throw-camera-resume" class="outline" hidden>${t('카메라 영상 시작','Start camera video')}</button></div>
    <p id="throw-camera-status" class="throw-lesson-status" role="status"></p>
   </section>
   <aside class="throw-lesson-coach"><div class="eyebrow">FOLLOW THE GOLD</div><h2>${lesson.name}</h2><p>${lesson.description}</p><canvas id="throw-feet" class="throw-feet" width="300" height="230" role="img" aria-label="${t('위에서 본 발 위치','Foot positions from above')}"></canvas></aside>
  </div>`;
 const $=id=>root.querySelector('#'+id),video=$('throw-video'),canvas=$('throw-canvas'),stage=root.querySelector('.throw-lesson-stage');
 const guide=$('throw-guide'),ctx=guide.getContext('2d'),tracking=$('throw-tracking'),trackingCtx=tracking.getContext('2d');
 const projection=createThrowGuide(lesson.id),guideScale=new OsotoGuideScale();
 let renderer;try{renderer=createThrowRenderer(canvas)}catch{$('throw-camera-status').textContent=t('3D를 표시할 수 없습니다.','3D is unavailable.');}
 let elapsed=0,playing=true,demo=true,speed=1,solo=false,yaw=1.05,raf=0,last=0,disposed=false,currentPose=null,poseTime=-1;
 const abort=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:abort.signal});
 let cameraStream=null,cameraPending=false,cameraGeneration=0,tracker=null,ready=false,busy=false,points=null,guideBody=null,lastResult=0,lastVideo=-1,sent=0,initTimer,frameTimer,calibrateUntil=0;
 const cameraPlayback=createCameraPlayback(video,$('throw-camera-resume'),{
  onBlocked:()=>{$('throw-camera-status').textContent=t('카메라 영상 시작을 눌러 주세요.','Tap Start camera video.');},
 });
 function stopCamera(message){
  cameraGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);cancelPhoneCamera();cameraPending=false;cameraPlayback.cancel();tracker?.terminate();tracker=null;ready=busy=false;points=guideBody=null;guideScale.reset();lastVideo=-1;
  releaseCamera(cameraStream);cameraStream=null;video.srcObject=null;video.hidden=true;$('throw-camera-stop').hidden=true;$('throw-start').disabled=$('throw-phone').disabled=false;
  if(message!==undefined)$('throw-camera-status').textContent=message;
 }
 async function connectCamera(phone=false){
  if(cameraPending||cameraStream||disposed)return;
  stopCamera();const current=cameraGeneration;cameraPending=true;$('throw-start').disabled=$('throw-phone').disabled=true;$('throw-camera-stop').hidden=false;
  $('throw-camera-status').textContent=t('카메라와 자세 추적을 준비합니다…','Preparing camera and pose tracking…');
  try{
   const acquired=phone?await connectPhoneCamera({orientation:'portrait',isCurrent:()=>current===cameraGeneration&&!disposed}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:720},height:{ideal:1280}},audio:false});
   if(current!==cameraGeneration||disposed){releaseCamera(acquired);return;}
   if(!acquired){stopCamera(t('연결을 취소했습니다.','Connection cancelled.'));return;}
   cameraStream=acquired;video.srcObject=acquired;
   onCameraEnded(acquired,()=>{if(current===cameraGeneration){stopCamera(t('카메라 연결이 끝났습니다.','Camera disconnected.'));demo=true;playing=true;}});
   if(!await cameraPlayback.start(()=>current===cameraGeneration&&!disposed))return;
   demo=false;playing=false;elapsed=0;calibrateUntil=performance.now()+3000;
   tracker=createPoseTracker();tracker.onmessage=({data})=>{
    if(current!==cameraGeneration||disposed)return;
    if(data.type==='ready'){clearTimeout(initTimer);ready=true;$('throw-camera-status').textContent='';}
    if(data.type==='result'){clearTimeout(frameTimer);busy=false;lastResult=performance.now();points=cameraPose(data.points,video.videoHeight/video.videoWidth);guideBody=guideScale.update(points,lastResult<calibrateUntil);}
    if(data.type==='error')trackingFailed(current);
   };tracker.onerror=()=>trackingFailed(current);
   initTimer=setTimeout(()=>trackingFailed(current),30000);tracker.postMessage({type:'init'});
  }catch(error){if(current===cameraGeneration)stopCamera(error.name==='PhoneCameraError'?error.message:t('카메라를 연결하지 못했습니다. 권한과 연결을 확인하세요.','Could not connect the camera. Check permission and connection.'));}
  finally{if(current===cameraGeneration)cameraPending=false;}
 }
 function trackingFailed(current){if(current!==cameraGeneration||disposed)return;stopCamera(t('자세 추적을 시작하지 못했습니다. 다시 연결하세요.','Could not start pose tracking. Reconnect the camera.'));demo=true;playing=true;}
 async function infer(now){
  if(!ready||busy||document.hidden||video.readyState<2||video.currentTime===lastVideo||now-sent<65)return;
  busy=true;lastVideo=video.currentTime;sent=now;const current=cameraGeneration;
  try{const bitmap=await createImageBitmap(video);if(current!==cameraGeneration||disposed){bitmap.close();return;}frameTimer=setTimeout(()=>trackingFailed(current),5000);tracker.postMessage({type:'frame',bitmap,time:now},[bitmap]);}
  catch{trackingFailed(current);}
 }
 function drawCamera(now){
  const fresh=ready&&now-lastResult<300&&!document.hidden?points:null;
  ctx.clearRect(0,0,guide.width,guide.height);
  for(const [body,color,offset,style]of [[projection.pose(currentPose.tori),'#d6a24d',0,{}],[fresh?guideBody?.points:null,'#6ebce5',300,{outline:'#1e4054',belt:'#1d3646'}]]){
   if(!body)continue;ctx.save();ctx.beginPath();ctx.rect(offset,0,300,420);ctx.clip();drawOsotoBody(ctx,projection.project(body,offset),color,projection.scale,style);ctx.restore();
  }
  guide.dataset.tracked=String(!!fresh&&!!guideBody);
  const box=video.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2),width=Math.max(1,Math.round(box.width*ratio)),height=Math.max(1,Math.round(box.height*ratio));
  if(tracking.width!==width||tracking.height!==height){tracking.width=width;tracking.height=height;}
  trackingCtx.setTransform(1,0,0,1,0,0);trackingCtx.clearRect(0,0,width,height);trackingCtx.setTransform(ratio,0,0,ratio,0,0);
  tracking.dataset.tracked=String(drawOsotoTracking(trackingCtx,projectOsotoCameraPose(fresh,box.width,box.height,video.videoWidth,video.videoHeight))>0);
 }
 function render(now){
  const time=throwTimeAtElapsed(elapsed);if(time!==poseTime){currentPose=sampleThrow(lesson.id,time);poseTime=time;}
  stage.classList.toggle('is-3d',demo);canvas.hidden=!demo;$('throw-3d-controls').hidden=!demo;$('throw-target').hidden=demo;tracking.hidden=demo||video.hidden;
  if(demo)renderer?.draw(currentPose,{yaw,pitch:.22,solo,gold:true});else drawCamera(now);
  drawFootMap($('throw-feet'),currentPose,{left:t('왼','L'),right:t('오','R'),top:t('↑ 준비 자세의 앞쪽','↑ Forward at preparation'),lifted:t('연한 발자국: 들어 올린 발','Faded footprint: lifted foot')});
  const progress=elapsed/THROW_DURATION;
  canvas.dataset.playing=String(playing);canvas.dataset.progress=progress.toFixed(4);canvas.dataset.elapsed=elapsed.toFixed(4);canvas.dataset.demo=String(demo);canvas.dataset.ready=String(ready);
  $('throw-seek').value=String(Math.round(progress*1000));$('throw-seek').setAttribute('aria-valuetext',`${Math.round(progress*100)}%`);
  $('throw-play').textContent=!demo?t('3D 시연 보기','Watch 3D demo'):playing?t('시연 일시정지','Pause demo'):t('시연 재생','Play demo');$('throw-play').setAttribute('aria-pressed',String(demo&&playing));
 }
 function tick(now){
  if(disposed)return;void infer(now);const dt=last?Math.min(now-last,100)/1000:0;last=now;
  if(demo&&playing&&!document.hidden)elapsed=(elapsed+dt*speed)%THROW_DURATION;
  render(now);raf=requestAnimationFrame(tick);
 }
 on($('throw-start'),'click',()=>void connectCamera());on($('throw-phone'),'click',()=>void connectCamera(true));
 on($('throw-camera-stop'),'click',()=>{stopCamera('');demo=true;playing=true;});
 on($('throw-play'),'click',()=>{if(!demo){stopCamera('');demo=true;playing=true;}else playing=!playing;});
 on($('throw-restart'),'click',()=>{elapsed=0;if(demo)playing=true;guideScale.reset();guideBody=null;calibrateUntil=performance.now()+3000;});
 on($('throw-speed'),'change',e=>speed=Number(e.target.value));on($('throw-solo'),'change',e=>solo=e.target.checked);
 on($('throw-seek'),'input',e=>{playing=false;elapsed=Number(e.target.value)/1000*THROW_DURATION;});
 root.querySelectorAll('[data-throw-view]').forEach(button=>on(button,'click',()=>{yaw={front:0,side:Math.PI/2,oblique:1.05}[button.dataset.throwView];root.querySelectorAll('[data-throw-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 on(video,'resize',()=>{guideScale.reset();points=guideBody=null;calibrateUntil=performance.now()+3000;});
 on(document,'visibilitychange',()=>{last=0;points=guideBody=null;});
 cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);stopCamera();abort.abort();renderer?.dispose();};
 on(document,'judo-exit',cleanup);on(window,'pagehide',cleanup);raf=requestAnimationFrame(tick);
}
