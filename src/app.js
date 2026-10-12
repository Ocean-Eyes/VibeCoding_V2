import {LandmarkStream,assignHands,projectHand,palmFacing} from './live-hands.js';
import {drawLiveGlove} from './live-glove.js';
import {prepareHands} from './hand-renderer.js';
import {drawOpponent,drawGripStudy,drawGripGuides,drawTrackedHands,crossedGrip} from './opponent.js';
import {GRIP_STEPS,opponentFrame,demonstrationAt,practiceGuide} from './demonstration.js';
import {TECHNIQUES} from './curriculum.js';
import {PASS_SCORE,POSES,BONES,HAND_BONES,bodyFrame,targetPose,armMatch,advanceHold} from './pose.js';
await prepareHands();
const poseStream=new LandmarkStream(),handStreams=[new LandmarkStream(),new LandmarkStream()];
let assignedHands=[null,null];
function resetTrackingDisplay(){poseStream.reset();handStreams.forEach(s=>s.reset());assignedHands=[null,null]}
const pixel=p=>p?{...p,x:p.x*video.videoWidth,y:p.y*video.videoHeight,z:(p.z??0)*video.videoWidth}:null;
const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const cyan='#80baff',partner=$('partner'),partnerCtx=partner.getContext('2d');
let demonstrating=true,demoStarted=performance.now(),demoStep=-1,guideStarted=performance.now();
let mode='idle',worker=null,stream=null,ready=false,busy=false,generation=0,lastVideo=-1,lastSent=0,lastResult=0,lastTick=performance.now();
let points=null,hands=[],selected=0,running=false,countdown=0,elapsed=0,hold=0,completed=new Set(),score=null;
let armScore=null,handScore=null,fps=0,viewWidth=0,viewHeight=0,initTimer=null,frameTimer=null;
let trackerGeneration=0,activeTechnique=TECHNIQUES[0],autoStart=false,gripReady=false,tapUntil=0;
const notify=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error)};
function line(context,a,b,color,width=3,dash=[]){if(!a||!b)return;context.beginPath();context.strokeStyle=color;context.lineWidth=width;context.lineCap='round';context.setLineDash(dash);context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();context.setLineDash([])}
function circle(context,p,r,color,fill=true){if(!p)return;context.beginPath();context.arc(p.x,p.y,r,0,Math.PI*2);context.fillStyle=color;context.strokeStyle=color;context.lineWidth=2;fill?context.fill():context.stroke()}
function skeleton(context,p,color,width=3){for(const[a,b]of BONES){if(p[a]&&p[b]&&(p[a].visibility??1)>=.65&&(p[b].visibility??1)>=.65)line(context,p[a],p[b],color,width)}for(const i of[11,12,13,14,15,16,23,24])if(p[i]&&(p[i].visibility??1)>=.65)circle(context,p[i],width*1.25,color)}
function preview(canvas,index){const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height;context.clearRect(0,0,w,h);const frame=opponentFrame(w,h);drawOpponent(context,frame);drawGripGuides(context,frame,GRIP_STEPS[index],activeTechnique.directions,true)}
function updatePose(index=selected){
  const p=POSES[index];$('step-label').textContent=`0${index+1} / 03`;$('pose-number').textContent=`0${index+1}`;$('pose-name').textContent=p.name;$('pose-description').textContent=activeTechnique.cues[index];$('gesture-label').textContent='흰색 손의 이동을 따라하세요';preview($('preview'),index);
  document.querySelectorAll('.pose-card').forEach((button,i)=>{preview(button.querySelector('canvas'),i);button.classList.toggle('selected',i===index);button.setAttribute('aria-pressed',String(i===index));button.querySelector('.completion').textContent=completed.has(i)?'✓':''});
}
POSES.forEach((p,i)=>{const button=document.createElement('button');button.className='pose-card';button.innerHTML=`<canvas width="140" height="110" aria-hidden="true"></canvas><span class="card-copy"><small>STEP 0${i+1}</small><strong>${p.name}</strong><span>${p.short}</span></span><span class="completion" aria-label="완료 여부"></span>`;button.onclick=()=>choose(i);$('pose-list').append(button);preview(button.querySelector('canvas'),i)});
function choose(index){demonstrating=false;guideStarted=performance.now();tapUntil=0;selected=(index+POSES.length)%POSES.length;hold=0;score=armScore=handScore=null;updatePose();controls()}
function controls(){const active=mode==='live';$('welcome').hidden=mode!=='idle';$('start').disabled=mode==='loading';$('play').disabled=mode==='loading'||mode==='preview';$('reset').disabled=!active;$('stop').disabled=mode==='idle';$('play').innerHTML=running?'일시 정지 <span>Ⅱ</span>':'내 동작 연습 <span>▶</span>';$('stop').textContent='카메라 끄기';$('status-dot').classList.toggle('active',!!stream);$('status').textContent={idle:demonstrating?'동작 시연 중':'카메라 대기 중',loading:'자세 추적 준비 중',preview:'카메라 켜짐 · 자세 추적 중단',live:'카메라 연결됨'}[mode];$('mode-label').textContent=demonstrating?'동작 시연 · 12초 반복':{idle:'카메라 대기',loading:'CONNECTING',preview:'추적 재연결 필요',live:'LIVE · 손 위치 연습'}[mode];$('demo').setAttribute('aria-pressed',String(demonstrating));}
function clearScore(){
  score=armScore=handScore=null;
  for(const id of ['score','arm-score','hand-score','live-score-value'])$(id).textContent='—';
  $('live-score').dataset.level='waiting';$('live-hold').textContent='몸을 인식하면 점수가 표시됩니다';
}
function stop(){
  resetTrackingDisplay();
  clearScore();
  tapUntil=0;autoStart=false;
  generation++;trackerGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.hidden=true;ready=busy=running=false;mode='idle';points=null;hands=[];lastResult=0;lastVideo=-1;elapsed=hold=countdown=0;score=armScore=handScore=null;$('countdown').hidden=true;$('retry-tracking').hidden=true;ctx.clearRect(0,0,canvas.width,canvas.height);controls();updatePose();
}
function fail(message){stop();notify(message,true)}
function trackingFailed(message){resetTrackingDisplay();clearScore();autoStart=false;tapUntil=0;
  trackerGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;
  ready=busy=running=false;points=null;hands=[];lastResult=0;hold=countdown=0;score=armScore=handScore=null;
  mode=stream?'preview':'idle';$('countdown').hidden=true;$('retry-tracking').hidden=!stream;controls();
  notify(`${message} 카메라 영상은 유지됩니다. 아래 버튼으로 자세 추적을 다시 연결해 주세요.`,true);
}
function connectTracker(){
  resetTrackingDisplay();
  const session=generation,attempt=++trackerGeneration;
  clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();ready=busy=false;lastVideo=-1;points=null;hands=[];lastResult=0;
  mode='loading';$('retry-tracking').hidden=true;controls();notify('카메라가 연결되었습니다. 자세 추적 모델을 준비하고 있습니다.');
  initTimer=setTimeout(()=>{if(session===generation&&attempt===trackerGeneration)trackingFailed('추적 모델 연결 시간이 초과되었습니다.')},90000);
  try{
    worker=new Worker(new URL('./tracker.js',import.meta.url));
    worker.onerror=e=>{if(session===generation&&attempt===trackerGeneration)trackingFailed(`추적 모듈 오류: ${e.message||'Worker 실행 실패'}`)};
    worker.onmessage=({data})=>{
      if(session!==generation||attempt!==trackerGeneration)return;
      if(data.type==='ready'){clearTimeout(initTimer);ready=true;mode='live';if(autoStart){autoStart=false;running=true;countdown=3;$('countdown').hidden=false;}controls();notify('흰색 손이 내 손가락 움직임을 따라갑니다. 점선 깃 위치로 손을 가져가세요.');}
      if(data.type==='error')trackingFailed(data.message);
      if(data.type==='result'){
        clearTimeout(frameTimer);busy=false;const now=performance.now();fps=lastResult?1000/(now-lastResult):0;lastResult=now;
        points=data.points?.map(pixel)??null;hands=data.hands.map(h=>h.map(pixel));
        poseStream.update(data.points,now);
        assignedHands=assignHands(data.hands,data.points,assignedHands);
        assignedHands.forEach((h,i)=>handStreams[i].update(h,now));
      }
    };worker.postMessage({type:'init'});
  }catch(e){trackingFailed(`추적 모듈을 시작하지 못했습니다: ${e.message}`)}
}
async function start(){
  demonstrating=false;guideStarted=performance.now();stop();autoStart=true;const session=generation;mode='loading';controls();notify('카메라 권한을 허용해 주세요. 첫 연결 시 추적 모델을 다운로드합니다.');
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){fail('카메라는 HTTPS 또는 localhost에서 사용할 수 있습니다. 로컬 실행 안내를 확인해 주세요.');return}
  initTimer=setTimeout(()=>{if(session===generation)fail('연결 시간이 초과되었습니다. 카메라 권한과 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')},90000);
  try{
    const acquired=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:'user',frameRate:{ideal:30,max:30}},audio:false});
    if(session!==generation){acquired.getTracks().forEach(t=>t.stop());return}
    stream=acquired;stream.getVideoTracks()[0].addEventListener('ended',()=>{if(session===generation)fail('카메라 연결이 끊겼습니다. 카메라를 확인하고 다시 연결해 주세요.')});video.srcObject=stream;await video.play();if(session!==generation)return;video.hidden=false;
    connectTracker();
  }catch(e){if(session!==generation)return;const message={NotAllowedError:'카메라 권한이 거부되었습니다. 브라우저 주소창의 사이트 권한에서 카메라를 허용해 주세요.',NotFoundError:'연결된 웹캠이 없습니다. 웹캠을 연결한 뒤 다시 시도해 주세요.',NotReadableError:'카메라를 사용할 수 없습니다. 다른 앱의 카메라 사용을 종료하고 다시 시도해 주세요.'}[e.name]??`카메라 연결에 실패했습니다: ${e.message}`;fail(message)}
}
async function sendFrame(now){
  if(!ready||busy||video.readyState<2||video.currentTime===lastVideo||now-lastSent<65)return;
  busy=true;lastVideo=video.currentTime;lastSent=now;const session=generation,attempt=trackerGeneration;
  try{const bitmap=await createImageBitmap(video);if(session!==generation||attempt!==trackerGeneration){bitmap.close();return}worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);frameTimer=setTimeout(()=>{if(session===generation&&attempt===trackerGeneration)trackingFailed('추적 응답이 지연되었습니다.')},15000)}catch(e){if(session===generation&&attempt===trackerGeneration)trackingFailed(`영상 프레임을 처리하지 못했습니다: ${e.message}`)}
}
function draw(now){
  const box=$('viewport').getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),scene=opponentFrame(box.width,box.height);
  if(viewWidth!==box.width||viewHeight!==box.height||canvas.width!==Math.round(box.width*dpr)){
    viewWidth=box.width;viewHeight=box.height;canvas.width=partner.width=Math.round(box.width*dpr);canvas.height=partner.height=Math.round(box.height*dpr);
    partnerCtx.setTransform(dpr,0,0,dpr,0,0);partnerCtx.clearRect(0,0,box.width,box.height);drawOpponent(partnerCtx,scene);
    partner.dataset.frame=JSON.stringify(scene);
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);
  const fresh=mode==='live'&&now-lastResult<650,current=fresh?points:null,frame=bodyFrame(current),mirrored=$('mirror').checked;
  score=armScore=handScore=null;gripReady=false;canvas.dataset.aligned=String(!!frame);canvas.dataset.skeleton=String($('show-skeleton').checked);
  let instruction;
  if(demonstrating){
    instruction=demonstrationAt((now-demoStarted)/1000,activeTechnique);
    if(demoStep!==instruction.step){demoStep=instruction.step;updatePose(demoStep)}
    drawGripGuides(ctx,scene,instruction.hands,activeTechnique.directions,mirrored,null,{actions:activeTechnique.actions,finish:instruction.finish});
  }else{
    if(mode!=='live')drawGripGuides(ctx,scene,practiceGuide(selected,(now-guideStarted)/1000),activeTechnique.directions,mirrored,GRIP_STEPS[selected]);
    canvas.dataset.liveHands='0';
    if(frame){
      const target=targetPose(frame,POSES[selected],current),arm=armMatch(current,target,frame.scale);
      score=armScore=arm?.score??null;gripReady=crossedGrip(current,target,frame);
      const shown=poseStream.at(now)?.map(pixel),shownFrame=bodyFrame(shown);
      if(shownFrame){
        const shownTarget=targetPose(shownFrame,POSES[selected],shown);
        for(const p of projectHand([shownTarget[15],shownTarget[16]],shownFrame,scene,mirrored)){
          ctx.beginPath();ctx.ellipse(p.x,p.y,scene.scale*.07,scene.scale*.10,0,0,Math.PI*2);
          ctx.strokeStyle='#efcf8dcc';ctx.lineWidth=1.5;ctx.setLineDash([5,5]);ctx.stroke();ctx.setLineDash([]);
        }
        const live=handStreams.map((stream,i)=>{
          const raw=stream.at(now)?.map(pixel);if(!raw)return null;
          const hand=projectHand(raw,shownFrame,scene,mirrored);
          const e=shown[13+i],elbow=e&&(e.visibility??1)>=.65?projectHand([e],shownFrame,scene,mirrored)[0]:null;
          return {hand,elbow,left:i===0,depth:shown[15+i]?.z??0};
        }).filter(Boolean).sort((a,b)=>b.depth-a.depth);
        for(const h of live)drawLiveGlove(ctx,h.hand,palmFacing(h.hand,h.left,mirrored),h.elbow);
        canvas.dataset.liveHands=String(live.length);
        // Wrist-only tracking remains a dot, never a fabricated closed hand.
        const wristDots=[15,16].map((id,i)=>{
          const p=shown[id];if(handStreams[i].at(now)||!p||(p.visibility??1)<.65)return null;
          return projectHand([p],shownFrame,{origin:{x:0,y:0},scale:1},false)[0];
        });
        drawTrackedHands(ctx,scene,wristDots,mirrored);
      }
      if($('show-skeleton').checked&&shownFrame){
        const frame=shownFrame;
        const project=p=>{if(!p)return null;const dx=p.x-frame.origin.x,dy=p.y-frame.origin.y;return {...p,x:scene.origin.x+(mirrored?-1:1)*(dx*frame.x.x+dy*frame.x.y)/frame.scale*scene.scale,y:scene.origin.y+(dx*frame.y.x+dy*frame.y.y)/frame.scale*scene.scale}};
        skeleton(ctx,shown.map(project),cyan,1.5);
        for(const hand of handStreams.map(s=>s.at(now)?.map(pixel)).filter(Boolean))for(const [a,b]of HAND_BONES)line(ctx,project(hand[a]),project(hand[b]),cyan,1);
      }
    }
  }
  const feedback=demonstrating?`깃 안쪽: ${activeTechnique.directions.map((d,i)=>`${i?'오른손':'왼손'} ${d==='↑'?'네 손가락':'엄지'}`).join(' · ')}`:!frame?'어깨와 팔꿈치, 양손이 보이도록 서 주세요.':score===null?'손목이나 팔꿈치가 가려졌습니다.':selected===2&&!gripReady?'양손을 교차해 각각 반대편 깃에 맞춰 주세요.':score>=PASS_SCORE?'좋아요. 지금 위치를 3초 유지하세요.':'흰색 내 손을 점선으로 표시된 깃 위치에 맞춰 주세요.';
  $('tracking-label').textContent=demonstrating?'시연 중':frame?`${canvas.dataset.liveHands||0}개 손 · 손가락 추적 중`:stream?'인식 대기':'대기';
  $('feedback').textContent=feedback;$('live-feedback').textContent=feedback;
  $('live-score-value').textContent=score??'—';$('live-score').dataset.level=score===null?'waiting':score>=PASS_SCORE?'good':score>=35?'near':'adjust';
  $('live-score-label').textContent=demonstrating?'시연 · 채점 안 함':'팔 위치 일치도 / 100';
  $('live-hold').textContent=demonstrating?'연습 버튼을 누르면 채점합니다':score===null?'몸을 인식하면 점수가 표시됩니다':`유지 ${hold.toFixed(1)} / 3초 · 통과 50점`;
  $('opponent-status').dataset.tap=String(!!tapUntil);
  $('opponent-status').textContent=tapUntil?'TAP! · 손을 풀어 주세요':demonstrating?instruction.label:`0${selected+1} · ${POSES[selected].name}`;
}
function tick(now){
  const dt=Math.min((now-lastTick)/1000,.2);lastTick=now;
  if(mode==='live')void sendFrame(now);
  if($('practice-screen').hidden){requestAnimationFrame(tick);return}
  video.style.transform=$('mirror').checked?'scaleX(-1)':'none';draw(now);
  if(running&&countdown>0){countdown=Math.max(0,countdown-dt);$('countdown').textContent=Math.ceil(countdown)||'GO';$('countdown').hidden=countdown===0}
  else if(running){elapsed+=dt;hold=advanceHold(hold,dt,selected===2&&!gripReady?null:score,true);if(hold>=3){completed.add(selected);if(selected===2&&completed.size===POSES.length){running=false;tapUntil=now+1500;controls();updatePose();notify('가상 상대가 탭했습니다. 손을 풀어 주세요.')}else{choose((selected+1)%POSES.length);notify('다음 손 위치를 맞춰 주세요.')}}}
  if(tapUntil&&now>=tapUntil){tapUntil=0;hold=0;document.dispatchEvent(new CustomEvent('judo-complete',{detail:{demo:false}}));}
  $('score').textContent=score??'—';$('arm-score').textContent=armScore===null?'—':`${armScore}%`;$('hand-score').textContent=mode==='live'?`${Math.min(hands.length,2)} / 2`:'—';
  $('score-verdict').textContent=score===null?'측정 가능한 자세를 기다려요':score>=PASS_SCORE?'좋아요, 그대로 유지해요':score>=35?'조금만 더 맞춰볼까요':'목표를 천천히 따라가세요';
  $('hold-text').textContent=`${hold.toFixed(1)} / 3.0초`;$('hold-progress').style.width=`${hold/3*100}%`;
  $('timer').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('fps').textContent=mode==='live'?`${Math.round(fps)} FPS · RGB CAMERA / 2D`:'RGB CAMERA / 2D';
  $('stage-hint').textContent=demonstrating?'흰색 손: 시연 · 상대는 고정됩니다':countdown?'잠시 후 시작합니다':mode==='live'?'흰색 장갑: 내 손 · 점선: 목표 위치':'내 동작 연습을 누르세요';requestAnimationFrame(tick);
}
$('start').onclick=start;
$('demo').onclick=()=>{stop();demonstrating=true;demoStarted=performance.now();demoStep=-1;controls();notify('흰색 손이 준비 → 왼손 교차 → 오른손 교차 → 유지 → 풀기를 반복합니다.')};
$('retry-tracking').onclick=()=>{if(stream)connectTracker()};
$('stop').onclick=()=>{stop();notify('연결을 종료했습니다. 카메라는 꺼져 있습니다.')};
function openVideo(){autoStart=false;running=false;hold=countdown=0;tapUntil=0;$('countdown').hidden=true;controls();$('video-title').textContent=activeTechnique.name;$('video-external').href=`https://www.youtube.com/watch?v=${activeTechnique.video}`;$('kodokan-player').src=`https://www.youtube-nocookie.com/embed/${activeTechnique.video}?rel=0`;$('video-dialog').showModal()}
$('video-shortcut').onclick=openVideo;
$('close-video').onclick=()=>$('video-dialog').close();$('video-dialog').addEventListener('close',()=>$('kodokan-player').removeAttribute('src'));
$('play').onclick=()=>{if(mode==='idle'){void start();return}demonstrating=false;updatePose();tapUntil=0;running=!running;hold=0;if(running){const done=completed;if(done.size===POSES.length){done.clear();updatePose()}countdown=3;$('countdown').hidden=false;notify('3초 뒤 시작합니다. 목표 자세를 50% 이상으로 3초 유지해 보세요.')}else{countdown=0;$('countdown').hidden=true;notify('일시 정지했습니다. 카메라 추적은 계속되며 유지 시간은 누적하지 않습니다.')}controls()};
$('reset').onclick=()=>{tapUntil=0;hold=0;elapsed=0;countdown=running?3:0;notify('현재 동작의 유지 시간과 연습 타이머를 초기화했습니다.')};
$('previous').onclick=()=>choose(selected-1);$('next').onclick=()=>choose(selected+1);
document.addEventListener('visibilitychange',()=>{if(document.hidden){autoStart=false;tapUntil=0;running=false;countdown=hold=0;$('countdown').hidden=true;controls()}});
window.addEventListener('pagehide',stop);updatePose();controls();requestAnimationFrame(tick);

document.addEventListener('judo-exit',stop);
document.addEventListener('judo-lesson',({detail})=>{activeTechnique=detail;const gripCanvas=$('grip-preview'),gripContext=gripCanvas.getContext('2d');drawGripStudy(gripContext,gripCanvas.width,gripCanvas.height,detail.directions);gripCanvas.setAttribute('aria-label',`${detail.name}: ${detail.detail}`);stop();completed.clear();selected=0;demonstrating=true;demoStarted=performance.now();demoStep=-1;updatePose();controls();notify('흰색 손의 시연을 확인한 뒤 내 동작 연습을 눌러 카메라를 연결하세요.');});
