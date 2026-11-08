import {throwText as t} from './throw-lessons.js';
import {sampleThrow} from './throw-motion.js';
import {THROW_DURATION,throwTimeAtElapsed} from './throw-playback.js';
import {createThrowRenderer,drawFootMap} from './throw-render.js';
import {createCameraPlayback} from './camera-playback.js';
import {connectPhoneCamera,cancelPhoneCamera,releaseCamera,onCameraEnded} from './phone-camera-host.js';

let cleanup=()=>{};
export function openThrowLesson(lesson){
 cleanup();const root=document.getElementById('throw-screen');
 root.innerHTML=`
  <header class="throw-heading"><div><div class="eyebrow">NAGE-WAZA / ${lesson.roman.toUpperCase()}</div><h1>${lesson.name}</h1><p>${lesson.description}</p></div><span class="throw-kanji" lang="ja" aria-hidden="true">${lesson.kanji}</span></header>
  <div class="throw-layout">
   <section class="throw-demo" aria-label="${t('기술 시연','Technique demonstration')}">
    <div class="throw-toolbar"><span>${t('오른손잡이 기준','Right-handed')}</span><div role="group" aria-label="${t('카메라 방향','Camera angle')}"><button data-throw-view="oblique" aria-pressed="true">${t('입체','Oblique')}</button><button data-throw-view="front" aria-pressed="false">${t('정면','Front')}</button><button data-throw-view="side" aria-pressed="false">${t('측면','Side')}</button></div></div>
    <div class="throw-stage"><canvas id="throw-canvas" width="960" height="620" role="img" aria-label="${lesson.name} · ${t('동작 애니메이션','Movement animation')}"></canvas><span id="throw-status" class="throw-status" role="status"></span></div>
    <div class="throw-legend"><span><i class="throw-white"></i>${t('흰 도복 · 따라 할 동작','White · Your movement')}</span><span><i class="throw-blue"></i>${t('파란 도복 · 상대','Blue · Partner')}</span><label><input id="throw-solo" type="checkbox"> ${t('혼자 보기','Solo view')}</label></div>
    <div class="throw-caption"><div><h2>${lesson.name}</h2><p>${lesson.description}</p></div></div>
    <div class="throw-controls"><button id="throw-play" class="primary"></button><button id="throw-restart" class="outline">${t('처음부터','Restart')}</button><label>${t('속도','Speed')} <select id="throw-speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option></select></label><label><input id="throw-repeat" type="checkbox"> ${t('전체 반복','Repeat full demonstration')}</label></div>
    <label class="throw-scrub" for="throw-seek"><span>${t('동작 살펴보기','Explore the movement')}</span><input id="throw-seek" type="range" min="0" max="1000" step="1" value="0"></label>
    <p class="throw-help">${t('전체 동작을 연속으로 재생합니다. 일시정지하거나 재생 막대로 원하는 순간을 살펴보세요.','Watch the continuous demonstration. Pause or use the timeline to inspect any moment.')}</p>
   </section>
   <aside class="throw-coach">
    <section class="throw-camera-panel"><div class="eyebrow">PORTRAIT CAMERA</div><h2>${t('내 동작 · 세로 촬영','Your movement · portrait camera')}</h2><div id="throw-camera-preview" class="throw-camera-preview" hidden><video id="throw-video" autoplay muted playsinline hidden></video></div><p id="throw-camera-status" role="status">${t('폰을 세로로 두고 머리부터 발끝까지 보여 주세요. 시연과 내 동작을 나란히 볼 수 있습니다.','Hold your phone upright and show your whole body. View your movement alongside the demonstration.')}</p><div class="throw-camera-actions"><button id="throw-phone" class="outline">${t('스마트폰 카메라 연결','Connect phone camera')}</button><button id="throw-camera-stop" class="outline" hidden>${t('카메라 끄기','Stop camera')}</button><button id="throw-camera-resume" class="outline" hidden>${t('카메라 영상 시작','Start camera video')}</button></div></section>
    <section class="throw-foot-panel"><div class="eyebrow">FOOTWORK</div><h2>${t('위에서 본 발 위치','Foot positions from above')}</h2><canvas id="throw-feet" width="300" height="230" role="img" aria-label="${t('거는 사람과 받는 사람의 좌우 발 위치','Left and right foot positions of both partners')}"></canvas><p>${t('금색은 내가 움직이는 오른발입니다.','Gold marks your working right foot.')}</p></section>
    <p class="throw-solo-note">${t('혼자 할 때는 발 이동과 몸 돌리기만 천천히 따라 하세요. 상대를 메치는 연습은 매트 위에서 지도자와 진행하세요.','Practise the footwork and turns slowly on your own. Practise throwing a partner on mats with an instructor.')}</p>
    <a class="throw-source" href="${lesson.source}" target="_blank" rel="noopener noreferrer">${t('동작 참고 · 강도관 / IJF ↗','Reference · Kodokan / IJF ↗')}</a>
   </aside>
  </div>`;
 const $=id=>root.querySelector('#'+id),canvas=$('throw-canvas');
 let renderer;try{renderer=createThrowRenderer(canvas)}catch(error){$('throw-status').textContent=t('3D 시연을 시작하지 못했습니다. WebGL을 지원하는 브라우저에서 다시 열어 주세요.','Could not start the 3D demonstration. Open in a browser with WebGL support.');throw error;}
 let elapsed=0,playing=false,speed=1,repeat=false,solo=false,yaw=1.05,pitch=.22,raf=0,last=0,disposed=false;
 let currentPose=null,poseTime=-1;
 const abort=new AbortController(),on=(target,name,fn)=>target.addEventListener(name,fn,{signal:abort.signal});
 let cameraStream=null,cameraPending=false,cameraGeneration=0;
 const cameraPlayback=createCameraPlayback($('throw-video'),$('throw-camera-resume'),{
  onBlocked:()=>{$('throw-camera-status').textContent=t('카메라 영상 시작을 눌러 주세요.','Tap Start camera video.');},
  onRetryFailed:()=>{$('throw-camera-status').textContent=t('카메라 영상 시작을 다시 눌러 주세요.','Please tap Start camera video again.');},
 });
 function stopCamera(message){
  cameraGeneration++;if(cameraPending)cancelPhoneCamera();cameraPending=false;cameraPlayback.cancel();releaseCamera(cameraStream);cameraStream=null;
  $('throw-video').srcObject=null;$('throw-video').hidden=true;$('throw-camera-preview').hidden=true;$('throw-camera-stop').hidden=true;$('throw-phone').disabled=false;
  if(message)$('throw-camera-status').textContent=message;
 }
 async function connectCamera(){
  if(cameraPending||cameraStream||disposed)return;
  const current=++cameraGeneration;cameraPending=true;$('throw-phone').disabled=true;$('throw-camera-stop').hidden=false;
  $('throw-camera-status').textContent=t('스마트폰 연결을 준비하고 있습니다…','Preparing phone camera…');
  try{
   const acquired=await connectPhoneCamera({orientation:'portrait',isCurrent:()=>current===cameraGeneration&&!disposed});
   if(current!==cameraGeneration||disposed){releaseCamera(acquired);return;}
   if(!acquired){stopCamera(t('연결을 취소했습니다.','Connection cancelled.'));return;}
   cameraStream=acquired;$('throw-video').srcObject=acquired;$('throw-camera-preview').hidden=false;
   onCameraEnded(acquired,()=>{if(current===cameraGeneration)stopCamera(t('스마트폰 연결이 끝났습니다.','Phone camera disconnected.'));});
   if(!await cameraPlayback.start(()=>current===cameraGeneration&&!disposed))return;
   $('throw-camera-status').textContent=t('스마트폰 영상 연결됨 · 시연을 보며 천천히 동작을 확인하세요.','Phone camera connected · follow the demonstration slowly and check your movement.');
  }catch(error){if(current===cameraGeneration)stopCamera(error.name==='PhoneCameraError'?error.message:t('카메라 영상을 재생하지 못했습니다. 다시 연결해 주세요.','Could not play camera video. Please reconnect.'));}
  finally{if(current===cameraGeneration)cameraPending=false;}
 }
 on($('throw-phone'),'click',()=>void connectCamera());
 on($('throw-camera-stop'),'click',()=>stopCamera(t('카메라를 껐습니다.','Camera stopped.')));
 on($('throw-video'),'resize',()=>{const video=$('throw-video');if(video.videoWidth&&video.videoHeight)$('throw-camera-preview').style.aspectRatio=`${video.videoWidth} / ${video.videoHeight}`;});
 function render(){
  if(disposed)return;
  const time=throwTimeAtElapsed(elapsed);if(time!==poseTime){currentPose=sampleThrow(lesson.id,time);poseTime=time;}
  renderer.draw(currentPose,{yaw,pitch,solo});
  drawFootMap($('throw-feet'),currentPose,{left:t('왼','L'),right:t('오','R'),top:t('↑ 준비 자세의 앞쪽','↑ Forward at preparation'),lifted:t('연한 발자국: 들어 올린 발','Faded footprint: lifted foot')});
  const progress=elapsed/THROW_DURATION;
  canvas.dataset.playing=String(playing);canvas.dataset.progress=progress.toFixed(4);canvas.dataset.elapsed=elapsed.toFixed(4);
  $('throw-seek').value=String(Math.round(progress*1000));$('throw-seek').setAttribute('aria-valuetext',`${Math.round(progress*100)}%`);
  $('throw-play').textContent=playing?t('일시정지','Pause'):elapsed>=THROW_DURATION?t('다시 보기','Replay'):t('재생','Play');$('throw-play').setAttribute('aria-pressed',String(playing));
  $('throw-status').textContent=playing?t('재생 중','Playing'):elapsed>=THROW_DURATION?t('시연 완료','Demonstration complete'):elapsed>0?t('일시정지','Paused'):t('준비되면 재생하세요','Play when ready');
 }
 function pause(){playing=false;last=0;cancelAnimationFrame(raf);render();}
 function tick(now){
  if(!playing||disposed)return;
  if(last)elapsed+=Math.min(now-last,100)/1000*speed;last=now;
  if(elapsed>=THROW_DURATION){
   if(repeat)elapsed%=THROW_DURATION;
   else {elapsed=THROW_DURATION;pause();return;}
  }
  render();raf=requestAnimationFrame(tick);
 }
 function start(fromBeginning=false){cancelAnimationFrame(raf);if(fromBeginning||elapsed>=THROW_DURATION)elapsed=0;playing=true;last=0;render();raf=requestAnimationFrame(tick);}
 on($('throw-play'),'click',()=>playing?pause():start());on($('throw-restart'),'click',()=>start(true));
 on($('throw-speed'),'change',e=>{speed=Number(e.target.value);});on($('throw-repeat'),'change',e=>{repeat=e.target.checked;});
 on($('throw-solo'),'change',e=>{solo=e.target.checked;render();});
 on($('throw-seek'),'input',e=>{playing=false;cancelAnimationFrame(raf);last=0;elapsed=Number(e.target.value)/1000*THROW_DURATION;render();});
 root.querySelectorAll('[data-throw-view]').forEach(b=>on(b,'click',()=>{yaw={front:0,side:Math.PI/2,oblique:1.05}[b.dataset.throwView];pitch=.22;root.querySelectorAll('[data-throw-view]').forEach(v=>v.setAttribute('aria-pressed',String(v===b)));render();}));
 on(document,'visibilitychange',()=>{if(document.hidden)pause();});on(window,'pagehide',pause);on(window,'resize',render);
 on(window,'pagehide',()=>stopCamera());
 cleanup=()=>{if(disposed)return;disposed=true;playing=false;cancelAnimationFrame(raf);stopCamera();abort.abort();renderer.dispose();};
 on(document,'judo-exit',cleanup);render();
}
