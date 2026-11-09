import {createThrowRenderer} from './throw-render.js';
import {sampleThrow} from './throw-motion.js';
import {throwTimeAtElapsed,THROW_DURATION} from './throw-playback.js';
import {throwText as t} from './throw-lessons.js';
import {OSOTO_TARGETS,OsotoProgress,drawOsotoBody,cameraPose,OSOTO_DEMO_DURATION} from './osoto-practice.js';
import {createPoseTracker} from './baemilgi-tracking.js';
import {createCameraPlayback} from './camera-playback.js';
import {connectPhoneCamera,cancelPhoneCamera,releaseCamera,onCameraEnded} from './phone-camera-host.js';
export function openOsotoLesson(lesson){
 const root=document.getElementById('throw-screen'),titles=[t('초기자세 오른발 앞','Starting stance: right foot forward'),t('당기고 왼발 딛기','Pull and plant the left foot'),t('오른발 높이 들기','Raise the right leg'),t('숙이고 오른발 뒤로 들기','Lean forward and lift the right leg behind')];
 const cues=[t('정면을 보고 오른발을 왼발보다 한 걸음 앞으로 놓으세요.','Face the camera with your right foot one step ahead of your left.'),t('양손을 당긴 모양으로 두고 왼발을 딛은 자세를 유지하세요.','Hold the pulling hand position with your left foot planted.'),t('왼발로 지지하고 오른무릎을 굽혀 앞으로 들어 올리세요.','Support yourself on the left foot and raise the bent right knee forward.'),t('왼발을 딛고 양손을 당기며 상체를 숙이고 오른다리를 뒤로 후리세요.','Keep the left foot planted, pull with both hands, lean forward and sweep the right leg back.')];
 root.innerHTML=`<header class="throw-heading"><div><div class="eyebrow">O-SOTO-GARI / 3 STEP CHALLENGE</div><h1>${lesson.name}</h1><p>${t('우측 하단의 자세를 따라 하세요. 각 자세를 1초 유지하면 다음 단계로 넘어갑니다.','Follow the pose in the lower-right corner. Hold each pose for 1 second to advance.')}</p></div><span class="throw-kanji">大外刈</span></header>
 <div class="osoto-layout"><section><div id="osoto-3d-controls" class="throw-toolbar"><span>${t('3D 시연','3D demonstration')}</span><div role="group" aria-label="${t('시점','View')}"><button data-osoto-view="oblique" aria-pressed="true">${t('사선','Oblique')}</button><button data-osoto-view="front" aria-pressed="false">${t('정면','Front')}</button><button data-osoto-view="side" aria-pressed="false">${t('측면','Side')}</button></div><label><input id="osoto-solo" type="checkbox"> ${t('혼자 보기','Solo view')}</label></div><div class="osoto-stage is-3d"><video id="osoto-video" autoplay muted playsinline hidden></video><div id="osoto-target"><span id="osoto-target-step"></span><canvas id="osoto-canvas" width="300" height="420" aria-label="${t('금색 목표 전신 자세','Gold full-body target pose')}"></canvas></div><canvas id="osoto-3d" role="img" aria-label="${t('강도관 참고 밭다리 3D 시연','Kodokan-inspired O-soto-gari 3D demonstration')}"></canvas></div><div id="osoto-timeline" class="throw-scrub"><label for="osoto-seek">${t('동작 살펴보기','Explore movement')}</label><input id="osoto-seek" type="range" min="0" max="1000" step="1" value="0"><select id="osoto-speed" aria-label="${t('재생 속도','Playback speed')}"><option value="1">1×</option><option value="0.5">0.5×</option></select></div><div class="osoto-hud"><span id="osoto-step"></span><strong id="osoto-score">—</strong><span id="osoto-feedback" role="status"></span><progress id="osoto-hold" max="1" value="0"></progress></div>
 <div class="throw-controls"><button id="osoto-demo" class="outline"></button><button id="osoto-start" class="primary">${t('웹캠으로 시작','Start with webcam')}</button><button id="osoto-phone" class="outline">${t('스마트폰 카메라 연결','Connect phone camera')}</button><button id="osoto-reset" class="outline">${t('처음부터','Restart')}</button><button id="osoto-stop" class="outline" hidden>${t('카메라 끄기','Stop camera')}</button><button id="osoto-resume" class="outline" hidden>${t('카메라 영상 시작','Start camera video')}</button></div><p id="osoto-status" role="status">${t('3D 시연이 자동 재생됩니다. 웹캠 연습을 시작하면 금색 2D 가이드로 전환됩니다.','The 3D demo plays automatically. Starting webcam practice switches to the gold 2D guide.')}</p></section>
 <aside class="osoto-coach"><div class="eyebrow">FOLLOW THE GOLD</div><h2 id="osoto-title"></h2><p id="osoto-cue"></p><ol>${titles.map((v,i)=>`<li data-osoto-step="${i}">${i===0?'':'<b>0'+i+'</b>'} ${v}</li>`).join('')}</ol></aside></div>`;
 const $=id=>root.querySelector('#'+id),video=$('osoto-video'),canvas=$('osoto-canvas'),ctx=canvas.getContext('2d'),progress=new OsotoProgress();
 const abort=new AbortController(),on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort.signal});
 let demo=true,playing=true,demoElapsed=0,lastTick=0,viewYaw=1.05,solo=false,speed=1,renderer=null,poseTime=-1,pose3d=null;
 try{renderer=createThrowRenderer($('osoto-3d'));}catch{$('osoto-status').textContent=t('3D를 표시할 수 없습니다. 웹캠 연습은 사용할 수 있습니다.','3D is unavailable. Webcam practice is still available.');}
 let disposed=false,stream=null,tracker=null,ready=false,busy=false,points=null,lastResult=0,lastVideo=-1,sent=0,raf=0,generation=0,pending=false,startAt=Infinity,initTimer,frameTimer;
 const playback=createCameraPlayback(video,$('osoto-resume'),{onBlocked:()=>{$('osoto-status').textContent=t('카메라 영상 시작을 눌러 주세요.','Tap Start camera video.');}});
 function stop(message){generation++;clearTimeout(initTimer);clearTimeout(frameTimer);cancelPhoneCamera();playback.cancel();tracker?.terminate();tracker=null;releaseCamera(stream);stream=null;video.srcObject=null;video.hidden=true;ready=busy=pending=false;points=null;lastVideo=-1;startAt=Infinity;progress.hold=0;progress.last=null;$('osoto-start').disabled=$('osoto-phone').disabled=false;$('osoto-stop').hidden=true;if(message)$('osoto-status').textContent=message;}
 async function start(phone=false){
  stop();demo=false;playing=false;progress.reset();const current=generation;pending=true;$('osoto-start').disabled=$('osoto-phone').disabled=true;$('osoto-stop').hidden=false;$('osoto-status').textContent=t('카메라와 자세 추적을 준비합니다…','Preparing camera and pose tracking…');
  try{
   const acquired=phone?await connectPhoneCamera({orientation:'portrait',isCurrent:()=>current===generation&&!disposed}):await navigator.mediaDevices.getUserMedia({video:{width:{ideal:720},height:{ideal:1280}},audio:false});
   if(current!==generation||disposed){releaseCamera(acquired);return;}if(!acquired){stop(t('연결을 취소했습니다.','Connection cancelled.'));return;}
   stream=acquired;video.srcObject=stream;onCameraEnded(stream,()=>{if(current===generation)stop(t('카메라 연결이 끝났습니다. 다시 시작하세요.','Camera disconnected. Start again.'));});
   if(!await playback.start(()=>current===generation&&!disposed))return;
   tracker=createPoseTracker();tracker.onmessage=({data})=>{
    if(current!==generation||disposed)return;
    if(data.type==='ready'){clearTimeout(initTimer);ready=true;startAt=performance.now()+3000;$('osoto-status').textContent=t('전신을 보이고 금색 자세를 따라 하세요.','Show your whole body and match the gold pose.');}
    if(data.type==='result'){clearTimeout(frameTimer);busy=false;lastResult=performance.now();const ratio=video.videoHeight/video.videoWidth;points=cameraPose(data.points,ratio);}
    if(data.type==='error')stop(t('자세 추적에 실패했습니다. 다시 시작해 주세요.','Pose tracking failed. Please start again.'));
   };tracker.onerror=()=>stop(t('자세 추적이 중단됐습니다. 다시 시작해 주세요.','Tracking stopped. Please start again.'));
   initTimer=setTimeout(()=>{if(current===generation)stop(t('모델 준비 시간이 초과됐습니다. 다시 시작해 주세요.','Model loading timed out. Please start again.'));},30000);tracker.postMessage({type:'init'});
  }catch(error){if(current===generation)stop(t('카메라를 연결하지 못했습니다. 권한과 연결을 확인하고 다시 시작하세요.','Could not connect the camera. Check permission and connection, then try again.'));}
  finally{if(current===generation)pending=false;}
 }
 async function infer(now){
  if(!ready||busy||document.hidden||video.readyState<2||video.currentTime===lastVideo||now-sent<65)return;
  busy=true;lastVideo=video.currentTime;sent=now;const current=generation;
  try{const bitmap=await createImageBitmap(video);if(current!==generation||disposed){bitmap.close();return;}frameTimer=setTimeout(()=>{if(current===generation)stop(t('추적 응답이 없습니다. 다시 시작하세요.','No tracking response. Please restart.'));},5000);tracker.postMessage({type:'frame',bitmap,time:now},[bitmap]);}
  catch{if(current===generation)stop(t('카메라 프레임을 읽지 못했습니다. 다시 시작하세요.','Could not read the camera frame. Please restart.'));}
 }
 function tick(now){
  if(disposed)return;void infer(now);
  const fresh=ready&&now-lastResult<300&&!document.hidden?points:null;
  const dt=lastTick?Math.min(.1,(now-lastTick)/1000):0;lastTick=now;
  if(demo&&playing&&!document.hidden)demoElapsed=(demoElapsed+dt*speed)%OSOTO_DEMO_DURATION;
  const time3d=throwTimeAtElapsed(demoElapsed/OSOTO_DEMO_DURATION*THROW_DURATION);
  const demoStage=time3d<.7?0:time3d<1.7?1:time3d<2.2?2:3;
  const state=demo?{stage:demoStage,score:0,hold:0}:progress.update(fresh,now,ready&&now>=startAt&&!document.hidden),stage=state.stage,target=OSOTO_TARGETS[stage];
  const show3d=demo&&!!renderer;canvas.hidden=show3d;$('osoto-target').hidden=show3d;$('osoto-3d').hidden=!show3d;root.querySelector('.osoto-stage').classList.toggle('is-3d',show3d);
  $('osoto-3d-controls').hidden=$('osoto-timeline').hidden=!show3d;
  if(show3d){if(time3d!==poseTime){pose3d=sampleThrow('o-soto-gari',time3d);poseTime=time3d;}renderer.draw(pose3d,{yaw:viewYaw,pitch:.18,solo,gold:true});$('osoto-seek').value=String(Math.round(demoElapsed/OSOTO_DEMO_DURATION*1000));}
  const W=300,H=420;ctx.clearRect(0,0,W,H);
  // Fixed reference coordinates: never anchor either silhouette to the user.
  const all=OSOTO_TARGETS.flat().filter(Boolean),xs=all.map(p=>p.x),ys=all.map(p=>p.y);
  const minX=Math.min(...xs)-.3,maxX=Math.max(...xs)+.3,minY=Math.min(...ys)-.3,maxY=Math.max(...ys)+.3;
  const scale=Math.min((W-24)/(maxX-minX),(H-24)/(maxY-minY));
  const ox=W/2-(minX+maxX)*scale/2,oy=H/2-(minY+maxY)*scale/2;
  drawOsotoBody(ctx,target.map(p=>p?{x:ox+p.x*scale,y:oy+p.y*scale}:null),'#d6a24d',scale);
  $('osoto-target-step').textContent=stage===0?t('초기자세','Ready'):`${stage} / 3`;
  canvas.dataset.demo=String(demo);canvas.dataset.playing=String(demo&&playing);canvas.dataset.time=demoElapsed.toFixed(3);canvas.dataset.stage=String(stage);canvas.dataset.done=String(state.done);canvas.dataset.score=String(state.score);canvas.dataset.ready=String(ready);
  $('osoto-title').textContent=titles[stage];$('osoto-cue').textContent=cues[stage];$('osoto-step').textContent=stage===0?t('초기자세 오른발 앞','Starting stance: right foot forward'):`${stage} / 3`;$('osoto-hold').value=state.hold||0;
  $('osoto-demo').textContent=demo?(playing?t('시연 일시정지','Pause demo'):t('시연 재생','Play demo')):t('3D 시연 보기','Watch 3D demo');
  $('osoto-score').hidden=demo;
  $('osoto-score').textContent=demo?'':state.done||state.transition?'Perfect':fresh?`${state.score}%`:'—';
  const hints={front:t('카메라 정면을 향해 서 주세요.','Face the camera directly.'),depth:stage===0?cues[0]:stage===1?t('왼발을 앞으로 딛고 오른발은 뒤에 두세요.','Step your left foot forward and keep the right foot behind.'):cues[stage],tracking:t('머리부터 양발까지 카메라에 보여 주세요.','Show your head and both feet.'),left:t('왼발을 딛고 지지하세요.','Plant and support on your left foot.'),right:cues[stage],torso:t('상체 기울기를 금색 몸에 맞춰 주세요.','Match the gold torso lean.'),arms:t('양손을 당긴 위치에 맞춰 주세요.','Match the pulling hand positions.'),hold:t('좋아요, 그대로 1초!','Hold it for 1 second!'),position:t('금색 몸에 자세를 맞춰 주세요.','Match the gold body.')};
  $('osoto-feedback').textContent=demo?cues[stage]:state.done?t('3단계 완료','All 3 stages complete.'):ready&&now<startAt?String(Math.ceil((startAt-now)/1000)):state.transition?t('Perfect · 다음 자세','Perfect · Next pose'):hints[state.issue]||hints.tracking;
  root.querySelectorAll('[data-osoto-step]').forEach((li,i)=>{li.classList.toggle('current',i===stage&&!state.done);li.classList.toggle('complete',!demo&&(i<stage||state.done));});raf=requestAnimationFrame(tick);
 }
 root.querySelectorAll('[data-osoto-view]').forEach(button=>on(button,'click',()=>{viewYaw={front:0,oblique:1.05,side:Math.PI/2}[button.dataset.osotoView];root.querySelectorAll('[data-osoto-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
 on($('osoto-solo'),'change',e=>solo=e.target.checked);on($('osoto-speed'),'change',e=>speed=Number(e.target.value));
 on($('osoto-seek'),'input',e=>{demoElapsed=Number(e.target.value)/1000*OSOTO_DEMO_DURATION;playing=false;});
 on($('osoto-demo'),'click',()=>{if(!demo){stop();demo=true;demoElapsed=0;playing=true;$('osoto-status').textContent=t('3D 시연 · 시점을 바꿔 동작을 확인하세요.','3D demo · Change the view to inspect the movement.');}else playing=!playing;});
 on($('osoto-start'),'click',()=>void start());on($('osoto-phone'),'click',()=>void start(true));on($('osoto-stop'),'click',()=>stop(t('카메라를 껐습니다.','Camera stopped.')));on($('osoto-reset'),'click',()=>{if(demo){demoElapsed=0;playing=true;}progress.reset();startAt=ready?performance.now()+3000:Infinity;});
 on(document,'visibilitychange',()=>{progress.hold=0;progress.last=null;points=null;lastTick=0;if(ready)startAt=performance.now()+3000;});
 function cleanup(){if(disposed)return;disposed=true;stop();cancelAnimationFrame(raf);renderer?.dispose();abort.abort();}
 on(document,'judo-exit',cleanup);on(window,'pagehide',cleanup);raf=requestAnimationFrame(tick);return cleanup;
}
