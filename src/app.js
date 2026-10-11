import {PASS_SCORE,POSES,BONES,HAND_BONES,bodyFrame,targetPose,armMatch,handMatch,advanceHold,fitRect} from './pose.js';
const $=id=>document.getElementById(id),video=$('video'),canvas=$('overlay'),ctx=canvas.getContext('2d');
const mint='#cf626b',cyan='#80baff',orange='#eab776';
let mode='idle',worker=null,stream=null,ready=false,busy=false,generation=0,lastVideo=-1,lastSent=0,lastResult=0,lastTick=performance.now();
let points=null,hands=[],selected=0,running=false,countdown=0,elapsed=0,hold=0,completed=new Set(),demoCompleted=new Set(),score=null;
let armScore=null,handScore=null,fps=0,viewWidth=0,viewHeight=0,initTimer=null,frameTimer=null;
let trackerGeneration=0;
const notify=(message,error=false)=>{$('notice').textContent=message;$('notice').classList.toggle('error',error)};
function line(context,a,b,color,width=3,dash=[]){if(!a||!b)return;context.beginPath();context.strokeStyle=color;context.lineWidth=width;context.lineCap='round';context.setLineDash(dash);context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();context.setLineDash([])}
function circle(context,p,r,color,fill=true){if(!p)return;context.beginPath();context.arc(p.x,p.y,r,0,Math.PI*2);context.fillStyle=color;context.strokeStyle=color;context.lineWidth=2;fill?context.fill():context.stroke()}
function drawHand(context,wrist,elbow,size,gesture,color){
  if(!wrist||!elbow)return;
  const angle=Math.atan2(wrist.y-elbow.y,wrist.x-elbow.x)+Math.PI/2;
  context.save();context.translate(wrist.x,wrist.y);context.rotate(angle);context.strokeStyle=color;context.fillStyle=color;context.lineWidth=Math.max(1.5,size*.065);context.lineCap='round';context.globalAlpha*=.75;
  context.beginPath();context.roundRect(-size*.23,-size*.55,size*.46,size*.6,size*.15);context.stroke();
  if(gesture==='open'){
    for(let i=0;i<4;i++)line(context,{x:(i-1.5)*size*.14,y:-size*.5},{x:(i-1.5)*size*.22,y:-size*(i===0||i===3?.93:1.15)},color,size*.07);
    line(context,{x:-size*.2,y:-size*.1},{x:-size*.51,y:-size*.48},color,size*.08);
  }else{for(let i=0;i<3;i++)line(context,{x:(i-1)*size*.14,y:-size*.52},{x:(i-1)*size*.14,y:-size*.25},color,size*.05)}
  context.restore();
}
function skeleton(context,p,color,width=3){for(const[a,b]of BONES){if(p[a]&&p[b]&&(p[a].visibility??1)>=.65&&(p[b].visibility??1)>=.65)line(context,p[a],p[b],color,width)}for(const i of[11,12,13,14,15,16,23,24])if(p[i]&&(p[i].visibility??1)>=.65)circle(context,p[i],width*1.25,color)}
function targetDraw(context,p,scale,gesture,head=false){
  context.save();context.globalAlpha=.28;skeleton(context,p,mint,Math.max(9,scale*.11));context.restore();
  skeleton(context,p,'#cf626bb0',2);for(const i of[15,16]){circle(context,p[i],scale*.14,'#cf626b70',false);drawHand(context,p[i],p[i-2],scale*.3,gesture,mint)}
  if(head){circle(context,p[0],scale*.23,'#cf626baa',false);line(context,{x:p[0].x,y:p[0].y+scale*.23},{x:(p[11].x+p[12].x)/2,y:(p[11].y+p[12].y)/2},'#cf626b80',2)}
}
function preview(canvas,index){const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height;context.clearRect(0,0,w,h);const scale=Math.min(w/4.7,h/3.2);const frame={origin:{x:w/2,y:h*.53},scale,x:{x:-1,y:0},y:{x:0,y:1}};targetDraw(context,targetPose(frame,POSES[index]),scale,POSES[index].gesture,true)}
function updatePose(){
  const p=POSES[selected];$('step-label').textContent=`0${selected+1} / 03`;$('pose-number').textContent=`0${selected+1}`;$('pose-name').textContent=p.name;$('pose-description').textContent=p.description;$('gesture-label').textContent='손바닥 방향은 직접 확인';preview($('preview'),selected);
  document.querySelectorAll('.pose-card').forEach((button,i)=>{button.classList.toggle('selected',i===selected);button.setAttribute('aria-pressed',String(i===selected));button.querySelector('.completion').textContent=(mode==='demo'?demoCompleted:completed).has(i)?'✓':''});
}
POSES.forEach((p,i)=>{const button=document.createElement('button');button.className='pose-card';button.innerHTML=`<canvas width="140" height="110" aria-hidden="true"></canvas><span class="card-copy"><small>STEP 0${i+1}</small><strong>${p.name}</strong><span>${p.short}</span></span><span class="completion" aria-label="완료 여부"></span>`;button.onclick=()=>choose(i);$('pose-list').append(button);preview(button.querySelector('canvas'),i)});
function choose(index){selected=(index+POSES.length)%POSES.length;hold=0;score=armScore=handScore=null;updatePose()}
function controls(){const active=mode==='live'||mode==='demo';$('welcome').hidden=mode!=='idle';$('start').disabled=mode==='loading';$('play').disabled=!active;$('reset').disabled=!active;$('stop').disabled=mode==='idle';$('play').innerHTML=running?'일시 정지 <span>Ⅱ</span>':'연습 시작 <span>▶</span>';$('stop').textContent=mode==='demo'?'데모 종료':'카메라 끄기';$('status-dot').classList.toggle('active',!!stream);$('status').textContent={idle:'카메라 대기 중',loading:'자세 추적 준비 중',preview:'카메라 켜짐 · 자세 추적 중단',live:'카메라 연결됨',demo:'데모 미리보기 · 실제 측정 아님'}[mode];$('mode-label').textContent={idle:'READY WHEN YOU ARE',loading:'CONNECTING',preview:'CAMERA ON · 추적 재연결 필요',live:'LIVE · LOCAL PROCESSING',demo:'DEMO · 가상 움직임'}[mode];}
function stop(){
  generation++;trackerGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.hidden=true;ready=busy=running=false;mode='idle';points=null;hands=[];lastResult=0;lastVideo=-1;elapsed=hold=countdown=0;score=armScore=handScore=null;$('countdown').hidden=true;$('retry-tracking').hidden=true;ctx.clearRect(0,0,canvas.width,canvas.height);controls();updatePose();
}
function fail(message){stop();notify(message,true)}
function trackingFailed(message){
  trackerGeneration++;clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();worker=null;
  ready=busy=running=false;points=null;hands=[];lastResult=0;hold=countdown=0;score=armScore=handScore=null;
  mode=stream?'preview':'idle';$('countdown').hidden=true;$('retry-tracking').hidden=!stream;controls();
  notify(`${message} 카메라 영상은 유지됩니다. 아래 버튼으로 자세 추적을 다시 연결해 주세요.`,true);
}
function connectTracker(){
  const session=generation,attempt=++trackerGeneration;
  clearTimeout(initTimer);clearTimeout(frameTimer);worker?.terminate();ready=busy=false;lastVideo=-1;points=null;hands=[];lastResult=0;
  mode='loading';$('retry-tracking').hidden=true;controls();notify('카메라가 연결되었습니다. 자세 추적 모델을 준비하고 있습니다.');
  initTimer=setTimeout(()=>{if(session===generation&&attempt===trackerGeneration)trackingFailed('추적 모델 연결 시간이 초과되었습니다.')},90000);
  try{
    worker=new Worker(new URL('./tracker.js',import.meta.url));
    worker.onerror=e=>{if(session===generation&&attempt===trackerGeneration)trackingFailed(`추적 모듈 오류: ${e.message||'Worker 실행 실패'}`)};
    worker.onmessage=({data})=>{
      if(session!==generation||attempt!==trackerGeneration)return;
      if(data.type==='ready'){clearTimeout(initTimer);ready=true;mode='live';controls();notify('어깨와 양손이 보이도록 서 주세요. 목표 가이드는 어깨가 인식되면 내 몸에 맞춰 정렬됩니다.');}
      if(data.type==='error')trackingFailed(data.message);
      if(data.type==='result'){
        clearTimeout(frameTimer);busy=false;const now=performance.now();fps=lastResult?1000/(now-lastResult):0;lastResult=now;
        const pixel=p=>({...p,x:p.x*video.videoWidth,y:p.y*video.videoHeight});points=data.points?.map(pixel)??null;hands=data.hands.map(h=>h.map(pixel));
      }
    };worker.postMessage({type:'init'});
  }catch(e){trackingFailed(`추적 모듈을 시작하지 못했습니다: ${e.message}`)}
}
async function start(){
  stop();const session=generation;mode='loading';controls();notify('카메라 권한을 허용해 주세요. 첫 연결 시 추적 모델을 다운로드합니다.');
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
  const box=$('viewport').getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  if(viewWidth!==box.width||viewHeight!==box.height){viewWidth=box.width;viewHeight=box.height;canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);
  let current=points,currentHands=hands,vw=video.videoWidth||1280,vh=video.videoHeight||720;
  if(mode==='demo'){
    vw=1280;vh=800;const f={origin:{x:640,y:365},scale:205,x:{x:1,y:0},y:{x:0,y:1}};
    current=targetPose(f,POSES[selected]).map(p=>p?{...p}:null);const offset=(Math.sin(now/900)+1)*8;
    for(const i of[13,14,15,16]){current[i].y+=offset;current[i].x+=(i%2?1:-1)*offset*.35}currentHands=[];
  }
  const fresh=mode==='demo'||(mode==='live'&&now-lastResult<650);
  const frame=fresh?bodyFrame(current):null;score=armScore=handScore=null;
  canvas.dataset.aligned=String(!!frame);
  if(!frame){
    if(stream){
      const rect=fitRect(box.width,box.height,vw,vh);ctx.save();ctx.translate(rect.x,rect.y);ctx.scale(rect.scale,rect.scale);
      if($('mirror').checked){ctx.translate(vw,0);ctx.scale(-1,1)}
      const guideFrame={origin:{x:vw/2,y:vh*.49},scale:Math.min(vw/4.8,vh/3.6),x:{x:1,y:0},y:{x:0,y:1}};
      targetDraw(ctx,targetPose(guideFrame,POSES[selected]),guideFrame.scale,POSES[selected].gesture,true);
      if(fresh&&current)skeleton(ctx,current,cyan,3);
      if(fresh)for(const hand of currentHands)for(const[a,b]of HAND_BONES)line(ctx,hand[a],hand[b],cyan,2);
      ctx.restore();
    }
    $('tracking-label').textContent=stream?'미정렬 가이드':'대기';
    $('feedback').textContent=stream?'지금 가이드는 화면 중앙의 참고 자세입니다. 양어깨가 인식되면 내 몸에 맞춰 정렬하고 비교합니다.':'어깨와 팔꿈치, 양손이 모두 보여야 비교할 수 있어요.';return
  }
  const target=targetPose(frame,POSES[selected],current),arm=armMatch(current,target,frame.scale);armScore=arm?.score??null;handScore=mode==='demo'?95:handMatch(currentHands,current,frame.scale,POSES[selected].gesture);
  score=armScore; // Solo position score; palm orientation and technique effectiveness are not graded.
  const rect=fitRect(box.width,box.height,vw,vh);ctx.save();ctx.translate(rect.x,rect.y);ctx.scale(rect.scale,rect.scale);
  if($('mirror').checked){ctx.translate(vw,0);ctx.scale(-1,1)}
  if(mode==='demo'){ctx.save();ctx.globalAlpha=.3;circle(ctx,current[0],frame.scale*.25,'#758889');skeleton(ctx,current,'#607a75',frame.scale*.17);ctx.restore()}
  targetDraw(ctx,target,frame.scale,POSES[selected].gesture,mode==='demo');skeleton(ctx,current,cyan,3);
  for(const hand of currentHands){for(const[a,b]of HAND_BONES)line(ctx,hand[a],hand[b],cyan,2);for(const p of hand)circle(ctx,p,2,cyan)}
  for(const i of[15,16]){if((current[i]?.visibility??0)<.65)continue;const a=current[i],b=target[i];if(Math.hypot(a.x-b.x,a.y-b.y)>frame.scale*.16){line(ctx,a,b,orange,2,[6,5]);const theta=Math.atan2(b.y-a.y,b.x-a.x);for(const sign of[-1,1])line(ctx,b,{x:b.x-12*Math.cos(theta+sign*.5),y:b.y-12*Math.sin(theta+sign*.5)},orange,2)}}
  ctx.restore();
  $('tracking-label').textContent=mode==='demo'?'가상 데이터':armScore===null?'팔 인식 대기':'팔 위치 추적 중';
  $('feedback').textContent=mode==='demo'?'가상 관절 시범입니다. XP와 완료 기록에 반영하지 않습니다.':armScore===null?'팔꿈치와 손목이 가려지지 않도록 보여 주세요.':score>=PASS_SCORE?'팔 위치가 맞습니다. 손바닥 방향은 기술 설명과 비교해 직접 확인하세요.':arm.errors[2]>arm.errors[3]?'왼쪽 손목을 화살표 방향으로 옮겨 주세요.':'오른쪽 손목을 화살표 방향으로 옮겨 주세요.';
}
function tick(now){
  const dt=Math.min((now-lastTick)/1000,.2);lastTick=now;
  if(mode==='live')void sendFrame(now);
  if($('practice-screen').hidden){requestAnimationFrame(tick);return}
  video.style.transform=$('mirror').checked?'scaleX(-1)':'none';draw(now);
  if(running&&countdown>0){countdown=Math.max(0,countdown-dt);$('countdown').textContent=Math.ceil(countdown)||'GO';$('countdown').hidden=countdown===0}
  else if(running){elapsed+=dt;hold=advanceHold(hold,dt,score,true);if(hold>=3){const done=mode==='demo'?demoCompleted:completed;done.add(selected);if(done.size===POSES.length){running=false;hold=0;controls();updatePose();document.dispatchEvent(new CustomEvent('judo-complete',{detail:{demo:mode==='demo'}}));notify(mode==='demo'?'데모 루틴을 완료했습니다. 데모를 종료하고 카메라로 직접 연습해 보세요.':'3단계 손 위치 연습을 마쳤습니다.')}else{choose(selected+1);notify(mode==='demo'?'데모: 다음 가상 동작을 보여드립니다.':'잘했어요! 다음 동작으로 이어갑니다.')}}}
  $('score').textContent=score??'—';$('arm-score').textContent=armScore===null?'—':`${armScore}%`;$('hand-score').textContent=mode==='demo'?'가상':mode==='live'?`${Math.min(hands.length,2)} / 2`:'—';
  $('score-verdict').textContent=mode==='demo'?'데모 · 실제 측정 아님':score===null?'측정 가능한 자세를 기다려요':score>=PASS_SCORE?'좋아요, 그대로 유지해요':score>=35?'조금만 더 맞춰볼까요':'목표를 천천히 따라가세요';
  $('hold-text').textContent=`${hold.toFixed(1)} / 3.0초`;$('hold-progress').style.width=`${hold/3*100}%`;
  $('timer').textContent=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('fps').textContent=mode==='live'?`${Math.round(fps)} FPS · RGB CAMERA / 2D`:mode==='demo'?'SIMULATED MOVEMENT':'RGB CAMERA / 2D';
  $('stage-hint').textContent=mode==='demo'?'데모 미리보기 · 카메라를 사용하지 않습니다':stream&&canvas.dataset.aligned!=='true'?'참고 가이드 · 아직 몸에 정렬되지 않았습니다':mode==='live'?running?countdown?'준비하세요. 잠시 후 시작합니다':'붉은색 가이드에 팔과 손 모양을 맞춰 주세요':'자세를 확인한 뒤 연습 시작을 눌러 주세요':'어깨와 양손이 화면에 들어오도록 서 주세요';requestAnimationFrame(tick);
}
$('start').onclick=start;
$('retry-tracking').onclick=()=>{if(stream)connectTracker()};
$('stop').onclick=()=>{stop();notify('연결을 종료했습니다. 카메라는 꺼져 있습니다.')};
$('demo').onclick=()=>{stop();mode='demo';demoCompleted.clear();controls();updatePose();notify('가상 데이터로 표시되는 데모입니다. 연습 시작을 누르면 자동 진행을 확인할 수 있어요.')};
$('play').onclick=()=>{running=!running;hold=0;if(running){const done=mode==='demo'?demoCompleted:completed;if(done.size===POSES.length){done.clear();updatePose()}countdown=3;$('countdown').hidden=false;notify(mode==='demo'?'데모 루틴을 재생합니다. 점수는 가상 데이터입니다.':'3초 뒤 시작합니다. 목표 자세를 50% 이상으로 3초 유지해 보세요.')}else{countdown=0;$('countdown').hidden=true;notify('일시 정지했습니다. 카메라 추적은 계속되며 유지 시간은 누적하지 않습니다.')}controls()};
$('reset').onclick=()=>{hold=0;elapsed=0;countdown=running?3:0;notify('현재 동작의 유지 시간과 연습 타이머를 초기화했습니다.')};
$('previous').onclick=()=>choose(selected-1);$('next').onclick=()=>choose(selected+1);
$('help').onclick=()=>$('guide').showModal();$('close-help').onclick=()=>$('guide').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden){running=false;countdown=hold=0;$('countdown').hidden=true;controls()}});
window.addEventListener('pagehide',stop);updatePose();controls();requestAnimationFrame(tick);

document.addEventListener('judo-exit',stop);
document.addEventListener('judo-lesson',()=>{stop();completed.clear();demoCompleted.clear();selected=0;updatePose();notify('선택한 기술의 그립 방향을 확인하며 손 위치를 연습하세요.');});
